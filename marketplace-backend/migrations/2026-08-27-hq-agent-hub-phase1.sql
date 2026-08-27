-- MarketSync HQ Agent Hub — Phase 1 Schema Migration
-- Applied for centralized AI agent control plane (ChatGPT, Claude, Gemini, Grok)

-- 1. AGENTS
CREATE TABLE IF NOT EXISTS public.hq_agents (
  id TEXT PRIMARY KEY, -- 'chatgpt', 'claude', 'gemini', 'grok'
  display_name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'contributor',
  status TEXT NOT NULL DEFAULT 'idle' CHECK (status IN ('idle', 'working', 'blocked', 'review', 'offline', 'disabled')),
  permission_scope TEXT[] NOT NULL DEFAULT '{"read_context", "read_tasks", "claim_tasks", "update_task_state", "attach_evidence", "handoff_qa"}'::text[],
  current_task_id TEXT,
  last_heartbeat TIMESTAMPTZ,
  last_activity_at TIMESTAMPTZ,
  is_enabled BOOLEAN NOT NULL DEFAULT true,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed the four required agent identities
INSERT INTO public.hq_agents (id, display_name, role, status, permission_scope, is_enabled, metadata)
VALUES
  ('chatgpt', 'ChatGPT', 'chief_of_staff', 'idle', '{"read_context", "read_tasks", "claim_tasks", "update_task_state", "attach_evidence", "handoff_qa", "request_approval"}'::text[], true, '{"provider": "openai", "model": "gpt-4o / o1"}'::jsonb),
  ('claude', 'Claude', 'senior_builder', 'idle', '{"read_context", "read_tasks", "claim_tasks", "update_task_state", "attach_evidence", "handoff_qa", "request_approval"}'::text[], true, '{"provider": "anthropic", "model": "claude-3-7-sonnet"}'::jsonb),
  ('gemini', 'Gemini', 'workspace_specialist', 'idle', '{"read_context", "read_tasks", "claim_tasks", "update_task_state", "attach_evidence", "handoff_qa", "request_approval"}'::text[], true, '{"provider": "google", "model": "gemini-2.0-flash / pro"}'::jsonb),
  ('grok', 'Grok', 'implementation_engineer', 'idle', '{"read_context", "read_tasks", "claim_tasks", "update_task_state", "attach_evidence", "handoff_qa", "request_approval"}'::text[], true, '{"provider": "xai", "model": "grok-2"}'::jsonb)
ON CONFLICT (id) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  role = EXCLUDED.role,
  updated_at = NOW();

-- 2. AGENT CREDENTIALS (Hashed API keys / Bearer tokens)
CREATE TABLE IF NOT EXISTS public.hq_agent_credentials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id TEXT NOT NULL REFERENCES public.hq_agents(id) ON DELETE CASCADE,
  name TEXT NOT NULL DEFAULT 'Default Agent Key',
  api_key_hash TEXT NOT NULL UNIQUE,
  key_prefix TEXT NOT NULL,
  scopes TEXT[] NOT NULL DEFAULT '{"tasks:claim", "tasks:write", "evidence:write", "approvals:request"}'::text[],
  is_active BOOLEAN NOT NULL DEFAULT true,
  expires_at TIMESTAMPTZ,
  last_used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_hq_agent_creds_hash ON public.hq_agent_credentials(api_key_hash) WHERE is_active = true;

-- 3. AGENT SESSIONS
CREATE TABLE IF NOT EXISTS public.hq_agent_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id TEXT NOT NULL REFERENCES public.hq_agents(id) ON DELETE CASCADE,
  session_name TEXT,
  external_session_id TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'terminated')),
  current_task_id TEXT,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ended_at TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_hq_agent_sessions_agent ON public.hq_agent_sessions(agent_id, status);

