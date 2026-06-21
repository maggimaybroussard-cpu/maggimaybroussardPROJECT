-- ─── Audit Log: Permission & Role Change Action Types ────────────────────────
-- Adds permission_changed and role_changed to the audit_action_type enum

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumlabel = 'permission_changed'
    AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'audit_action_type')
  ) THEN
    ALTER TYPE public.audit_action_type ADD VALUE 'permission_changed';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumlabel = 'role_changed'
    AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'audit_action_type')
  ) THEN
    ALTER TYPE public.audit_action_type ADD VALUE 'role_changed';
  END IF;
END $$;
