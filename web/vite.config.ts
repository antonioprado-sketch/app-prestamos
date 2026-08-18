import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.ts',
      includeAssets: ['manifest.webmanifest', 'icons/icon-192.png', 'icons/icon-512.png'],
      manifest: false,
      // El caching de runtime y el navigateFallback viven en src/sw.ts (mismo
      // comportamiento que antes) — injectManifest es necesario para poder agregar
      // los listeners 'push'/'notificationclick' que generateSW no permite.
      injectManifest: {
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
      },
    }),
  ],
  server: {
    proxy: { '/api': 'http://localhost:3000' },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './src/setupTests.ts',
    exclude: ['**/node_modules/**', './e2e/**'],
  },
});
