-- Invoice email send logs table
CREATE TABLE IF NOT EXISTS public.invoice_email_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_number text NOT NULL,
  client_email text NOT NULL,
  client_name text NOT NULL,
  email_id text,
  sent_at timestamptz NOT NULL DEFAULT now(),
  status text NOT NULL DEFAULT 'sent',
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Index for fast lookups by invoice number
CREATE INDEX IF NOT EXISTS idx_invoice_email_logs_invoice_number
  ON public.invoice_email_logs (invoice_number);

-- RLS
ALTER TABLE public.invoice_email_logs ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'invoice_email_logs' AND policyname = 'Authenticated users can manage invoice email logs'
  ) THEN
    CREATE POLICY "Authenticated users can manage invoice email logs"
      ON public.invoice_email_logs
      FOR ALL
      TO authenticated
      USING (true)
      WITH CHECK (true);
  END IF;
END $$;
