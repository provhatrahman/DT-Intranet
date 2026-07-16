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
| **Prod** | `DT-Test` | `appdaytimers` | real data; app password lives in the Lambda env / Secrets Manager |

> `MSYS_NO_PATHCONV=1` is needed in Git Bash for `aws ssm ... --name /prod/...` (leading-slash args get mangled).

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
```
$env:PGPASSWORD = "<appdaytimers password>"
& "...\pg_dump.exe" -h <host> -U appdaytimers -d DT-Test --no-owner --no-privileges \
  | & "...\psql.exe" -h <host> -U appdaytimers -d greenroom_dev
```

## Guardrails
- Never run untested SQL directly on `DT-Test`. Dev-first, snapshot, then prod.
- Prod has deletion protection + 7-day backups; the dev clone holds real PII — treat it as sensitive.
