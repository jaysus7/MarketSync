# Production runbook

## Required controls before production

- Set `REDIS_URL` and `REQUIRE_REDIS_RATE_LIMITING=true`.
- Configure an external uptime monitor for `GET /ready`; alert after two failed checks.
- Configure error tracking for backend exceptions and failed webhook deliveries.
- In Supabase, verify daily backups and point-in-time recovery are enabled; record the retention period and restoration owner.
- Never deploy directly to `main`: merge into `staging`, verify `/ready`, test authentication and cross-dealer access, then promote.

## Incident response

1. Pause affected integration or revoke its API key.
2. Preserve audit-log and webhook-delivery evidence.
3. Rotate exposed secrets in Render/Supabase.
4. Revoke user sessions if account compromise is suspected.
5. Document the incident, scope, remediation, and follow-up test.
