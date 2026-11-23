# Vāchaspati AI — Super Admin and production operations

The platform uses **custom email/password auth** backed by Supabase-hosted PostgreSQL. It does **not** use Supabase Auth. Every application table is in `vachaspati_private` and begins with `vachaspati_`.

The separate administrative control plane is at **`/superadmin`** with its own session cookie, independent administrator roles and time-based authenticator-code MFA. Public registration must NEVER grant administrative privileges.

## First-time superadmin bootstrap (no hardcoded administrator)

1. Configure the web application's private `DATABASE_URL`, `APP_ORIGIN`, and `ADMIN_MFA_ENCRYPTION_KEY` in Vercel. Generate the MFA encryption key locally using `openssl rand -hex 32`. Keep it private and backed up securely.
2. Sign up with your actual email at `/signup` and confirm the account if email verification is enabled.
3. From the connected **AI_AGENT** Supabase project's authorized SQL Editor, assign the admin role only to the existing user you intend to authorize:

```sql
insert into vachaspati_private.vachaspati_admin_roles (user_id, role)
select id, 'superadmin'
from vachaspati_private.vachaspati_users
where email = lower('REPLACE_WITH_YOUR_REGISTERED_EMAIL')
on conflict (user_id) do update
set role = excluded.role, active = true;
```

4. Verify the SQL statement inserted **exactly one row**, for the correct email. Never run it with someone else's account and never expose a public bootstrap endpoint.
5. Log in with your normal account, visit `/superadmin/setup`, confirm your password, and add the generated TOTP secret to an authenticator app. Verify a fresh six-digit code.
6. Future privileged sign-ins use `/superadmin/login` (email + password + authenticator code). The admin session expires after four hours and can be revoked by the admin sign-out endpoint.
7. Create other staff accounts with normal email registration, then use **Admin roles** from the Super Admin console to grant the least privilege required. Every staff user separately enrolls MFA.

**Never** set `role='superadmin'` from public user-submitted profile fields, JWT metadata, client JavaScript or signup logic.

## Administrator roles

- `superadmin`: all modules, role assignment, platform maintenance, model publishing, security, customer and credit changes.
- `operations`: agent/model operations, incidents, service health, support, API key revocation, announcements, selected settings.
- `support`: user account support, account inspection, ticket triage, incidents, limited API key inspection.
- `finance`: prices, plans, prepaid packages, payment history, usage, auditable wallet adjustments.
- `analyst`: read-only platform analytics, usage, audit and service health.

Every privileged action requires a valid admin session and is checked again server-side. The administration code does not rely on hiding menus or user-editable claims. Operational updates produce audit records. Admin MFA secrets are AES-256-GCM encrypted at rest using a separate server key.

## Admin modules and their real data

| Module | Source tables | Supported operations |
|---|---|---|
| Overview | users, accounts, agents, payments, usage | Actual live counts and integration configuration |
| User management | `vachaspati_users`, sessions | Review accounts, suspend/reactivate, revoke sessions |
| Staff access | `vachaspati_admin_roles`, `vachaspati_admin_mfa` | Grant/revoke admin roles, enforce MFA |
| Workspaces | `vachaspati_accounts`, members | Inspect tenants, switch plans, audited wallet adjustments |
| Agents | `vachaspati_agents` | Inspect and pause/publish compliant agents |
| Model catalog | `vachaspati_voice_models` | Create models; enable only when relevant providers are configured |
| Plans & credit rates | `vachaspati_plans`, `vachaspati_rates` | Update customer allowances and metering |
| Prepaid packages | `vachaspati_credit_packages` | Create and publish real INR credit packages |
| Payments | `vachaspati_payment_orders`, events | Payment history and captured-payment settlement |
| API keys | `vachaspati_api_keys` | Inspect non-secret metadata and revoke keys |
| Usage | `vachaspati_api_usage`, credit ledger | Actual API usage history and charges |
| Settings | `vachaspati_platform_settings` | Disable signups, pause publishing, toggle email verification, maintenance |
| Incidents | `vachaspati_service_incidents` | Open/track/resolve service incidents |
| Support | `vachaspati_support_tickets`, messages | Review, reply, assign through staff responses, internal notes |
| Announcements | `vachaspati_announcements` | Publish customer-facing platform notices |
| Service health | `vachaspati_service_checks` | Real network probes for DB, OpenRouter, Sherpa, Razorpay and Resend |
| Audit log | `vachaspati_admin_audit` | Read role/audit history, no public mutation endpoint |

