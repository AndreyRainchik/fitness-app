# 🚀 Quick Start: Deploy to Production

Get your fitness app deployed to Render.com in under 30 minutes.

---

## Prerequisites ✅

- GitHub account
- Render.com account (sign up at https://render.com)
- Your fitness app code pushed to GitHub

---

## Step-by-Step Deployment

### 1️⃣ Update Your Code (10 minutes)

#### Backend Changes

1. **Replace server.js with production version:**
   ```bash
   cp backend/src/server.production.js backend/src/server.js
   ```

2. **Review environment variables:**
   ```bash
   cat backend/.env.example
   ```
   Make sure you understand what each variable does.

3. **Commit changes:**
   ```bash
   git add .
   git commit -m "Add production configurations for deployment"
   git push origin main
   ```

#### Frontend Changes

1. **Create production environment file:**
   ```bash
   # frontend/.env.production
   VITE_API_URL=https://your-backend-name.onrender.com
   ```

2. **Update API service (if needed):**
   
   Verify `frontend/src/services/api.js` uses environment variables:
   ```javascript
   const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';
   ```

3. **Test production build locally:**
   ```bash
   cd frontend
   npm run build
   npm run preview
   ```

4. **Commit changes:**
   ```bash
   git add .
   git commit -m "Add frontend production configuration"
   git push origin main
   ```

---

### 2️⃣ Deploy Backend (10 minutes)

1. **Go to Render:** https://dashboard.render.com

2. **Click "New +" → "Web Service"**

3. **Connect GitHub repository**

4. **Configure service:**
   - Name: `fitness-app-backend`
   - Environment: `Node`
   - Root Directory: `backend`
   - Build Command: `npm install`
   - Start Command: `npm start`
   - Plan: `Free`

5. **Add Persistent Disk:**
   - Click "Add Disk"
   - Name: `fitness-db`
   - Mount Path: `/opt/render/project/src/data`
   - Size: `1 GB`

6. **Add Environment Variables:**
   ```
   NODE_ENV=production
   PORT=3000
   JWT_SECRET=<run: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))">
   JWT_EXPIRES_IN=7d
   DATABASE_PATH=/opt/render/project/src/data/fitness.db
   CORS_ORIGIN=https://your-frontend-name.onrender.com
   LOG_LEVEL=info
   ```

7. **Click "Create Web Service"**

8. **Wait for deployment** (2-5 minutes)

9. **Test it works:**
   ```bash
   curl https://your-backend-name.onrender.com/api/health
   ```

---

### 3️⃣ Deploy Frontend (10 minutes)

1. **In Render Dashboard, click "New +" → "Static Site"**

2. **Connect your repository**

3. **Configure service:**
   - Name: `fitness-app-frontend`
   - Root Directory: `frontend`
   - Build Command: `npm install && npm run build`
   - Publish Directory: `dist`

4. **Add Environment Variables:**
   ```
   VITE_API_URL=https://your-backend-name.onrender.com
   ```

5. **Click "Create Static Site"**

6. **Wait for deployment** (2-5 minutes)

7. **Update Backend CORS:**
   - Go back to backend service
   - Click "Environment"
   - Update `CORS_ORIGIN` with your frontend URL
   - Save (will auto-redeploy)

8. **Test your app:**
   - Visit your frontend URL
   - Register an account
   - Log in
   - Create a workout
   - Check it persists!

---

### 4️⃣ Set Up Logging (5 minutes - Optional)

1. **Sign up for Better Stack:** https://betterstack.com/logtail

2. **Create a source:**
   - Name: "Fitness App Backend"
   - Copy your source token

3. **Add to backend environment variables:**
   ```
   EXTERNAL_LOG_URL=https://in.logtail.com
   EXTERNAL_LOG_TOKEN=<your-token>
   ```

4. **Create error alert:**
   - In Better Stack, go to "Alerts"
   - Create new alert
   - Query: `level:error`
   - Notification: Email

5. **Test it:**
   - Make some API requests
   - Check Better Stack dashboard
   - Logs should appear!

---

## ✅ Verification Checklist

After deployment, verify everything works:

### Backend Tests
- [ ] Health check works: `https://your-backend.onrender.com/api/health`
- [ ] API root works: `https://your-backend.onrender.com/api`
- [ ] Can register a new account
- [ ] Can login
- [ ] No errors in Render logs

### Frontend Tests
- [ ] Site loads without errors
- [ ] Can navigate to all pages
- [ ] Can register and login
- [ ] Can create a workout
- [ ] Can view workouts
- [ ] Can view analytics
- [ ] Can update profile
- [ ] Mobile responsive

### Integration Tests
- [ ] Frontend connects to backend (no CORS errors)
- [ ] Data persists after page refresh
- [ ] Logout and login works
- [ ] All features work end-to-end

---

## 🎉 You're Live!

Your fitness app is now deployed and accessible from anywhere!

### Your URLs
- **Frontend**: `https://your-frontend-name.onrender.com`
- **Backend API**: `https://your-backend-name.onrender.com`
- **Logs**: Render dashboard → Logs tab (or Better Stack)

### What's Next?

Optional enhancements:
- 🌐 Add custom domain
- 📊 Set up more detailed monitoring
- 🔔 Configure email alerts
- 💾 Set up automated backups
- 🚀 Upgrade to paid plan for no sleep ($7/mo)

---

## 🆘 Troubleshooting

### Backend won't start
- Check environment variables are set
- Verify DATABASE_PATH matches disk mount path
- Check logs for error messages

### Frontend can't connect to backend
- Verify VITE_API_URL is correct
- Update CORS_ORIGIN in backend
- Check browser console for errors

### Data not persisting
- Verify persistent disk is mounted
- Check DATABASE_PATH environment variable
- Verify disk mount path is correct

### Need Help?
- Check `docs/DEPLOYMENT-RENDER.md` for detailed guide
- Check `docs/PRODUCTION-CHECKLIST.md` for comprehensive checklist
- Check Render logs for error messages
- Check Better Stack logs (if configured)

---

## 📚 Documentation

- **Detailed Deployment Guide**: `docs/DEPLOYMENT-RENDER.md`
- **Production Checklist**: `docs/PRODUCTION-CHECKLIST.md`
- **Logging Guide**: `docs/LOGGING-MONITORING.md`
- **Render Docs**: https://render.com/docs

---

## 💰 Cost

**Free Tier:**
- Backend: Free (sleeps after 15min inactivity)
- Frontend: Free (always on)
- Database: Free (1GB persistent disk)
- Logging: Free (Better Stack 1GB/month)

**Total: $0/month**

**Paid Tier (if you want always-on backend):**
- Backend: $7/month
- Everything else: $0

**Total: $7/month**

---

Good luck with your deployment! 🚀

If you run into any issues, check the detailed guides in the `docs/` folder.