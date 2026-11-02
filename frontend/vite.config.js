import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon.svg'],
      manifest: {
        name: 'Smart Tuition Centre',
        short_name: 'TuitionCentre',
        description: 'Attendance, fees and batch management for the tuition centre',
        theme_color: '#4f46e5',
        background_color: '#f8fafc',
        display: 'standalone',
        start_url: '/',
        icons: [{ src: '/icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any maskable' }],
      },
      workbox: {
        // API calls always go to the network; only the app shell is cached
        navigateFallbackDenylist: [/^\/api/],
      },
    }),
  ],
  server: { port: 5173 },
});