## Prepaid billing

1. Set `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, and `RAZORPAY_WEBHOOK_SECRET` server-side. Complete Razorpay merchant verification and configure payment capture.
2. Register an HTTPS webhook at `https://YOUR_DOMAIN/api/billing/webhook` for `payment.captured`, `payment.failed`, and refund events.
3. As a finance/superadmin user, create and enable a package with a real INR price in paise and credit allowance.
4. Customers purchase at `/dashboard/billing`. The server creates the Razorpay order and a matching local pending order. The public checkout only receives the payment order ID, amount and public key ID.
5. **Only the server-verified `payment.captured` webhook** grants wallet credits. It checks raw-body HMAC signatures, order ID, amount, currency, captured status, and unique provider event IDs, within a PostgreSQL transaction.
6. The credit reservation code consumes monthly included credits first and any purchased prepaid wallet balance next. On provider failures it issues an idempotent refund to the ledger and prepaid wallet if applicable.
7. Refund settlement is **NOT automatic**: refund webhooks open an incident for manual reconciliation to avoid granting spent credits without the operator confirming the refund. Do not advertise automatic refunds or issued tax invoices before they exist.

## Voice operations

The Next.js web frontend is deployed separately from `worker/`: use a persistent Linux CPU/GPU host for the Sherpa-ONNX native worker. Mount verified, commercially licensed, language-specific ASR/TTS model weights and configure `SHERPA_ASR_CONFIG_JSON`, `SHERPA_TTS_CONFIG_JSON`, `SHERPA_VOICES_JSON`. Set matching `SHERPA_WORKER_SECRET` in both services and `SHERPA_INFERENCE_URL` on Next.js.

The current browser widget implements **turn-based voice requests** (record → transcription → OpenRouter reply → TTS) and persistent text sessions. Continuous full-duplex WebSocket speech streaming, barge-in, production-grade language routing and audio interruption are not yet shipped. Do not label these features active.

## Required go-live tests

- Run `npm install && npm run typecheck && npm run build`; also run `node --check public/widget.js` and `node --check worker/server.mjs`.
- Sign up, verify email if required, log in, change/reset password, sign out, and verify session expiry.
- Enroll a superadmin, log in with MFA and verify the same TOTP code cannot be reused; check all staff role permissions.
- Create and update agents, configure approved domains, publish, send actual OpenRouter messages and verify tenant isolation.
- Upload speech and check real ASR transcripts; generate voice and listen; verify unsupported models fail closed.
- Configure real credit packages in Razorpay test mode, test capture, duplicate webhook delivery, incorrect signatures/amounts, refunds and payment failure.
- Verify credit limits, failed-request refunds, concurrency, audit records, support tickets, incident updates and setting toggles.
- Confirm SSL/TLS, restricted Postgres credentials, firewall rules, log redaction, rate limiting, privacy terms and retention before charging customers.

## Known deployment blockers

The repository contains no production secrets, provider account access or licensed model weights. Real operational E2E validation cannot pass until the Vercel environment variables and persistent speech-inference deployment are configured. Recent GitHub checks indicated a **Vercel build-rate limit**; that is not proof of either a successful or failed TypeScript build for the new admin code.

This shared Supabase project also contains unrelated application tables. Do not alter their schema or permissions while deploying Vāchaspati. Prefer a dedicated database role with minimal grants, or a dedicated Supabase project, before handling production customer data.
