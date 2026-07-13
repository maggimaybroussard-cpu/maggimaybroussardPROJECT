-- Clio Integration: OAuth tokens and sync logs

CREATE TABLE IF NOT EXISTS public.clio_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  access_token TEXT NOT NULL,
  refresh_token TEXT NOT NULL,
  token_type TEXT DEFAULT 'bearer',
  expires_at TIMESTAMPTZ NOT NULL,
  clio_user_id BIGINT,
  clio_user_name TEXT,
  clio_account_id BIGINT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.clio_sync_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sync_type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  records_synced INTEGER DEFAULT 0,
  error_message TEXT,
  started_at TIMESTAMPTZ DEFAULT now(),
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.clio_matters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clio_id BIGINT UNIQUE NOT NULL,
  display_number TEXT,
  description TEXT,
  status TEXT,
  client_name TEXT,
  client_clio_id BIGINT,
  practice_area TEXT,
  open_date DATE,
  close_date DATE,
  responsible_attorney TEXT,
  billable BOOLEAN DEFAULT true,
  pending_date DATE,
  synced_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.clio_contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clio_id BIGINT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  contact_type TEXT,
  email TEXT,
  phone TEXT,
  company TEXT,
  title TEXT,
  address_line1 TEXT,
  address_city TEXT,
  address_state TEXT,
  address_zip TEXT,
  synced_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.clio_time_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clio_id BIGINT UNIQUE NOT NULL,
  matter_clio_id BIGINT,
  matter_description TEXT,
  user_name TEXT,
  date DATE,
  quantity_seconds INTEGER,
  quantity_hours NUMERIC(10,2),
  price NUMERIC(10,2),
  total NUMERIC(10,2),
  note TEXT,
  billable BOOLEAN DEFAULT true,
  billed BOOLEAN DEFAULT false,
  activity_description TEXT,
  synced_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_clio_matters_clio_id ON public.clio_matters(clio_id);
CREATE INDEX IF NOT EXISTS idx_clio_matters_status ON public.clio_matters(status);
CREATE INDEX IF NOT EXISTS idx_clio_contacts_clio_id ON public.clio_contacts(clio_id);
CREATE INDEX IF NOT EXISTS idx_clio_time_entries_clio_id ON public.clio_time_entries(clio_id);
CREATE INDEX IF NOT EXISTS idx_clio_time_entries_matter ON public.clio_time_entries(matter_clio_id);
CREATE INDEX IF NOT EXISTS idx_clio_sync_log_type ON public.clio_sync_log(sync_type);

-- RLS
ALTER TABLE public.clio_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clio_sync_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clio_matters ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clio_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clio_time_entries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin_manage_clio_tokens" ON public.clio_tokens;
CREATE POLICY "admin_manage_clio_tokens" ON public.clio_tokens FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "admin_manage_clio_sync_log" ON public.clio_sync_log;
CREATE POLICY "admin_manage_clio_sync_log" ON public.clio_sync_log FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "admin_manage_clio_matters" ON public.clio_matters;
CREATE POLICY "admin_manage_clio_matters" ON public.clio_matters FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "admin_manage_clio_contacts" ON public.clio_contacts;
CREATE POLICY "admin_manage_clio_contacts" ON public.clio_contacts FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "admin_manage_clio_time_entries" ON public.clio_time_entries;
CREATE POLICY "admin_manage_clio_time_entries" ON public.clio_time_entries FOR ALL TO authenticated USING (true) WITH CHECK (true);
