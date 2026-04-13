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
      'http://localhost:5002';
    return {
      server: {
        port: 3003,
        host: '0.0.0.0',
        proxy: {
          '/api': {
            target: apiProxyTarget,
            changeOrigin: true,
            secure: apiProxyTarget.startsWith('https://'),
            // Prevent SPA HTML fallback for /api requests
            bypass: (req, res, options) => {
              if (req.headers.accept?.includes('text/html')) {
                return null; // Let Vite handle it if they explicitly want HTML
              }
            }
          }
        }
      },
      plugins: [react()],
      optimizeDeps: {
        include: ['recharts', 'lucide-react', 'react-router-dom', 'idb', 'date-fns']
      },
      define: {
        'process.env.API_KEY': JSON.stringify(env.VITE_GEMINI_API_KEY),
        'process.env.GEMINI_API_KEY': JSON.stringify(env.VITE_GEMINI_API_KEY),
        'process.env.VITE_API_URL': JSON.stringify(env.VITE_API_URL || 'http://localhost:5002'),
        'process.env.API_BASE_URL': JSON.stringify(env.VITE_API_URL || 'http://localhost:5002'),
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.')
        }
      }
    };
});
