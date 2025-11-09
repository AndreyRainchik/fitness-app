# PWA Deployment & Testing Guide

## Prerequisites

### HTTPS Required ✅
PWAs require HTTPS (except on localhost). Your deployment must have:
- Valid SSL certificate
- HTTPS enabled
- No mixed content warnings

---

## Installation Steps

### 1. Install Dependencies

```bash
cd frontend
npm install vite-plugin-pwa workbox-window --save-dev
```

### 2. File Structure

Create/update these files:

```
frontend/
├── public/
│   ├── icons/              # Create this folder
│   │   └── (place icons here)
│   └── favicon.ico
├── src/
│   ├── components/
│   │   └── PWAPrompt.jsx   # NEW
│   ├── App.jsx             # UPDATE
│   └── index.css           # UPDATE (add animations)
├── vite.config.js          # UPDATE
└── package.json            # UPDATE
```

### 3. Update Files

1. **Update package.json** - Add PWA dependencies
2. **Replace vite.config.js** - With PWA configuration
3. **Create PWAPrompt.jsx** - In `src/components/`
4. **Update App.jsx** - Add `<PWAPrompt />` component
5. **Update index.css** - Add PWA animations
6. **Generate icons** - Follow icon generation guide

### 4. Build and Test Locally

```bash
# Development mode (PWA enabled)
npm run dev

# Production build
npm run build

# Preview production build
npm run preview
```

---

## Testing Your PWA

### Local Testing (Development)

1. **Start dev server:**
   ```bash
   npm run dev
   ```

2. **Open Chrome DevTools (F12)**

3. **Go to Application tab:**
   - Click "Manifest" - Check all fields are correct
   - Click "Service Workers" - Should show registered SW
   - Check "Update on reload" for testing

4. **Test Install Prompt:**
   - In Chrome, you should see the install prompt after a few seconds
   - Click "Install" to test

### Production Testing

1. **Build:**
   ```bash
   npm run build
   ```

2. **Serve locally with HTTPS:**
   ```bash
   # Option 1: Using serve
   npx serve -s dist -l 3001 --ssl-cert cert.pem --ssl-key key.pem

   # Option 2: Using vite preview
   npm run preview
   ```

3. **Test in multiple browsers:**
   - Chrome/Edge (full support)
   - Firefox (good support)
   - Safari (partial support, iOS 16.4+)

### Mobile Testing

#### Android (Chrome):
1. Deploy to production or use ngrok for local testing
2. Open in Chrome on Android
3. Should see "Add to Home screen" prompt
4. Install and test offline functionality

#### iOS (Safari):
1. Deploy to HTTPS server
2. Open in Safari on iOS
3. Tap Share button → "Add to Home Screen"
4. Test installed app

---

## Deployment Platforms

### Recommended Platforms (All support PWA):

#### 1. Vercel (Easiest)
```bash
# Install Vercel CLI
npm install -g vercel

# Deploy
cd frontend
vercel --prod
```

**Configuration (vercel.json):**
```json
{
  "buildCommand": "npm run build",
  "outputDirectory": "dist",
  "devCommand": "npm run dev",
  "installCommand": "npm install",
  "headers": [
    {
      "source": "/sw.js",
      "headers": [
        {
          "key": "Cache-Control",
          "value": "public, max-age=0, must-revalidate"
        }
      ]
    },
    {
      "source": "/manifest.webmanifest",
      "headers": [
        {
          "key": "Content-Type",
          "value": "application/manifest+json"
        }
      ]
    }
  ]
}
```

#### 2. Netlify
```bash
# Install Netlify CLI
npm install -g netlify-cli

# Deploy
cd frontend
netlify deploy --prod
```

**Configuration (netlify.toml):**
```toml
[build]
  command = "npm run build"
  publish = "dist"

[[headers]]
  for = "/sw.js"
  [headers.values]
    Cache-Control = "public, max-age=0, must-revalidate"

[[headers]]
  for = "/manifest.webmanifest"
  [headers.values]
    Content-Type = "application/manifest+json"
```

#### 3. GitHub Pages with Actions

**.github/workflows/deploy.yml:**
```yaml
name: Deploy PWA

on:
  push:
    branches: [ main ]

jobs:
  build-and-deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
          
      - name: Install dependencies
        working-directory: ./frontend
        run: npm ci
        
      - name: Build
        working-directory: ./frontend
        run: npm run build
        
      - name: Deploy to GitHub Pages
        uses: peaceiris/actions-gh-pages@v3
        with:
          github_token: ${{ secrets.GITHUB_TOKEN }}
          publish_dir: ./frontend/dist
```

#### 4. Firebase Hosting

```bash
# Install Firebase CLI
npm install -g firebase-tools

# Login
firebase login

# Initialize
firebase init hosting

# Deploy
cd frontend
npm run build
firebase deploy
```

**firebase.json:**
```json
{
  "hosting": {
    "public": "dist",
    "ignore": [
      "firebase.json",
      "**/.*",
      "**/node_modules/**"
    ],
    "rewrites": [
      {
        "source": "**",
        "destination": "/index.html"
      }
    ],
    "headers": [
      {
        "source": "/sw.js",
        "headers": [
          {
            "key": "Cache-Control",
            "value": "public, max-age=0, must-revalidate"
          }
        ]
      }
    ]
  }
}
```

