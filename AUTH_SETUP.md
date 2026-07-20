# Greenroom Authentication — setup & handoff

Google OAuth (Authorization Code + PKCE) login for the Greenroom desktop.
This doc covers how it's wired and records how it was turned on in production.

**Status:** ✅ **LIVE and ENFORCED in production** (2026-07-20). The desktop at
greenroom.daytimers.org requires an allowlisted Google login (`VITE_AUTH_ENABLED=true`
in the live build), and the API rejects anonymous traffic (`REQUIRE_AUTH=true` on all
9 active domain Lambdas — anonymous `/api/*` → 401). Real admin emails are in the prod
allowlist and login is verified working end-to-end. Getting there required new infra
(a NAT gateway) and fixing two Lambda dependency-bundling bugs — see the **Prod
enablement — DONE** section below for the full runbook and rollback.

## How it works

1. User clicks **Sign in with Google** on the Aqua login gate.
2. Browser redirects to Google (PKCE, `code_challenge=S256`).
3. Google redirects back to `/auth/callback?code=…`.
4. Browser POSTs `{code, code_verifier, redirect_uri}` to the backend
   **`POST /api/users/auth/exchange`**.
5. **Backend** exchanges the code for tokens using the **client secret**
   (server-side only — never in the browser), verifies the returned Google
   **ID token**, and looks the email up in the `users` table (the allowlist).
6. Backend returns `{user, id_token}`. The frontend stores the id_token and
   sends it as `Authorization: Bearer <id_token>` on subsequent API calls.
7. Backend middleware re-verifies the bearer on each request (enforcement is
   flag-gated — see `REQUIRE_AUTH`).

> The code→token exchange is **server-side** because Google "Web application"
> clients require the client secret at the token endpoint even with PKCE. This
> is why the frontend does **not** call Google's token endpoint directly, and
> why **Authorized JavaScript origins are NOT required** in the OAuth client.

## The allowlist = the `users` table

A Google account can log in **only if its email exists in `users.email`**. No
match → `403 not_allowlisted`. `is_admin` is derived from `users.role`
(`admin`/`manager`). To grant someone access, put their **real Google email**
on a `users` row in the prod DB `DT-Test` (see `greenroom-db-change`; DDL/DML on
`DT-Test` runs as master `admindaytimers`). Real admin emails were added
2026-07-20; the old seeded `@greenroom.com` rows are dummies and never map to a
real Google account.

## Flags & secrets

| Where | Name | Purpose | Default |
|---|---|---|---|
| Frontend build (`import.meta.env`) | `VITE_AUTH_ENABLED` | Master switch — gate the desktop behind Google login | code `false` · **prod build: `true`** (deploy.ps1 defaults it on) |
| Frontend build | `VITE_GOOGLE_CLIENT_ID` | Override the OAuth client ID | hardcoded public default |
| Backend env | `GOOGLE_CLIENT_SECRET` | **Server-side only.** Code→token exchange | *(empty → exchange 503)* · **set on prod-users-service** |
| Backend env | `GOOGLE_CLIENT_ID` | ID-token audience check | hardcoded public default |
| Backend env | `REQUIRE_AUTH` | Enforce 401 on all `/api/*` (vs. attach-user-only) | code `false` · **prod: `true` on all 9 active domain Lambdas** |
| Backend env | `GREENROOM_ADMIN_ROLES` | Which `users.role` values are admin | `admin,manager` |

In **prod both are ON**: `VITE_AUTH_ENABLED=true` (desktop gated) and
`REQUIRE_AUTH=true` (API closed). To un-gate the desktop, rebuild/redeploy the
frontend with `$env:VITE_AUTH_ENABLED="false"`; to reopen the API, set
`REQUIRE_AUTH=false` on the Lambda envs. The two are independent switches.

## Local development

**Login gate on** — must run on **:3000** (the registered local redirect URI),
pointed at the local Django backend on `:8000`:
```bash
PORT=3000 GREENROOM_API_TARGET=http://localhost:8000 \
  VITE_AUTH_ENABLED=true bun dev
```
Do **not** use `bun run dev:vercel` — it's also :3000 but points at the **prod**
API instead of the local `:8000` backend. Prerequisites (both done):
1. `GOOGLE_CLIENT_SECRET=…` in `c:\Projects\backend\.env`, then restart the
   Django server (`.venv\Scripts\python manage.py runserver 8000`).
2. `http://localhost:3000/auth/callback` registered on the OAuth client.

**Ungated dev** — to work without logging in, just omit `VITE_AUTH_ENABLED`
(or set it `false`). The app runs as before, on any port, no bearer headers.

---

## ✅ Action items for the Google Cloud / auth owner

The frontend + backend code is done. These are the only things outside the code:

1. **Authorized redirect URIs** on OAuth client
   `407614724084-…apps.googleusercontent.com`:
   - `http://localhost:3000/auth/callback` (local dev)
   - `https://greenroom.daytimers.org/auth/callback` (prod)
   - *(Authorized JavaScript origins are **not** needed — exchange is server-side.)*
   - **Status: ✅ done** — both registered by the OAuth owner.
