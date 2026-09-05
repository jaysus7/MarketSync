# FULL_E2E_DEFECT_REGISTER

Every defect discovered during operational certification. Severity per
the finalization brief:

| Severity | Definition | Fix policy |
|----------|-----------|-----------|
| **P0** | Dealership cannot operate | Fix immediately before any P2/P3 work |
| **P1** | Major workflow broken (e.g. deal closes but commission never posts) | Fix before certification |
| **P2** | Feature broken but workaround exists | Track; fix in normal cadence |
| **P3** | UX/visual/minor issue | Fix after P0/P1 clear |

## Schema

Every row uses:

```
ID:            E2E-YYYYMMDD-NNN
Severity:      P0 | P1 | P2 | P3
Discovered:    <date, phase, spec/route>
Component:     <workspace/module>
Symptom:       <what the human sees>
Reproduction:  <exact steps>
Root cause:    <after investigation>
Fix commit:    <SHA + branch, once landed>
Regression:    <test file added/updated>
Evidence:      <trace/screenshot/DB query path>
Status:        OPEN | FIXING | FIXED | VERIFIED | WONT_FIX
```

## Standing / triaged from source pass

None recorded yet — the environment-dependent execution passes have not
run. Findings from the source-only audit (dead nav, duplicate loaders,
fabricated placeholders) were addressed in the Phase 1 IA freeze
(commit `40d45ab`) and are not re-recorded here.

## OPEN — P0

_(none)_

## OPEN — P1

_(none)_

## OPEN — P2

_(none)_

## OPEN — P3

_(none)_

## FIXED

_(will be populated as fixes land)_

## Test-suite baseline (pre-existing failures)

The `npm test` baseline currently reports **56 pre-existing failures**
that were not introduced by this certification cycle. They are tracked
separately from the E2E defect register — see
[`inventory/test-baseline.txt`](./inventory/test-baseline.txt) once the
next `npm test` run snapshots them here.
