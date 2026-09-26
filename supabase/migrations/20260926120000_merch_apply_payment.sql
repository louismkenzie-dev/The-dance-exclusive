-- Turning a paid merchandise PaymentIntent into a fulfilled order, exactly once.
--
-- Two things call this by design: the Stripe webhook, and the client polling fallback for when
-- the webhook does not arrive. Both may run at the same moment, and Stripe may replay a webhook
-- days later. So the whole transition — mark paid, move the lines, take the stock — lives in one
-- function behind one row lock, and says plainly whether it did the work or someone else already
-- had.
--
-- Stock only moves for items Amie actually holds. Hoodies are printed to order and have no stock
-- to take. Where stock does move it is a single atomic UPDATE, never a read-then-write, and it is
-- allowed to go negative: in a print-to-order business "you owe two more" is the fact that
-- matters, and clamping at zero destroys it. The shortfall comes back so the caller can shout.

create or replace function public.apply_merch_order_payment(
  _order_id uuid,
  _payment_intent_id text default null,
  _amount_pence integer default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  _order public.merch_orders%rowtype;
  _shortfall jsonb := '[]'::jsonb;
  _row record;
begin
  -- The lock that makes the webhook and the poller safe to run together.
  select * into _order from public.merch_orders where id = _order_id for update;

  if not found then
    return jsonb_build_object('applied', false, 'reason', 'not_found');
  end if;

  -- Already done. Not an error: a replayed webhook is expected.
  if _order.stock_applied_at is not null then
    return jsonb_build_object(
      'applied', false,
      'reason', 'already_applied',
      'order_id', _order_id,
      'order_number', _order.order_number
    );
  end if;

  -- Take the stock for items that have any, in one statement per variant.
  for _row in
    update public.merchandise_variants v
       set stock_quantity = v.stock_quantity - need.qty
      from (
             select oi.variant_id, sum(oi.quantity)::int as qty
               from public.merch_order_items oi
              where oi.order_id = _order_id
                and oi.variant_id is not null
                and oi.status = 'pending'
              group by oi.variant_id
           ) need,
           public.merchandise_items mi
     where v.id = need.variant_id
       and mi.id = v.item_id
       and mi.tracks_stock
    returning v.id as variant_id, v.size, v.stock_quantity, mi.name as product_name
  loop
    if _row.stock_quantity < 0 then
      _shortfall := _shortfall || jsonb_build_object(
        'variant_id', _row.variant_id,
        'product_name', _row.product_name,
        'size', _row.size,
        'owed', abs(_row.stock_quantity)
      );
    end if;
  end loop;

  -- Move the lines. The rollup trigger sets the order's status from these.
  update public.merch_order_items
     set status = 'paid'
   where order_id = _order_id
     and status = 'pending';

  -- Stamps only: status is the trigger's business.
  update public.merch_orders
     set paid_at = coalesce(paid_at, now()),
         stock_applied_at = now(),
         stripe_payment_intent_id = coalesce(stripe_payment_intent_id, _payment_intent_id),
         total_pence = coalesce(_amount_pence, total_pence),
         updated_at = now()
   where id = _order_id;

  return jsonb_build_object(
    'applied', true,
    'order_id', _order_id,
    'order_number', _order.order_number,
    'shortfall', _shortfall
  );
end;
$$;

comment on function public.apply_merch_order_payment(uuid, text, integer) is
  'Idempotent: marks a merchandise order paid and takes stock once, however many times it is called.';

-- ---------------------------------------------------------------- status moves

-- Admin-only status changes, with the same transition rules the client enforces
-- (src/lib/merchStatus.ts). Returns the ids it actually moved, so a double-tap is a no-op rather
-- than an error.
create or replace function public.set_merch_item_status(_item_ids uuid[], _status text)
returns setof uuid
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.has_role(auth.uid(), 'admin') then
    raise exception 'Not authorised';
  end if;

  return query
  update public.merch_order_items i
     set status = _status,
         sent_to_print_at = case when _status = 'sent_to_print' then now() else i.sent_to_print_at end,
         ready_at         = case when _status = 'ready'         then now() else i.ready_at end,
         collected_at     = case when _status = 'collected'     then now() else i.collected_at end
   where i.id = any(_item_ids)
     and i.status <> _status
     and (
       -- the happy path, one step at a time
       (i.status = 'pending'       and _status in ('paid', 'expired', 'cancelled'))
       or (i.status = 'paid'          and _status in ('sent_to_print', 'cancelled', 'refunded'))
       or (i.status = 'sent_to_print' and _status in ('ready', 'cancelled', 'refunded'))
       or (i.status = 'ready'         and _status in ('collected', 'cancelled', 'refunded'))
       or (i.status = 'collected'     and _status = 'refunded')
     )
  returning i.id;
end;
$$;

-- ---------------------------------------------------------------- collection

-- Toggle a hand-over. A mis-tap on a register has to be undoable, so this flips rather than sets,
-- and returns only the ids it moved.
create or replace function public.set_merch_collected(
  _item_ids uuid[],
  _collected boolean,
  _session_id uuid default null
)
returns setof uuid
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Staff take registers, so staff can hand merchandise over. Authorisation is inside the
  -- statement, not a separate check that could be forgotten.
  if not (public.has_role(auth.uid(), 'admin') or public.has_role(auth.uid(), 'staff')) then
    raise exception 'Not authorised';
  end if;

  return query
  update public.merch_order_items i
     set status = case when _collected then 'collected' else 'ready' end,
         collected_at = case when _collected then now() else null end,
         collected_by = case when _collected then auth.uid() else null end,
         collected_session_id = case when _collected then _session_id else null end
   where i.id = any(_item_ids)
     and i.status = case when _collected then 'ready' else 'collected' end
  returning i.id;
end;
$$;

comment on function public.set_merch_collected(uuid[], boolean, uuid) is
  'Toggles a line between ready and collected. Returns only the ids it moved, so a double-tap does nothing.';