2. **Provide the client secret** (`GOCSPX-…`) so it can be set as
   `GOOGLE_CLIENT_SECRET` in the backend env (dev `.env`; prod Lambda env
   on `prod-users-service`). It must never be committed or shipped to the browser.
   - **Status: ✅ done** — in the local backend `.env` (dev) and set on
     `prod-users-service` (prod, 2026-07-20).

---

## Prod enablement — DONE (2026-07-20)

Auth is fully enabled in prod. This section records what was applied and how to
roll back. Everything below is ✅ live unless noted.

1. **Frontend build flag** — `deploy.ps1` defaults `VITE_AUTH_ENABLED=true`, and
   the live build (`1a82122`) shipped gated. The desktop requires Google login.
2. **Backend auth code → prod — all domains** — `main` promoted, CI built, and
   all `prod-<domain>-service` Lambdas updated (the middleware is in shared
   settings → runs in every domain Lambda). Domains are now **10** (added `music`;
   `events` is retired).
3. **`GOOGLE_CLIENT_SECRET` on `prod-users-service`** — set (merged into the env,
   nothing clobbered). Exchange endpoint returns a real Google response (not 503).
4. **CORS at the gateway** — already configured for `https://greenroom.daytimers.org`
   (`authorization,content-type`). No change needed.
5. **CloudFront SPA fallback** — dist `E3OF10QS7S5YPV` now has `CustomErrorResponses`
   (403/404 → `/index.html`, 200), so `/auth/callback` and app deep links resolve.
6. **Google Console** — prod redirect URI `https://greenroom.daytimers.org/auth/callback`
   registered.
7. **Allowlist in prod DB** (`DT-Test`) — real admin Google emails added to `users`
   (via `backend/scripts/sql/allowlist_prod.sql`, run as `admindaytimers`). Snapshot
   `prod-postgres-predeploy-20260717` taken first.
8. **Enforcement** — `REQUIRE_AUTH=true` on **all 9 active domain Lambdas**
   (`users, artists, bookings, projects, tasks, pitches, payments, analytics, music`).
   Verified: anonymous `/api/*` → 401 `missing_token`, bad token → 401 `invalid_token`,
   real login → desktop loads and authenticated calls succeed.
   *(A 10th deployed Lambda, `prod-events-service`, is a **retired orphan** — its code
   and DB were removed months ago, it predates the auth middleware, and `/api/events/`
   returns 500. It is NOT enforced and exposes no data; it should be removed along with
   its `ANY /api/events/{proxy+}` gateway route.)*

### Three blockers we hit turning it on (and the fixes)

The commits alone did not make login work — three prod-only issues surfaced in order:

1. **No VPC egress.** The domain Lambdas run in private subnets with no NAT, so the
   server-side code→token call to `oauth2.googleapis.com` timed out (10s). **Fix:**
   created NAT gateway `nat-004f38aa2518c0fdd` (EIP `51.24.142.253`) in
   `prod-public-subnet-1` and added `0.0.0.0/0 → NAT` to the private route table
   `rtb-08dd35c327cf76fa7`. **This NAT is required for OAuth and costs ~$33/mo.**
2. **Missing pure-Python deps.** `google-auth`'s deps `rsa` / `cachetools` /
   `pyasn1-modules` were absent from the bundle (the cross-platform pip resolver
   drops `py3-none-any` wheels). → ID-token verify raised ImportError → 503.
3. **Wrong-glibc `cryptography`.** CI (Ubuntu) bundled cryptography's
   `manylinux_2_34` wheel; the Lambda python3.11 runtime is Amazon Linux 2
   (**glibc 2.26**), so the native `_rust` binding couldn't load → 503. **Fix:**
   swapped in the `manylinux_2_17` (glibc 2.17) wheel.

Blockers 2 & 3 were hot-patched into all 9 active Lambda zips, and the **root cause is
fixed for future builds** in `backend/scripts/build_lambdas.py` (commit `ddebb10`):
always cross-target `manylinux2014`, plus a second unconstrained pip pass for the
pure-Python deps.

### Rollback
- **Reopen the API:** set `REQUIRE_AUTH=false` on the 10 Lambda envs (or roll back
  to the pre-enforcement Lambda version), then `update-function-configuration`.
- **Un-gate the desktop:** rebuild + redeploy the frontend with
  `$env:VITE_AUTH_ENABLED="false"`.
- **DB:** snapshot `prod-postgres-predeploy-20260717`.

### Known caveat
Per-domain `/api/<domain>/health/` endpoints now return 401 (the exempt list only
covers `/api/health`, `/api/docs`, `/api/users/auth/exchange`, `/api/users/auth/verify`).
Harmless — the top-level `GET /health` (separate `prod-health-check` Lambda) stays
public and is what monitoring uses. To exempt the per-domain ones, widen
`_PUBLIC_PREFIXES` in `shared/middleware/auth.py` and redeploy.

## Dev DB note
For local testing, dev `users` id 8's email was changed to a real Google address so
it maps on login. This is `greenroom_dev` only — prod `DT-Test` was allowlisted
separately (item 7 above).
