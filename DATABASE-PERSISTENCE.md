# SQLite Database Persistence on Cloud Run

## Overview

Cloud Run services are stateless by default, but you can mount Cloud Storage buckets as volumes to persist data between deployments. This guide shows you how to persist your SQLite database.

---

## 🗄️ Solution: Cloud Storage Volume Mounts

Cloud Run supports mounting Cloud Storage buckets using GCSFuse, which presents the bucket as a POSIX filesystem.

### Prerequisites
- Google Cloud SDK installed
- Cloud Run service (or ready to deploy)
- Storage Admin permissions

---

## 📋 Step-by-Step Setup

### Step 1: Create Cloud Storage Bucket

```bash
# Set variables
export PROJECT_ID="your-project-id"
export BUCKET_NAME="${PROJECT_ID}-fitness-tracker-data"
export REGION="us-central1"
export SERVICE_NAME="fitness-tracker"

# Create bucket in the same region as your Cloud Run service
gsutil mb -l ${REGION} gs://${BUCKET_NAME}

# Set lifecycle policy (optional - for backups)
cat > lifecycle.json << EOF
{
  "lifecycle": {
    "rule": [
      {
        "action": {"type": "Delete"},
        "condition": {
          "age": 90,
          "matchesPrefix": ["backups/"]
        }
      }
    ]
  }
}
EOF

gsutil lifecycle set lifecycle.json gs://${BUCKET_NAME}
```

### Step 2: Grant Permissions

```bash
# Get your Cloud Run service account
export SERVICE_ACCOUNT="${PROJECT_ID}@appspot.gserviceaccount.com"

# Or if using a custom service account:
# export SERVICE_ACCOUNT="your-service-account@${PROJECT_ID}.iam.gserviceaccount.com"

# Grant storage permissions
gsutil iam ch serviceAccount:${SERVICE_ACCOUNT}:roles/storage.objectAdmin gs://${BUCKET_NAME}
```

### Step 3: Update Environment Variables

Update your environment to use the mounted path:

```bash
export DATABASE_PATH="/mnt/data/fitness_tracker.db"
export BACKUP_PATH="/mnt/data/backups"
```

### Step 4: Deploy with Volume Mount

```bash
# Build and push image (if not already done)
export IMAGE_NAME="gcr.io/${PROJECT_ID}/fitness-tracker:latest"
podman build -t ${IMAGE_NAME} -f Dockerfile .
podman push ${IMAGE_NAME}

# Deploy with volume mount
gcloud run deploy ${SERVICE_NAME} \
  --image ${IMAGE_NAME} \
  --platform managed \
  --region ${REGION} \
  --allow-unauthenticated \
  --port 3000 \
  --memory 1Gi \
  --cpu 1 \
  --min-instances 1 \
  --max-instances 10 \
  --execution-environment gen2 \
  --add-volume name=data-volume,type=cloud-storage,bucket=${BUCKET_NAME} \
  --add-volume-mount volume=data-volume,mount-path=/mnt/data \
  --set-env-vars "\
NODE_ENV=production,\
PORT=3000,\
DATABASE_PATH=/mnt/data/fitness_tracker.db,\
LOG_LEVEL=info,\
RATE_LIMIT_MAX=100,\
AUTH_RATE_LIMIT_MAX=10,\
ENABLE_HEALTH_CHECK=true" \
  --set-secrets "JWT_SECRET=jwt-secret:latest,EXTERNAL_LOG_URL=external-log-url:latest,EXTERNAL_LOG_TOKEN=external-log-token:latest"
```

**Important Notes:**
- `--execution-environment gen2` is REQUIRED for volume mounts
- `--min-instances 1` is recommended to keep the database connection warm
- Volume name (`data-volume`) can be anything you choose
- Mount path (`/mnt/data`) should match your `DATABASE_PATH`

---

## 🔧 Code Changes

### Update database.js Configuration

Your existing database configuration should work, but ensure the path is correct:

```javascript
// backend/src/config/database.js
import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

// Get database path from environment or use default
const DATABASE_PATH = process.env.DATABASE_PATH || '/mnt/data/fitness_tracker.db';

// Ensure directory exists
const dbDir = path.dirname(DATABASE_PATH);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

// Initialize database connection
const db = new Database(DATABASE_PATH);

// Enable WAL mode for better concurrent access
db.pragma('journal_mode = WAL');

export default db;
```

### Add Initialization Check

Add this to your server startup to verify the mount:

```javascript
// backend/src/server.production-single-container.js

// After database initialization
import fs from 'fs';

const dbPath = process.env.DATABASE_PATH || '/mnt/data/fitness_tracker.db';
const mountPath = '/mnt/data';

// Verify mount is accessible
if (fs.existsSync(mountPath)) {
  logger.info('✅ Volume mount verified', { path: mountPath });
  
  // Check if database exists
  if (fs.existsSync(dbPath)) {
    const stats = fs.statSync(dbPath);
    logger.info('✅ Database file found', { 
      path: dbPath, 
      size: stats.size,
      modified: stats.mtime 
    });
  } else {
    logger.info('📝 Database will be created', { path: dbPath });
  }
} else {
  logger.warn('⚠️ Volume mount not found', { path: mountPath });
}
```

