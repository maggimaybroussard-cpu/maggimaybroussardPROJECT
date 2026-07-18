-- Team Members table for role-based access management
-- Migration: 20260719000000_team_members.sql

CREATE TABLE IF NOT EXISTS public.team_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  full_name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'paralegal',
  permissions TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  last_login TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_team_members_email ON public.team_members(email);
CREATE INDEX IF NOT EXISTS idx_team_members_status ON public.team_members(status);

ALTER TABLE public.team_members ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin_manage_team_members" ON public.team_members;
CREATE POLICY "admin_manage_team_members"
ON public.team_members
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);