-- 4. AI TASKS (Canonical Task Ledger)
CREATE TABLE IF NOT EXISTS public.hq_ai_tasks (
  id TEXT PRIMARY KEY, -- e.g. 'MS-001', 'MS-005', 'MS-006'
  title TEXT NOT NULL,
  description TEXT,
  priority TEXT NOT NULL DEFAULT 'P2' CHECK (priority IN ('P0', 'P1', 'P2', 'P3')),
  status TEXT NOT NULL DEFAULT 'Inbox' CHECK (status IN ('Inbox', 'Ready', 'In Progress', 'Review', 'Blocked', 'Done')),
  owner TEXT REFERENCES public.hq_agents(id) ON DELETE SET NULL,
  acceptance_criteria TEXT,
  next_action TEXT,
  qa_owner TEXT REFERENCES public.hq_agents(id) ON DELETE SET NULL,
  handoff_target TEXT REFERENCES public.hq_agents(id) ON DELETE SET NULL,
  blocked_by TEXT,
  result_summary TEXT,
  verification_notes TEXT,
  claimed_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  source TEXT NOT NULL DEFAULT 'internal', -- 'internal', 'google_sheets'
  external_sync_key TEXT UNIQUE,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_hq_ai_tasks_status ON public.hq_ai_tasks(status);
CREATE INDEX IF NOT EXISTS idx_hq_ai_tasks_owner ON public.hq_ai_tasks(owner);
CREATE INDEX IF NOT EXISTS idx_hq_ai_tasks_priority ON public.hq_ai_tasks(priority);

-- 5. TASK EVENTS (State Transition and Progress Ledger)
CREATE TABLE IF NOT EXISTS public.hq_task_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id TEXT NOT NULL REFERENCES public.hq_ai_tasks(id) ON DELETE CASCADE,
  agent_id TEXT REFERENCES public.hq_agents(id) ON DELETE SET NULL,
  event_type TEXT NOT NULL CHECK (event_type IN ('created', 'claimed', 'status_changed', 'handoff', 'blocked', 'evidence_added', 'approval_requested', 'review_submitted', 'completed')),
  previous_state TEXT,
  new_state TEXT,
  note TEXT,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_hq_task_events_task ON public.hq_task_events(task_id, created_at DESC);

-- 6. TASK EVIDENCE (Verifiable Proof of Completion)
CREATE TABLE IF NOT EXISTS public.hq_task_evidence (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id TEXT NOT NULL REFERENCES public.hq_ai_tasks(id) ON DELETE CASCADE,
  agent_id TEXT REFERENCES public.hq_agents(id) ON DELETE SET NULL,
  evidence_type TEXT NOT NULL CHECK (evidence_type IN ('test_run', 'pr_link', 'commit_hash', 'screenshot', 'audit_report', 'benchmark', 'log_output', 'documentation')),
  title TEXT NOT NULL,
  url TEXT,
  content JSONB NOT NULL DEFAULT '{}'::jsonb,
  verified BOOLEAN NOT NULL DEFAULT false,
  verified_by TEXT,
  verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_hq_task_evidence_task ON public.hq_task_evidence(task_id);

-- 7. APPROVALS (Founder Gate for Privileged Actions)
CREATE TABLE IF NOT EXISTS public.hq_approvals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id TEXT REFERENCES public.hq_ai_tasks(id) ON DELETE SET NULL,
  agent_id TEXT NOT NULL REFERENCES public.hq_agents(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  action_type TEXT NOT NULL CHECK (action_type IN ('production_deploy', 'privileged_access', 'schema_migration', 'billing_change', 'customer_impact', 'entitlement_override')),
  description TEXT,
  requested_changes JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'cancelled')),
  decision_reason TEXT,
  decided_by TEXT,
  decided_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_hq_approvals_status ON public.hq_approvals(status);

-- 8. INTEGRATIONS (System & Provider Connection Status)
CREATE TABLE IF NOT EXISTS public.hq_integrations (
  id TEXT PRIMARY KEY, -- 'google_sheets_work_queue', 'github', 'openai', 'anthropic', 'google_gemini', 'xai_grok'
  name TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('work_queue', 'vcs', 'model_provider', 'monitoring')),
  status TEXT NOT NULL DEFAULT 'unconfigured' CHECK (status IN ('connected', 'disconnected', 'degraded', 'unconfigured')),
  config JSONB NOT NULL DEFAULT '{}'::jsonb,
  last_sync_at TIMESTAMPTZ,
  last_error TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed standard integrations
INSERT INTO public.hq_integrations (id, name, category, status, config)
VALUES
  ('google_sheets_work_queue', 'Google Sheets Work Queue', 'work_queue', 'connected', '{"sheet_name": "MarketSync — AI Work Queue", "sync_mode": "bidirectional"}'::jsonb),
  ('github', 'GitHub Repository (jaysus7/MarketSync)', 'vcs', 'connected', '{"repo": "jaysus7/MarketSync", "default_branch": "main", "working_branch": "staging"}'::jsonb),
  ('openai', 'OpenAI (ChatGPT / o1)', 'model_provider', 'connected', '{"status": "active"}'::jsonb),
  ('anthropic', 'Anthropic (Claude 3.7)', 'model_provider', 'connected', '{"status": "active"}'::jsonb),
  ('google_gemini', 'Google Cloud (Gemini 2.0)', 'model_provider', 'connected', '{"status": "active"}'::jsonb),
  ('xai_grok', 'xAI (Grok 2)', 'model_provider', 'connected', '{"status": "active"}'::jsonb)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  category = EXCLUDED.category,
  updated_at = NOW();

-- 9. AUDIT LOGS (Immutable HQ Audit Ledger)
CREATE TABLE IF NOT EXISTS public.hq_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id TEXT,
  task_id TEXT,
  action TEXT NOT NULL,
  actor_type TEXT NOT NULL DEFAULT 'agent' CHECK (actor_type IN ('agent', 'founder', 'system')),
  actor_id TEXT,
  previous_state JSONB,
  resulting_state JSONB,
  evidence_ref TEXT,
  session_id TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_hq_audit_logs_task ON public.hq_audit_logs(task_id);
CREATE INDEX IF NOT EXISTS idx_hq_audit_logs_agent ON public.hq_audit_logs(agent_id);
CREATE INDEX IF NOT EXISTS idx_hq_audit_logs_created ON public.hq_audit_logs(created_at DESC);

-- 10. RLS POLICIES & GRANTS
ALTER TABLE public.hq_agents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hq_agent_credentials ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hq_agent_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hq_ai_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hq_task_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hq_task_evidence ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hq_approvals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hq_integrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hq_audit_logs ENABLE ROW LEVEL SECURITY;

-- Service role has full unrestricted access
GRANT ALL ON public.hq_agents TO service_role;
GRANT ALL ON public.hq_agent_credentials TO service_role;
GRANT ALL ON public.hq_agent_sessions TO service_role;
GRANT ALL ON public.hq_ai_tasks TO service_role;
GRANT ALL ON public.hq_task_events TO service_role;
GRANT ALL ON public.hq_task_evidence TO service_role;
GRANT ALL ON public.hq_approvals TO service_role;
GRANT ALL ON public.hq_integrations TO service_role;
GRANT ALL ON public.hq_audit_logs TO service_role;
