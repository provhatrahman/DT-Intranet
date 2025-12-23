# deploy.ps1 - Deploy ryOS frontend to AWS S3 and CloudFront

$ErrorActionPreference = "Stop"

Write-Host "Building ryOS frontend..." -ForegroundColor Cyan
bun run build

# Check if dist directory exists
if (-not (Test-Path "dist")) {
    Write-Host "Error: dist directory not found after build!" -ForegroundColor Red
    exit 1
}

# These values need to be set - replace with your actual values
$S3_BUCKET = if ($env:S3_BUCKET) { $env:S3_BUCKET } else { "your-s3-bucket-name" }
$CLOUDFRONT_DISTRIBUTION_ID = if ($env:CLOUDFRONT_DISTRIBUTION_ID) { $env:CLOUDFRONT_DISTRIBUTION_ID } else { "your-cloudfront-distribution-id" }
$AWS_PROFILE = if ($env:AWS_PROFILE) { $env:AWS_PROFILE } else { "AdministratorAccess-471028617262" }

# Check if variables are set
if ($S3_BUCKET -eq "your-s3-bucket-name" -or $CLOUDFRONT_DISTRIBUTION_ID -eq "your-cloudfront-distribution-id") {
    Write-Host "Error: Please set S3_BUCKET and CLOUDFRONT_DISTRIBUTION_ID environment variables" -ForegroundColor Red
    Write-Host "Example:" -ForegroundColor Yellow
    Write-Host "  `$env:S3_BUCKET = 'your-bucket-name'"
    Write-Host "  `$env:CLOUDFRONT_DISTRIBUTION_ID = 'your-distribution-id'"
    Write-Host "  .\deploy.ps1"
    exit 1
}

Write-Host "Uploading to S3..." -ForegroundColor Cyan
aws s3 sync dist/ "s3://$S3_BUCKET/" --delete --profile $AWS_PROFILE

Write-Host "Invalidating CloudFront cache..." -ForegroundColor Cyan
aws cloudfront create-invalidation `
  --distribution-id $CLOUDFRONT_DISTRIBUTION_ID `
  --paths "/*" `
  --profile $AWS_PROFILE

Write-Host "Deployment complete!" -ForegroundColor Green

