-- ============================================================================
-- September 2026 venue & weekly timetable import
-- Source: confirmed WhatsApp updates, 8–16 July 2026 (see docs/VENUE_UPDATES_2026.md)
--
-- IDEMPOTENT: venues match on slug, classes match on
-- (venue, name, day_of_week, start_time). Safe to re-run.
--
-- Deliberate decisions (do not "fix" without project-owner sign-off):
--   * booking_enabled = false on every imported class: prices, capacities and
--     instructors are not yet confirmed (blocker Q19). Admins enable booking
--     per class once pricing is set.
--   * Invite-only classes (SURGE Crew, NEXUS O17, VELOCITY 16+U) are visible
--     but never bookable (blocker Q18 decides final UX).
--   * NEXUS O17 (Wed 19:45–20:00) is imported as a hidden DRAFT — the
--     15-minute duration is unconfirmed (blocker Q3).
--   * "Coval Lane Studios / Chelmsford Theatre" is a hidden PROVISIONAL venue
--     (blocker Q9). Only its two well-formed rows are imported, as hidden
--     provisional records. The Mini Street row (no end time, Q10) and the
--     Mixed Street row (18:45–18:45 zero duration, Q11) are NOT imported.
--   * Addresses/postcodes are not fabricated: unknown ones are left empty
--     (blocker Q15). Harrow is imported as confirmed per the later timetable
--     message, pending explicit sign-off (blocker Q8).
--   * SURGE Crew (16:45–17:45) and Mini Street (17:00–17:45) overlap at
--     Kelvedon; both are preserved as supplied (blocker Q7).
--   * "White Court School" and "White Court School, Braintree" are kept as
--     ONE venue record pending address confirmation (blocker Q2).
-- ============================================================================

BEGIN;

-- ---------- Venues ----------
WITH new_venues (slug, name, city, county, status, publicly_visible, short_description) AS (
  VALUES
    ('clacton-county-high-school',      'Clacton County High School',        'Clacton-on-Sea', 'Essex',          'confirmed',   true,  'High-energy hip hop nights on the Essex coast — beginner to adult.'),
    ('kelvedon-institute',              'Kelvedon Institute',                'Kelvedon',       'Essex',          'confirmed',   true,  'Our Kelvedon home — street, hip hop and adult commercial through the week.'),
    ('thaxted-bolford-hall',            'Bolford Hall, Thaxted',             'Thaxted',        'Essex',          'confirmed',   true,  'Tuesday street classes for minis and mixed ages in Thaxted.'),
    ('braintree-sport-and-health-club', 'Braintree Sport and Health Club',   'Braintree',      'Essex',          'confirmed',   true,  'From Mini Street to Adult Heels — a full Tuesday of classes in Braintree.'),
    ('wickford-nevendon-centre',        'The Nevendon Centre, Wickford',     'Wickford',       'Essex',          'confirmed',   true,  'Street, lyrical and adult commercial every Tuesday in Wickford.'),
    ('chatham-holcombe-grammar-school', 'Holcombe Grammar School, Chatham',  'Chatham',        'Kent',           'confirmed',   true,  'Our Kent venue — minis to seniors plus competition team training.'),
    ('drapers-maylands-primary-school', 'Drapers Maylands Primary School',   'Romford',        'Greater London', 'confirmed',   true,  'After-school street dance and competition training in Romford.'),
    ('white-court-school-braintree',    'White Court School, Braintree',     'Braintree',      'Essex',          'confirmed',   true,  'School-year street dance and performing arts at White Court School.'),
    ('white-notley-village-hall',       'White Notley Village Hall',         'White Notley',   'Essex',          'confirmed',   true,  'Thursday nights in White Notley — hip hop, lyrical, street styles and crews.'),
    ('harrow-arts-centre',              'Harrow Arts Centre',                'Harrow',         'Greater London', 'confirmed',   true,  'Junior, senior and adult hip hop every Thursday at Harrow Arts Centre.'),
    ('beaulieu-community-centre',       'Beaulieu Community Centre',         'Chelmsford',     'Essex',          'confirmed',   true,  'Friday Mini Street sessions for ages 3–7 in Beaulieu.'),
    ('coval-lane-chelmsford-theatre',   'Coval Lane Studios / Chelmsford Theatre', 'Chelmsford', 'Essex',        'provisional', false, 'Provisional Monday venue — name, address and schedule awaiting confirmation.')
)
INSERT INTO public.venues (slug, name, city, county, status, publicly_visible, short_description, address_line1, postcode, is_active)
SELECT nv.slug, nv.name, nv.city, nv.county, nv.status, nv.publicly_visible, nv.short_description, '', '',
       nv.status <> 'provisional'
