CREATE TABLE public.cart_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  cart_item_id TEXT NOT NULL,
  class_id UUID NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  class_name TEXT NOT NULL,
  class_type public.class_type NOT NULL,
  dance_style TEXT NULL,
  day_of_week public.day_of_week NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  venue_name TEXT NULL,
  student_id UUID NULL REFERENCES public.students(id) ON DELETE SET NULL,
  student_name TEXT NULL,
  pricing_plan TEXT NOT NULL,
  unit_price NUMERIC(10,2) NOT NULL DEFAULT 0,
  total_price NUMERIC(10,2) NOT NULL DEFAULT 0,
  sessions_count INTEGER NULL,
  term_discount_percent NUMERIC(5,2) NULL,
  workshop_image TEXT NULL,
  selected_session_ids UUID[] NOT NULL DEFAULT '{}',
  selected_session_dates TEXT[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT cart_items_user_cart_item_unique UNIQUE (user_id, cart_item_id)
);

CREATE INDEX idx_cart_items_user_id ON public.cart_items(user_id);

ALTER TABLE public.cart_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own cart items"
ON public.cart_items
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own cart items"
ON public.cart_items
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own cart items"
ON public.cart_items
FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own cart items"
ON public.cart_items
FOR DELETE
USING (auth.uid() = user_id);

CREATE TRIGGER update_cart_items_updated_at
BEFORE UPDATE ON public.cart_items
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();