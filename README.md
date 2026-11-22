# Vāchaspati AI — Voice Agent Platform

Next.js + TypeScript frontend, with a PostgreSQL-backed custom email/password identity layer. Supabase is used **only as the Postgres database host**; this project does **not** use Supabase Auth.

## Current implementation

- Premium multipage website and Motion animations.
- Custom auth endpoints: `POST /api/auth/register`, `POST /api/auth/login`, `POST /api/auth/logout`, `GET /api/auth/me`.
- Registration and login forms at `/signup` and `/login`.
- Authenticated `/dashboard` showing workspaces from the real database.
- Salted scrypt password hashes, opaque random session tokens (SHA-256 hashes in DB), HttpOnly/Secure/SameSite cookies, origin checks, and database-backed login attempt limiting.
- Initial schema for agents, model catalog, API keys, quotas, credit ledger, conversations, and usage. Those voice-service features are **not yet operational**.

## Schema naming requirement

Every table begins with `vachaspati_` and resides in the private schema `vachaspati_private`. For example:

- `vachaspati_private.vachaspati_users`
- `vachaspati_private.vachaspati_sessions`
- `vachaspati_private.vachaspati_agents`
- `vachaspati_private.vachaspati_api_keys`

The schema is intentionally not exposed through Supabase's Data API. Server-side parameterized SQL must enforce workspace membership on every resource access. No `auth.users` references, `auth.uid()`-based policies, or Supabase Auth SDKs.

## Configuration and deployment

1. Use a dedicated Supabase PostgreSQL project (do **not** assume an existing unrelated project is safe to modify).
2. Run `supabase/migrations/202611230001_core_platform.sql` against that database after reviewing it.
3. Copy `.env.example` to `.env.local`, and supply `DATABASE_URL` using the **Transaction pooler** URL from Supabase Dashboard → Connect. Keep it server-side and secret. Use TLS in production.
4. Set `APP_ORIGIN` to the exact production site origin.
5. Run `npm install`, then `npm run build` and `npm run dev`.

The app does not perform DB setup at build time; auth endpoints require an actual database connection at runtime. Until migration and environment variables are configured, they will return an unavailable-service error.

## Security and production readiness

Password hashing, session expiration and revocation, CSRF origin protection and basic login throttling are implemented. **Still required before public production launch:** verified email delivery and verification, secure password recovery, proper abuse controls at the edge (IP-spoof-resistant rate limiting), operational audit logs, automated integration/security tests, and a CI-verified production build.

Speech inference, OpenRouter live agent execution, usage billing, embed gateway and real model deployment still require separate implementation and infrastructure. Public-facing demo components are not connected to paid services and should not be described as live APIs.
