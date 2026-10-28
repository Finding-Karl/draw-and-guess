import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { DEFAULT_SERVER_PORT } from '@dg/shared';

/**
 * Dev config notes:
 * - `host: true` exposes the dev server on the LAN so a real phone can load the
 *   page. S03's canvas spike requires testing on actual iOS Safari.
 * - The ws proxy means the browser always talks to its own origin in dev, so
 *   the same relative-URL client code works in dev and after deploy.
 */
export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    port: 5173,
    strictPort: true,
    proxy: {
      '/ws': {
        target: `ws://localhost:${DEFAULT_SERVER_PORT}`,
        ws: true,
      },
      '/healthz': {
        target: `http://localhost:${DEFAULT_SERVER_PORT}`,
        changeOrigin: true,
      },
    },
  },
});
