#!/bin/bash
# deploy.sh - Deploy ryOS frontend to AWS S3 and CloudFront

set -e  # Exit on error

echo "Building ryOS frontend..."
bun run build

# Check if dist directory exists
if [ ! -d "dist" ]; then
  echo "Error: dist directory not found after build!"
  exit 1
fi

# These values need to be set - replace with your actual values
S3_BUCKET="${S3_BUCKET:-your-s3-bucket-name}"
CLOUDFRONT_DISTRIBUTION_ID="${CLOUDFRONT_DISTRIBUTION_ID:-your-cloudfront-distribution-id}"
AWS_PROFILE="${AWS_PROFILE:-AdministratorAccess-471028617262}"

# Check if variables are set
if [ "$S3_BUCKET" = "your-s3-bucket-name" ] || [ "$CLOUDFRONT_DISTRIBUTION_ID" = "your-cloudfront-distribution-id" ]; then
  echo "Error: Please set S3_BUCKET and CLOUDFRONT_DISTRIBUTION_ID environment variables"
  echo "Example:"
  echo "  export S3_BUCKET=your-bucket-name"
  echo "  export CLOUDFRONT_DISTRIBUTION_ID=your-distribution-id"
  echo "  ./deploy.sh"
  exit 1
fi

echo "Uploading to S3..."
aws s3 sync dist/ s3://$S3_BUCKET/ --delete --profile $AWS_PROFILE

echo "Invalidating CloudFront cache..."
aws cloudfront create-invalidation \
  --distribution-id $CLOUDFRONT_DISTRIBUTION_ID \
  --paths "/*" \
  --profile $AWS_PROFILE

echo "Deployment complete!"

