---
name: greenroom-deploy-frontend
description: Deploy the Greenroom frontend to production — builds and publishes to AWS S3 + CloudFront (live at greenroom.daytimers.org). Use when asked to ship, deploy, publish, or release frontend/UI changes.
---

# Deploy the Greenroom frontend to production

Publishes this repo (`ryos`) to the live site **https://greenroom.daytimers.org**
(S3 bucket `daytimers-intranet-prod-471028617262` → CloudFront `E3OF10QS7S5YPV`).

## Preconditions
- Changes committed (deploy ships whatever is in the working tree — don't ship a messy tree).
- `bun run lint` and `bun run build` succeed locally.
- AWS profile `greenroom-cli` works: `aws sts get-caller-identity --profile greenroom-cli`.

## Deploy
```powershell
cd c:\Projects\ryos
$env:AWS_PROFILE = "greenroom-cli"     # IMPORTANT: override the script's default (MFA-locked) SSO profile
.\deploy.ps1
```
`deploy.ps1` builds (`bun run build`), `aws s3 sync dist/ --delete`, and invalidates the
CloudFront cache. `deploy-quick.ps1` also works but defaults to the SSO profile and tries
`aws sso login` (which is MFA-locked) — set `$env:AWS_PROFILE="greenroom-cli"` first, or use
`deploy.ps1` directly as above.

## Verify
- Wait 1–5 min for CloudFront invalidation, then hard-refresh https://greenroom.daytimers.org.
- Check the browser console and a couple of core flows.

## Rollback
Check out the last-good commit, rebuild, and re-run `deploy.ps1` (S3 sync replaces the site).
