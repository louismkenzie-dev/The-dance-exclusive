-- Launch updates (22 July 2026): sibling discounts, WhatsApp group links,
-- holiday-workshop (camp) basket support, adult class passes, coupon camp scope.

-- 1) Sibling discount opt-in per class / holiday workshop (camp).
--    Children's products default ON; the automatic 10% second-child discount
--    only ever applies to children's items, so the flag on adult classes is inert.
ALTER TABLE public.classes ADD COLUMN IF NOT EXISTS sibling_discount_enabled boolean NOT NULL DEFAULT true;
ALTER TABLE public.camps ADD COLUMN IF NOT EXISTS sibling_discount_enabled boolean NOT NULL DEFAULT true;

-- 2) WhatsApp parent group chat link per class.
ALTER TABLE public.classes ADD COLUMN IF NOT EXISTS whatsapp_group_url text;

-- 3) Basket can hold holiday workshops (camps) and adult class passes,
--    not just classes.
ALTER TABLE public.cart_items ALTER COLUMN class_id DROP NOT NULL;
ALTER TABLE public.cart_items ADD COLUMN IF NOT EXISTS camp_id uuid REFERENCES public.camps(id) ON DELETE CASCADE;
ALTER TABLE public.cart_items ADD COLUMN IF NOT EXISTS item_kind text NOT NULL DEFAULT 'class';
ALTER TABLE public.cart_items ADD COLUMN IF NOT EXISTS pass_type text;
DO $$ BEGIN
  ALTER TABLE public.cart_items ADD CONSTRAINT cart_items_kind_valid
    CHECK (item_kind IN ('class', 'camp', 'pass')) NOT VALID;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE public.cart_items ADD CONSTRAINT cart_items_kind_target
    CHECK (
      (item_kind = 'class' AND class_id IS NOT NULL)
      OR (item_kind = 'camp' AND camp_id IS NOT NULL)
      OR (item_kind = 'pass')
    ) NOT VALID;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 4) Bookings can reference a camp (holiday workshop) instead of a class.
ALTER TABLE public.bookings ALTER COLUMN class_id DROP NOT NULL;
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS camp_id uuid REFERENCES public.camps(id) ON DELETE SET NULL;
DO $$ BEGIN
  ALTER TABLE public.bookings ADD CONSTRAINT bookings_target_present
    CHECK (class_id IS NOT NULL OR camp_id IS NOT NULL) NOT VALID;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 5) Adult multi-class passes (2 in a calendar week / 4, 6, 8 within 6 weeks).
CREATE TABLE IF NOT EXISTS public.class_passes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  student_id uuid REFERENCES public.students(id) ON DELETE SET NULL,
  pass_type text NOT NULL CHECK (pass_type IN ('week_2', 'pack_4', 'pack_6', 'pack_8')),
  sessions_total integer NOT NULL CHECK (sessions_total > 0),
  sessions_remaining integer NOT NULL CHECK (sessions_remaining >= 0),
  amount_paid numeric(10,2) NOT NULL DEFAULT 0,
  purchased_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  payment_intent_id text,
  cart_item_ref text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS class_passes_pi_item_unique
  ON public.class_passes (payment_intent_id, cart_item_ref)
  WHERE payment_intent_id IS NOT NULL;
ALTER TABLE public.class_passes ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "Users can view their own passes" ON public.class_passes
    FOR SELECT USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "Admins can manage passes" ON public.class_passes
    FOR ALL USING (public.has_role(auth.uid(), 'admin'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 6) Coupons: restricted to holiday workshops (camps); optional per-camp scoping.
ALTER TABLE public.coupons ADD COLUMN IF NOT EXISTS applies_to_camp_ids uuid[] DEFAULT NULL;
