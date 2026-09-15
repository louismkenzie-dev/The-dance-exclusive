-- Amie: "Do we know the emails are going through 100%? ... How do we
-- showcase the emails have been delivered and opened?"
--
-- Until now we couldn't, because nothing was kept. send-email posted to
-- Resend, logged the returned id to the console and threw it away, so an
-- email that bounced, or was never opened, looked exactly like one that
-- landed. The studio was reading a 15% trial conversion with no way to tell
-- whether the ask had reached anybody.
--
-- Two records. What we sent, and what happened to it afterwards; and every
-- time a trialist was chased, by whoever chased them, however they did it.

-- ── What we sent ──────────────────────────────────────────────────────────
create table if not exists public.email_log (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  template text not null,
  to_email text not null,
  subject text,
  -- Resend's own id. The join key for everything the webhook tells us later.
  provider_id text,
  -- sent  → Resend accepted it. That is NOT delivery.
  -- The rest arrive from the provider afterwards, via resend-webhook.
  status text not null default 'sent'
    check (status in ('sent','delivered','opened','clicked','bounced','complained','failed')),
  delivered_at timestamptz,
  opened_at timestamptz,
  clicked_at timestamptz,
  failed_at timestamptz,
  -- Why it failed: our error, or the provider's bounce reason.
  error text,
  -- Who it was about, so a card can show its own history without guessing.
  -- parent_id and sent_by are plain uuids, as bookings.parent_id is: this
  -- schema does not foreign-key onto auth.users anywhere.
  parent_id uuid,
  student_id uuid references public.students(id) on delete set null,
  booking_id uuid references public.bookings(id) on delete set null,
  class_id uuid references public.classes(id) on delete set null,
  -- Null when a cron sent it; the admin's id when a person pressed a button.
  sent_by uuid,
  source text not null default 'auto' check (source in ('auto','manual'))
);

-- The webhook arrives knowing only Resend's id, so that lookup must be quick.
create unique index if not exists email_log_provider_id_key
  on public.email_log (provider_id) where provider_id is not null;
create index if not exists email_log_booking_id_idx on public.email_log (booking_id);
create index if not exists email_log_to_email_idx on public.email_log (lower(to_email));
create index if not exists email_log_created_at_idx on public.email_log (created_at desc);

alter table public.email_log enable row level security;

drop policy if exists "Admins can view the email log" on public.email_log;
create policy "Admins can view the email log"
  on public.email_log for select
  using (public.has_role(auth.uid(), 'admin'::app_role));

-- Writes come only from send-email and resend-webhook (service role).

-- ── Every time a trialist was chased ──────────────────────────────────────
-- Louis: "We should also record when a trialist was chased. Time and date,
-- email being sent, etc. So there's a record."
--
-- Separate from email_log because a chase is not always an email. Amie
-- picking up the phone is a chase, and the next person to look at that
-- family needs to know it happened before they send a fourth message.
create table if not exists public.trial_chases (
  id uuid primary key default gen_random_uuid(),
  chased_at timestamptz not null default now(),
  booking_id uuid not null references public.bookings(id) on delete cascade,
  parent_id uuid,
  student_id uuid references public.students(id) on delete set null,
  method text not null check (method in ('email','whatsapp','call','copy')),
  -- Null for a phone call; set when the chase was an email we sent.
  email_log_id uuid references public.email_log(id) on delete set null,
  chased_by uuid,
  note text
);

create index if not exists trial_chases_booking_id_idx
  on public.trial_chases (booking_id, chased_at desc);

alter table public.trial_chases enable row level security;

drop policy if exists "Admins can view trial chases" on public.trial_chases;
create policy "Admins can view trial chases"
  on public.trial_chases for select
  using (public.has_role(auth.uid(), 'admin'::app_role));

-- Tapping WhatsApp or Call records itself from the browser, so admins need
-- to be able to write those. The email chases are written by chase-trials
-- under the service role, which bypasses this.
drop policy if exists "Admins can record a chase" on public.trial_chases;
create policy "Admins can record a chase"
  on public.trial_chases for insert
  with check (public.has_role(auth.uid(), 'admin'::app_role));
