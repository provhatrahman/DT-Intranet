---
name: greenroom-db-change
description: Safely change or inspect the Greenroom database — schema changes (add/alter tables or columns), data fixes, or connecting to the dev/prod Postgres. Use when altering the DB or running SQL. Enforces dev-first testing and prod snapshots.
---

# Change the Greenroom database safely

One RDS instance `prod-postgres.c76kwqimoyuh.eu-west-2.rds.amazonaws.com:5432` hosts two DBs.
**Domain-table schema is managed by hand-run SQL, NOT Django migrations** (see
`c:\Projects\backend\scripts\sql\*.sql` for the pattern). Postgres client:
`C:\Program Files\PostgreSQL\18\bin\{psql,pg_dump}.exe`.

| Env | DB | User | Notes |
|---|---|---|---|
| **Dev** | `greenroom_dev` | `devuser` | isolated clone; password = `DB_PASSWORD` in `backend\.env`; blocked from prod |
| **Prod** | `DT-Test` | `appdaytimers` | real data; app password in Secrets Manager (see Credentials) |

> `MSYS_NO_PATHCONV=1` is needed in Git Bash for `aws ssm ... --name /prod/...` (leading-slash args get mangled).

## Credentials

- **`devuser`** (dev app user): password is `DB_PASSWORD` in `backend\.env`. This is what the local backend connects as, and what the running app can read/write.
- **`appdaytimers`** (table owner, both DBs): password lives in Secrets Manager, NOT SSM. Fetch it with:
  ```bash
  aws secretsmanager get-secret-value --profile greenroom-cli --region eu-west-2 \
    --secret-id 'prod/app/db_password' --query SecretString --output text
  ```
  `appdaytimers` can connect to **either** DB on the RDS instance (same server), including `greenroom_dev` — that's how the re-clone below works, and it's the account you need for DDL on prod-cloned tables (see the ownership gotcha).

## ⚠️ Table-ownership gotcha (DDL in dev)

The dev DB is a `pg_dump` clone of prod, so **tables that came from prod are owned by `appdaytimers`, not `devuser`.** `devuser` can `SELECT/INSERT/UPDATE` them but **cannot run `ALTER`/`DROP`** — you get `ERROR: must be owner of table <t>`. (Tables first created by a prior hand-run dev migration — e.g. `booking_votes` — are owned by `devuser` and *can* be altered as `devuser`; check with `SELECT tablename, tableowner FROM pg_tables WHERE tablename='<t>';`.)

To run DDL (add/alter columns, etc.) against a prod-owned table **in dev**, connect as `appdaytimers` against `greenroom_dev`:
```bash
export PGPASSWORD="$(aws secretsmanager get-secret-value --profile greenroom-cli --region eu-west-2 \
  --secret-id 'prod/app/db_password' --query SecretString --output text)"
"/c/Program Files/PostgreSQL/18/bin/psql.exe" -h <host> -U appdaytimers -d greenroom_dev -f change.sql
```
Then **grant the new object to `devuser`** so the app (which connects as `devuser`) can use it — a new column inherits table grants, but re-granting is harmless and covers new tables:
```bash
psql ... -U appdaytimers -d greenroom_dev -c "GRANT SELECT, INSERT, UPDATE ON <table> TO devuser;"
```
This is dev-only and safe — you're altering `greenroom_dev`, never `DT-Test`. (On prod you already connect as `appdaytimers`, so ownership is a non-issue there.)

## Connect
```
& "C:\Program Files\PostgreSQL\18\bin\psql.exe" -h prod-postgres.c76kwqimoyuh.eu-west-2.rds.amazonaws.com -U devuser -d greenroom_dev
# (set $env:PGPASSWORD first, or it will prompt)
```

## Schema/data change workflow (ALWAYS dev-first)
1. Write **idempotent** SQL (`IF NOT EXISTS` / `IF EXISTS`). Keep a copy in `backend\scripts\sql\`.
2. **Apply to dev and test:**
   ```
   psql -h <host> -U devuser -d greenroom_dev -f change.sql
   ```
   If this fails with `must be owner of table`, the table is prod-owned — apply as
   `appdaytimers` instead and grant to `devuser` (see the ownership gotcha above).
   Run the app locally (`greenroom-local-dev`) and confirm nothing breaks.
3. If the backend code depends on the change, deploy code together (`greenroom-deploy-backend`).
4. **Snapshot prod first**, then apply to prod:
   ```
   aws rds create-db-snapshot --profile greenroom-cli --region eu-west-2 \
     --db-instance-identifier prod-postgres --db-snapshot-identifier predev-<yyyymmdd-desc>
   # after snapshot is 'available':
   psql -h <host> -U appdaytimers -d DT-Test -f change.sql
   ```

## Refresh the dev DB from prod (re-clone)
`<appdaytimers password>` comes from Secrets Manager — see Credentials.
```
$env:PGPASSWORD = "<appdaytimers password>"
& "...\pg_dump.exe" -h <host> -U appdaytimers -d DT-Test --no-owner --no-privileges \
  | & "...\psql.exe" -h <host> -U appdaytimers -d greenroom_dev
```
> Note: `--no-owner` restores objects as the connecting role (`appdaytimers`), which
> is why cloned tables end up owned by `appdaytimers` and trip the ownership gotcha.

## Auth allowlist = the `users` table
The `users` table doubles as the Google-login **allowlist**: a person can sign in only if
their **real Google email** is in `users.email` (case-insensitive), and `is_admin` derives
from `users.role` (`admin`/`manager`). "Allowlist someone" = INSERT/UPDATE their real email
on a `users` row (dev now; prod after a snapshot). See `AUTH_SETUP.md`. Note: dev `users`
id 8's email was set to a real Google address for local login testing (`greenroom_dev` only).

## Guardrails
- Never run untested SQL directly on `DT-Test`. Dev-first, snapshot, then prod.
- Prod has deletion protection + 7-day backups; the dev clone holds real PII — treat it as sensitive.
