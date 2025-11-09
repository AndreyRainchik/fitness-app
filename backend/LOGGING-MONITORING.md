# 📊 Logging & Monitoring Guide

Complete guide to setting up logging and monitoring for your Fitness Tracker app in production.

---

## Table of Contents

1. [Overview](#overview)
2. [Built-in Logging](#built-in-logging)
3. [External Logging with Better Stack](#external-logging-with-better-stack)
4. [Log Levels](#log-levels)
5. [What Gets Logged](#what-gets-logged)
6. [Setting Up Alerts](#setting-up-alerts)
7. [Analyzing Logs](#analyzing-logs)
8. [Troubleshooting](#troubleshooting)

---

## Overview

Your fitness app now has comprehensive logging built-in:

- **Request Logging**: Every API call is logged with timing and status
- **Error Logging**: All errors are captured with stack traces
- **Performance Monitoring**: Track response times and slow queries
- **User Activity**: See what users are doing (anonymized)
- **Security Events**: Failed logins, rate limiting, suspicious activity

### Logging Architecture

```
┌─────────────────────────────────────┐
│     Your Backend Application        │
│  ┌────────────────────────────┐    │
│  │   Request comes in         │    │
│  │         ↓                   │    │
│  │   Request Logger           │────┼──┐
│  │         ↓                   │    │  │
│  │   Your Route Handler       │    │  │
│  │         ↓                   │    │  │
│  │   Response sent            │    │  │
│  │         ↓                   │    │  │
│  │   Request Logger logs      │────┼──┘
│  │   (duration, status, etc)  │    │
│  └────────────────────────────┘    │
└───────────────┬─────────────────────┘
                │
                │ Logs sent to:
                ├──────────────────────┐
                │                      │
                ▼                      ▼
    ┌───────────────────┐  ┌──────────────────┐
    │ Console (Render)  │  │ Better Stack     │
    │ • 7 day history   │  │ • 1GB/month free │
    │ • Basic search    │  │ • Advanced search│
    │ • No alerts       │  │ • Alerts         │
    └───────────────────┘  └──────────────────┘
```

---

## Built-in Logging

Your app logs to console by default, which Render captures.

### Configuration

Set the log level in your environment variables:

```bash
LOG_LEVEL=info  # error, warn, info, http, debug
```

### Log Levels Explained

| Level | When to Use | What Gets Logged | Production? |
|-------|-------------|------------------|-------------|
| `error` | Production critical issues | Only errors | ✅ Minimal logs |
| `warn` | Production with warnings | Errors + warnings | ✅ Recommended |
| `info` | Production standard | Errors + warnings + info | ✅ Best for most |
| `http` | Development/debugging | All above + every HTTP request | ⚠️ Verbose |
| `debug` | Development only | Everything including debug info | ❌ Too verbose |

**Recommended for production:** `info`

### Viewing Logs in Render

1. Go to your service in Render dashboard
2. Click "Logs" tab
3. See real-time logs
4. Filter by:
   - Time range (last hour, day, week)
   - Search text
   - Log level (errors show in red)

**Limitations:**
- Only 7 days of history
- No alerts
- Basic search
- Can't export logs

---

## External Logging with Better Stack

Better Stack (Logtail) provides advanced logging features for free.

### Why Use Better Stack?

- ✅ **Longer History**: 30+ days (vs 7 days in Render)
- ✅ **Better Search**: Query by any field
- ✅ **Alerts**: Email/Slack when errors occur
- ✅ **Live Tail**: Real-time log streaming
- ✅ **Structured Logs**: Filter by level, user, endpoint, etc.
- ✅ **Graphs**: Visualize error rates, response times

### Setup Instructions

#### 1. Create Better Stack Account

1. Go to https://betterstack.com/logtail
2. Sign up (free tier: 1 GB/month - plenty for you)
3. Verify your email

#### 2. Create a Source

1. After logging in, click "Add Source"
2. Select "HTTP" (for Node.js)
3. Name it: "Fitness App Backend"
4. Click "Create Source"
5. **Copy your Source Token** (starts with `your-token-here`)

#### 3. Configure Backend

Add these environment variables in Render:

```bash
# External logging
EXTERNAL_LOG_URL=https://in.logtail.com
EXTERNAL_LOG_TOKEN=your-actual-token-here
```

**Steps in Render:**
1. Go to your backend service
2. Click "Environment" tab
3. Click "Add Environment Variable"
4. Add `EXTERNAL_LOG_URL` = `https://in.logtail.com`
5. Add `EXTERNAL_LOG_TOKEN` = `<your-token>`
6. Click "Save Changes"
7. Service will automatically redeploy

#### 4. Verify It's Working

1. Wait for service to redeploy (~2 minutes)
2. Make some API requests to your app
3. Go to Better Stack dashboard
4. Click "Live Tail"
5. You should see logs appearing!

### What You'll See in Better Stack

Each log entry includes:

```json
{
  "timestamp": "2025-11-08T10:30:45.123Z",
  "level": "info",
  "message": "GET /api/workouts - 200",
  "meta": {
    "method": "GET",
    "path": "/api/workouts",
    "status": 200,
    "duration": "45ms",
    "userId": 1,
    "ip": "123.456.789.0",
    "userAgent": "Mozilla/5.0..."
  },
  "environment": "production",
  "service": "fitness-app-backend"
}
```

---

## Log Levels

### Error (level: error)

**What it logs:**
- API errors (500 status codes)
- Uncaught exceptions
- Database errors
- Authentication failures

**Example:**
```
[2025-11-08T10:30:45.123Z] [ERROR] Database query failed
{
  "error": "SQLITE_ERROR: no such table: workouts",
  "query": "SELECT * FROM workouts",
  "userId": 1
}
```

**When to check:**
- Immediately! These are serious issues
- Set up alerts for these

### Warning (level: warn)

**What it logs:**
- 4xx status codes (bad requests, not found, etc.)
- Rate limiting triggers
- Security events (failed logins)
- Deprecated API usage

**Example:**
```
[2025-11-08T10:30:45.123Z] [WARN] POST /api/auth/login - 401
{
  "method": "POST",
  "path": "/api/auth/login",
  "status": 401,
  "ip": "123.456.789.0",
  "error": "Invalid credentials"
}
```

**When to check:**
- Daily review
- If users report issues
- Look for patterns (same IP failing login)

### Info (level: info)

**What it logs:**
- Server startup/shutdown
- Successful requests (2xx, 3xx)
- Important state changes
- Configuration info

**Example:**
```
[2025-11-08T10:30:45.123Z] [INFO] 🚀 Server started successfully
{
  "port": 3000,
  "environment": "production",
  "nodeVersion": "v18.17.0"
}
```

**When to check:**
- General debugging
- Understanding user behavior
- Performance analysis

### HTTP (level: http)

**What it logs:**
- Every single HTTP request
- Very verbose!

**Example:**
```
[2025-11-08T10:30:45.123Z] [HTTP] GET /api/exercises - 200
{
  "method": "GET",
  "path": "/api/exercises",
  "status": 200,
  "duration": "12ms",
  "userId": 1
}
```

**When to use:**
- Debugging specific issues
- Not recommended for production (too many logs)

### Debug (level: debug)

**What it logs:**
- Internal application state
- Variable values
- Function calls
- Very detailed debugging info

**When to use:**
- Development only
- Never in production

---

## What Gets Logged

### Automatically Logged

✅ **Every API Request:**
- Method (GET, POST, etc.)
- Path (/api/workouts)
- Status code (200, 404, 500)
- Response time (in ms)
- User ID (if authenticated)
- IP address
- User agent

✅ **Errors:**
- Error message
- Stack trace
- Request details
- User context

✅ **Application Events:**
- Server start/stop
- Database connection
- Configuration loaded
- Graceful shutdowns

### What's NOT Logged

❌ **Sensitive Data:**
- Passwords (always hashed)
- JWT tokens (only logged on generation, not in requests)
- Personal information (emails only in context)

❌ **Request Bodies:**
- Not logged by default (would include passwords)
- Can be enabled for specific routes if needed

---

## Setting Up Alerts

### Better Stack Alerts

#### 1. Create Alert for All Errors

1. Go to Better Stack dashboard
2. Click "Alerts"
3. Click "Create Alert"
4. Configure:
   - **Name**: "Production Errors"
   - **Query**: `level:error`
   - **Threshold**: More than 1 event in 5 minutes
   - **Notifications**: Email to your address
5. Click "Create Alert"

Now you'll get an email whenever an error occurs!

#### 2. Create Alert for Failed Logins

1. Click "Create Alert"
2. Configure:
   - **Name**: "Failed Login Attempts"
   - **Query**: `level:warn AND path:/api/auth/login AND status:401`
   - **Threshold**: More than 5 events in 15 minutes
   - **Notifications**: Email
3. Click "Create Alert"

This alerts you to potential brute force attacks.

#### 3. Create Alert for High Error Rate

1. Click "Create Alert"
2. Configure:
   - **Name**: "High Error Rate"
   - **Query**: `status:>=500`
   - **Threshold**: More than 10 events in 5 minutes
   - **Notifications**: Email
3. Click "Create Alert"

This alerts you if something is seriously wrong.

### Render Alerts

Render automatically sends email alerts for:
- Deployment failures
- Service crashes
- Health check failures

No configuration needed!

---

## Analyzing Logs

### Common Queries (Better Stack)

**Find all errors today:**
```
level:error
```

**Find slow requests (>1 second):**
```
duration:>1000ms
```

**Find requests from specific user:**
```
userId:5
```

**Find failed login attempts:**
```
path:/api/auth/login AND status:401
```

**Find rate limited requests:**
```
status:429
```

**Find all workout creation requests:**
```
path:/api/workouts AND method:POST
```

### Performance Analysis

**Average Response Times:**
1. Go to Better Stack
2. Click "Analytics"
3. Add metric: `avg(duration)`
4. Group by: `path`
5. See which endpoints are slowest

**Error Rate Over Time:**
1. Go to "Analytics"
2. Add metric: `count(level)`
3. Filter: `level:error`
4. View as line chart
5. See error trends

---

## Troubleshooting

### Problem: No Logs Appearing in Better Stack

**Check:**

1. **Token configured?**
   ```bash
   # In Render environment variables:
   EXTERNAL_LOG_URL=https://in.logtail.com
   EXTERNAL_LOG_TOKEN=<your-token>
   ```

2. **Service redeployed?**
   - Changes to environment variables require a redeploy
   - Check deployment logs

3. **Making requests?**
   - Logs only appear when requests are made
   - Try making an API call

4. **Network issues?**
   - Check Render logs for "Failed to send log to external service"
   - Verify token is correct

### Problem: Too Many Logs

**Solution:**

Change log level to `warn` or `error`:
```bash
LOG_LEVEL=warn
```

This reduces log volume by only logging warnings and errors.

### Problem: Can't Find Specific Log

**Better Stack Search Tips:**

- Use specific fields: `userId:5 AND path:/api/workouts`
- Use date range picker
- Use operators: `AND`, `OR`, `NOT`
- Use wildcards: `path:/api/workout*`

### Problem: Missing Information in Logs

**Add Custom Logging:**

In your code, use the logger:

```javascript
import logger from '../config/logger.config.js';

// In your route handler
logger.info('User created workout', {
  userId: req.user.id,
  workoutId: workout.id,
  exerciseCount: workout.exercises.length,
  duration: workout.duration
});
```

---

## Best Practices

### DO ✅

- **Set LOG_LEVEL to `info` in production**
- **Set up alerts for errors**
- **Review logs daily**
- **Include context in log messages**
- **Use structured logging (objects)**
- **Log before and after important operations**

### DON'T ❌

- **Don't log passwords or tokens**
- **Don't log excessive debug info in production**
- **Don't ignore warning logs**
- **Don't log sensitive user data**
- **Don't use console.log (use logger instead)**

---

## Log Retention

### Render (Console Logs)
- **Free Tier**: 7 days
- **Starter Plan**: 7 days
- Cannot be extended

### Better Stack
- **Free Tier**: 30 days, 1 GB/month
- **Basic Plan**: 90 days, 5 GB/month ($10/mo)
- **Pro Plan**: 180 days, 15 GB/month ($20/mo)

For personal use, free tier is perfect!

---

## Example: Debugging a Problem

### Scenario: User reports "workout not saving"

**Step 1: Find the user's requests**
```
# In Better Stack
userId:5 AND path:/api/workouts
```

**Step 2: Look for errors**
```
userId:5 AND level:error
```

**Step 3: Check the specific request**
```
userId:5 AND path:/api/workouts AND method:POST
```

**Step 4: See the full details**
- Click on the log entry
- See request path, status, duration
- See error message and stack trace
- See what happened before/after

**Step 5: Fix the issue**
- Identify the problem from logs
- Fix in code
- Deploy
- Verify fix works

---

## Summary

### Quick Setup (5 minutes)

1. ✅ Backend already has logging built-in
2. ✅ Sign up for Better Stack (free)
3. ✅ Add EXTERNAL_LOG_TOKEN to Render
4. ✅ Create alert for errors
5. ✅ Done!

### What You Get

- **Real-time monitoring** of your app
- **Email alerts** when errors occur
- **30 days of log history**
- **Fast searching and filtering**
- **Performance insights**

### Cost

**$0/month** (Better Stack free tier is perfect for personal use)

---

## Support

- **Better Stack Docs**: https://betterstack.com/docs/logtail
- **Render Logs**: https://render.com/docs/logging
- **Your Logs**: Check Render dashboard → Logs tab

Happy monitoring! 📊🚀