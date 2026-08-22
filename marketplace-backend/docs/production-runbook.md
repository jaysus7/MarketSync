# Production runbook

## Required controls before production

- Set `REDIS_URL` and `REQUIRE_REDIS_RATE_LIMITING=true`.
- Set `RESEND_API_KEY` and a verified `EMAIL_FROM` value (for example, `MarketSync <noreply@marketsync.com>`). Test a team invite before promotion.
- Configure an external uptime monitor for `GET /ready`; alert after two failed checks.
- Configure error tracking for backend exceptions and failed webhook deliveries.
- In Supabase, verify daily backups and point-in-time recovery are enabled; record the retention period and restoration owner.
- Never deploy directly to `main`: commit and push to `staging`, verify `/ready`, test sign-in, invite/reset links, and cross-dealer access, then promote.
- Apply any new backend migration to the separate staging Supabase project before testing it. Do not copy production data into staging.
- Every new `public` table must ship with RLS enabled and permission-based policies in the same migration — no exceptions. Follow `docs/rls-standard.md` and the `migrations/_TEMPLATE-new-table-rls.sql` template, and query dealer-facing routes with `req.supabase` (not `supabaseAdmin`) so those policies are enforced.
- Platform access is assigned through `profiles.system_role`; do not use an email address or dealership name as an access-control shortcut.

## Incident response

1. Pause affected integration or revoke its API key.
2. Preserve audit-log and webhook-delivery evidence.
3. Rotate exposed secrets in Render/Supabase.
4. Revoke user sessions if account compromise is suspected.
5. Document the incident, scope, remediation, and follow-up test.
