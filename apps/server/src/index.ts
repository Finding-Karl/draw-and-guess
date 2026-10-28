import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';
import { existsSync } from 'node:fs';
import fastifyStatic from '@fastify/static';
import Fastify from 'fastify';
import { DEFAULT_SERVER_PORT, WS_PATH } from '@dg/shared';
import { attachWebSocket, closeAllClients } from './ws.js';

/**
 * HTTP + WebSocket entry point.
 *
 * Fastify and the ws server share one node http.Server, so there is one port
 * and one origin in every environment. In production the same server also
 * serves the built frontend, which removes CORS and ws-origin configuration
 * entirely — the browser only ever talks to the host it loaded the page from.
 */

const PORT = Number(process.env.PORT ?? DEFAULT_SERVER_PORT);
const HOST = process.env.HOST ?? '0.0.0.0';
const IS_PROD = process.env.NODE_ENV === 'production';

const app = Fastify({ logger: true });

app.get('/healthz', async () => ({
  ok: true,
  uptime: process.uptime(),
  serverTime: Date.now(),
}));

/**
 * In production, serve the Vite build from the same origin.
 * The web dist path is resolved relative to this file so the container layout
 * (apps/server/dist/index.js → apps/web/dist) doesn't need hardcoding.
 */
if (IS_PROD) {
  const here = dirname(fileURLToPath(import.meta.url));
  const webDist = resolve(here, '../../web/dist');

  if (existsSync(join(webDist, 'index.html'))) {
    await app.register(fastifyStatic, { root: webDist, wildcard: false });

    // SPA fallback: any non-asset route returns index.html so deep links like
    // /play/ABCD work on refresh. /ws and /healthz are matched above/below.
    app.setNotFoundHandler((req, reply) => {
      if (req.url.startsWith('/ws')) return reply.code(404).send();
      return reply.type('text/html').sendFile('index.html');
    });

    app.log.info(`serving static frontend from ${webDist}`);
  } else {
    app.log.warn(`no frontend build found at ${webDist}; serving API only`);
  }
}

async function main(): Promise<void> {
  // Fastify owns the http server; attach ws before listen() so the upgrade
  // handler is registered by the time connections arrive.
  try {
    await app.listen({ port: PORT, host: HOST });
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }

  attachWebSocket(app.server);

  app.log.info(`ws listening on ws://localhost:${PORT}${WS_PATH}`);
  app.log.info(`health check: http://localhost:${PORT}/healthz`);
}

async function shutdown(signal: string): Promise<void> {
  app.log.info(`${signal} received, shutting down`);
  closeAllClients();
  await app.close();
  process.exit(0);
}

process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('SIGTERM', () => void shutdown('SIGTERM'));

void main();