---

## ✅ Verification

### 1. Check Volume Mount Status

```bash
# Describe the service
gcloud run services describe ${SERVICE_NAME} \
  --platform managed \
  --region ${REGION} \
  --format yaml

# Look for the volumes section:
# spec:
#   template:
#     spec:
#       volumes:
#       - cloudStorage:
#           bucket: your-bucket-name
#         name: data-volume
```

### 2. Test Database Persistence

```bash
# Get service URL
export SERVICE_URL=$(gcloud run services describe ${SERVICE_NAME} \
  --platform managed \
  --region ${REGION} \
  --format 'value(status.url)')

# Create a test user
curl -X POST ${SERVICE_URL}/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "testpass123",
    "username": "TestUser"
  }'

# Redeploy the service (should keep data)
gcloud run deploy ${SERVICE_NAME} \
  --image ${IMAGE_NAME} \
  --platform managed \
  --region ${REGION}

# Verify user still exists
curl -X POST ${SERVICE_URL}/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "testpass123"
  }'
```

### 3. Check Database File in Bucket

```bash
# List files in bucket
gsutil ls gs://${BUCKET_NAME}/

# Download database for inspection (optional)
gsutil cp gs://${BUCKET_NAME}/fitness_tracker.db ./local_copy.db

# View database contents locally
sqlite3 local_copy.db "SELECT * FROM users;"
```

---

## 📊 Backup Strategy

### Automated Backups to Bucket

Add this to your application code:

```javascript
// backend/src/utils/backup.js
import fs from 'fs';
import path from 'path';
import { Storage } from '@google-cloud/storage';

const storage = new Storage();
const bucketName = process.env.BUCKET_NAME;
const dbPath = process.env.DATABASE_PATH || '/mnt/data/fitness_tracker.db';

/**
 * Create a backup of the database
 */
export async function createBackup() {
  try {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupName = `backups/fitness_tracker_${timestamp}.db`;
    
    // Copy database file
    const backupPath = `/mnt/data/backups/fitness_tracker_${timestamp}.db`;
    fs.copyFileSync(dbPath, backupPath);
    
    console.log(`✅ Backup created: ${backupName}`);
    return backupPath;
  } catch (error) {
    console.error('❌ Backup failed:', error);
    throw error;
  }
}

/**
 * Schedule automatic backups
 */
export function scheduleBackups(intervalHours = 24) {
  setInterval(async () => {
    try {
      await createBackup();
    } catch (error) {
      console.error('Scheduled backup failed:', error);
    }
  }, intervalHours * 60 * 60 * 1000);
}
```

Use in your server:

```javascript
// backend/src/server.production-single-container.js
import { scheduleBackups } from './utils/backup.js';

// After server starts
scheduleBackups(24); // Backup every 24 hours
```

### Manual Backup Script

```bash
#!/bin/bash
# backup-database.sh

PROJECT_ID="your-project-id"
BUCKET_NAME="${PROJECT_ID}-fitness-tracker-data"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_NAME="manual_backup_${TIMESTAMP}.db"

# Download from bucket
gsutil cp gs://${BUCKET_NAME}/fitness_tracker.db ./backups/${BACKUP_NAME}

# Upload to backups folder in same bucket
gsutil cp ./backups/${BACKUP_NAME} gs://${BUCKET_NAME}/backups/

echo "✅ Backup created: ${BACKUP_NAME}"
```

---

## ⚡ Performance Considerations

### GCSFuse Performance

GCSFuse has some limitations compared to local disk:

**Pros:**
- ✅ Data persists between deployments
- ✅ Automatic replication and durability
- ✅ Easy backups with `gsutil`
- ✅ No size limits

**Cons:**
- ⚠️ Higher latency than local disk (~50-100ms per operation)
- ⚠️ Not ideal for high-write workloads
- ⚠️ Eventual consistency

### Optimization Tips

1. **Enable WAL Mode** (already in your code)
```javascript
db.pragma('journal_mode = WAL');
```

2. **Use Connection Pooling**
```javascript
// Keep database connection open
db.pragma('busy_timeout = 5000');
```

3. **Batch Operations**
```javascript
// Use transactions for multiple inserts
const insertMany = db.transaction((items) => {
  for (const item of items) {
    insertStmt.run(item);
  }
});
```

4. **Consider Caching**
```javascript
// Cache frequently accessed data in memory
const cache = new Map();
```

---

## 🚨 Important Notes

