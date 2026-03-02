# deploy.ps1 - Deploy Greenroom frontend to AWS S3 and CloudFront

$ErrorActionPreference = "Stop"

Write-Host "=== Deployment Script ===" -ForegroundColor Cyan
Write-Host ""

# Default values (can be overridden with environment variables)
$S3_BUCKET = if ($env:S3_BUCKET) { $env:S3_BUCKET } else { "daytimers-intranet-prod-471028617262" }
$CLOUDFRONT_DISTRIBUTION_ID = if ($env:CLOUDFRONT_DISTRIBUTION_ID) { $env:CLOUDFRONT_DISTRIBUTION_ID } else { "E3OF10QS7S5YPV" }
$AWS_PROFILE = if ($env:AWS_PROFILE) { $env:AWS_PROFILE } else { "AdministratorAccess-471028617262" }

Write-Host "Deployment Configuration:" -ForegroundColor Cyan
Write-Host "  S3 Bucket: $S3_BUCKET"
Write-Host "  CloudFront Distribution: $CLOUDFRONT_DISTRIBUTION_ID"
Write-Host "  AWS Profile: $AWS_PROFILE"
Write-Host ""

# Step 1: Build
Write-Host "Step 1: Building frontend..." -ForegroundColor Cyan
try {
    bun run build
    if ($LASTEXITCODE -ne 0) {
        Write-Host "Error: Build failed with exit code $LASTEXITCODE" -ForegroundColor Red
        exit 1
    }
} catch {
    Write-Host "Error: Build command failed: $_" -ForegroundColor Red
    exit 1
}

# Check if dist directory exists
if (-not (Test-Path "dist")) {
    Write-Host "Error: dist directory not found after build!" -ForegroundColor Red
    exit 1
}

# Verify key files exist
$requiredFiles = @("dist/index.html", "dist/version.json")
foreach ($file in $requiredFiles) {
    if (-not (Test-Path $file)) {
        Write-Host "Warning: Required file not found: $file" -ForegroundColor Yellow
    }
}

# Show version info
if (Test-Path "dist/version.json") {
    try {
        $versionInfo = Get-Content "dist/version.json" | ConvertFrom-Json
        Write-Host "Build version: $($versionInfo.version) (Build $($versionInfo.buildNumber))" -ForegroundColor Green
    } catch {
        Write-Host "Warning: Could not read version.json" -ForegroundColor Yellow
    }
}

Write-Host ""

# Step 2: Upload to S3
Write-Host "Step 2: Uploading to S3..." -ForegroundColor Cyan
try {
    $syncOutput = aws s3 sync dist/ "s3://$S3_BUCKET/" --delete --profile $AWS_PROFILE 2>&1
    if ($LASTEXITCODE -ne 0) {
        Write-Host "Error: S3 sync failed!" -ForegroundColor Red
        Write-Host $syncOutput -ForegroundColor Red
        exit 1
    }
    Write-Host $syncOutput
    Write-Host "S3 upload completed successfully" -ForegroundColor Green
} catch {
    Write-Host "Error: S3 sync command failed: $_" -ForegroundColor Red
    exit 1
}

Write-Host ""

# Step 3: Invalidate CloudFront
Write-Host "Step 3: Invalidating CloudFront cache..." -ForegroundColor Cyan
try {
    $invalidationOutput = aws cloudfront create-invalidation `
        --distribution-id $CLOUDFRONT_DISTRIBUTION_ID `
        --paths "/*" `
        --profile $AWS_PROFILE 2>&1 | ConvertFrom-Json
    
    if ($LASTEXITCODE -ne 0) {
        Write-Host "Error: CloudFront invalidation failed!" -ForegroundColor Red
        exit 1
    }
    
    $invalidationId = $invalidationOutput.Invalidation.Id
    Write-Host "CloudFront invalidation created successfully" -ForegroundColor Green
    Write-Host "  Invalidation ID: $invalidationId" -ForegroundColor Gray
    Write-Host "  Status: $($invalidationOutput.Invalidation.Status)" -ForegroundColor Gray
    Write-Host ""
    Write-Host "Note: It may take a few minutes for the cache to fully invalidate." -ForegroundColor Yellow
} catch {
    Write-Host "Error: CloudFront invalidation command failed: $_" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "=== Deployment Complete! ===" -ForegroundColor Green

