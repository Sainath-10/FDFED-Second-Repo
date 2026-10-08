import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

/**
 * NEXUS ESPORTS — Vite config
 *
 * The SPA is served from `index.html` and every route mirrors an app path
 * (`/` and `/pages/**`). Because `appType: 'mpa'` disables Vite's own SPA
 * fallback, direct navigation/refresh requests for those paths are rewritten to
 * the entry so the client router can take over. The rewrite is intentionally
 * narrow — only `/`, `/index.html` and `/pages/**` — so Vite's own asset and
 * module requests (/src/*, /@vite/*, /node_modules/*, /assets/*) are never touched.
 */
const APP_ENTRY = '/index.html';

const isAppRoute = (url) => {
  const path = url.split('?')[0].split('#')[0];
  return path === '/' || path === '/index.html' || path.startsWith('/pages/');
};

function spaFallback() {
  const rewrite = (req, _res, next) => {
    if (req.url && isAppRoute(req.url)) req.url = APP_ENTRY;
    next();
  };
  return {
    name: 'nexus-spa-fallback',
    configureServer(server) {
      server.middlewares.use(rewrite);
    },
    configurePreviewServer(server) {
      server.middlewares.use(rewrite);
    },
  };
}

export default defineConfig({
  appType: 'mpa',
  plugins: [react(), spaFallback()],
  root: '.',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      input: 'index.html',
    },
  },
  server: {
    port: 5173,
    open: '/',
  },
});