### When GCSFuse Works Well
- ✅ Read-heavy workloads
- ✅ Small to medium databases (<1GB)
- ✅ Infrequent writes
- ✅ Personal/small team apps

### When to Consider Alternatives
- ❌ High write frequency (>100 writes/sec)
- ❌ Large databases (>5GB)
- ❌ Need for ACID guarantees
- ❌ Production apps with many concurrent users

---

## 🔄 Alternative: Cloud SQL (Recommended for Production)

For production workloads, consider migrating to Cloud SQL:

### Pros
- ✅ Better performance
- ✅ Automatic backups
- ✅ High availability
- ✅ Scaling capabilities
- ✅ Connection pooling

### Quick Setup

```bash
# Create Cloud SQL instance (PostgreSQL)
gcloud sql instances create fitness-tracker-db \
  --database-version=POSTGRES_14 \
  --tier=db-f1-micro \
  --region=${REGION}

# Create database
gcloud sql databases create fitness_tracker \
  --instance=fitness-tracker-db

# Create user
gcloud sql users create appuser \
  --instance=fitness-tracker-db \
  --password=your-secure-password

# Connect from Cloud Run
gcloud run deploy ${SERVICE_NAME} \
  --image ${IMAGE_NAME} \
  --add-cloudsql-instances=${PROJECT_ID}:${REGION}:fitness-tracker-db \
  --set-env-vars "DATABASE_URL=postgresql://appuser:password@/fitness_tracker?host=/cloudsql/${PROJECT_ID}:${REGION}:fitness-tracker-db"
```

---

## 📝 Complete Deployment Script with Volume Mount

```bash
#!/bin/bash

# Configuration
PROJECT_ID="your-project-id"
REGION="us-central1"
SERVICE_NAME="fitness-tracker"
BUCKET_NAME="${PROJECT_ID}-fitness-tracker-data"
IMAGE_NAME="gcr.io/${PROJECT_ID}/fitness-tracker:latest"

echo "🚀 Starting deployment with persistent storage..."

# 1. Create bucket if it doesn't exist
if ! gsutil ls gs://${BUCKET_NAME} &>/dev/null; then
    echo "📦 Creating storage bucket..."
    gsutil mb -l ${REGION} gs://${BUCKET_NAME}
else
    echo "✅ Bucket already exists"
fi

# 2. Set permissions
echo "🔐 Setting permissions..."
SERVICE_ACCOUNT="${PROJECT_ID}@appspot.gserviceaccount.com"
gsutil iam ch serviceAccount:${SERVICE_ACCOUNT}:roles/storage.objectAdmin gs://${BUCKET_NAME}

# 3. Build and push image
echo "🔨 Building image..."
podman build -t ${IMAGE_NAME} -f Dockerfile .

echo "📤 Pushing image..."
podman push ${IMAGE_NAME}

# 4. Deploy with volume mount
echo "🚢 Deploying to Cloud Run..."
gcloud run deploy ${SERVICE_NAME} \
  --image ${IMAGE_NAME} \
  --platform managed \
  --region ${REGION} \
  --allow-unauthenticated \
  --port 3000 \
  --memory 1Gi \
  --cpu 1 \
  --min-instances 1 \
  --max-instances 10 \
  --execution-environment gen2 \
  --add-volume name=data-volume,type=cloud-storage,bucket=${BUCKET_NAME} \
  --add-volume-mount volume=data-volume,mount-path=/mnt/data \
  --set-env-vars "NODE_ENV=production,PORT=3000,DATABASE_PATH=/mnt/data/fitness_tracker.db,LOG_LEVEL=info" \
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
```

Save as `deploy-with-storage.sh` and run:
```bash
chmod +x deploy-with-storage.sh
./deploy-with-storage.sh
```

---

## 🔍 Troubleshooting

### Volume Not Mounting

Check execution environment:
```bash
gcloud run services describe ${SERVICE_NAME} --region ${REGION} \
  --format 'value(spec.template.spec.executionEnvironment)'
```
Must show `gen2`

### Permission Errors

Verify service account has permissions:
```bash
gsutil iam get gs://${BUCKET_NAME}
```

### Database Locked

If you get "database is locked" errors:
1. Ensure WAL mode is enabled
2. Use `min-instances 1` to keep connection warm
3. Implement proper connection pooling

### Can't See Database File

```bash
# Check if file exists in bucket
gsutil ls gs://${BUCKET_NAME}/

# Check Cloud Run logs
gcloud run services logs read ${SERVICE_NAME} --limit 50
```

---

## 📚 Additional Resources

- [Cloud Run Volume Mounts](https://cloud.google.com/run/docs/configuring/services/cloud-storage-volume-mounts)
- [GCSFuse Documentation](https://cloud.google.com/storage/docs/gcs-fuse)
- [Cloud SQL Quickstart](https://cloud.google.com/sql/docs/postgres/quickstart)
- [SQLite Best Practices](https://www.sqlite.org/bestpractice.html)