-- Push subscriptions for browser push notifications
CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  endpoint text NOT NULL UNIQUE,
  p256dh text,
  auth text,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  user_type text NOT NULL DEFAULT 'client' CHECK (user_type IN ('client', 'admin')),
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

-- Index for fast user lookups
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user_id ON public.push_subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user_type ON public.push_subscriptions(user_type);

-- RLS
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

-- Service role can do everything (for server-side sends)
CREATE POLICY "Service role full access on push_subscriptions"
  ON public.push_subscriptions
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Authenticated users can manage their own subscriptions
CREATE POLICY "Users manage own push subscriptions"
  ON public.push_subscriptions
  FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Allow anon insert for unauthenticated visitors (staff/admin pages before login)
CREATE POLICY "Anon can insert push subscriptions"
  ON public.push_subscriptions
  FOR INSERT
  TO anon
  WITH CHECK (true);
