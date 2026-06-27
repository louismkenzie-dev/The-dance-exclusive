
ALTER TABLE public.profiles ADD COLUMN customer_type TEXT DEFAULT NULL;
ALTER TABLE public.profiles ADD COLUMN date_of_birth DATE DEFAULT NULL;
ALTER TABLE public.profiles ADD COLUMN gender TEXT DEFAULT NULL;
ALTER TABLE public.profiles ADD COLUMN medical_info TEXT DEFAULT NULL;
ALTER TABLE public.profiles ADD COLUMN medical_conditions_list TEXT[] DEFAULT '{}';
ALTER TABLE public.profiles ADD COLUMN has_inhaler BOOLEAN DEFAULT FALSE;
ALTER TABLE public.profiles ADD COLUMN has_epipen BOOLEAN DEFAULT FALSE;
ALTER TABLE public.profiles ADD COLUMN allergies_list TEXT[] DEFAULT '{}';
ALTER TABLE public.profiles ADD COLUMN dance_style_preference TEXT DEFAULT NULL;
