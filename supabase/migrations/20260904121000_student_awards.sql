-- Awards tracking: Dancer of the Term and Most Improved, one per class per
-- term. The studio needs the history — who has already had which award, in
-- which class and when — so the same dancers aren't picked year after year as
-- children move between classes.

create table if not exists public.student_awards (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete cascade,
  class_id uuid references public.classes(id) on delete set null,
  term_id uuid references public.school_terms(id) on delete set null,
  -- Snapshots so the record still reads correctly after a class is renamed or
  -- a term row is tidied away.
  class_name text,
  term_label text not null,
  award_type text not null check (award_type in ('dancer_of_term', 'most_improved')),
  notes text,
  awarded_on date not null default current_date,
  awarded_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- One winner of each award per class per term: awarding it again replaces the
-- previous choice rather than quietly recording two.
create unique index if not exists student_awards_one_per_class_term
  on public.student_awards (award_type, term_label, coalesce(class_id, '00000000-0000-0000-0000-000000000000'::uuid));

create index if not exists student_awards_student_idx on public.student_awards (student_id, awarded_on desc);
create index if not exists student_awards_class_idx on public.student_awards (class_id);

alter table public.student_awards enable row level security;

do $$ begin
  create policy "Admins manage awards" on public.student_awards
    for all
    using (has_role(auth.uid(), 'admin'::app_role))
    with check (has_role(auth.uid(), 'admin'::app_role));
exception when duplicate_object then null; end $$;

-- Teachers see and record awards for the classes they actually teach.
do $$ begin
  create policy "Staff view awards for own classes" on public.student_awards
    for select
    using (
      exists (
        select 1 from public.bookings b
        where b.student_id = student_awards.student_id
          and staff_teaches_class(get_staff_id_for_user(auth.uid()), b.class_id)
      )
    );
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "Staff record awards for own classes" on public.student_awards
    for insert
    with check (staff_teaches_class(get_staff_id_for_user(auth.uid()), class_id));
exception when duplicate_object then null; end $$;

-- Parents see their own child's achievements.
do $$ begin
  create policy "Parents view own children's awards" on public.student_awards
    for select
    using (
      exists (
        select 1 from public.students s
        where s.id = student_awards.student_id
          and s.parent_id = auth.uid()
      )
    );
exception when duplicate_object then null; end $$;

drop trigger if exists update_student_awards_updated_at on public.student_awards;
create trigger update_student_awards_updated_at
  before update on public.student_awards
  for each row execute function public.update_updated_at_column();
