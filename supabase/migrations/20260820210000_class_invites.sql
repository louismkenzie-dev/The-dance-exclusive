-- One-to-one session invites: Amie creates a private (invite_only) class
-- with a single session and invites a specific child — the parent books and
-- pays for it in the portal. The invite is what unlocks checkout for an
-- invite-only class.
create table if not exists public.class_invites (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.classes(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  parent_id uuid not null,
  invited_by uuid,
  price numeric not null,
  status text not null default 'pending' check (status in ('pending','cancelled')),
  created_at timestamptz not null default now()
);

alter table public.class_invites enable row level security;

create policy "Parents can view their own invites"
  on public.class_invites for select
  using (parent_id = auth.uid());

create policy "Admins can manage invites"
  on public.class_invites for all
  using (public.has_role(auth.uid(), 'admin'::app_role))
  with check (public.has_role(auth.uid(), 'admin'::app_role));
