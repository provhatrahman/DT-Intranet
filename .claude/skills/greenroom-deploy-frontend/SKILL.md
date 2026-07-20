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
- Since auth is enforced, confirm the Google sign-in gate (`LoginScreen`) appears and a real
  allowlisted account can complete the `/auth/callback` round-trip.

## Rollback
Check out the last-good commit, rebuild, and re-run `deploy.ps1` (S3 sync replaces the site).

## Auth (LIVE and enforced in prod since 2026-07-20)
`deploy.ps1` now **defaults to a gated build**: `VITE_AUTH_ENABLED=true` is baked in
(Vite bakes env at build time), so the desktop requires Google sign-in
(`App.tsx` renders `LoginScreen` until authenticated) — a normal deploy ships auth
**on**, matching current prod (build `1a82122`). The backend is enforced too
(`REQUIRE_AUTH=true` on all 9 active domain Lambdas — see `greenroom-deploy-backend`), so
frontend and backend auth state should be changed **together**, not independently.

The CloudFront SPA fallback needed for `/auth/callback` (403/404 → `/index.html`,
200) is already live on `E3OF10QS7S5YPV` — nothing to add for a normal deploy.

**To deliberately roll back to an un-gated build** (e.g. emergency rollback):
- Build with `VITE_AUTH_ENABLED=false` (override the default in the `deploy.ps1`
  build env / `.env.production`).
- Flip the backend to match: `REQUIRE_AUTH=false` on all domain Lambdas (see
  `greenroom-deploy-backend`) — otherwise an un-gated frontend will just hit `401`s
  against an still-enforcing API.
Full design + checklist: `AUTH_SETUP.md`.
