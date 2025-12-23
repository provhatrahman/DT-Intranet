#!/bin/bash
# deploy.sh - Deploy Greenroom frontend to AWS S3 and CloudFront

set -e  # Exit on error

echo "Building Greenroom frontend..."
bun run build

# Check if dist directory exists
if [ ! -d "dist" ]; then
  echo "Error: dist directory not found after build!"
  exit 1
fi

# Default values (can be overridden with environment variables)
S3_BUCKET="${S3_BUCKET:-daytimers-intranet-prod-471028617262}"
CLOUDFRONT_DISTRIBUTION_ID="${CLOUDFRONT_DISTRIBUTION_ID:-E3OF10QS7S5YPV}"
AWS_PROFILE="${AWS_PROFILE:-AdministratorAccess-471028617262}"

# Note: Script now uses default values, but you can still override with environment variables
# if needed for different environments

echo "Deployment Configuration:"
echo "  S3 Bucket: $S3_BUCKET"
echo "  CloudFront Distribution: $CLOUDFRONT_DISTRIBUTION_ID"
echo "  AWS Profile: $AWS_PROFILE"
echo ""

echo "Uploading to S3..."
aws s3 sync dist/ s3://$S3_BUCKET/ --delete --profile $AWS_PROFILE

echo "Invalidating CloudFront cache..."
aws cloudfront create-invalidation \
  --distribution-id $CLOUDFRONT_DISTRIBUTION_ID \
  --paths "/*" \
  --profile $AWS_PROFILE

echo "Deployment complete!"

