-- Studio-made class passes (class_pass_types) have their own codes, so the
-- old CHECK pinning class_passes.pass_type to the four built-in codes blocked
-- every custom pass — for admins adding one by hand AND for fulfilment after
-- a parent had paid. Keep only a "not blank" rule; the catalogue is the
-- source of truth for which codes exist.
-- (Applied to the live project on 2026-09-02; filed here for the record.)
alter table public.class_passes drop constraint if exists class_passes_pass_type_check;
alter table public.class_passes
  add constraint class_passes_pass_type_not_blank check (length(btrim(pass_type)) > 0);