FROM new_venues nv
WHERE NOT EXISTS (SELECT 1 FROM public.venues v WHERE v.slug = nv.slug);

-- ---------- Classes ----------
-- audience columns: age_min/age_max where the source gives a true age range,
-- school_year_min/max for school-year bands, audience_label always set to the
-- human-readable label exactly as it should display.
WITH t (venue_slug, name, day_of_week, start_time, end_time, class_type,
        age_min, age_max, school_year_min, school_year_max, audience_label,
        ability_level, invite_only, status, publicly_visible) AS (
  VALUES
  -- Monday — Clacton County High School (confirmed)
  ('clacton-county-high-school', 'Beginner Hip Hop',    'monday', '17:30', '18:30', 'children', 8, 16, NULL, NULL, 'Ages 8–16', 'Beginner',   false, 'confirmed', true),
  ('clacton-county-high-school', 'Hip Hop Freestyle',   'monday', '18:30', '19:30', 'children', 8, 16, NULL, NULL, 'Ages 8–16', NULL,         false, 'confirmed', true),
  ('clacton-county-high-school', 'Adult Hip Hop',       'monday', '19:30', '20:30', 'adult', NULL, NULL, NULL, NULL, 'Adults',   'All Levels', false, 'confirmed', true),
  -- Monday — Kelvedon Institute (confirmed; SURGE/Mini Street overlap preserved, Q7)
  ('kelvedon-institute', 'SURGE Crew',                  'monday', '16:45', '17:45', 'children', NULL, NULL, NULL, NULL, 'Invite only', NULL,  true,  'confirmed', true),
  ('kelvedon-institute', 'Mini Street',                 'monday', '17:00', '17:45', 'children', 3, 7,  NULL, NULL, 'Ages 3–7',  NULL,         false, 'confirmed', true),
  ('kelvedon-institute', 'Junior Hip Hop',              'monday', '17:45', '18:45', 'children', 8, 12, NULL, NULL, 'Ages 8–12', NULL,         false, 'confirmed', true),
  ('kelvedon-institute', 'Senior Hip Hop',              'monday', '18:45', '19:45', 'children', 13, 18, NULL, NULL, 'Ages 13–18', NULL,       false, 'confirmed', true),
  ('kelvedon-institute', 'Adult Commercial / Hip Hop',  'monday', '19:45', '21:00', 'adult', NULL, NULL, NULL, NULL, 'Adults',   'All Levels', false, 'confirmed', true),
  -- Tuesday — Bolford Hall, Thaxted (schedule confirmed; venue spelling Q1)
  ('thaxted-bolford-hall', 'Mini Street',               'tuesday', '17:00', '17:45', 'children', 3, 7,  NULL, NULL, 'Ages 3–7',  NULL,        false, 'confirmed', true),
  ('thaxted-bolford-hall', 'Mixed Street',              'tuesday', '17:45', '18:45', 'children', 8, 16, NULL, NULL, 'Ages 8–16', NULL,        false, 'confirmed', true),
  -- Tuesday — Braintree Sport and Health Club (confirmed)
  ('braintree-sport-and-health-club', 'Mini Street',    'tuesday', '17:00', '17:45', 'children', 3, 7,  NULL, NULL, 'Ages 3–7',  NULL,        false, 'confirmed', true),
  ('braintree-sport-and-health-club', 'Junior Hip Hop', 'tuesday', '17:45', '18:45', 'children', 8, 12, NULL, NULL, 'Ages 8–12', NULL,        false, 'confirmed', true),
  ('braintree-sport-and-health-club', 'Senior Hip Hop', 'tuesday', '18:45', '19:45', 'children', 13, 18, NULL, NULL, 'Ages 13–18', NULL,      false, 'confirmed', true),
  ('braintree-sport-and-health-club', 'Adult Heels',    'tuesday', '19:45', '21:00', 'adult', NULL, NULL, NULL, NULL, 'Adults',   'All Levels', false, 'confirmed', true),
  -- Tuesday — The Nevendon Centre, Wickford (confirmed)
  ('wickford-nevendon-centre', 'Mini Street',           'tuesday', '17:00', '17:45', 'children', 3, 7,  NULL, NULL, 'Ages 3–7',  NULL,        false, 'confirmed', true),
  ('wickford-nevendon-centre', 'Mixed Street',          'tuesday', '17:45', '18:45', 'children', 8, 16, NULL, NULL, 'Ages 8–16', NULL,        false, 'confirmed', true),
  ('wickford-nevendon-centre', 'Mixed Lyrical',         'tuesday', '18:45', '19:45', 'children', 8, 16, NULL, NULL, 'Ages 8–16', NULL,        false, 'confirmed', true),
  ('wickford-nevendon-centre', 'Adult Commercial / Heels', 'tuesday', '19:45', '20:45', 'adult', NULL, NULL, NULL, NULL, 'Adults', 'All Levels', false, 'confirmed', true),
  -- Tuesday — Holcombe Grammar School, Chatham (confirmed)
  ('chatham-holcombe-grammar-school', 'Mini Street',    'tuesday', '17:00', '17:45', 'children', 5, 7,  NULL, NULL, 'Ages 5–7',  NULL,        false, 'confirmed', true),
  ('chatham-holcombe-grammar-school', 'Junior Hip Hop', 'tuesday', '17:45', '18:45', 'children', 8, 12, NULL, NULL, 'Ages 8–12', NULL,        false, 'confirmed', true),
  ('chatham-holcombe-grammar-school', 'Mixed Competition Team Training', 'tuesday', '18:45', '19:45', 'children', 8, 16, NULL, NULL, 'Ages 8–16', NULL, false, 'confirmed', true),
  ('chatham-holcombe-grammar-school', 'Senior Hip Hop', 'tuesday', '19:45', '20:45', 'children', 13, 18, NULL, NULL, 'Ages 13–18', NULL,      false, 'confirmed', true),
  -- Tuesday — Drapers Maylands Primary School, Romford (confirmed)
  ('drapers-maylands-primary-school', 'Mini Street',    'tuesday', '15:15', '16:15', 'children', 4, 7,  NULL, NULL, 'Ages 4–7',  NULL,        false, 'confirmed', true),
  ('drapers-maylands-primary-school', 'Mixed Street',   'tuesday', '16:15', '17:15', 'children', 8, 16, NULL, NULL, 'Ages 8–16', NULL,        false, 'confirmed', true),
  ('drapers-maylands-primary-school', 'Mixed Competition Team Training', 'tuesday', '17:15', '18:00', 'children', 8, 16, NULL, NULL, 'Ages 8–16', NULL, false, 'confirmed', true),
  -- Tuesday — White Court School, Braintree (confirmed)
  ('white-court-school-braintree', 'Street Dance',      'tuesday', '08:00', '08:45', 'children', NULL, NULL, 2, 6, 'Year 2–Year 6', NULL,     false, 'confirmed', true),
  -- Wednesday — White Court School (same venue record pending Q2)
  ('white-court-school-braintree', 'Performing Arts',   'wednesday', '15:15', '16:15', 'children', NULL, NULL, 2, 6, 'Year 2–Year 6', NULL,   false, 'confirmed', true),
  -- Wednesday — Kelvedon Institute (confirmed; NEXUS kept as hidden draft, Q3/Q4)
  ('kelvedon-institute', 'Mini Street',                 'wednesday', '17:00', '17:45', 'children', 3, 7,  NULL, NULL, 'Ages 3–7',  NULL,          false, 'confirmed', true),
  ('kelvedon-institute', 'Intermediate Hip Hop',        'wednesday', '17:45', '18:45', 'children', 8, 16, NULL, NULL, 'Ages 8–16', 'Intermediate', false, 'confirmed', true),
  ('kelvedon-institute', 'Mixed Competition Team Training', 'wednesday', '18:45', '19:45', 'children', 8, 16, NULL, NULL, 'Ages 8–16', NULL,      false, 'confirmed', true),
  ('kelvedon-institute', 'NEXUS O17 Crew Training',     'wednesday', '19:45', '20:00', 'adult', NULL, NULL, NULL, NULL, 'O17',      NULL,          true,  'draft',     false),
  -- Thursday — White Notley Village Hall (confirmed; VELOCITY invite only, Q5)
  ('white-notley-village-hall', 'Junior Hip Hop',       'thursday', '16:30', '17:30', 'children', 7, 12, NULL, NULL, 'Ages 7–12', NULL,       false, 'confirmed', true),
  ('white-notley-village-hall', 'Mixed Lyrical',        'thursday', '17:30', '18:15', 'children', 8, 16, NULL, NULL, 'Ages 8–16', NULL,       false, 'confirmed', true),
  ('white-notley-village-hall', 'Mixed Street Styles (Popping / Locking / Breaking)', 'thursday', '18:15', '19:00', 'children', 8, 16, NULL, NULL, 'Ages 8–16', NULL, false, 'confirmed', true),
  ('white-notley-village-hall', 'Senior Hip Hop',       'thursday', '19:00', '20:00', 'children', 13, 18, NULL, NULL, 'Ages 13–18', NULL,     false, 'confirmed', true),
  ('white-notley-village-hall', 'VELOCITY 16+U Crew',   'thursday', '20:00', '21:00', 'children', NULL, NULL, NULL, NULL, '16+U',  NULL,      true,  'confirmed', true),
  -- Thursday — Harrow Arts Centre (imported as confirmed per later message; Q8)
  ('harrow-arts-centre', 'Junior Hip Hop',              'thursday', '17:45', '18:40', 'children', 7, 12, NULL, NULL, 'Ages 7–12', NULL,       false, 'confirmed', true),
  ('harrow-arts-centre', 'Senior Hip Hop',              'thursday', '18:45', '19:45', 'children', 13, 18, NULL, NULL, 'Ages 13–18', NULL,     false, 'confirmed', true),
  ('harrow-arts-centre', 'Adult Hip Hop',               'thursday', '19:45', '20:45', 'adult', NULL, NULL, NULL, NULL, 'Adults',   NULL,      false, 'confirmed', true),
  -- Friday — Beaulieu Community Centre (confirmed)
  ('beaulieu-community-centre', 'Mini Street',          'friday', '16:30', '17:15', 'children', 3, 7,  NULL, NULL, 'Ages 3–7',  NULL,         false, 'confirmed', true),
  -- Monday — Coval Lane / Chelmsford Theatre (PROVISIONAL, hidden; Q9)
  -- Q10 (Mini Street, no end time) and Q11 (Mixed Street 18:45–18:45) are NOT imported.
  ('coval-lane-chelmsford-theatre', 'Mixed Lyrical',    'monday', '18:45', '19:45', 'children', 8, 16, NULL, NULL, 'Ages 8–16', NULL,         false, 'provisional', false),
  ('coval-lane-chelmsford-theatre', 'Adult Commercial / Heels', 'monday', '19:45', '21:00', 'adult', NULL, NULL, NULL, NULL, 'Adults', 'All Levels', false, 'provisional', false)
)
INSERT INTO public.classes
  (venue_id, name, day_of_week, days_of_week, start_time, end_time, class_type,
   age_min, age_max, school_year_min, school_year_max, audience_label,
   ability_level, invite_only, status, publicly_visible,
   booking_enabled, is_active, capacity)
