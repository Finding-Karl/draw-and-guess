import { WebSocketServer, type WebSocket } from 'ws';
import type { IncomingMessage, Server } from 'node:http';
import {
  DEFAULT_SERVER_PORT,
  PING_INTERVAL_MS,
  WS_PATH,
  type ClientMessage,
  type ServerMessage,
} from '@dg/shared';

/**
 * WebSocket transport layer.
 *
 * S01 scope: prove that a typed bidirectional channel works, that latency can be
 * measured, and that disconnects are visible. No rooms, no game state, no auth.
 *
 * Design:
 * - One shared JSON envelope. Every frame is parsed defensively: a malformed
 *   frame closes only that connection, never the server.
 * - Connections are tracked in a Set so shutdown can close them cleanly.
 * - Nothing here knows about the game. Keep it that way; room logic lands in
 *   S02 as a separate module that this file delegates to.
 */

type Client = {
  ws: WebSocket;
  id: string;
  alive: boolean;
};

const clients = new Map<WebSocket, Client>();
let nextId = 1;

function send(ws: WebSocket, msg: ServerMessage): void {
  if (ws.readyState !== ws.OPEN) return;
  ws.send(JSON.stringify(msg));
}

function isClientMessage(value: unknown): value is ClientMessage {
  return (
    typeof value === 'object' &&
    value !== null &&
    'type' in value &&
    (value as { type: unknown }).type === 'ping'
  );
}

function handleMessage(client: Client, raw: string): void {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    console.warn(`[ws] client ${client.id} sent invalid JSON, closing`);
    client.ws.close(1003, 'invalid JSON');
    return;
  }

  if (!isClientMessage(parsed)) {
    console.warn(`[ws] client ${client.id} sent unknown message type, ignoring`);
    return;
  }

  switch (parsed.type) {
    case 'ping': {
      send(client.ws, {
        type: 'pong',
        t: parsed.t,
        serverTime: Date.now(),
      });
      break;
    }
    default: {
      // Exhaustiveness guard: adding a ClientMessage variant breaks the build here.
      // The cast is required because `isClientMessage` narrows rather than
      // exhaustive-filters, so `parsed` is still the full union in this branch.
      const unreachable = parsed as never;
      console.warn('[ws] unhandled message', unreachable);
    }
  }
}

export function attachWebSocket(server: Server): WebSocketServer {
  const wss = new WebSocketServer({ server, path: WS_PATH });

  wss.on('connection', (ws: WebSocket, req: IncomingMessage) => {
    const client: Client = {
      ws,
      id: `c${nextId++}`,
      alive: true,
    };
    clients.set(ws, client);
    console.log(
      `[ws] connect ${client.id} from ${req.socket.remoteAddress ?? 'unknown'} (total ${clients.size})`,
    );

    ws.on('message', (data) => {
      handleMessage(client, data.toString());
    });

    ws.on('pong', () => {
      client.alive = true;
    });

    ws.on('close', (code, reason) => {
      clients.delete(ws);
      console.log(
        `[ws] close ${client.id} code=${code} reason=${reason.toString() || 'none'} (total ${clients.size})`,
      );
    });

    ws.on('error', (err) => {
      console.error(`[ws] error ${client.id}:`, err.message);
    });

    // Greet immediately so the client can measure its first RTT without waiting.
    send(ws, { type: 'pong', t: 0, serverTime: Date.now() });
  });

  // Detect half-open connections (phone went to sleep, laptop closed lid).
  const heartbeat = setInterval(() => {
    for (const client of clients.values()) {
      if (!client.alive) {
        console.log(`[ws] heartbeat timeout ${client.id}, terminating`);
        client.ws.terminate();
        continue;
      }
      client.alive = false;
      client.ws.ping();
    }
  }, PING_INTERVAL_MS * 2);

  wss.on('close', () => clearInterval(heartbeat));

  return wss;
}

export function closeAllClients(): void {
  for (const client of clients.values()) {
    client.ws.close(1001, 'server shutting down');
  }
  clients.clear();
}
