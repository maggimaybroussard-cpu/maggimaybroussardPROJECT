-- Create email_subscribers table for opt-in captures
CREATE TABLE IF NOT EXISTS public.email_subscribers (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  email text NOT NULL,
  source text DEFAULT 'website_optin',
  subscribed_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now(),
  CONSTRAINT email_subscribers_email_key UNIQUE (email)
);

-- Enable RLS
ALTER TABLE public.email_subscribers ENABLE ROW LEVEL SECURITY;

-- Allow anonymous inserts (opt-in form is public)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'email_subscribers' AND policyname = 'allow_public_insert'
  ) THEN
    CREATE POLICY allow_public_insert ON public.email_subscribers
      FOR INSERT TO anon WITH CHECK (true);
  END IF;
END $$;

-- Allow authenticated users (admin) to read all subscribers
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'email_subscribers' AND policyname = 'allow_authenticated_select'
  ) THEN
    CREATE POLICY allow_authenticated_select ON public.email_subscribers
      FOR SELECT TO authenticated USING (true);
  END IF;
END $$;
