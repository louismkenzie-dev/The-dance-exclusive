-- Franchises: who owns which venues.
--
-- Amie asked "how much has each franchise earned this month?" and the system could not answer,
-- because it had no idea what a franchise was — fifteen venues from Chelmsford to Harrow with
-- nothing grouping them.
--
-- A franchise is a FRANCHISEE, not a territory: Ella holds two (Chelmsford and Wickford). Amie's
-- own venues sit under an explicit head-office row rather than being left null, so that null means
-- exactly one thing — a venue nobody has categorised yet — and the reports can flag it instead of
-- quietly counting it as Amie's.

create table if not exists public.franchises (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  franchisee_name text,
  is_head_office boolean not null default false,
  is_active boolean not null default true,
  created_at timestamp with time zone not null default now()
);

-- Only one head office.
create unique index if not exists franchises_one_head_office
  on public.franchises (is_head_office) where is_head_office;

alter table public.venues
  add column if not exists franchise_id uuid references public.franchises(id) on delete set null;

create index if not exists venues_franchise_idx on public.venues (franchise_id);

-- Admin only. Staff and parents have no business knowing who owns which hall, and the franchise is
-- the unit money is reported by, so it sits behind the same wall as the money.
alter table public.franchises enable row level security;

drop policy if exists "Admins manage franchises" on public.franchises;
create policy "Admins manage franchises"
  on public.franchises for all to authenticated
  using (public.has_role(auth.uid(), 'admin'))
  with check (public.has_role(auth.uid(), 'admin'));

-- ---------------------------------------------------------------- seed (Amie, 30 Sep)
--
-- Keyed by venue id, not name: names are free text and one of these contains a slash.
-- Fixed ids for the franchise rows so re-running this is harmless.

insert into public.franchises (id, name, franchisee_name, is_head_office) values
  ('f0000000-0000-4000-8000-000000000001', 'The Dance Exclusive', 'Amie Whitaker', true),
  ('f0000000-0000-4000-8000-000000000002', 'Chelmsford & Wickford', 'Ella', false),
  ('f0000000-0000-4000-8000-000000000003', 'Clacton', 'Brad', false),
  ('f0000000-0000-4000-8000-000000000004', 'Harrow', 'Boo', false)
on conflict (id) do nothing;

update public.venues set franchise_id = 'f0000000-0000-4000-8000-000000000002'
 where id in ('c7f5844a-749b-4246-8144-fe8f3b043744',   -- Coval Lane Studios / Chelmsford Theatre
              '4c572770-df73-48e1-aa9c-14360b534309');  -- The Nevendon Centre, Wickford
update public.venues set franchise_id = 'f0000000-0000-4000-8000-000000000003'
 where id = '72082795-ed10-487a-824c-6aa64f181e4c';     -- Clacton County High School
update public.venues set franchise_id = 'f0000000-0000-4000-8000-000000000004'
 where id = '5b04a1a3-fe3f-442b-a287-b3feca33c801';     -- Harrow Arts Centre

-- Everything else is Amie's own. That is the reading of her answer — she listed the franchise
-- venues and nothing else — and it is reassignable on the Venues page if it is wrong. Inactive
-- venues included: their historic revenue was still hers.
update public.venues set franchise_id = 'f0000000-0000-4000-8000-000000000001'
 where franchise_id is null;

comment on column public.venues.franchise_id is
  'Which franchise owns this venue. Null means nobody has categorised it yet, and the reports flag it.';
