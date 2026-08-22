-- Phase 7 PR 7.5 — compliance that can tell "nothing is wrong" from "nothing was set up".
--
-- CURRENT TRUTH: `staff_compliance_dashboard_v` counts overdue policy acknowledgements,
-- overdue training, expired certifications, expired documents, overdue lifecycle tasks and
-- open safety actions. EVERY one of those counters reads a table with no producer.
-- `staff_policies`, `staff_policy_versions` and `staff_policy_acknowledgements` had ZERO
-- references anywhere in the codebase; `staff_lifecycle_assignments` had zero references
-- despite 10 seeded templates and 90 template tasks. A dealership that had published no policy
-- and started no onboarding saw all zeros — which reads as "everybody is compliant".
--
-- The schema itself is good and is left alone. This adds only what the producers need, and one
-- rule the evidence depends on.
--
-- APPLIED TO STAGING ONLY.

-- ── The templates had no producer either ────────────────────────────────────
-- Five dealerships were seeded with the core checklists once. Every dealership created since
-- has had NO templates at all, so onboarding could never be started there. `ensureLifecycleTemplates`
-- seeds them on demand, which needs these keys to be idempotent rather than duplicating.
create unique index if not exists staff_lifecycle_templates_system_key_uk
  on public.staff_lifecycle_templates (dealership_id, system_key) where system_key is not null;

create unique index if not exists staff_lifecycle_template_tasks_key_uk
  on public.staff_lifecycle_template_tasks (template_id, task_key) where task_key is not null;

-- ── Published policy text is immutable — ALREADY, and more strictly than planned ──
-- This migration originally added a `reject_published_policy_edit` trigger. It was DELETED
-- before shipping: `protect_staff_policy_version()` already exists and is stricter. It makes
-- published AND retired versions fully immutable (allowing only the published -> retired
-- transition, and only when nothing else changed), and it COMPUTES `checksum_sha256`
-- server-side on publish, overriding whatever a caller supplied.
--
-- Recording this rather than quietly dropping it: a second, weaker guard beside a working one
-- is worse than no second guard, because the next person to read the code has to work out
-- which of the two is authoritative. `publishPolicyVersion` therefore does not send a checksum
-- at all — it reads back the one the database computed.

-- ── An acknowledgement names the exact text it was given for ────────────────
-- Stored on the acknowledgement rather than read through the version at display time: the
-- point of the evidence is that it stays true even if the version row is later retired or the
-- policy is renamed.
alter table public.staff_policy_acknowledgements
  add column if not exists acknowledged_checksum_sha256 text;

do $$ begin
  alter table public.staff_policy_acknowledgements
    add constraint staff_policy_ack_checksum_format
    check (acknowledged_checksum_sha256 is null or acknowledged_checksum_sha256 ~ '^[0-9a-f]{64}$');
exception when duplicate_object then null; end $$;

-- Acknowledged means the checksum was captured. Evidence with no text behind it is not
-- evidence, and this is the constraint that keeps that true for every future writer.
do $$ begin
  alter table public.staff_policy_acknowledgements
    add constraint staff_policy_ack_records_what_was_read
    check (status <> 'acknowledged' or acknowledged_checksum_sha256 is not null);
exception when duplicate_object then null; end $$;

-- ── An onboarding assignment must be for a real employee, in this dealership ─
do $$ begin
  alter table public.staff_lifecycle_assignments
    add constraint staff_lifecycle_assignments_staff_same_dealer
    foreign key (staff_member_id, dealership_id)
    references public.staff_members(id, dealership_id) on delete cascade;
exception when duplicate_object then null; when undefined_object then null; end $$;

-- One live onboarding (or offboarding) per person. Starting it twice would produce two
-- checklists and two answers to "is this person onboarded".
create unique index if not exists staff_lifecycle_one_open_per_type
  on public.staff_lifecycle_assignments (dealership_id, staff_member_id, lifecycle_type)
  where status <> 'completed' and status <> 'cancelled';
