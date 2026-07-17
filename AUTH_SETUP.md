# Greenroom Authentication — setup & handoff

Google OAuth (Authorization Code + PKCE) login for the Greenroom desktop.
This doc covers how it's wired, what still needs configuring by whoever owns
the Google Cloud project, and the checklist for turning it on in production.

**Status:** ✅ Verified working end-to-end in **local dev** (frontend `:3000` +
local backend `:8000`) — real Google login lands on the desktop. Google Cloud
OAuth client is configured and the client secret is in the local backend
`.env`. Remaining work is **production enablement** (see the checklist below).

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
on a `users` row (see `greenroom-db-change`). The seeded rows use dummy
`@greenroom.com` emails, which are not real Google accounts.

## Flags & secrets

| Where | Name | Purpose | Default |
|---|---|---|---|
| Frontend build (`import.meta.env`) | `VITE_AUTH_ENABLED` | Master switch — gate the desktop behind Google login | `false` |
| Frontend build | `VITE_GOOGLE_CLIENT_ID` | Override the OAuth client ID | hardcoded public default |
| Backend env | `GOOGLE_CLIENT_SECRET` | **Server-side only.** Code→token exchange | *(empty → exchange returns 503)* |
| Backend env | `GOOGLE_CLIENT_ID` | ID-token audience check | hardcoded public default |
| Backend env | `REQUIRE_AUTH` | Enforce 401/403 on all `/api/*` (vs. attach-user-only) | `false` |
| Backend env | `GREENROOM_ADMIN_ROLES` | Which `users.role` values are admin | `admin,manager` |

Nothing changes for existing users until `VITE_AUTH_ENABLED=true` (frontend)
and, separately, `REQUIRE_AUTH=true` (backend enforcement).

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
   `GOOGLE_CLIENT_SECRET` in the backend env (dev `.env`; prod SSM / Lambda env
   on `prod-users-service`). It must never be committed or shipped to the browser.
   - **Status: ✅ done for dev** — secret is in the local backend `.env`. Prod
     still needs it set on `prod-users-service` (see checklist item 3).

---

## Prod enablement runbook — verified 2026-07-17

Deploying the current commits alone will **not** enable auth. State below was
verified against live prod on 2026-07-17 (✅ = confirmed done, ❌ = outstanding).
Do these as **one batch**; nothing here has been applied to prod yet.

1. **Frontend build flag.** ✅ **Wired.** `deploy.ps1` now defaults
   `VITE_AUTH_ENABLED=true` before `bun run build` (Vite bakes `import.meta.env`
   at build time). The next frontend deploy ships gated. Override with
   `$env:VITE_AUTH_ENABLED="false"` to ship ungated.
2. **Backend auth code → prod — all domains.** ❌ The auth code is on
   `greenroom-develop` (+ uncommitted working-tree changes), **not on `main`**,
   so prod 404s `/api/users/auth/*`. Get it onto `main`, let CI build, then
   `lambda update-function-code` for **all 9** `prod-<domain>-service` (the
   middleware lives in shared `settings.py` → runs in every domain Lambda).
   `google-auth` + `requests` are already in `requirements.txt`.
   ```bash
   for d in users artists bookings projects tasks pitches payments analytics events; do
     aws lambda update-function-code --profile greenroom-cli --region eu-west-2 \
       --function-name prod-$d-service \
       --s3-bucket prod-lambda-artifacts-471028617262 --s3-key $d-service.zip
     aws lambda wait function-updated --profile greenroom-cli --region eu-west-2 \
       --function-name prod-$d-service
   done
   ```
3. **`GOOGLE_CLIENT_SECRET` on `prod-users-service`** ❌ (the Lambda that does the
   exchange). The value is already in `backend/.env` (same OAuth client). Set it
   on the Lambda env (merge into existing Environment.Variables, don't clobber).
4. **CORS at the gateway** — ✅ **already configured.** Verified: OPTIONS + real
   responses return `access-control-allow-origin: https://greenroom.daytimers.org`
   and `access-control-allow-headers: authorization,content-type`. No action.
   *(This doc previously said CORS was unconfigured — that was stale.)*
5. **CloudFront SPA fallback** ❌ — dist `E3OF10QS7S5YPV` has
   `DefaultRootObject=index.html` but **0 custom error responses**, so
   `/auth/callback` returns 403 from S3 today (verified). Add error responses so
   403/404 → `/index.html` (200). Via `get-distribution-config` → add
   `CustomErrorResponses` → `update-distribution` with the returned `ETag`:
   ```json
   "CustomErrorResponses": { "Quantity": 2, "Items": [
     {"ErrorCode":403,"ResponsePagePath":"/index.html","ResponseCode":"200","ErrorCachingMinTTL":10},
     {"ErrorCode":404,"ResponsePagePath":"/index.html","ResponseCode":"200","ErrorCachingMinTTL":10}
   ]}
   ```
   (Bonus: also fixes hard-navigation to app deep links like `/ipod`, which 403 today.)
6. **Google Console** — ✅ prod redirect URI `https://greenroom.daytimers.org/auth/callback`
   registered (see action items above).
7. **Allowlist in prod DB** (`DT-Test`) ❌ — real Google emails on `users` rows.
   Snapshot first, then apply `backend/scripts/sql/allowlist_prod.sql` (fill in the
   real emails). The seeded `@greenroom.com` rows are dummies and won't map.
8. **Enforcement rollout** ❌ — steps 1–7 leave `REQUIRE_AUTH=false` (API open,
   but the desktop already requires login and sends tokens). Once confirmed all
   traffic carries a bearer, set `REQUIRE_AUTH=true` on every Lambda env and
   redeploy/restart to actually close the open API.

Order: 2 + 3 + 5 + 7 (with a snapshot) go in the batch; 8 last, after verifying login.

## Dev DB note
For local testing, dev `users` id 8's email was changed to a real Google
address so it maps on login. This is `greenroom_dev` only — prod `DT-Test` is
untouched.