---

## Testing Checklist

### ✅ Before Deployment
- [ ] All icons generated and in correct location
- [ ] Manifest.json configured correctly
- [ ] Service worker registering in dev mode
- [ ] Build completes without errors
- [ ] Preview build works locally

### ✅ After Deployment
- [ ] Site loads over HTTPS
- [ ] No mixed content warnings
- [ ] Install prompt appears
- [ ] Can install to home screen
- [ ] Installed app opens in standalone mode
- [ ] Icons display correctly on home screen
- [ ] Offline mode works (disconnect and test)
- [ ] Update prompt works (deploy update and test)

### ✅ Cross-Platform Testing
- [ ] Chrome on Android
- [ ] Safari on iOS
- [ ] Chrome on Desktop
- [ ] Edge on Desktop
- [ ] Firefox on Desktop

---

## Debugging Common Issues

### Install Prompt Not Showing

**Reasons:**
1. Not on HTTPS (except localhost)
2. Already installed
3. User dismissed prompt multiple times
4. Browser doesn't support PWA
5. Manifest is invalid

**Solutions:**
- Check DevTools > Application > Manifest for errors
- Clear site data and revisit
- Check browser console for errors
- Use Chrome (best PWA support)

### Service Worker Not Registering

**Check:**
```javascript
// In browser console:
navigator.serviceWorker.getRegistrations().then(registrations => {
  console.log('Service Workers:', registrations);
});
```

**Common fixes:**
- Clear browser cache completely
- Check service worker scope
- Ensure SW file is in root of build
- Check for JavaScript errors

### Icons Not Showing

**Debug steps:**
1. Open DevTools > Application > Manifest
2. Click on each icon URL
3. Ensure images load
4. Check file paths match manifest
5. Clear cache and hard reload (Ctrl+Shift+R)

### Offline Not Working

**Check:**
1. DevTools > Application > Service Workers
2. Check "Offline" checkbox
3. Refresh page - should still load
4. Check Network tab for cache hits

**Fix:**
- Verify workbox configuration in vite.config.js
- Check caching strategies
- Ensure service worker is activated

---

## Performance Testing

### Lighthouse Audit

1. Open Chrome DevTools
2. Go to Lighthouse tab
3. Select "Progressive Web App"
4. Click "Analyze page load"

**Target Scores:**
- Performance: 90+
- PWA: 100
- Accessibility: 90+
- Best Practices: 90+
- SEO: 90+

### PWA Checklist

Run Lighthouse PWA audit - should pass all:
- ✅ Installable
- ✅ PWA optimized
- ✅ Works offline
- ✅ Configured for custom splash screen
- ✅ Sets theme color
- ✅ Has maskable icon

---

## Monitoring & Analytics

### Track PWA Metrics

Add to your analytics:

```javascript
// Track install events
window.addEventListener('appinstalled', () => {
  console.log('PWA installed');
  // Send to analytics
  gtag('event', 'pwa_install');
});

// Track standalone mode
if (window.matchMedia('(display-mode: standalone)').matches) {
  console.log('Running as installed PWA');
  // Send to analytics
  gtag('event', 'pwa_launch');
}
```

### Monitor Service Worker

```javascript
// Track SW updates
navigator.serviceWorker.addEventListener('controllerchange', () => {
  console.log('Service Worker updated');
  // Send to analytics
  gtag('event', 'sw_update');
});
```

---

## Update Strategy

### Deploying Updates

1. **Make changes to your app**
2. **Build:** `npm run build`
3. **Deploy** to your hosting platform
4. **Service worker updates automatically**
5. **Users see update prompt** on next visit

### Force Update

If critical update needed:

```javascript
// In PWAPrompt.jsx, change updateServiceWorker to:
updateServiceWorker(true); // Force immediate update
```

---

## Best Practices

### DO:
✅ Keep service worker cache small (< 50MB)
✅ Version your cache names
✅ Test offline functionality thoroughly
✅ Provide update notifications
✅ Handle failed network requests gracefully
✅ Use appropriate caching strategies per resource type

### DON'T:
❌ Cache sensitive user data
❌ Cache API responses for too long
❌ Force update without user consent
❌ Block the main thread with SW operations
❌ Forget to test on real devices

---

## Resources

- [PWA Documentation](https://web.dev/progressive-web-apps/)
- [Workbox Documentation](https://developers.google.com/web/tools/workbox)
- [Vite PWA Plugin](https://vite-pwa-org.netlify.app/)
- [Can I Use - PWA](https://caniuse.com/?search=pwa)
- [PWA Builder](https://www.pwabuilder.com/)

---

## Quick Start Summary

```bash
# 1. Install dependencies
npm install vite-plugin-pwa workbox-window --save-dev

# 2. Update configuration files
# - vite.config.js
# - App.jsx
# - index.css

# 3. Create PWAPrompt component

# 4. Generate icons
# Use PWA Builder or ImageMagick

# 5. Test locally
npm run dev

# 6. Build and deploy
npm run build
vercel --prod  # or your preferred platform

# 7. Test on mobile devices

# 8. Monitor and iterate
```

---

Your fitness app is now a fully functional PWA! 🎉