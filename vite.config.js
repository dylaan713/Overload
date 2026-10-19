import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// base './' keeps asset URLs relative, so the build works inside a native
// Capacitor file:// webview and when served from a host subpath.
// https://vite.dev/config/
export default defineConfig({
  base: './',
  test: {
    include: ['tests/**/*.test.{ts,tsx}'],
    setupFiles: ['tests/setup.ts'],
    css: { modules: { classNameStrategy: 'non-scoped' } },
  },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon.svg', 'apple-touch-icon-180x180.png'],
      workbox: {
        // Precache fonts too, so the installed app is fully styled offline.
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff,woff2}'],
      },
      manifest: {
        name: 'Overload',
        short_name: 'Overload',
        description: 'Log every set and get told exactly when to add weight.',
        theme_color: '#0e1118',
        background_color: '#0e1118',
        display: 'standalone',
        orientation: 'portrait',
        start_url: './',
        scope: './',
        icons: [
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          { src: 'maskable-icon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
    }),
  ],
})
