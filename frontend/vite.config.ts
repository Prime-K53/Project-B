import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

const normalizeBase = (value: string) => String(value || '').trim().replace(/\/+$/, '');
const stripApiSuffix = (value: string) => normalizeBase(value).replace(/\/api$/i, '');

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    const apiProxyTarget =
      stripApiSuffix(env.VITE_API_PROXY_TARGET || '') ||
      stripApiSuffix(env.VITE_API_URL || '') ||
      'http://localhost:3000';
    return {
      server: {
        port: 5173,
        host: '0.0.0.0',
        headers: {
          // Override CSP to allow inline scripts and WebAssembly in dev mode
          'Content-Security-Policy': "default-src 'self' 'unsafe-inline' 'unsafe-eval' http://127.0.0.1:* http://localhost:* ws://127.0.0.1:* ws://localhost:* data: blob:; script-src 'self' 'unsafe-inline' 'unsafe-eval' http://127.0.0.1:* http://localhost:*; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self' http://127.0.0.1:* http://localhost:* ws://127.0.0.1:* ws://localhost:* data: blob:; frame-src 'self' blob: data: http://127.0.0.1:* http://localhost:*; object-src 'self' blob: data:; worker-src 'self' blob:;"
        },
        proxy: mode === 'development' ? {
          '/api': {
            target: apiProxyTarget,
            changeOrigin: true,
            secure: apiProxyTarget.startsWith('https://'),
            bypass: (req) => {
              if (req.headers.accept?.includes('text/html')) {
                return null;
              }
            }
          }
        } : {}
      },
      plugins: [react()],
      optimizeDeps: {
        include: ['recharts', 'lucide-react', 'react-router-dom', 'idb', 'date-fns']
      },
      define: {
        'process.env.API_KEY': JSON.stringify(env.VITE_GEMINI_API_KEY),
        'process.env.GEMINI_API_KEY': JSON.stringify(env.VITE_GEMINI_API_KEY),
        // Don't hardcode API URL in production - let runtime config (Electron) take precedence
        'process.env.VITE_API_URL': mode === 'development' ? JSON.stringify(env.VITE_API_URL || 'http://localhost:3000') : '""',
        'process.env.API_BASE_URL': mode === 'development' ? JSON.stringify(env.VITE_API_URL || 'http://localhost:3000') : '""',
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.')
        }
      },
      base: './',
      build: {
        outDir: 'dist',
        emptyOutDir: true,
        sourcemap: false
      }
    };
});
