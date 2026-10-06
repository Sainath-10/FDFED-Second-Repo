import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const apiProxy = {
  target: 'http://localhost:3001',
  changeOrigin: true,
  // When a browser requests a page (Accept: text/html), serve the React SPA index.html
  // Only proxy actual API calls (JSON, fetch, XMLHttpRequest, etc.) to the NestJS backend
  bypass: (req) => {
    if (req.headers.accept && req.headers.accept.includes('text/html')) {
      return '/index.html';
    }
  },
  configure: (proxy) => {
    proxy.on('error', (err, req, res) => {
      if (!res.headersSent) {
        res.writeHead(503, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Backend offline or unreachable on http://localhost:3001' }));
      }
    });
  },
};

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/auth': apiProxy,
      '/competitions': apiProxy,
      '/teams': apiProxy,
      '/disputes': apiProxy,
      '/matches': apiProxy,
      '/notifications': apiProxy,
      '/policies': apiProxy,
      '/admin': apiProxy,
    },
  },
});
