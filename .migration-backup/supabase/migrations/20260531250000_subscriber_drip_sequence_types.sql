-- Add new drip sequence enum values for the 3-email series
-- (litigation prep, contract review, engagement process)

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumlabel = 'subscriber_drip_litigation'
      AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'email_sequence_type')
  ) THEN
    ALTER TYPE public.email_sequence_type ADD VALUE 'subscriber_drip_litigation';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumlabel = 'subscriber_drip_contract'
      AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'email_sequence_type')
  ) THEN
    ALTER TYPE public.email_sequence_type ADD VALUE 'subscriber_drip_contract';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumlabel = 'subscriber_drip_engagement'
      AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'email_sequence_type')
  ) THEN
    ALTER TYPE public.email_sequence_type ADD VALUE 'subscriber_drip_engagement';
  END IF;
END $$;
