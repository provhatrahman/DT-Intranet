# Development & Deployment Workflow Guide

This guide covers the complete workflow for developing, testing, and deploying ryOS to your AWS-hosted custom domain.

## Table of Contents

1. [Local Development](#local-development)
2. [Testing Before Deployment](#testing-before-deployment)
3. [Deployment Process](#deployment-process)
4. [Best Practices](#best-practices)
5. [Troubleshooting](#troubleshooting)

---

## Local Development

### Quick Start

1. **Start the development server:**
   ```powershell
   bun dev
   ```
   This starts Vite dev server at `http://localhost:5173` with hot module replacement (HMR).

2. **For full Vercel environment (recommended if using API routes):**
   ```powershell
   bun run dev:vercel
   ```
   This runs the Vercel dev server which includes API route support.

### Development Commands

| Command | Description |
|---------|-------------|
| `bun dev` | Start Vite dev server (fast, basic) |
| `bun run dev:vercel` | Start Vercel dev server (includes API routes) |
| `bun run lint` | Run ESLint to check code quality |
| `bun run build` | Build for production (test locally) |
| `bun run preview` | Preview production build locally |

### Development Tips

- **Hot Reload**: Changes to React components update automatically
- **Network Access**: Dev server is accessible on your network (useful for mobile testing)
- **Port**: Default port is `5173`, change with `PORT=3000 bun dev`
- **TypeScript**: Type checking happens during build, use your IDE for real-time feedback

---

## Testing Before Deployment

### Step 1: Run Linter

Check for code quality issues:
```powershell
bun run lint
```

Fix any errors or warnings before proceeding.

### Step 2: Build Locally

Test the production build to catch any build errors:
```powershell
bun run build
```

This will:
- Run TypeScript compilation
- Build the Vite bundle
- Generate service worker files
- Copy files to `dist/` directory

**Check for errors** - if the build fails, fix issues before deploying.

### Step 3: Preview Production Build

Test the production build locally to ensure everything works:
```powershell
bun run preview
```

This serves the `dist/` folder at `http://localhost:4173` (or next available port).

**What to test:**
- ✅ App loads correctly
- ✅ All features work as expected
- ✅ No console errors
- ✅ Service worker registers (check DevTools > Application > Service Workers)
- ✅ PWA features work (if applicable)

### Step 4: Test on Different Devices (Optional)

Since the dev server is network-accessible, you can test on mobile devices:

1. Find your local IP address:
   ```powershell
   ipconfig
   # Look for IPv4 Address (e.g., 192.168.1.100)
   ```

2. On your mobile device, navigate to:
   ```
   http://YOUR_IP_ADDRESS:5173
   ```

3. Test touch interactions, responsive design, etc.

---

## Deployment Process

### Prerequisites

Before deploying, ensure you have:

1. ✅ **AWS CLI installed and configured** (see [DEPLOYMENT.md](./DEPLOYMENT.md))
2. ✅ **AWS SSO logged in** (sessions last 8-12 hours)
3. ✅ **Environment variables set** (see below)

### Step 1: Verify AWS SSO Session

Check if you're still logged in:
```powershell
aws sts get-caller-identity --profile AdministratorAccess-471028617262
```

If you get an error, log in again:
```powershell
aws sso login --profile AdministratorAccess-471028617262
```

### Step 2: Set Deployment Variables

Set your deployment configuration (PowerShell):
```powershell
$env:S3_BUCKET = "daytimers-intranet-prod-471028617262"
$env:CLOUDFRONT_DISTRIBUTION_ID = "E3OF10QS7S5YPV"
```

**Note**: These are your actual values. You can create a PowerShell profile or script to set these automatically.

### Step 3: Deploy

Run the deployment script:
```powershell
.\deploy.ps1
```

**What happens:**
1. 🔨 Builds the app (`bun run build`)
2. 📤 Uploads to S3 (`aws s3 sync`)
3. 🔄 Invalidates CloudFront cache
4. ✅ Deployment complete!

### Step 4: Verify Deployment

1. **Wait for CloudFront invalidation** (usually 1-5 minutes)
2. **Visit your site** and verify changes are live
3. **Check browser console** for any errors
4. **Test critical features** to ensure nothing broke

---

## Best Practices

### Git Workflow

1. **Create a feature branch:**
   ```powershell
   git checkout -b feature/your-feature-name
   ```

2. **Make your changes** and test locally

3. **Commit with descriptive messages:**
   ```powershell
   git add .
   git commit -m "Add feature: description of what you did"
   ```

4. **Push to remote:**
   ```powershell
   git push -u origin feature/your-feature-name
   ```

5. **After testing locally and building successfully, deploy:**
   ```powershell
   # Set deployment variables
   $env:S3_BUCKET = "daytimers-intranet-prod-471028617262"
   $env:CLOUDFRONT_DISTRIBUTION_ID = "E3OF10QS7S5YPV"
   
   # Deploy
   .\deploy.ps1
   ```

### Pre-Deployment Checklist

Before deploying, make sure:

- [ ] Code is committed to git
- [ ] `bun run lint` passes
- [ ] `bun run build` succeeds without errors
- [ ] `bun run preview` works correctly
- [ ] AWS SSO session is active
- [ ] Environment variables are set
- [ ] You've tested the changes locally

### Deployment Frequency

- **Small fixes**: Deploy immediately after testing
- **New features**: Test thoroughly, then deploy
- **Breaking changes**: Coordinate with team, test extensively

### Rollback Strategy

If something goes wrong:

1. **Revert to previous commit:**
   ```powershell
   git log  # Find the previous working commit
   git checkout <previous-commit-hash>
   bun run build
   # Set env vars and deploy again
   .\deploy.ps1
   ```

2. **Or redeploy previous version:**
   - Check git history for last known good commit
   - Checkout that commit
   - Rebuild and redeploy

---

## Quick Reference

### Daily Development

```powershell
# Start dev server
bun dev

# Make changes, test in browser

# When ready to test production build
bun run build
bun run preview
```

### Deploying Changes

```powershell
# 1. Ensure AWS SSO is logged in
aws sso login --profile AdministratorAccess-471028617262

# 2. Set deployment variables
$env:S3_BUCKET = "daytimers-intranet-prod-471028617262"
$env:CLOUDFRONT_DISTRIBUTION_ID = "E3OF10QS7S5YPV"

# 3. Deploy
.\deploy.ps1
```

### Creating a Deployment Script (Optional)

You can create a PowerShell script to automate the setup:

**`deploy-quick.ps1`**:
```powershell
# Quick deployment script
$env:S3_BUCKET = "daytimers-intranet-prod-471028617262"
$env:CLOUDFRONT_DISTRIBUTION_ID = "E3OF10QS7S5YPV"

# Check AWS login
Write-Host "Checking AWS SSO..." -ForegroundColor Cyan
$identity = aws sts get-caller-identity --profile AdministratorAccess-471028617262 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host "Not logged in. Logging in..." -ForegroundColor Yellow
    aws sso login --profile AdministratorAccess-471028617262
}

# Deploy
.\deploy.ps1
```

Then just run:
```powershell
.\deploy-quick.ps1
```

---

## Troubleshooting

### Build Fails

**Error**: TypeScript errors
- **Fix**: Check error messages, fix type issues
- **Prevent**: Run `bun run build` before committing

**Error**: Missing dependencies
- **Fix**: Run `bun install`

### Deployment Fails

**Error**: "Unable to locate credentials"
- **Fix**: Run `aws sso login --profile AdministratorAccess-471028617262`

**Error**: "Access Denied"
- **Fix**: Check your IAM permissions, ensure SSO session is active

**Error**: "NoSuchDistribution"
- **Fix**: Verify `CLOUDFRONT_DISTRIBUTION_ID` is correct (should be `E3OF10QS7S5YPV`)

### Site Not Updating After Deployment

- **Wait**: CloudFront invalidation takes 1-5 minutes
- **Check**: Verify invalidation completed in AWS Console
- **Hard refresh**: Clear browser cache (Ctrl+Shift+R or Cmd+Shift+R)
- **Verify**: Check S3 bucket to ensure files uploaded correctly

### Local Dev Server Issues

**Port already in use**:
```powershell
# Use a different port
$env:PORT=3000; bun dev
```

**Changes not reflecting**:
- Clear browser cache
- Restart dev server
- Check for build errors in terminal

---

## Summary

**Development Flow:**
1. `bun dev` → Make changes → Test in browser
2. `bun run build` → `bun run preview` → Test production build
3. Fix any issues, repeat

**Deployment Flow:**
1. Ensure code is tested and committed
2. `aws sso login` (if needed)
3. Set environment variables
4. `.\deploy.ps1`
5. Wait for CloudFront invalidation
6. Verify on live site

**Remember**: Always test locally before deploying to production!

