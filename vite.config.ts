import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

// BASE is set by the deploy workflow (e.g. "/cadence/" on GitHub Pages).
const base = process.env.BASE ?? '/'

export default defineConfig({
  base,
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      pwaAssets: { config: true, overrideManifestIcons: true },
      manifest: {
        name: 'Cadence',
        short_name: 'Cadence',
        description: 'Your habits, tasks and feelings, held by the moon.',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#0B0A1F',
        theme_color: '#0B0A1F',
        start_url: base,
        scope: base,
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        globIgnores: ['**/apple-splash-*', '**/*cyrillic*', '**/*greek*', '**/*vietnamese*'],
        navigateFallback: base + 'index.html',
        cleanupOutdatedCaches: true,
      },
    }),
  ],
})
