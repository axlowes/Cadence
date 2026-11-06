import { defineConfig, minimal2023Preset } from '@vite-pwa/assets-generator/config'
import { createAppleSplashScreens } from '@vite-pwa/assets-generator/config'

export default defineConfig({
  headLinkOptions: { preset: '2023' },
  preset: {
    ...minimal2023Preset,
    maskable: { ...minimal2023Preset.maskable, padding: 0, resizeOptions: { background: '#0B0A1F' } },
    apple: { ...minimal2023Preset.apple, padding: 0, resizeOptions: { background: '#0B0A1F' } },
    appleSplashScreens: createAppleSplashScreens({
      padding: 0.45,
      resizeOptions: { background: '#0B0A1F', fit: 'contain' },
      linkMediaOptions: { log: false, addMediaScreen: true, xhtml: false },
      png: { compressionLevel: 9, quality: 70 },
    }),
  },
  images: ['public/icon.svg'],
})
