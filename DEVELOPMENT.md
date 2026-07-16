# Greenroom — Local Development Guide

Everything a solo full-stack dev needs to run, change, and ship Greenroom.
Greenroom = the **frontend** (this repo, `ryos` shell + domain apps) + a separate
**backend** (Django-on-Lambda) at `c:\Projects\backend`, both hosted in one AWS
account (`471028617262`, region `eu-west-2`).

> **Auth note:** the Greenroom API currently has **no authentication** — anyone who
> can reach it can read/write all data. This is a known limitation to be addressed
> later via development. Don't rely on the frontend "admin" allowlist for security.

---

## Daily workflow (the loop)

Two environments: **dev = your local machine** (local API + the isolated `greenroom_dev` DB —
there is **no** separately-deployed dev site) and **prod = the live system**. The flow is always
**build & test locally → deploy to prod.**

1. **Branch:** `git checkout greenroom-develop && git pull` (both repos; optional `feat/<name>`).
2. **Run the local stack** (§1B): backend `runserver 8000` + frontend with `GREENROOM_API_TARGET=http://localhost:8000`.
3. **Make changes:** frontend `src/…`; backend `api/views/<domain>.py` + `lambdas/<domain>/urls.py`;
   DB via idempotent SQL applied to `greenroom_dev` (§3). Everything hot-reloads.
4. **Test on dev:** exercise it in the browser, `curl` the local API, and gate the frontend with
   `bun run lint` + `bun run build`.
5. **Commit:** `git add -A && git commit -m "…"`.
6. **Deploy only what changed** (§4): frontend → `.\deploy.ps1`; backend → push to `main` → CI →
   `update-function-code`; DB → snapshot then run the *same tested SQL* against `DT-Test`.
   **Apply DB changes before** the backend code that depends on them.

Rollback: frontend → redeploy previous commit; backend → Lambda version `1` or previous S3 zip;
DB → restore snapshot.

---

## 0. One-time prerequisites

- **AWS CLI** logged in as profile `greenroom-cli` (admin). Check:
  `aws sts get-caller-identity --profile greenroom-cli`
- **Bun** (frontend), **Python venv** already set up in `c:\Projects\backend\.venv`.
- **PostgreSQL 18 client** at `C:\Program Files\PostgreSQL\18\bin` (for `psql`/`pg_dump`).
- Backend `.env` is already pointed at the **isolated dev database** (`greenroom_dev`
  as `devuser`) — local work can never touch production data.

---

## 1. Two ways to run the frontend

### A) Against PRODUCTION data (quick UI work) — default
```powershell
cd c:\Projects\ryos
bun run dev:vercel      # full ryOS (needed for AI/chat /api routes); calls the live Greenroom API
# or: bun dev           # lighter, UI only
```
The Greenroom API calls proxy to the live AWS gateway (real prod data via `DT-Test`).

### B) Against your LOCAL backend + dev DB (safe, isolated) — recommended for domain work
Two terminals:
```powershell
# Terminal 1 — local API serving the isolated dev DB
cd c:\Projects\backend
.venv\Scripts\python manage.py runserver 8000

# Terminal 2 — frontend pointed at the local API
cd c:\Projects\ryos
$env:GREENROOM_API_TARGET = "http://localhost:8000"
bun dev
```
Now the app reads/writes `greenroom_dev` only. Unset `GREENROOM_API_TARGET` (new
terminal) to go back to prod. The proxy switch lives in `vite.config.ts`.

---

## 2. Changing the backend (code)

The backend is a Django app split into per-domain Lambdas, but locally it runs as
**one server** — `manage.py runserver` serves every domain at `/api/<domain>/`.

- Endpoints live in `c:\Projects\backend\api\views\<domain>.py`; routes in
  `lambdas\<domain>\urls.py`. Adding a route **under an existing domain**
  (e.g. `/api/projects/<id>/foo/`) needs **only code** — the API Gateway already
  forwards everything under `/api/<domain>/` to that domain's Lambda.
- Edit → it hot-reloads under `runserver` → test via the frontend (mode B) or curl:
  `curl http://localhost:8000/api/projects/`
- A brand-new **top-level** domain (e.g. `/api/venues/`) needs new infra
  (Lambda + gateway route) — that's Terraform in a separate infra repo. Flag it.

---

## 3. Changing the database (schema)

**Important:** domain tables are **not** managed by Django migrations — they're
created/altered by **hand-run SQL** (see `backend\scripts\sql\*.sql` for the pattern).

