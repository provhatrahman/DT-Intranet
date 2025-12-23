# deploy.ps1 - Deploy Greenroom frontend to AWS S3 and CloudFront

$ErrorActionPreference = "Stop"

Write-Host "Building Greenroom frontend..." -ForegroundColor Cyan
bun run build

# Check if dist directory exists
if (-not (Test-Path "dist")) {
    Write-Host "Error: dist directory not found after build!" -ForegroundColor Red
    exit 1
}

# Default values (can be overridden with environment variables)
$S3_BUCKET = if ($env:S3_BUCKET) { $env:S3_BUCKET } else { "daytimers-intranet-prod-471028617262" }
$CLOUDFRONT_DISTRIBUTION_ID = if ($env:CLOUDFRONT_DISTRIBUTION_ID) { $env:CLOUDFRONT_DISTRIBUTION_ID } else { "E3OF10QS7S5YPV" }
$AWS_PROFILE = if ($env:AWS_PROFILE) { $env:AWS_PROFILE } else { "AdministratorAccess-471028617262" }

# Note: Script now uses default values, but you can still override with environment variables
# if needed for different environments

Write-Host "Deployment Configuration:" -ForegroundColor Cyan
Write-Host "  S3 Bucket: $S3_BUCKET"
Write-Host "  CloudFront Distribution: $CLOUDFRONT_DISTRIBUTION_ID"
Write-Host "  AWS Profile: $AWS_PROFILE"
Write-Host ""

Write-Host "Uploading to S3..." -ForegroundColor Cyan
aws s3 sync dist/ "s3://$S3_BUCKET/" --delete --profile $AWS_PROFILE

Write-Host "Invalidating CloudFront cache..." -ForegroundColor Cyan
aws cloudfront create-invalidation `
  --distribution-id $CLOUDFRONT_DISTRIBUTION_ID `
  --paths "/*" `
  --profile $AWS_PROFILE

Write-Host "Deployment complete!" -ForegroundColor Green

