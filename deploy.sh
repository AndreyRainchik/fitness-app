#!/bin/bash

# Configuration
PROJECT_ID="metal-apricot-343704"
REGION="us-central1"
SERVICE_NAME="fitness-tracker"
BUCKET_NAME="${PROJECT_ID}-fitness-tracker-data"
IMAGE_NAME="gcr.io/${PROJECT_ID}/fitness-tracker:latest"

echo "🚀 Starting deployment with persistent storage..."

# 1. Create bucket if it doesn't exist
if ! gsutil ls gs://${BUCKET_NAME} &>/dev/null; then
    echo "📦 Creating storage bucket..."
    gsutil mb -l ${REGION} gs://${BUCKET_NAME}
    # 2. Set permissions
    echo "🔐 Setting permissions..."
    SERVICE_ACCOUNT="980600772488-compute@developer.gserviceaccount.com"
    gsutil iam ch serviceAccount:${SERVICE_ACCOUNT}:roles/storage.objectAdmin gs://${BUCKET_NAME}
else
    echo "✅ Bucket already exists"
fi

# 3. Build and push image
echo "🔨 Building image..."
podman build -t ${IMAGE_NAME} -f Dockerfile .

echo "📤 Pushing image..."
podman push ${IMAGE_NAME}

# 4. Deploy with volume mount
echo "🚢 Deploying to Cloud Run..."
REVISION_SUFFIX="manual-$(date -u +%Y%m%d-%H%M%S)"
gcloud run deploy ${SERVICE_NAME} \
  --image ${IMAGE_NAME} \
  --revision-suffix "${REVISION_SUFFIX}" \
  --platform managed \
  --region ${REGION} \
  --allow-unauthenticated \
  --port 3000 \
  --memory 1Gi \
  --cpu 1 \
  --min-instances 0 \
  --max-instances 1 \
  --execution-environment gen2 \
  --add-volume name=data-volume,type=cloud-storage,bucket=${BUCKET_NAME} \
  --add-volume-mount volume=data-volume,mount-path=/mnt/data \
  --env-vars-file ".env.yaml" \
  --quiet

# Send all traffic to the new revision. A no-traffic (preview) deploy pins
# traffic to one revision, and `gcloud run deploy` won't move it after that.
gcloud run services update-traffic ${SERVICE_NAME} \
  --platform managed \
  --region ${REGION} \
  --to-revisions "${SERVICE_NAME}-${REVISION_SUFFIX}=100" \
  --quiet

# 5. Get service URL
SERVICE_URL=$(gcloud run services describe ${SERVICE_NAME} \
  --platform managed \
  --region ${REGION} \
  --format 'value(status.url)')

echo "✅ Deployment complete!"
echo "🔗 Service URL: ${SERVICE_URL}"
echo "💾 Database persists in: gs://${BUCKET_NAME}/fitness_tracker.db"

# 6. Test
echo "🧪 Testing health endpoint..."
curl -s ${SERVICE_URL}/api/health | jq .

echo "✨ Done!"