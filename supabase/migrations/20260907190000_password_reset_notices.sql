-- A reset requested for an address with no account now emails that address
-- to say so and point at registration. This table throttles those notices to
-- one per address per hour, so the public reset form cannot be used to flood
-- an inbox. Written only by the send-password-reset function (service role);
-- row security with no policies keeps every other role out.
CREATE TABLE public.password_reset_notices (
  email text PRIMARY KEY,
  last_sent_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.password_reset_notices ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.password_reset_notices IS
  'Last time a "no account found" notice was emailed to an address; one per hour.';
