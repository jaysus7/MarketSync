# MarketSync — canonical build roadmap

**This document is the single authority on phase numbering.** Where any other document,
comment or commit message implies a different sequence, this one wins.

It exists because two conflicting phase lists were in circulation: the sequence the build
sessions actually followed, and the one in `docs/DEALEROS_AND_AI_ENGINE.md` §5. The
specification document `AGENTS.md` named as the authority — *"22 — Master Build Roadmap /
Audit Method"* — is not in the repository, so the sequence below was ratified by the owner
and recorded here instead.

---

## Phases

| Phase | Scope | Status |
|---|---|---|
| **0** | Dealer OS Architecture | **COMPLETE** |
| **1** | Shared Shell / Navigation | **COMPLETE** |
| **2** | Sales / CRM | **COMPLETE** |
| **3** | Inventory + F&I | **COMPLETE** |
| **4** | Service + Parts | **COMPLETE** |
| **5** | Accounting | **COMPLETE ON STAGING** |
| **6** | Dealer Marketing + Communications | **COMPLETE ON STAGING** |
| **6S** | Security stabilization (CodeQL triage) | **COMPLETE** |
| **7** | Dealer People + Academy + Dealer Launch / Self-Onboarding | **COMPLETE ON STAGING** |
| **8** | Dealer Management + unified My Day / UX simplification | **COMPLETE ON STAGING** |
| **9A** | Full Dealer OS E2E + Security + Production Hardening | **COMPLETE ON STAGING** |
| **9B** | MarketSync Internal OS + Affiliate Login / Dashboard | **NEXT** |
| **9C** | Controlled Pilot + Production Launch | Planned |

Phases 0–8 are **dealer-facing product**. MarketSync's own internal workspaces, the
affiliate login and dashboard, and any partner portal belong to **9B** — they are not to be
built earlier, however convenient it seems at the time.

---

## What "complete on staging" means for Phase 5

Accounting is functionally complete and merged to `staging`, and **production convergence is
deliberately not applied**. The five accounting migrations are written, idempotent and
verified on staging; they land on production **once**, during Phase 9A production hardening.
Historical accounting events are never replayed or backfilled.

Deferred by owner decision, and **not grounds to reopen Phase 5**:

- **Required before broad Accounting production in 9A** — real bank statement reconciliation;
  manual journal-entry UI.
- **May remain post-launch** unless E2E or pilot proves otherwise — Cash Flow statement;
  full Parts receipt → vendor bill matching.

The Banking view is an honest raw bank-transaction view, and the close checklist carries one
explicitly labelled manual bank-reconciliation attestation. Neither fabricates reconciliation
state, and neither should be "fixed" by inventing one.

---

## Detail lives elsewhere

This file stays a phase index. What each completed phase actually did, and the traps a later
session must not walk back into, live in:

- `docs/SESSION_HANDOFF.md` — current state, baseline, next slice
- `docs/DEALEROS_UI_AUDIT.md` — page → workspace mapping and gating
- `docs/STAGE3_INVENTORY_FNI_AUDIT.md` — Phase 3 domain truth
- `docs/STAGE4_SERVICE_PARTS_AUDIT.md` — Phase 4 domain truth
- `docs/PHASE5_ACCOUNTING.md` — Phase 5 ledger, AR/AP and close
- `docs/PHASE6_MARKETING.md` — Phase 6 marketing and communications
- `docs/PHASE6S_SECURITY.md` — the 68-finding CodeQL triage and its dispositions
- `docs/PHASE7_PEOPLE_LAUNCH.md` — Phase 7 people, academy, time, compliance and launch

Older documents keep their original names and internal numbering. They are historical
records and are **not** renumbered to match this table; read them for domain truth, and read
this file for sequence.
