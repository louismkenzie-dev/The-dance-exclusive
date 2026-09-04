-- Bulk emails: one record per send, so the studio can see what went out, to
-- whom and when, and nobody has to guess whether a message was actually sent.

create table if not exists public.email_broadcasts (
  id uuid primary key default gen_random_uuid(),
  subject text not null,
  body text not null,
  audience jsonb not null default '{}'::jsonb,
  audience_label text,
  sent_by uuid,
  recipient_count integer not null default 0,
  failed_count integer not null default 0,
  status text not null default 'sending' check (status in ('sending', 'sent', 'failed')),
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create table if not exists public.email_broadcast_recipients (
  id uuid primary key default gen_random_uuid(),
  broadcast_id uuid not null references public.email_broadcasts(id) on delete cascade,
  email text not null,
  name text,
  user_id uuid,
  status text not null default 'sent' check (status in ('sent', 'failed')),
  error text,
  created_at timestamptz not null default now()
);

create index if not exists email_broadcasts_created_idx on public.email_broadcasts (created_at desc);
create index if not exists email_broadcast_recipients_broadcast_idx
  on public.email_broadcast_recipients (broadcast_id);

alter table public.email_broadcasts enable row level security;
alter table public.email_broadcast_recipients enable row level security;

do $$ begin
  create policy "Admins manage broadcasts" on public.email_broadcasts
    for all
    using (has_role(auth.uid(), 'admin'::app_role))
    with check (has_role(auth.uid(), 'admin'::app_role));
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "Admins manage broadcast recipients" on public.email_broadcast_recipients
    for all
    using (has_role(auth.uid(), 'admin'::app_role))
    with check (has_role(auth.uid(), 'admin'::app_role));
exception when duplicate_object then null; end $$;
