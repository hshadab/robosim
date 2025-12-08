/// <reference types="vitest" />
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      // Proxy CSM API requests to bypass CORS
      '/api/csm': {
        target: 'https://api.csm.ai',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/csm/, '/v3'),
        configure: (proxy) => {
          proxy.on('proxyReq', (proxyReq, req) => {
            // Forward the API key header
            const apiKey = req.headers['x-api-key'];
            if (apiKey) {
              proxyReq.setHeader('X-API-KEY', apiKey as string);
            }
          });
        },
      },
      // Proxy Rodin (Hyper3D) API requests to bypass CORS
      '/api/rodin': {
        target: 'https://api.hyper3d.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/rodin/, '/api/v2'),
        configure: (proxy) => {
          proxy.on('proxyReq', (proxyReq, req) => {
            // Forward the Authorization header
            const auth = req.headers['authorization'];
            if (auth) {
              proxyReq.setHeader('Authorization', auth as string);
            }
          });
        },
      },
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
  },
})
