-- Phase 1 security foundation: explicit platform identity, dealer RBAC, and
-- immutable security-event storage. Apply to staging before production.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS system_role text NOT NULL DEFAULT 'dealer_user'
  CHECK (system_role IN ('platform_owner', 'platform_admin', 'dealer_user'));

-- Existing SaaS staff are platform users; promote the actual owner explicitly
-- after deploying via the documented admin command (never infer from a dealer name).
UPDATE public.profiles
SET system_role = 'platform_admin'
WHERE saas_role IS NOT NULL
  AND system_role = 'dealer_user';

CREATE TABLE IF NOT EXISTS public.roles (
  id text PRIMARY KEY,
  display_name text NOT NULL,
  scope text NOT NULL CHECK (scope IN ('platform', 'dealership')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.permissions (
  id text PRIMARY KEY,
  description text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.role_permissions (
  role_id text NOT NULL REFERENCES public.roles(id) ON DELETE CASCADE,
  permission_id text NOT NULL REFERENCES public.permissions(id) ON DELETE CASCADE,
  PRIMARY KEY (role_id, permission_id)
);

CREATE TABLE IF NOT EXISTS public.user_roles (
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  role_id text NOT NULL REFERENCES public.roles(id) ON DELETE CASCADE,
  dealership_id uuid NOT NULL REFERENCES public.dealerships(id) ON DELETE CASCADE,
  assigned_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  assigned_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, role_id, dealership_id)
);

CREATE INDEX IF NOT EXISTS user_roles_user_dealership_idx
  ON public.user_roles (user_id, dealership_id);

CREATE TABLE IF NOT EXISTS public.security_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type text NOT NULL,
  user_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  dealership_id uuid REFERENCES public.dealerships(id) ON DELETE SET NULL,
  ip inet,
  user_agent text,
  metadata jsonb,
  before_state jsonb,
  after_state jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS security_events_dealer_created_idx
  ON public.security_events (dealership_id, created_at DESC);
CREATE INDEX IF NOT EXISTS security_events_user_created_idx
  ON public.security_events (user_id, created_at DESC);

ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.security_events ENABLE ROW LEVEL SECURITY;

INSERT INTO public.roles (id, display_name, scope) VALUES
  ('platform_owner', 'Platform Owner', 'platform'),
  ('platform_admin', 'Platform Admin', 'platform'),
  ('dealer_group_owner', 'Dealer Group Owner', 'dealership'),
  ('dealer_owner', 'Dealer Owner', 'dealership'),
  ('general_manager', 'General Manager', 'dealership'),
  ('sales_manager', 'Sales Manager', 'dealership'),
  ('salesperson', 'Salesperson', 'dealership'),
  ('bdc', 'BDC', 'dealership'),
  ('fni_manager', 'F&I Manager', 'dealership'),
  ('service_manager', 'Service Manager', 'dealership'),
  ('technician', 'Technician', 'dealership'),
  ('accounting', 'Accounting', 'dealership'),
  ('read_only', 'Read Only', 'dealership')
ON CONFLICT (id) DO UPDATE SET display_name = EXCLUDED.display_name, scope = EXCLUDED.scope;

INSERT INTO public.permissions (id, description) VALUES
  ('inventory.view', 'View inventory'), ('inventory.edit', 'Create and edit inventory'), ('inventory.delete', 'Delete inventory'),
  ('customer.view', 'View customer records'), ('customer.export', 'Export customer records'),
  ('lead.create', 'Create leads'), ('lead.assign', 'Assign leads'),
  ('deal.create', 'Create deals'), ('deal.approve', 'Approve deals'), ('deal.finalize', 'Finalize deals'),
  ('accounting.view', 'View accounting'), ('accounting.edit', 'Edit accounting'),
  ('service.write_repair_order', 'Create and edit repair orders'),
  ('users.manage', 'Manage dealership users'), ('billing.manage', 'Manage billing'),
  ('platform.manage', 'Manage platform settings')
ON CONFLICT (id) DO UPDATE SET description = EXCLUDED.description;

-- Platform owners retain every permission. Dealer role mappings are added in the
-- next RBAC slice after each existing route has been mapped and tested.
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT 'platform_owner', id FROM public.permissions
ON CONFLICT DO NOTHING;

-- No direct Data API policies are intentionally granted. The backend's service-role
-- client performs authorization; policies are added per tenant table during the RLS rollout.
