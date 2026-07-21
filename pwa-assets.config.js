import { defineConfig, minimal2023Preset } from '@vite-pwa/assets-generator/config'

// Generates the PWA/Apple icon set from public/icon.svg.
// Run with: npx pwa-assets-generator
export default defineConfig({
  preset: minimal2023Preset,
  images: ['public/icon.svg'],
})
