
-- Add instructor override per session
ALTER TABLE public.class_sessions ADD COLUMN instructor_id uuid REFERENCES public.staff(id) ON DELETE SET NULL;

-- Add class_session_id to attendance so we can track attendance per session
ALTER TABLE public.attendance ADD COLUMN class_session_id uuid REFERENCES public.class_sessions(id) ON DELETE SET NULL;

-- Index for lookups
CREATE INDEX idx_class_sessions_instructor ON public.class_sessions(instructor_id);
CREATE INDEX idx_attendance_session ON public.attendance(class_session_id);
