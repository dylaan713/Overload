import { defineConfig } from '@vite-pwa/assets-generator/config'

// Custom preset: fill the whole tile with our dark background and no padding,
// so the Apple/home-screen icon is edge-to-edge (no white border, larger mark).
// Regenerate with: npx pwa-assets-generator
export default defineConfig({
  images: ['public/icon.svg'],
  preset: {
    transparent: {
      sizes: [64, 192, 512],
      favicons: [[64, 'favicon.ico']],
    },
    maskable: {
      sizes: [512],
      padding: 0,
      resizeOptions: { background: '#1C1B19' },
    },
    apple: {
      sizes: [180],
      padding: 0,
      resizeOptions: { background: '#1C1B19' },
    },
  },
})
