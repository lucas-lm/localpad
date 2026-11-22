import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// "/" for a user site or custom domain; "/<repo>/" for a GitHub Pages project site.
// The deploy workflow sets this automatically.
const base = process.env.BASE_PATH || '/';

export default defineConfig({
  base,
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icons/icon.svg', 'icons/apple-touch-icon.png'],
      manifest: {
        name: 'LocalPad',
        short_name: 'LocalPad',
        description: 'Personal local-first, offline-first notepad.',
        lang: 'en',
        id: base,
        start_url: base,
        scope: base,
        display: 'standalone',
        background_color: '#fbfaf7',
        theme_color: '#fbfaf7',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/icon-512-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico,webmanifest}'],
        // Any route (/meeting, /a/b, ...) opens the app from the cache, including offline.
        navigateFallback: 'index.html',
      },
    }),
  ],
});
