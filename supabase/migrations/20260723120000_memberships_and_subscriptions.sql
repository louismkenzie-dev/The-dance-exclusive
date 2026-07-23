-- Real rolling monthly memberships backed by Stripe subscriptions.

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS stripe_customer_id text;

CREATE TABLE IF NOT EXISTS public.memberships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  student_id uuid REFERENCES public.students(id) ON DELETE SET NULL,
  class_id uuid REFERENCES public.classes(id) ON DELETE SET NULL,
  stripe_subscription_id text NOT NULL,
  stripe_subscription_item_id text,
  stripe_price_id text,
  monthly_amount numeric(10,2) NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'incomplete'
    CHECK (status IN ('incomplete','active','past_due','paused','cancel_scheduled','cancelled')),
  started_at timestamptz NOT NULL DEFAULT now(),
  current_period_end timestamptz,
  cancel_requested_at timestamptz,
  final_payment_date timestamptz,
  cancel_at timestamptz,
  cancelled_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS memberships_sub_item_unique
  ON public.memberships (stripe_subscription_item_id)
  WHERE stripe_subscription_item_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS memberships_user_idx ON public.memberships (user_id);
CREATE INDEX IF NOT EXISTS memberships_sub_idx ON public.memberships (stripe_subscription_id);

ALTER TABLE public.memberships ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "Users can view their own memberships" ON public.memberships
    FOR SELECT USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "Admins can manage memberships" ON public.memberships
    FOR ALL USING (public.has_role(auth.uid(), 'admin'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Daily maintenance scheduling
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Which Stripe environment the subscription lives in (drives maintenance).
ALTER TABLE public.memberships ADD COLUMN IF NOT EXISTS stripe_env text NOT NULL DEFAULT 'sandbox' CHECK (stripe_env IN ('sandbox','live'));
