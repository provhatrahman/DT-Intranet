---
name: greenroom-deploy-backend
description: Deploy a Greenroom backend domain to production (the per-domain AWS Lambdas serving the API). Use when asked to ship, deploy, or release backend/API/Django changes for a domain like projects, artists, bookings, pitches, payments, tasks, analytics.
---

# Deploy a Greenroom backend domain to production

Backend lives at `c:\Projects\backend` (Django split into per-domain Lambdas
`prod-<domain>-service` — **9 active domains** as of 2026-07-20
(`users, artists, bookings, projects, tasks, pitches, payments, analytics, music`),
including the newly added `prod-music-service` for the collective iPod library. (A
10th Lambda, `prod-events-service`, is a **retired orphan** — dead code, `/api/events/`
500s, not enforced; remove it and its route rather than deploying to it.) See `DEVELOPMENT.md`'s Key
Facts for the current roster). **Do NOT build Lambda zips locally** — the local venv is
Windows/Python 3.13 and the Lambda runtime is Linux/Python 3.11; local builds break
compiled deps. Build via CI, then point the Lambda at the new artifact.

**Lambda build gotcha (glibc):** Lambda's `python3.11` runtime is Amazon Linux 2
(glibc 2.26), so native wheels must be `manylinux2014` (glibc 2.17) — a too-new
`cryptography` wheel previously got bundled and broke the `google-auth` import
(auth returned `503`). `google-auth`'s pure-Python deps (`rsa`, `cachetools`,
`pyasn1-modules`) can also get dropped by a cross-platform pip resolve and need a
second pip pass. Both are now handled in `backend/scripts/build_lambdas.py` — don't
bypass it with a manual `pip install` when building.

## Steps

1. **Commit + push the backend changes to `main`** (from `c:\Projects\backend`).
   GitHub Actions (`.github/workflows/deploy-lambdas.yml`) detects the changed domain(s),
   builds the zip(s), and uploads to `s3://prod-lambda-artifacts-471028617262/<domain>-service.zip`.
   Wait for the Actions run to finish (check the repo's Actions tab).

2. **Point the Lambda(s) at the new artifact** for each changed domain:
   ```
   aws lambda update-function-code --profile greenroom-cli --region eu-west-2 \
     --function-name prod-<domain>-service \
     --s3-bucket prod-lambda-artifacts-471028617262 --s3-key <domain>-service.zip
   aws lambda wait function-updated --profile greenroom-cli --region eu-west-2 \
     --function-name prod-<domain>-service
   ```
   (CI only uploads to S3; this step actually deploys the code.)

3. **Verify** the live API: `curl https://jzre02jvh9.execute-api.eu-west-2.amazonaws.com/api/<domain>/`
   (trailing slash required) returns expected data; function `State`/`LastUpdateStatus` are `Active`/`Successful`.

## Notes
- Adding a route **under an existing domain** needs code only (gateway forwards `/api/<domain>/{proxy+}`).
  A brand-new top-level domain normally needs new infra (Terraform, separate repo) — flag it, don't
  improvise. (The `music` domain added 2026-07-20 was an exception: created directly via CLI, which
  means it's **Terraform drift** — the infra repo's state doesn't yet reflect it. Worth reconciling,
  but don't let that block treating it as a normal domain for deploy purposes.)
- **Shared-code changes hit every domain.** Edits to `greenroom_backend/settings.py`, `shared/`,
  or `requirements.txt` affect **all 9 active domain Lambdas** — redeploy each `prod-<domain>-service`, not just one.
- **Auth is live and enforced in prod (since 2026-07-20).** The Google-auth **bearer middleware lives
  in shared `settings.py`** with `REQUIRE_AUTH=true` set on all 9 active domain Lambdas — anonymous `/api/*`
  calls return `401`. Because the middleware is shared, altering auth behavior (e.g. a deliberate
  rollback to `REQUIRE_AUTH=false`) is still an **all-domain deploy**, same as enabling it was.
  `GOOGLE_CLIENT_SECRET` (on `prod-users-service`, does the token exchange) and a NAT gateway
  (`nat-004f38aa2518c0fdd`, added 2026-07-20 so VPC Lambdas can reach `oauth2.googleapis.com`) are
  both required for auth to actually work. Full design + rollback checklist: `AUTH_SETUP.md`.
- If the change includes a **schema change**, apply it to the DB first — see `greenroom-db-change`.
  Note: DDL on prod (`DT-Test`) must run as master user `admindaytimers`, not `appdaytimers` — see
  that skill for the ownership gotcha.
- **Rollback:** each Lambda has a published version `1` baseline; or re-deploy the previous
  S3 artifact by key. Take an RDS snapshot before schema-affecting deploys.