Workflow for a schema change:
1. Write the SQL (idempotent — use `IF NOT EXISTS` / `IF EXISTS`).
2. **Test on dev first:**
   ```powershell
   & "C:\Program Files\PostgreSQL\18\bin\psql.exe" `
     -h prod-postgres.c76kwqimoyuh.eu-west-2.rds.amazonaws.com `
     -U devuser -d greenroom_dev -f your_change.sql
   # password = DB_PASSWORD in backend\.env
   ```
3. Verify the app still works locally.
4. **Apply to prod** — take a snapshot first (see §5), then run the same SQL against
   the real DB (`-U appdaytimers -d DT-Test`, app password from the Lambda env).

**Refresh the dev DB from prod** (re-clone data anytime):
```powershell
$env:PGPASSWORD = "<appdaytimers password>"
& "C:\Program Files\PostgreSQL\18\bin\pg_dump.exe" -h <host> -U appdaytimers -d DT-Test --no-owner --no-privileges `
  | & "C:\Program Files\PostgreSQL\18\bin\psql.exe" -h <host> -U appdaytimers -d greenroom_dev
```

### Database cheat-sheet
| | Host | DB | User | Use |
|---|---|---|---|---|
| **Dev** | prod-postgres…rds…com | `greenroom_dev` | `devuser` | local dev (isolated clone) |
| **Prod** | prod-postgres…rds…com | `DT-Test` | `appdaytimers` | real data — careful |

---

## 4. Deploying

### Frontend → live (greenroom.daytimers.org)
```powershell
cd c:\Projects\ryos
$env:AWS_PROFILE = "greenroom-cli"
.\deploy.ps1              # builds, syncs to S3, invalidates CloudFront
```

### Backend → live Lambdas
Local machine can't build deployable zips (Windows/Py3.13 vs Lambda Linux/Py3.11),
so build via CI:
1. Push your backend changes to `main` → GitHub Actions builds the changed
   domain(s) and uploads `*-service.zip` to `s3://prod-lambda-artifacts-471028617262/`.
2. Point the Lambda at the new zip:
   ```powershell
   aws lambda update-function-code --profile greenroom-cli --region eu-west-2 `
     --function-name prod-<domain>-service `
     --s3-bucket prod-lambda-artifacts-471028617262 --s3-key <domain>-service.zip
   ```
**Rollback:** each Lambda has a published version `1` (pre-dev baseline) to revert to.

---

## 5. Safety before touching prod

- Prod RDS has **deletion protection ON** and **7-day backups**.
- Manual restore point exists: snapshot `prod-postgres-predev-20260716`.
- **Before any prod schema change**, take a fresh snapshot:
  ```powershell
  aws rds create-db-snapshot --profile greenroom-cli --region eu-west-2 `
    --db-instance-identifier prod-postgres --db-snapshot-identifier predev-<yyyymmdd-desc>
  ```

---

## Tips & troubleshooting

- **Preview a prod build locally** before deploying: `bun run preview` (serves `dist/` at :4173).
- **Version bump** (user-visible release number): run `bun run version:bump` before `.\deploy.ps1`.
  Update prompts also fire on build-number (commit SHA) change, so a bump isn't required for redeploys.
- **`bun dev` port in use:** `$env:PORT=3000; bun dev`.
- **Build fails:** TypeScript errors → fix them; missing deps → `bun install`. Always `bun run build` before deploying.
- **Deploy "Unable to locate credentials":** you didn't set the working profile — `$env:AWS_PROFILE="greenroom-cli"`.
- **Deploy "NoSuchDistribution":** CloudFront id must be `E3OF10QS7S5YPV`.
- **Site not updating:** CloudFront invalidation takes 1–5 min; then hard-refresh (Ctrl+Shift+R).

## Key facts
- **AWS account:** `471028617262` / `eu-west-2` / profile `greenroom-cli`
- **Live frontend:** https://greenroom.daytimers.org (S3 + CloudFront `E3OF10QS7S5YPV`)
- **Live API:** https://jzre02jvh9.execute-api.eu-west-2.amazonaws.com/api (trailing slash required)
- **Backend repo:** `c:\Projects\backend` (github.com/arronS22/greenroom-backend)
- See `DEPLOYMENT.md` for deeper deploy detail; `backend\INFRASTRUCTURE_INTEGRATION.md` for infra.
