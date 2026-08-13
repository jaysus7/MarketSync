-- Encryption metadata makes future key/cipher rotations explicit and auditable.
-- Existing encrypted records are AES-256-GCM format version 1.

ALTER TABLE IF EXISTS public.dealer_integrations
  ADD COLUMN IF NOT EXISTS credentials_encryption_version smallint NOT NULL DEFAULT 1;

ALTER TABLE IF EXISTS public.credit_applications
  ADD COLUMN IF NOT EXISTS pii_encryption_version smallint NOT NULL DEFAULT 1;

ALTER TABLE IF EXISTS public.dealer_integrations
  DROP CONSTRAINT IF EXISTS dealer_integrations_credentials_encryption_version_positive;
ALTER TABLE IF EXISTS public.dealer_integrations
  ADD CONSTRAINT dealer_integrations_credentials_encryption_version_positive
  CHECK (credentials_encryption_version >= 1);

ALTER TABLE IF EXISTS public.credit_applications
  DROP CONSTRAINT IF EXISTS credit_applications_pii_encryption_version_positive;
ALTER TABLE IF EXISTS public.credit_applications
  ADD CONSTRAINT credit_applications_pii_encryption_version_positive
  CHECK (pii_encryption_version >= 1);
