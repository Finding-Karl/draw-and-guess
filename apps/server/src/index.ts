import Fastify from 'fastify';
import { DEFAULT_SERVER_PORT, WS_PATH } from '@dg/shared';
import { attachWebSocket, closeAllClients } from './ws.js';

/**
 * HTTP + WebSocket entry point.
 *
 * The Fastify instance and the ws server share one node http.Server, which
 * avoids running two ports in dev and keeps same-origin deploy simple later.
 */

const PORT = Number(process.env.PORT ?? DEFAULT_SERVER_PORT);
const HOST = process.env.HOST ?? '0.0.0.0';

const app = Fastify({ logger: true });

app.get('/healthz', async () => ({
  ok: true,
  uptime: process.uptime(),
  serverTime: Date.now(),
}));

async function main(): Promise<void> {
  // Fastify owns the http server; attach ws to it before listen() so the
  // upgrade handler is registered by the time connections arrive.
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
