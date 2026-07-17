# Greenroom Authentication — setup & handoff

Google OAuth (Authorization Code + PKCE) login for the Greenroom desktop.
This doc covers how it's wired, what still needs configuring by whoever owns
the Google Cloud project, and the checklist for turning it on in production.

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
| Frontend build (`import.meta.env`) | `VITE_AUTH_ENABLED` | Master switch — gate the desktop behind login | `false` |
| Frontend build | `VITE_AUTH_MODE` | `mock` (fake login, no Google/backend) or `google` (real flow) | `mock` |
| Frontend build | `VITE_GOOGLE_CLIENT_ID` | Override the OAuth client ID | hardcoded public default |
| Backend env | `GOOGLE_CLIENT_SECRET` | **Server-side only.** Code→token exchange | *(empty → exchange returns 503)* |
| Backend env | `GOOGLE_CLIENT_ID` | ID-token audience check | hardcoded public default |
| Backend env | `REQUIRE_AUTH` | Enforce 401/403 on all `/api/*` (vs. attach-user-only) | `false` |
| Backend env | `GREENROOM_ADMIN_ROLES` | Which `users.role` values are admin | `admin,manager` |

Nothing changes for existing users until `VITE_AUTH_ENABLED=true` (frontend)
and, separately, `REQUIRE_AUTH=true` (backend enforcement).

## Local development

Local dev runs on **:5173** (the default Vite port), proxied to the local
Django backend on `:8000`.

**Mock mode (works today, no Google/secret needed)** — develop the gated app:
```bash
GREENROOM_API_TARGET=http://localhost:8000 \
  VITE_AUTH_ENABLED=true VITE_AUTH_MODE=mock bun dev
```
"Sign in with Google" fakes a verified admin session (user id 8). Good for
building/behaviour work behind the gate. Port doesn't matter in mock mode (no
Google redirect).

**Real Google mode locally** — needs the two prerequisites below:
```bash
GREENROOM_API_TARGET=http://localhost:8000 \
  VITE_AUTH_ENABLED=true VITE_AUTH_MODE=google bun dev
```
Do **not** use `bun run dev:vercel` — it points at the **prod** API instead of
the local `:8000` backend. Prerequisites:
1. `GOOGLE_CLIENT_SECRET=…` in `c:\Projects\backend\.env`, then restart the
   Django server (`.venv\Scripts\python manage.py runserver 8000`).
2. `http://localhost:5173/auth/callback` in the OAuth client's redirect URIs.

---

## ✅ Action items for the Google Cloud / auth owner

The frontend + backend code is done. These are the only things outside the code:

1. **Authorized redirect URIs** on OAuth client
   `407614724084-…apps.googleusercontent.com`:
   - `http://localhost:5173/auth/callback` (local dev — the Vite port we use)
   - `https://greenroom.daytimers.org/auth/callback` (prod)
   - *(Authorized JavaScript origins are **not** needed — exchange is server-side.)*
2. **Provide the client secret** (`GOCSPX-…`) so it can be set as
   `GOOGLE_CLIENT_SECRET` in the backend env (dev `.env`; prod SSM / Lambda env
   on `prod-users-service`). It must never be committed or shipped to the browser.

---

## Will it "just work" in prod? — NO, here's the checklist

Deploying the current commits alone will **not** enable auth. Required steps:

1. **Frontend build flags.** `VITE_AUTH_ENABLED=true` + `VITE_AUTH_MODE=google`
   must be set **at build time** (Vite bakes `import.meta.env` into the bundle).
   Add them to the `deploy.ps1` build env / `.env.production`. Without this the
   prod bundle has auth off.
2. **Backend redeploy — all domains.** The auth middleware lives in the shared
   `settings.py`, so it runs in **every** domain Lambda, not just users. Redeploy
   all `prod-<domain>-service` functions with the new code. `google-auth` +
   `requests` are in `requirements.txt`, so the CI build bundles them.
3. **`GOOGLE_CLIENT_SECRET` on `prod-users-service`** (the Lambda that does the
   exchange) via SSM/Lambda env.
4. **CORS at the gateway** — the prod frontend (`greenroom.daytimers.org`) calls
   the API cross-origin, and the bearer header + JSON POST make requests
   *non-simple*, so the gateway must answer **preflight (OPTIONS)** and allow the
   `Authorization` header + the origin. This is the main infra item and is
   currently not configured (the API sends no CORS headers today).
5. **CloudFront SPA fallback** for `/auth/callback` → serve `index.html`
   (403/404 → `/index.html`, 200). Otherwise the callback URL 404s on prod.
6. **Google Console** — prod redirect URI added (see action items above).
7. **Allowlist in prod DB** (`DT-Test`) — real Google emails on `users` rows.
8. **Enforcement rollout** — deploy with `REQUIRE_AUTH=false` first (endpoints
   work, nothing blocked), confirm the frontend is sending tokens for all
   traffic, then flip `REQUIRE_AUTH=true` to actually close the open API.

Order: 1–3 + 6 can go together; 4 & 5 are infra; 7 anytime; 8 last.

## Dev DB note
For local testing, dev `users` id 8's email was changed to a real Google
address so it maps on login. This is `greenroom_dev` only — prod `DT-Test` is
untouched.
