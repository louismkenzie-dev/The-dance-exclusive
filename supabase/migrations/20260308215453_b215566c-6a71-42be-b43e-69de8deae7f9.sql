
-- Add workshop_id to classes table
ALTER TABLE public.classes ADD COLUMN workshop_id uuid REFERENCES public.workshops(id) ON DELETE SET NULL;

-- Add days_of_week array column (allows multiple days)
ALTER TABLE public.classes ADD COLUMN days_of_week text[] NOT NULL DEFAULT '{}';

-- Create class_sessions table for individual session dates with editable times
CREATE TABLE public.class_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id uuid NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  session_date date NOT NULL,
  start_time time NOT NULL,
  end_time time NOT NULL,
  status text NOT NULL DEFAULT 'scheduled',
  notes text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.class_sessions ENABLE ROW LEVEL SECURITY;

-- RLS: Admins can manage sessions
CREATE POLICY "Admins can manage class sessions" ON public.class_sessions
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'));

-- RLS: Anyone can view sessions
CREATE POLICY "Anyone can view class sessions" ON public.class_sessions
  FOR SELECT TO authenticated
  USING (true);

-- Index for fast lookups
CREATE INDEX idx_class_sessions_class_id ON public.class_sessions(class_id);
CREATE INDEX idx_class_sessions_date ON public.class_sessions(session_date);
