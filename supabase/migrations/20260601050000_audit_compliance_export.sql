-- ─── Audit Compliance Export: New Action Types ───────────────────────────────
-- Adds additional audit action types for comprehensive compliance coverage

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumlabel = 'message_sent'
    AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'audit_action_type')
  ) THEN
    ALTER TYPE public.audit_action_type ADD VALUE 'message_sent';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumlabel = 'signature_requested'
    AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'audit_action_type')
  ) THEN
    ALTER TYPE public.audit_action_type ADD VALUE 'signature_requested';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumlabel = 'signature_completed'
    AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'audit_action_type')
  ) THEN
    ALTER TYPE public.audit_action_type ADD VALUE 'signature_completed';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumlabel = 'retainer_renewed'
    AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'audit_action_type')
  ) THEN
    ALTER TYPE public.audit_action_type ADD VALUE 'retainer_renewed';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumlabel = 'retainer_cancelled'
    AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'audit_action_type')
  ) THEN
    ALTER TYPE public.audit_action_type ADD VALUE 'retainer_cancelled';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumlabel = 'payment_failed'
    AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'audit_action_type')
  ) THEN
    ALTER TYPE public.audit_action_type ADD VALUE 'payment_failed';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumlabel = 'data_export'
    AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'audit_action_type')
  ) THEN
    ALTER TYPE public.audit_action_type ADD VALUE 'data_export';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumlabel = 'intake_submitted'
    AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'audit_action_type')
  ) THEN
    ALTER TYPE public.audit_action_type ADD VALUE 'intake_submitted';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumlabel = 'appointment_booked'
    AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'audit_action_type')
  ) THEN
    ALTER TYPE public.audit_action_type ADD VALUE 'appointment_booked';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumlabel = 'stripe_invoice_synced'
    AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'audit_action_type')
  ) THEN
    ALTER TYPE public.audit_action_type ADD VALUE 'stripe_invoice_synced';
  END IF;
END $$;

-- Add compliance_export_logs table for tracking who exported what and when
CREATE TABLE IF NOT EXISTS public.compliance_export_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  exported_by_email TEXT NOT NULL,
  exported_by_id UUID,
  export_format TEXT NOT NULL DEFAULT 'csv',
  date_from TIMESTAMPTZ,
  date_to TIMESTAMPTZ,
  action_filter TEXT,
  total_records INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_compliance_export_logs_created_at ON public.compliance_export_logs(created_at DESC);

ALTER TABLE public.compliance_export_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin_manage_compliance_export_logs" ON public.compliance_export_logs;
CREATE POLICY "admin_manage_compliance_export_logs"
  ON public.compliance_export_logs
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM auth.users au
      WHERE au.id = auth.uid()
      AND (
        au.raw_user_meta_data->>'role' = 'admin'
        OR au.raw_app_meta_data->>'role' = 'admin'
        OR au.email LIKE '%@maggimaybr%'
        OR au.email LIKE '%admin%'
      )
    )
  )
  WITH CHECK (true);
