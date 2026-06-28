import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'mask-icon.svg'],

      // Web App Manifest — makes it installable on mobile/desktop
      manifest: {
        name: 'ShopEase — Fashion Store',
        short_name: 'ShopEase',
        description: 'Your premium fashion destination',
        theme_color: '#1a1a2e',
        background_color: '#ffffff',
        display: 'standalone',
        scope: '/',
        start_url: '/',
        icons: [
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' }
        ]
      },

      // Workbox strategy — what gets cached and how
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],

        runtimeCaching: [
          // Cache product API responses for 1 day (network-first, fallback to cache)
          {
            urlPattern: /\/api\/product\/list/,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'products-api-cache',
              expiration: { maxEntries: 5, maxAgeSeconds: 60 * 60 * 24 }, // 1 day
              networkTimeoutSeconds: 5, // if network takes > 5s → use cache
              cacheableResponse: { statuses: [0, 200] }
            }
          },
          // Cache product images from Cloudinary
          {
            urlPattern: /res\.cloudinary\.com/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'cloudinary-images',
              expiration: { maxEntries: 100, maxAgeSeconds: 60 * 60 * 24 * 7 }, // 7 days
              cacheableResponse: { statuses: [0, 200] }
            }
          },
          // Cache Google Fonts
          {
            urlPattern: /^https:\/\/fonts\.(googleapis|gstatic)\.com/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts',
              expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 365 }
            }
          }
        ]
      }
    })
  ],
  server: { port: 5173 }
})
