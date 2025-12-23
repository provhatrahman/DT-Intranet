# deploy-quick.ps1 - Quick deployment script with automatic setup
# This script sets up environment variables and checks AWS SSO before deploying

$ErrorActionPreference = "Stop"

# Set deployment configuration
$env:S3_BUCKET = "daytimers-intranet-prod-471028617262"
$env:CLOUDFRONT_DISTRIBUTION_ID = "E3OF10QS7S5YPV"
$env:AWS_PROFILE = "AdministratorAccess-471028617262"

Write-Host "=== Quick Deployment Script ===" -ForegroundColor Cyan
Write-Host ""

# Check if version bump is requested
$bumpVersion = $args -contains "--bump" -or $args -contains "-b"

if ($bumpVersion) {
    Write-Host "Bumping version before deployment..." -ForegroundColor Cyan
    bun run version:bump
    if ($LASTEXITCODE -ne 0) {
        Write-Host "Warning: Version bump failed, continuing with current version" -ForegroundColor Yellow
    }
    Write-Host ""
}

# Check AWS SSO login
Write-Host "Checking AWS SSO session..." -ForegroundColor Cyan
$identity = aws sts get-caller-identity --profile $env:AWS_PROFILE 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host "Not logged in. Opening browser for SSO login..." -ForegroundColor Yellow
    aws sso login --profile $env:AWS_PROFILE
    if ($LASTEXITCODE -ne 0) {
        Write-Host "Error: Failed to log in to AWS SSO" -ForegroundColor Red
        exit 1
    }
} else {
    $account = ($identity | ConvertFrom-Json).Account
    Write-Host "Logged in to AWS account: $account" -ForegroundColor Green
}

Write-Host ""
Write-Host "Configuration:" -ForegroundColor Cyan
Write-Host "  S3 Bucket: $env:S3_BUCKET"
Write-Host "  CloudFront Distribution: $env:CLOUDFRONT_DISTRIBUTION_ID"
Write-Host "  AWS Profile: $env:AWS_PROFILE"
Write-Host ""

# Run the main deployment script
Write-Host "Starting deployment..." -ForegroundColor Cyan
Write-Host ""
.\deploy.ps1

