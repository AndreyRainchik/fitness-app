# Quick Deployment Reference

## 🚀 Essential Commands (Copy & Paste)

### 1️⃣ Set Variables (Update these first!)
```bash
export PROJECT_ID="your-project-id-here"
export REGION="us-central1"
export SERVICE_NAME="fitness-tracker"
export IMAGE_NAME="gcr.io/${PROJECT_ID}/fitness-tracker"
export IMAGE_TAG="latest"
```

### 2️⃣ Build Container
```bash
podman build -t ${IMAGE_NAME}:${IMAGE_TAG} -f Dockerfile .
```

### 3️⃣ Push to Google Container Registry
```bash
# Authenticate first (only needed once)
gcloud auth configure-docker

# Push image
podman push ${IMAGE_NAME}:${IMAGE_TAG}
```

### 4️⃣ Deploy to Cloud Run
```bash
gcloud run deploy ${SERVICE_NAME} \
  --image ${IMAGE_NAME}:${IMAGE_TAG} \
  --platform managed \
  --region ${REGION}
```

### 5️⃣ Verify Deployment
```bash
# Get URL
export SERVICE_URL=$(gcloud run services describe ${SERVICE_NAME} \
  --platform managed \
  --region ${REGION} \
  --format 'value(status.url)')

# Test
curl ${SERVICE_URL}/api/health
```

---

## 📝 One-Liner Deployment (After Initial Setup)

```bash
export PROJECT_ID="your-project-id" && \
export REGION="us-central1" && \
export SERVICE_NAME="fitness-tracker" && \
export IMAGE_NAME="gcr.io/${PROJECT_ID}/fitness-tracker:latest" && \
podman build -t ${IMAGE_NAME} . && \
podman push ${IMAGE_NAME} && \
gcloud run deploy ${SERVICE_NAME} --image ${IMAGE_NAME} --platform managed --region ${REGION} --quiet
```

---

## 🔍 Common Tasks

### View Logs
```bash
gcloud run services logs tail ${SERVICE_NAME} --region ${REGION}
```

### List Services
```bash
gcloud run services list
```

### Delete Service
```bash
gcloud run services delete ${SERVICE_NAME} --region ${REGION}
```

---

## ⚡ Environment Variables Setup

If deploying for the first time with environment variables:

```bash
gcloud run deploy ${SERVICE_NAME} \
  --image ${IMAGE_NAME}:${IMAGE_TAG} \
  --platform managed \
  --region ${REGION} \
  --allow-unauthenticated \
  --port 3000 \
  --memory 512Mi \
  --set-env-vars "\
NODE_ENV=production,\
PORT=3000,\
JWT_SECRET=your-jwt-secret,\
CORS_ORIGIN=*,\
LOG_LEVEL=info,\
RATE_LIMIT_MAX=100,\
AUTH_RATE_LIMIT_MAX=10,\
ENABLE_HEALTH_CHECK=true,\
EXTERNAL_LOG_URL=https://s1583312.eu-nbg-2.betterstackdata.com/,\
EXTERNAL_LOG_TOKEN=Ra6ChCAZp8yMS6EyuKnFBnA4"
```

---

## 🆘 Troubleshooting

**Build fails?**
```bash
podman build --no-cache -t ${IMAGE_NAME}:${IMAGE_TAG} .
```

**Push fails?**
```bash
gcloud auth login
gcloud auth configure-docker
```

**Need to rollback?**
```bash
gcloud run services list --platform managed
# Find previous revision, then:
gcloud run revisions list --service ${SERVICE_NAME} --region ${REGION}
gcloud run services update-traffic ${SERVICE_NAME} --to-revisions REVISION_NAME=100 --region ${REGION}
```

---

For detailed documentation, see: [DEPLOYMENT-GUIDE.md](computer:///mnt/user-data/outputs/DEPLOYMENT-GUIDE.md)