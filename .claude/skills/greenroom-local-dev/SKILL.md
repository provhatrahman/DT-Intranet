---
name: greenroom-local-dev
description: Run the Greenroom app locally as a full stack — a local Django API serving the isolated dev database, with the frontend proxied to it. Use when the user wants to develop or test Greenroom domain features (projects, artists, bookings, pitches, payments) against safe non-production data.
---

# Run Greenroom locally (isolated dev stack)

Runs the whole app against the isolated **`greenroom_dev`** database — never production.

## Steps

1. **Start the backend API** (serves every `/api/<domain>/` route from the dev DB):
   ```
   cd c:\Projects\backend
   .venv\Scripts\python manage.py runserver 8000
   ```
   The DB target comes from `c:\Projects\backend\.env`, which points at `greenroom_dev`
   (user `devuser`, isolated clone — cannot touch prod). Smoke test:
   `curl http://localhost:8000/api/health/` → 200.

2. **Start the frontend pointed at the local API** (separate terminal):
   ```
   cd c:\Projects\ryos
   # PowerShell:
   $env:GREENROOM_API_TARGET = "http://localhost:8000"; bun dev
   # bash:
   GREENROOM_API_TARGET=http://localhost:8000 bun dev
   ```
   App runs at http://localhost:5173 and reads/writes `greenroom_dev` only.

## Optional: run with the login gate ON (test Google auth + Sign Out)

Default local dev is **ungated** (`:5173`, no login) — intentionally different from prod,
where Google auth is live + enforced (see `CLAUDE.md`). To exercise the **login screen**,
**silent re-auth**, or the **Sign Out** menu item, run the frontend gated on **`:3000`**
(the only registered OAuth redirect URI) pointed at the local backend. **No backend change
is needed** — `c:\Projects\backend\.env` already has `GOOGLE_CLIENT_SECRET`, so the
`/api/users/auth/{exchange,verify}` endpoints work as-is.

Keep the backend from Step 1 running, then start the frontend like this instead of Step 2:
```powershell
# PowerShell — gated, :3000, proxied to the local backend
$env:PORT = "3000"; $env:GREENROOM_API_TARGET = "http://localhost:8000"; $env:VITE_AUTH_ENABLED = "true"; bun dev
```
Then open **http://localhost:3000** and sign in with an **allowlisted** Google account.
- The allowlist is the `users` table in `greenroom_dev` (e.g. `provhatr@gmail.com`, admin).
  A non-allowlisted address (like a `@caddo.com` work email not in the table) is rejected
  `not_allowlisted`. List them: `SELECT email, role FROM users;` (see `greenroom-db-change`).
- **Sign Out** lives in the Apple menu (system7/macosx) / Start menu (xp/win98); it only
  renders when `AUTH_ENABLED` is true + a session exists, and returns to the login screen.
- Must be **:3000** (redirect URI `http://localhost:3000/auth/callback`). Sanity check the
  proxy: `GET /greenroom-api/users/auth/verify` → **405** (route exists, wants POST).
- Plain `bun dev` (no `VITE_AUTH_ENABLED`) reverts to the ungated default. Full auth design:
  `AUTH_SETUP.md`; launch matrix: `DEVELOPMENT.md` §1C.

## Notes
- **DB additions as of 2026-07-20** (present in a fresh `greenroom_dev` clone from prod):
  new tables `booking_votes`, `project_updates`, `project_team`, `ipod_tracks`,
  `user_settings` (+ new columns on existing tables), and the artist roster is at
  v2 — 272 active artists. The Google-login allowlist is also just the `users` table
  (`is_admin` derives from `role`) — see `greenroom-db-change` for schema/DDL details,
  including the `admindaytimers` vs `appdaytimers` ownership gotcha on prod.
- Unset `GREENROOM_API_TARGET` (new terminal) → frontend hits the **prod** Greenroom API.
- Use `bun run dev:vercel` instead of `bun dev` if you need ryOS AI/chat (`/api/*`) routes —
  but that mode calls the prod Greenroom API, not local.
- The proxy switch lives in `vite.config.ts` (`server.proxy["/greenroom-api"].target`).
- Backend endpoints: views in `c:\Projects\backend\api\views\<domain>.py`, routes in
  `lambdas\<domain>\urls.py`. `runserver` hot-reloads on save.
- To reset/refresh the dev DB from prod, use the `greenroom-db-change` skill.
