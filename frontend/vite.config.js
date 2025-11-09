import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'robots.txt', 'icons/*.png', 'splash/*.png'],
      
      manifest: {
        name: 'Fitness Tracker - Training Programs & Analytics',
        short_name: 'Fitness Tracker',
        description: 'Track your workouts with 5/3/1 BBB, Starting Strength, and advanced analytics',
        theme_color: '#2563eb',
        background_color: '#ffffff',
        display: 'standalone',
        orientation: 'portrait-primary',
        start_url: '/',
        scope: '/',
        icons: [
          {
            src: '/icons/icon-72x72.png',
            sizes: '72x72',
            type: 'image/png',
            purpose: 'any maskable'
          },
          {
            src: '/icons/icon-96x96.png',
            sizes: '96x96',
            type: 'image/png',
            purpose: 'any maskable'
          },
          {
            src: '/icons/icon-128x128.png',
            sizes: '128x128',
            type: 'image/png',
            purpose: 'any maskable'
          },
          {
            src: '/icons/icon-144x144.png',
            sizes: '144x144',
            type: 'image/png',
            purpose: 'any maskable'
          },
          {
            src: '/icons/icon-152x152.png',
            sizes: '152x152',
            type: 'image/png',
            purpose: 'any maskable'
          },
          {
            src: '/icons/icon-192x192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any maskable'
          },
          {
            src: '/icons/icon-384x384.png',
            sizes: '384x384',
            type: 'image/png',
            purpose: 'any maskable'
          },
          {
            src: '/icons/icon-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable'
          }
        ],
        shortcuts: [
          {
            name: 'Start Workout',
            short_name: 'Workout',
            description: 'Start tracking a new workout',
            url: '/workout/active',
            icons: [
              {
                src: '/icons/shortcut-workout.png',
                sizes: '96x96'
              }
            ]
          },
          {
            name: 'Current Week',
            short_name: 'Program',
            description: 'View current week\'s program',
            url: '/current-week',
            icons: [
              {
                src: '/icons/shortcut-program.png',
                sizes: '96x96'
              }
            ]
          },
          {
            name: 'Analytics',
            short_name: 'Stats',
            description: 'View workout analytics',
            url: '/analytics',
            icons: [
              {
                src: '/icons/shortcut-analytics.png',
                sizes: '96x96'
              }
            ]
          }
        ],
        categories: ['fitness', 'health', 'lifestyle', 'sports'],
        screenshots: [
          {
            src: '/screenshots/dashboard.png',
            sizes: '1280x720',
            type: 'image/png',
            label: 'Dashboard with workout analytics'
          },
          {
            src: '/screenshots/active-workout.png',
            sizes: '1280x720',
            type: 'image/png',
            label: 'Real-time workout tracking'
          }
        ]
      },
      
      workbox: {
        // Cache strategy
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-cache',
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24 * 365 // 1 year
              },
              cacheableResponse: {
                statuses: [0, 200]
              }
            }
          },
          {
            urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'gstatic-fonts-cache',
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24 * 365 // 1 year
              },
              cacheableResponse: {
                statuses: [0, 200]
              }
            }
          },
          {
            urlPattern: /\/api\/.*/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'api-cache',
              expiration: {
                maxEntries: 50,
                maxAgeSeconds: 60 * 5 // 5 minutes
              },
              cacheableResponse: {
                statuses: [0, 200]
              },
              networkTimeoutSeconds: 10
            }
          },
          {
            urlPattern: /\.(?:png|jpg|jpeg|svg|gif|webp)$/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'images-cache',
              expiration: {
                maxEntries: 100,
                maxAgeSeconds: 60 * 60 * 24 * 30 // 30 days
              }
            }
          }
        ],
        
        // Skip waiting and claim clients
        skipWaiting: true,
        clientsClaim: true,
        
        // Clean up old caches
        cleanupOutdatedCaches: true,
        
        // Offline page fallback
        navigateFallback: null,
        navigateFallbackDenylist: [/^\/api\//]
      },
      
      devOptions: {
        enabled: false, // Enable in development for testing
        type: 'module'
      }
    })
  ],
  
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true
      }
    }
  },
  
  build: {
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom', 'react-router-dom'],
          charts: ['recharts']
        }
      }
    }
  }
});