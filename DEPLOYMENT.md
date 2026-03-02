# Deployment Guide

This guide explains how to deploy the ryOS frontend to AWS S3 and CloudFront using AWS CLI with SSO.

## Prerequisites

1. **AWS CLI installed**: See installation instructions below
2. **SSO access**: You need access to the AWS IAM Identity Center

## Installing AWS CLI on Windows

You have several options to install AWS CLI on Windows:

### Option 1: MSI Installer (Recommended)

1. Download the AWS CLI MSI installer for Windows (64-bit):
   - Go to: https://awscli.amazonaws.com/AWSCLIV2.msi
   - Or visit: https://aws.amazon.com/cli/ and click "Download the AWS CLI MSI installer for Windows (64-bit)"

2. Run the downloaded `.msi` file and follow the installation wizard

3. **Close and reopen your PowerShell terminal** (important - the PATH needs to refresh)

4. Verify installation:
   ```powershell
   aws --version
   ```

### Option 2: Using MSI Installer via PowerShell

You can also download and install directly from PowerShell:

```powershell
# Download the installer
Invoke-WebRequest -Uri "https://awscli.amazonaws.com/AWSCLIV2.msi" -OutFile "$env:TEMP\AWSCLIV2.msi"

# Install silently
Start-Process msiexec.exe -ArgumentList "/i $env:TEMP\AWSCLIV2.msi /quiet" -Wait

# Close and reopen PowerShell, then verify
aws --version
```

### Option 3: Using Chocolatey (if you have it installed)

```powershell
choco install awscli
```

### Option 4: Using Winget (Windows Package Manager)

```powershell
winget install Amazon.AWSCLI
```

### After Installation

**Important**: Close and reopen your PowerShell terminal after installation so that the `aws` command is available in your PATH.

Verify the installation works:
```powershell
aws --version
```

You should see output like: `aws-cli/2.x.x Python/3.x.x Windows/10 exe/AMD64`

## Step 1: Configure AWS CLI with SSO

Run the following command and follow the prompts:

```bash
aws configure sso
```

When prompted, enter:

- **SSO start URL**: `https://d-9c67444dac.awsapps.com/start`
- **SSO region**: Your AWS region (e.g., `eu-west-2`, `us-east-1`)
- **Account ID**: Your AWS account ID
- **Role name**: The permission set name (e.g., `AdministratorAccess` or your specific role)
- **CLI default region**: Your preferred AWS region
- **CLI default output**: `json`

## Step 2: Login to AWS SSO

Before deploying, you need to authenticate:

```bash
aws sso login
```

This will open a browser window for authentication. Complete the login process.

## Step 3: Set Deployment Variables

You need to know your S3 bucket name and CloudFront distribution ID. Set them as environment variables:

### On Windows (PowerShell):
```powershell
$env:S3_BUCKET = "your-s3-bucket-name"
$env:CLOUDFRONT_DISTRIBUTION_ID = "your-cloudfront-distribution-id"
```

### On Windows (Git Bash) or Linux/Mac:
```bash
export S3_BUCKET="your-s3-bucket-name"
export CLOUDFRONT_DISTRIBUTION_ID="your-cloudfront-distribution-id"
```

## Step 4: Deploy

### Using PowerShell (Windows):
```powershell
.\deploy.ps1
```

### Using Bash (Git Bash, WSL, or Linux/Mac):
```bash
chmod +x deploy.sh
./deploy.sh
```

## What the Script Does

1. **Builds the React app**: Runs `bun run build` to create production build in `dist/` directory
2. **Uploads to S3**: Syncs the `dist/` directory to your S3 bucket, deleting files that no longer exist
3. **Invalidates CloudFront cache**: Clears the CloudFront cache so users see the latest version

## Manual Deployment (Alternative)

If you prefer to run commands manually:

```bash
# 1. Build the app
bun run build

# 2. Upload to S3 (replace with your bucket name)
aws s3 sync dist/ s3://your-bucket-name/ --delete

# 3. Invalidate CloudFront cache (replace with your distribution ID)
aws cloudfront create-invalidation \
  --distribution-id your-distribution-id \
  --paths "/*"
```

## Troubleshooting

### "Error: dist directory not found"
- Make sure the build completed successfully
- Check that `bun run build` runs without errors

### "Unable to locate credentials"
- Run `aws sso login` to authenticate
- Check that your SSO session hasn't expired (they typically last 8-12 hours)

### "Access Denied" errors
- Verify your IAM role has permissions for:
  - `s3:PutObject`, `s3:DeleteObject`, `s3:ListBucket` on your S3 bucket
  - `cloudfront:CreateInvalidation` for your CloudFront distribution

### Finding Your S3 Bucket and CloudFront Distribution ID
- **S3 Bucket**: Check your AWS S3 console or ask your AWS administrator
- **CloudFront Distribution ID**: Check your CloudFront console or ask your AWS administrator

## Development Testing with Pitch App

When developing Pitch-related features locally, you can use a shared dummy Greenroom user account for testing instead of creating your own account.

### Quick Start

1. **Set up the dev test user** (one-time setup):
   ```bash
   bun run scripts/ensure-greenroom-dev-user.ts <user_id>
   ```
   Replace `<user_id>` with a valid Greenroom system user ID. See [Dev Greenroom Test User Setup](docs/dev-greenroom-test-user.md) for detailed instructions.

2. **Start the dev server**:
   ```bash
   bun run dev:vercel
   ```

3. **Enable dev mode in the Pitch app**:
   - Open the Pitch app in your browser
   - Look for the "Developer Testing" section (only visible in dev builds)
   - Toggle "Use Dev Testing Account" to ON

4. **Test pitch features**:
   - Submit pitches - they'll be created as the dev user
   - Vote on pitches - votes will be cast as the dev user
   - View "My Pitches" - shows pitches submitted by the dev user
   - Test Incoming Offers - offer interactions use the dev user ID

### Verifying Dev Account Usage

To verify the dev account is being used:

1. **Check network requests**: Open browser DevTools → Network tab
   - Submit a pitch and check the request payload
   - The `submitter_user_id` should match your dev user ID
   - Vote on a pitch and check the `user_id` in the vote request

2. **Check UI indicators**: The "Developer Testing" section shows:
   - Current account status (dev vs linked)
   - Dev user display name and ID when enabled

### Testing Checklist

Before deploying Pitch-related changes, test both modes:

- [ ] **With dev account enabled**:
  - [ ] Can submit pitches
  - [ ] Can vote on pitches (accept, interested, decline, recommend)
  - [ ] Can view "My Pitches" tab
  - [ ] Incoming Offers shows correct vote status for pitch cards
  - [ ] API calls use dev user ID (check network tab)

- [ ] **With dev account disabled** (if you have a linked account):
  - [ ] Can submit pitches with linked account
  - [ ] Can vote with linked account
  - [ ] "My Pitches" shows pitches from linked account
  - [ ] API calls use linked account user ID

### Troubleshooting

- **Dev toggle not appearing**: Ensure `VITE_DEV_GREENROOM_USER_ID` is set in `.env.local` and restart the dev server
- **Wrong user ID in API calls**: Check that the toggle is enabled and verify `.env.local` has the correct user ID
- **API errors**: Verify the dev user ID exists in the Greenroom database

For more details, see [Dev Greenroom Test User Setup](docs/dev-greenroom-test-user.md).

