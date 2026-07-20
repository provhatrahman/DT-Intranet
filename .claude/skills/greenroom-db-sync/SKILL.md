---
name: greenroom-db-sync
description: Sync/refresh the Greenroom dev (test) database from production — re-clone greenroom_dev to an exact copy of prod DT-Test (schema + data). Use when asked to "sync the db", "refresh dev from prod", "re-clone the dev database", or get realistic prod data locally. Prod is READ-ONLY in this op; only the local dev DB is overwritten.
---

# Sync the dev database from prod (full re-clone)

Replaces everything in `greenroom_dev` with an exact copy of prod `DT-Test`
(schema + data), leaving dev tables uniformly owned by `appdaytimers` and readable
by `devuser` (the role the local app connects as). **Prod is only ever read.**

One RDS instance `prod-postgres.c76kwqimoyuh.eu-west-2.rds.amazonaws.com:5432` hosts
both DBs. Postgres client: `C:\Program Files\PostgreSQL\18\bin\{psql,pg_dump}.exe`.

| Env | DB | User | Role in this op |
|---|---|---|---|
| **Prod** | `DT-Test` | `appdaytimers` | SOURCE — read-only (`pg_dump`) |
| **Dev** | `greenroom_dev` | `appdaytimers` | TARGET — schema dropped & restored |
| Dev app | `greenroom_dev` | `devuser` | gets DML grants after restore; `.env` `DB_PASSWORD` |

## ⚠️ Direction — CONFIRM before running
This skill is **prod → dev only**. That is the only safe/supported direction: it
overwrites the *local test* DB. **Never** run it in reverse (dev → prod) — that
would destroy real production data AND the live Google-auth allowlist (`users`
table). If the request is ambiguous ("sync the db"), confirm it means refreshing
dev from prod before touching anything.

## Why not the naive `pg_dump | psql`
The older re-clone recipe (plain `pg_dump ... | psql greenroom_dev`, no drop) breaks
on a *populated* dev: `CREATE TABLE ... already exists` + duplicate/PK-conflict on
`COPY`. Dev also has a **mixed-ownership gotcha** — a few tables
(`booking_votes`, `feedback`, `project_team`, `project_updates`) are owned by
`devuser`, not `appdaytimers`, so `appdaytimers` can't even `SELECT` (let alone
`TRUNCATE`/`ALTER`) them. The clean fix below sidesteps both by dropping and
recreating schema `public`.

Key enabler: **`appdaytimers` is a member of `pg_database_owner`**, which owns schema
`public` in `greenroom_dev` — so it can `DROP SCHEMA public CASCADE` even though it
is **not** a superuser. `CASCADE` drops the `devuser`-owned tables too.

## Procedure

All commands are PowerShell. Fetch the `appdaytimers` password inline each time
(shell env does not persist between tool calls). Host/paths:
```powershell
$host_ = "prod-postgres.c76kwqimoyuh.eu-west-2.rds.amazonaws.com"
$psql   = "C:\Program Files\PostgreSQL\18\bin\psql.exe"
$pgdump = "C:\Program Files\PostgreSQL\18\bin\pg_dump.exe"
$env:PGPASSWORD = aws secretsmanager get-secret-value --profile greenroom-cli --region eu-west-2 --secret-id 'prod/app/db_password' --query SecretString --output text
```

**1. Baseline (optional but recommended)** — record prod row counts to verify against
later. Count real rows (`reltuples` shows `-1` for never-analyzed tables):
```powershell
# UNION ALL count(*) over the ~28 domain tables, run against BOTH -d "DT-Test" and -d greenroom_dev
```

**2. Dump prod full** (schema + data), stripping owner/privilege lines so it restores
cleanly as `appdaytimers`:
```powershell
& $pgdump -h $host_ -U appdaytimers -d "DT-Test" --no-owner --no-privileges -f prod_full.sql
```
Sanity-check the file BEFORE dropping anything: `CREATE TABLE` count == `COPY` count
== table count (28 as of 2026-07-20); and it must contain **no** `OWNER TO` /
`admindaytimers` / `GRANT` / `CREATE SCHEMA` lines. (Prod `public` has no extensions
except `plpgsql` in `pg_catalog`, so the schema drop touches nothing exotic — but
re-check `pg_extension` if that ever changes, as extensions in `public` would need
recreating.)

**3. Reset dev schema → restore → re-grant** (destructive to dev only). Use
`ON_ERROR_STOP=1` and abort on any non-zero exit:
```powershell
# 3a  reset schema (as appdaytimers, works via pg_database_owner membership)
@"
DROP SCHEMA public CASCADE;
CREATE SCHEMA public;
ALTER SCHEMA public OWNER TO pg_database_owner;
GRANT USAGE ON SCHEMA public TO public;
GRANT USAGE, CREATE ON SCHEMA public TO devuser;
"@ | & $psql -h $host_ -U appdaytimers -d greenroom_dev -v ON_ERROR_STOP=1

# 3b  restore prod dump
& $psql -h $host_ -U appdaytimers -d greenroom_dev -v ON_ERROR_STOP=1 -f prod_full.sql

# 3c  grant DML to the app role (restore recreates tables owned by appdaytimers)
@"
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO devuser;
GRANT USAGE, SELECT, UPDATE ON ALL SEQUENCES IN SCHEMA public TO devuser;
"@ | & $psql -h $host_ -U appdaytimers -d greenroom_dev -v ON_ERROR_STOP=1
```

**4. Verify:**
- Dev row counts now equal the prod baseline from step 1.
- `SELECT DISTINCT tableowner FROM pg_tables WHERE schemaname='public';` → only `appdaytimers` (28 tables).
- As **`devuser`** (`.env` `DB_PASSWORD`), read a previously-blocked table
  (`SELECT count(*) FROM project_team;`) → succeeds.
- Running app still serves: `Invoke-WebRequest http://localhost:3000/greenroom-api/{projects,artists,pitches}/` → `200`. (Endpoints resolve fresh after the schema swap; a backend restart is only needed if you get `could not open relation`/`cache lookup failed`.)

## Notes / side-effects
- **`users` table is overwritten with prod's rows** — this is the live auth allowlist.
  Any dev-only login tweaks are lost. As of last sync, prod `users` includes id 8
  `provhatr@gmail.com` (admin), a real Google account, so local admin login still
  works. If it didn't, INSERT/UPDATE a real Google email into dev `users` afterward.
- Dev now holds **real prod PII** — treat the dev clone as sensitive.
- The dump is disposable; if a restore fails partway, dev is broken but recoverable —
  just re-run steps 2–3 (prod is untouched).
- Keep a copy of the SQL/dump under `backend\scripts\sql\` only if useful; the dump
  itself is transient (scratchpad is fine).
