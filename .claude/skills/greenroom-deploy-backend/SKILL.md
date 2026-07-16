---
name: greenroom-deploy-backend
description: Deploy a Greenroom backend domain to production (the per-domain AWS Lambdas serving the API). Use when asked to ship, deploy, or release backend/API/Django changes for a domain like projects, artists, bookings, pitches, payments, tasks, analytics.
---

# Deploy a Greenroom backend domain to production

Backend lives at `c:\Projects\backend` (Django split into 9 per-domain Lambdas
`prod-<domain>-service`). **Do NOT build Lambda zips locally** — the local venv is
Windows/Python 3.13 and the Lambda runtime is Linux/Python 3.11; local builds break
compiled deps. Build via CI, then point the Lambda at the new artifact.

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
  A brand-new top-level domain needs new infra (Terraform, separate repo) — flag it, don't improvise.
- If the change includes a **schema change**, apply it to the DB first — see `greenroom-db-change`.
- **Rollback:** each Lambda has a published version `1` baseline; or re-deploy the previous
  S3 artifact by key. Take an RDS snapshot before schema-affecting deploys.
