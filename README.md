# Vāchaspati AI — Speech and Voice Agent SaaS

A Next.js 15 + TypeScript voice infrastructure platform using custom email/password authentication and Supabase-hosted PostgreSQL. **Supabase Auth is not used**. All product tables are in the private `vachaspati_private` schema and begin with `vachaspati_`.

## Actual implementation

- Animated responsive marketing pages with Motion and premium typography.
- Custom password auth with per-user workspace creation, scrypt password hashing, HttpOnly cookies, random token sessions, session revocation and login throttling.
- One-time password reset links and optional verified-email sign-in through the Resend Email API (requires verified sender and provider credentials).
- Authenticated dashboard with agent creation/editing/publishing, approved website domains, configurable OpenRouter model and voice ID, API key issuance/revocation and actual credit usage.
- Tenant-scoped PostgreSQL REST APIs, hashed bearer keys, scope enforcement and rate limiting.
- OpenRouter text conversations with persisted session history, no hardcoded chat replies.
- Atomic account credit reservations, configurable rates, failure refunds, daily/weekly/monthly quotas and per-plan concurrent-request limits.
- `public/widget.js`: real floating Shadow DOM widget with text chat, browser microphone capture, WAV conversion, STT, agent response and TTS playback.
- Separate `worker/` Node.js service built with Sherpa-ONNX native addons for PCM16 WAV ASR and TTS, configurable by model files.
- Public catalog comes from the database; models aren't advertised as live until enabled.
- GitHub CI checks for TypeScript, Next production build and widget/worker script syntax.

## Production setup (required before calling the service live)

1. Configure `DATABASE_URL` in Vercel from the connected Supabase project's **transaction-pooler** Postgres connection string. Keep the password private. The connected database has 33 Vāchaspati-prefixed tables (verified with RLS enabled as of November 23, 2026). Review migrations before recreating on another database.
2. Set `APP_ORIGIN` to the exact production site origin (including `https://`).
3. Set `OPENROUTER_API_KEY` for actual AI replies. Each agent's LLM model is stored in PostgreSQL; `OPENROUTER_DEFAULT_MODEL` is optional.
4. Deploy `worker/` to a persistent Linux container / VM (Railway, Render or your own host), mount licensed Sherpa-ONNX ASR and TTS weights, then configure `SHERPA_INFERENCE_URL` and matching `SHERPA_WORKER_SECRET` on the Next.js server.
5. Optional password recovery requires verified `MAIL_FROM` and `RESEND_API_KEY`.
6. Run `npm install`, `npm run typecheck`, and `npm run build`, and test account creation, agent publishing, real audio, rate limiting and subscription quotas.
7. Create an account, publish an agent to approved domains, and copy its unique embed snippet from the dashboard.

Secrets must **never** be committed to Git, served as `NEXT_PUBLIC_` values, or included in the embed script. Only the published agent ID may be public.

## Super Admin, prepaid billing, live operations

- **Separate MFA-protected operations console:** `/superadmin` with real administrator roles, audit records and staff access controls. No hardcoded administrator identities.
- **Customer billing:** `/dashboard/billing` with database-configured INR credit packages, real Razorpay orders and signed webhook fulfillment (only after captured payment).
- **Customer support:** `/dashboard/support` with persistent tickets and threaded replies. Staff can triage tickets and leave private notes in Super Admin.
- **Operations:** real database and provider health checks, signup/publishing/maintenance toggles, prepaid balance adjustments, platform announcements, incidents, usage and model catalogs.
- **Full administrator setup runbook:** [SUPERADMIN.md](./SUPERADMIN.md). Read this before trying to grant your first administrator role or configure payment credentials.
- **Current deployment constraint:** Vercel reports a build-rate-limit failure for the latest commits. This is not a passing production build. Re-run the build after the account's limit is lifted or use an appropriately provisioned deployment environment.
- **Still incomplete:** actual native speech worker hosting and licensed weights, real payment capture testing, automatic refund settlement, recurring paid subscriptions/invoices and low-latency full-duplex WebSocket speech. Do not advertise these as production ready.

## API endpoints

| Endpoint | Method | Authentication |
|---|---|---|
| `/api/auth/register` | POST | Same-origin form |
| `/api/auth/login` | POST | Same-origin form |
| `/api/auth/logout` | POST | Session cookie |
| `/api/auth/me` | GET | Session cookie |
| `/api/auth/password-reset/request` | POST | Same-origin form |
| `/api/auth/password-reset/confirm` | POST | One-time reset token |
| `/api/console/agents` | GET/POST | Owner/admin/developer session |
| `/api/console/agents/:id` | PATCH/DELETE | Owner/admin/developer session |
| `/api/console/keys` | GET/POST | Owner/admin/developer session |
| `/api/console/keys/:id` | DELETE | Owner/admin session |
| `/api/console/usage` | GET | Workspace session |
| `/api/v1/agents` | GET/POST | Scoped bearer key |
| `/api/v1/agents/:id` | GET/PATCH/DELETE | Scoped bearer key |
| `/api/v1/agents/:id/config` | GET | Approved website origin |
| `/api/v1/agents/:id/chat` | POST | Approved website origin |
| `/api/v1/agents/:id/transcribe` | POST | Approved website origin |
| `/api/v1/agents/:id/speak` | POST | Approved website origin |
| `/api/v1/audio/transcriptions` | POST | `audio:write` API key |
| `/api/v1/audio/speech` | POST | `audio:write` API key |
| `/api/v1/usage` | GET | `usage:read` API key |
| `/api/public/catalog` | GET | Public |
| `/api/auth/verify/request` | POST | Credentials for existing unverified account |
| `/api/auth/verify/confirm` | POST | Single-use email confirmation token |
| `/api/billing/packages` | GET | Public |
| `/api/billing/orders` | GET/POST | User session |
| `/api/billing/webhook` | POST | Verified Razorpay signature |
| `/api/support/tickets` | GET/POST | User session |
| `/api/support/tickets/:id` | GET/POST | Tenant-scoped user session |
| `/api/admin/auth/login` | POST | Email, password and MFA code |
| `/api/admin/auth/enroll` | POST | Explicit admin role + account session + password |
| `/api/admin/auth/confirm` | POST | TOTP enrollment code |
| `/api/admin/:resource` | GET/POST | Privileged administrator session |
| `/api/admin/:resource/:id` | PATCH | Role-checked administrator session |
| `/api/admin/support/:id` | GET/POST | Administrator session |
| `/api/public/announcements` | GET | Public |

## Limitations / not yet production-verified

- Actual production environment credentials aren't stored in this repository. Until configured, the routes return explicit unavailability errors.
- The native Sherpa worker has code and Docker packaging, but **licensed model weights and compute deployment** are external requirements. Only enabled/tested models should be advertised.
- Realtime WebSocket streaming, automatic speech interruption, payment checkout, paid subscriptions, and provider-level uptime/error handling are not complete. The widget implements turn-based voice interaction, not sub-second full-duplex streaming.
- User email verification, a privacy-retention policy, worker-side multi-model localization, and comprehensive browser/e2e security tests require additional release work.
- Database-backed per-plan concurrency and credits are enforced for the implemented AI calls. Monetary billing is **not** connected. No claims of production readiness are made without passing live integration tests.

## Resources

- API docs: `/docs`
- Dashboard: `/dashboard`
- Worker details: `worker/README.md`
- Supabase migrations: `supabase/migrations/`
- Sherpa-ONNX native API: https://k2-fsa.github.io/sherpa/onnx/javascript-api/
- OpenRouter chat API: https://openrouter.ai/docs/api/api-reference/chat/send-chat-completion-request