SELECT
  v.id, t.name, t.day_of_week::public.day_of_week, ARRAY[t.day_of_week],
  t.start_time::time, t.end_time::time, t.class_type::public.class_type,
  t.age_min, t.age_max, t.school_year_min, t.school_year_max, t.audience_label,
  t.ability_level, t.invite_only, t.status, t.publicly_visible,
  false,                                  -- booking disabled until pricing confirmed (Q19)
  t.status IN ('confirmed'),              -- drafts/provisional start inactive
  20
FROM t
JOIN public.venues v ON v.slug = t.venue_slug
WHERE NOT EXISTS (
  SELECT 1 FROM public.classes c
  WHERE c.venue_id = v.id
    AND c.name = t.name
    AND c.day_of_week = t.day_of_week::public.day_of_week
    AND c.start_time = t.start_time::time
);

-- ---------- Import report ----------
DO $$
DECLARE
  v_count integer;
  c_count integer;
BEGIN
  SELECT count(*) INTO v_count FROM public.venues WHERE slug IN (
    'clacton-county-high-school','kelvedon-institute','thaxted-bolford-hall',
    'braintree-sport-and-health-club','wickford-nevendon-centre',
    'chatham-holcombe-grammar-school','drapers-maylands-primary-school',
    'white-court-school-braintree','white-notley-village-hall',
    'harrow-arts-centre','beaulieu-community-centre','coval-lane-chelmsford-theatre');
  SELECT count(*) INTO c_count FROM public.classes c
    JOIN public.venues v ON v.id = c.venue_id
    WHERE v.slug LIKE ANY (ARRAY['clacton-%','kelvedon-%','thaxted-%','braintree-sport%',
      'wickford-%','chatham-%','drapers-%','white-court-%','white-notley-%',
      'harrow-%','beaulieu-%','coval-lane-%']);
  RAISE NOTICE 'September 2026 import: % venues present, % timetable classes present', v_count, c_count;
END $$;

COMMIT;
