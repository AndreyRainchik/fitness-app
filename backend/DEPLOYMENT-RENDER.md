# 🚀 Deployment Guide - Render.com

Complete guide to deploying your Fitness Tracker app to Render.com for free (or very cheap).

---

## 📋 Table of Contents

1. [Prerequisites](#prerequisites)
2. [Deployment Architecture](#deployment-architecture)
3. [Backend Deployment](#backend-deployment)
4. [Frontend Deployment](#frontend-deployment)
5. [Environment Configuration](#environment-configuration)
6. [External Logging Setup](#external-logging-setup)
7. [Monitoring & Maintenance](#monitoring--maintenance)
8. [Troubleshooting](#troubleshooting)
9. [Cost Breakdown](#cost-breakdown)

---

## Prerequisites

### Required
- ✅ GitHub account
- ✅ Render.com account (sign up at https://render.com)
- ✅ Your fitness app code pushed to GitHub

### Optional (Recommended)
- Better Stack account for logging (https://betterstack.com/logtail)
- Custom domain (optional)

---

## Deployment Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Your Users                           │
└──────────────────┬──────────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────────────┐
│         Render Frontend (Static Site)                   │
│         https://fitness-app.onrender.com                │
│         • Serves React app                              │
│         • Free SSL certificate                          │
└──────────────────┬──────────────────────────────────────┘
                   │
                   │ API Calls
                   ▼
┌─────────────────────────────────────────────────────────┐
│         Render Backend (Web Service)                    │
│         https://fitness-api.onrender.com                │
│         • Node.js/Express API                           │
│         • SQLite database (persistent disk)             │
│         • Health checks                                 │
└──────────────────┬──────────────────────────────────────┘
                   │
                   │ Logs
                   ▼
┌─────────────────────────────────────────────────────────┐
│         Better Stack (Optional)                         │
│         • Centralized logging                           │
│         • Error tracking                                │
│         • Alerts                                        │
└─────────────────────────────────────────────────────────┘
```

---

## Backend Deployment

### Step 1: Prepare Your Repository

1. **Update server.js**
   
   Replace your current `backend/src/server.js` with the production-ready version:
   ```bash
   # Copy the production server file
   cp backend/src/server.production.js backend/src/server.js
   ```

2. **Create .env file for Render**
   
   Render will set environment variables through their dashboard, but create a local `.env` for testing:
   ```bash
   cp backend/.env.example backend/.env
   ```

3. **Commit and push changes**
   ```bash
   git add .
   git commit -m "Add production configurations"
   git push origin main
   ```

### Step 2: Create Backend Service on Render

1. **Go to Render Dashboard**: https://dashboard.render.com

2. **Click "New +" → "Web Service"**

3. **Connect your GitHub repository**
   - Select your fitness-app repository
   - Give Render permission to access it

4. **Configure the service:**

   | Setting | Value |
   |---------|-------|
   | **Name** | `fitness-app-backend` |
   | **Environment** | `Node` |
   | **Region** | Choose closest to you |
   | **Branch** | `main` (or your default branch) |
   | **Root Directory** | `backend` |
   | **Build Command** | `npm install` |
   | **Start Command** | `npm start` |
   | **Plan** | Free |

5. **Add Persistent Disk for SQLite Database:**
   
   - Scroll to "Disk" section
   - Click "Add Disk"
   - **Name**: `fitness-db`
   - **Mount Path**: `/opt/render/project/src/data`
   - **Size**: 1 GB (free tier)
   - Click "Save"

6. **Configure Environment Variables:**

   Click "Advanced" → "Add Environment Variable" and add these:

   ```
   NODE_ENV=production
   PORT=3000
   JWT_SECRET=<generate-secure-random-string>
   JWT_EXPIRES_IN=7d
   DATABASE_PATH=/opt/render/project/src/data/fitness.db
   CORS_ORIGIN=https://fitness-app.onrender.com
   LOG_LEVEL=info
   ENABLE_HEALTH_CHECK=true
   ```

   **To generate JWT_SECRET:**
   ```bash
   # Run this on your local machine
   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   ```

7. **Click "Create Web Service"**

   Render will now:
   - Clone your repository
   - Install dependencies
   - Start your server
   - Assign a URL (e.g., `https://fitness-app-backend.onrender.com`)

8. **Wait for deployment** (usually 2-5 minutes)

9. **Test your backend:**
   ```bash
   curl https://fitness-app-backend.onrender.com/api/health
   ```

   You should see:
   ```json
   {
     "status": "ok",
     "timestamp": "2025-11-08T...",
     "uptime": 123.45
   }
   ```

### Step 3: Configure Health Checks

Render automatically sets up health checks, but you can customize them:

1. Go to your service settings
2. Find "Health Check Path"
3. Set to: `/api/health`
4. Save changes

This ensures Render will restart your service if it becomes unhealthy.

---

## Frontend Deployment

### Step 1: Update Frontend Configuration

1. **Create production environment file**

   Create `frontend/.env.production`:
   ```bash
   VITE_API_URL=https://fitness-app-backend.onrender.com
   VITE_APP_NAME=Fitness Tracker
   VITE_APP_VERSION=1.0.0
   ```

   **Important**: Replace `fitness-app-backend` with your actual backend service name!

2. **Update API service configuration**

   Edit `frontend/src/services/api.js` to use environment variable:
   ```javascript
   const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';
   ```

3. **Commit changes:**
   ```bash
   git add .
   git commit -m "Add production frontend configuration"
   git push origin main
   ```

### Step 2: Create Frontend Service on Render

1. **Go to Render Dashboard**: https://dashboard.render.com

2. **Click "New +" → "Static Site"**

3. **Connect your repository**
   - Select the same fitness-app repository

4. **Configure the service:**

   | Setting | Value |
   |---------|-------|
   | **Name** | `fitness-app-frontend` |
   | **Branch** | `main` |
   | **Root Directory** | `frontend` |
   | **Build Command** | `npm install && npm run build` |
   | **Publish Directory** | `dist` |

5. **Add Environment Variables:**

   ```
   VITE_API_URL=https://fitness-app-backend.onrender.com
   ```

   **Important**: Use your actual backend URL!

6. **Click "Create Static Site"**

7. **Wait for deployment** (usually 2-5 minutes)

8. **Test your frontend:**
   - Visit: `https://fitness-app-frontend.onrender.com`
   - Try to register and log in

### Step 3: Update Backend CORS

Now that you know your frontend URL, update the backend:

1. Go to your backend service on Render
2. Click "Environment"
3. Update `CORS_ORIGIN`:
   ```
   CORS_ORIGIN=https://fitness-app-frontend.onrender.com
   ```
4. Click "Save Changes"
5. Render will automatically redeploy

---

## Environment Configuration

### Backend Environment Variables (Complete List)

```bash
# Required
NODE_ENV=production
PORT=3000
JWT_SECRET=<your-secure-secret-here>
JWT_EXPIRES_IN=7d
DATABASE_PATH=/opt/render/project/src/data/fitness.db
CORS_ORIGIN=https://your-frontend.onrender.com
LOG_LEVEL=info

# Optional - Logging
EXTERNAL_LOG_URL=https://in.logtail.com
EXTERNAL_LOG_TOKEN=<your-logtail-token>

# Optional - Rate Limiting
RATE_LIMIT_MAX=100
AUTH_RATE_LIMIT_MAX=5

# Optional - Security
ENABLE_HELMET=true
```

### Frontend Environment Variables

```bash
# Required
VITE_API_URL=https://your-backend.onrender.com

# Optional
VITE_APP_NAME=Fitness Tracker
VITE_APP_VERSION=1.0.0
```

---

## External Logging Setup

### Option 1: Better Stack (Logtail) - RECOMMENDED

Better Stack provides 1GB/month free logging - perfect for your use case.

#### Setup Steps:

1. **Sign up**: https://betterstack.com/logtail

2. **Create a Source:**
   - Click "Add Source"
   - Select "HTTP"
   - Name it "Fitness App Backend"
   - Copy your Source Token

3. **Add to Render:**
   - Go to your backend service
   - Click "Environment"
   - Add these variables:
     ```
     EXTERNAL_LOG_URL=https://in.logtail.com
     EXTERNAL_LOG_TOKEN=<your-source-token>
     ```
   - Save changes

4. **Verify Logging:**
   - Make some API requests
   - Check Better Stack dashboard
   - You should see logs appearing

#### What You'll See:

- All HTTP requests (method, path, status, duration)
- Error logs with stack traces
- Performance metrics
- User IDs for debugging

#### Setting Up Alerts:

1. Go to Better Stack dashboard
2. Click "Alerts"
3. Create alert for: `level:error`
4. Get notified via email when errors occur

### Option 2: Render's Built-in Logging

Render provides basic logging for free:

1. Go to your service dashboard
2. Click "Logs" tab
3. View real-time logs
4. Filter by date/time

**Limitations:**
- Only keeps 7 days of logs
- No search functionality
- No alerts
- Basic formatting

### Option 3: Sentry (Error Tracking)

For more advanced error tracking:

1. Sign up: https://sentry.io
2. Create new project (Node.js)
3. Install Sentry SDK:
   ```bash
   npm install @sentry/node
   ```
4. Configure in `server.js`
5. Get alerts for errors

---

## Monitoring & Maintenance

### Health Check Endpoints

Your app now has multiple health check endpoints:

| Endpoint | Purpose | Response |
|----------|---------|----------|
| `/api/health` | Basic health check | `{ status: "ok" }` |
| `/api/health/detailed` | Includes database check | `{ status: "ok", checks: {...} }` |
| `/api/health/ready` | Kubernetes-style readiness | `{ status: "ready" }` |
| `/api/health/live` | Kubernetes-style liveness | `{ status: "alive" }` |

### Monitoring Dashboard

Render provides a dashboard with:
- Request metrics
- Response times
- Memory usage
- CPU usage
- Deployment history

### Setting Up Alerts

1. **Render Email Alerts** (Free):
   - Automatically notifies on deployment failures
   - Alerts when service goes down

2. **Better Stack Alerts**:
   - Custom queries for errors
   - Slack/Email/PagerDuty integration
   - Example: Alert when >10 errors in 5 minutes

### Database Backups

Your SQLite database is on a persistent disk. To create backups:

1. **Manual Backup via Shell:**
   ```bash
   # In Render Shell (Dashboard → Shell)
   cp /opt/render/project/src/data/fitness.db /opt/render/project/src/data/backup-$(date +%Y%m%d).db
   ```

2. **Download Backup:**
   - Use Render's shell to access the file
   - Copy to your local machine

3. **Automated Backups** (Advanced):
   - Set up a cron job service on Render
   - Copy database to S3/Google Cloud Storage
   - Keep rolling 7-day backups

---

## Troubleshooting

### Common Issues

#### 1. Backend Won't Start

**Symptoms:**
- "Application failed to start"
- Logs show errors

**Solutions:**
```bash
# Check logs in Render dashboard
# Common issues:
1. Missing environment variables (check JWT_SECRET)
2. Port not set correctly (should be 3000 or $PORT)
3. Database path incorrect
```

#### 2. Database Not Persisting

**Symptoms:**
- Data disappears after restart
- "Cannot find database" errors

**Solutions:**
```bash
# Verify persistent disk is mounted
# Check DATABASE_PATH matches mount path:
DATABASE_PATH=/opt/render/project/src/data/fitness.db

# Mount path should be:
/opt/render/project/src/data
```

#### 3. CORS Errors

**Symptoms:**
- Frontend can't connect to backend
- "No 'Access-Control-Allow-Origin' header" error

**Solutions:**
```bash
# Update CORS_ORIGIN in backend:
CORS_ORIGIN=https://your-frontend.onrender.com

# Multiple origins (if needed):
CORS_ORIGIN=https://fitness-app-frontend.onrender.com,http://localhost:5173
```

#### 4. Frontend Shows Old Version

**Symptoms:**
- Changes not appearing
- Old code still running

**Solutions:**
1. Clear browser cache (Ctrl+Shift+R / Cmd+Shift+R)
2. Verify build succeeded in Render
3. Check "Publish Directory" is set to `dist`
4. Trigger manual deploy

#### 5. Rate Limiting Too Aggressive

**Symptoms:**
- Getting 429 errors
- "Too many requests" messages

**Solutions:**
```bash
# Increase limits in backend environment:
RATE_LIMIT_MAX=200
AUTH_RATE_LIMIT_MAX=10

# Or disable in development:
NODE_ENV=development
```

### Debugging with Logs

#### Check Recent Errors:
```bash
# In Better Stack:
1. Go to "Live Tail"
2. Filter: level:error
3. See real-time errors

# In Render:
1. Go to service → Logs
2. Scroll to errors (red)
```

#### Debug Specific Request:
```bash
# Logs show:
- Request method and path
- Response status and duration
- User ID (if authenticated)
- Error messages and stack traces
```

---

## Cost Breakdown

### Free Tier (Perfect for Personal Use)

| Service | Free Tier | Cost if Exceeded |
|---------|-----------|------------------|
| **Render Backend** | Free with sleep after 15min inactivity | $7/month for always-on |
| **Render Frontend** | Unlimited | $0 |
| **Render Database Storage** | 1 GB | $0.25/GB/month |
| **Better Stack Logging** | 1 GB/month | $10/month for 5GB |
| **SSL Certificates** | Free | $0 |

**Total Monthly Cost: $0** (stays free if backend sleeps)

### Budget Tier (Always-On)

If you want your backend to never sleep:

| Service | Cost |
|---------|------|
| Render Backend (Starter) | $7/month |
| Render Frontend | $0 |
| Better Stack (free tier) | $0 |

**Total Monthly Cost: $7/month**

### Notes on Free Tier:

- **Backend sleeps** after 15 minutes of inactivity
- **First request after sleep** takes ~30 seconds (cold start)
- **No sleep during active use**
- **Perfect for personal use** (just you)

---

## Next Steps

1. ✅ Deploy backend to Render
2. ✅ Deploy frontend to Render
3. ✅ Set up external logging (optional)
4. ✅ Test the application end-to-end
5. 📱 Optionally set up custom domain
6. 🔔 Set up alerts for errors

---

## Additional Resources

- [Render Documentation](https://render.com/docs)
- [Better Stack Docs](https://betterstack.com/docs/logtail)
- [SQLite on Render](https://render.com/docs/disks)
- [Node.js Best Practices](https://github.com/goldbergyoni/nodebestpractices)

---

## Support

Having issues? Check:
1. Render logs in dashboard
2. Better Stack logs (if configured)
3. Browser console (F12) for frontend errors
4. Health check endpoint: `/api/health/detailed`

Need help? The logs will show you exactly what's wrong! 🔍