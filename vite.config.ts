/// <reference types="vitest" />
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 5000,
    allowedHosts: true,
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
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          // Split heavy ML libraries into separate chunks for better caching
          'ml-transformers': ['@huggingface/transformers'],
          'ml-onnx': ['onnxruntime-web'],
          'mediapipe': ['@mediapipe/tasks-vision'],
          // Split Three.js ecosystem
          'three-core': ['three'],
          'three-fiber': ['@react-three/fiber', '@react-three/drei'],
          'three-physics': ['@react-three/rapier'],
          // Split large UI dependencies
          'monaco-editor': ['@monaco-editor/react'],
        },
      },
    },
    // Increase chunk size warning limit (some WASM chunks are inherently large)
    chunkSizeWarningLimit: 1000,
  },
  // Optimize dependencies for faster dev server startup
  optimizeDeps: {
    include: ['three', '@react-three/fiber', '@react-three/drei'],
    exclude: ['@huggingface/transformers', 'onnxruntime-web'],
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      '**/tests/**', // Exclude Playwright tests
    ],
  },
})
