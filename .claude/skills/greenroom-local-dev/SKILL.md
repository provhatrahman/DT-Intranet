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

## Notes
- **Auth is off by default** (app is ungated; `:5173` is fine). To develop/test the
  Google **login gate**, run the frontend on **`:3000`** (the registered OAuth redirect
  URI) with `VITE_AUTH_ENABLED=true`, and set `GOOGLE_CLIENT_SECRET` in the backend
  `.env` (then restart the backend). Full procedure + flags: `AUTH_SETUP.md`.
  ```
  # PowerShell:
  $env:PORT="3000"; $env:GREENROOM_API_TARGET="http://localhost:8000"; $env:VITE_AUTH_ENABLED="true"; bun dev
  ```
- Unset `GREENROOM_API_TARGET` (new terminal) → frontend hits the **prod** Greenroom API.
- Use `bun run dev:vercel` instead of `bun dev` if you need ryOS AI/chat (`/api/*`) routes —
  but that mode calls the prod Greenroom API, not local.
- The proxy switch lives in `vite.config.ts` (`server.proxy["/greenroom-api"].target`).
- Backend endpoints: views in `c:\Projects\backend\api\views\<domain>.py`, routes in
  `lambdas\<domain>\urls.py`. `runserver` hot-reloads on save.
- To reset/refresh the dev DB from prod, use the `greenroom-db-change` skill.
