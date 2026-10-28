import { WebSocketServer, type WebSocket } from 'ws';
import type { IncomingMessage, Server } from 'node:http';
import { randomUUID } from 'node:crypto';
import {
  DEFAULT_SERVER_PORT,
  MAX_NAME_LENGTH,
  PLAYER_DISCONNECT_GRACE_MS,
  PING_INTERVAL_MS,
  ROOM_IDLE_TIMEOUT_MS,
  WS_PATH,
  normalizeRoomCode,
  type ClientMessage,
  type ErrorCode,
  type ServerMessage,
} from '@dg/shared';
import {
  allGuessersSolved,
  clearRoom,
  endRound,
  forgetPlayer,
  getRound,
  startGame,
  submitGuess,
  tick,
  toRoundView,
} from './round.js';
import {
  createRoom,
  getRoom,
  joinRoom,
  markDisconnected,
  reapExpiredPlayers,
  reapIdleRooms,
  removePlayer,
  toRoomView,
} from './rooms.js';

/**
 * WebSocket transport + room membership messaging.
 *
 * Responsibilities, in order of importance:
 * 1. parse and validate every inbound frame without ever crashing the process
 * 2. own the mapping between sockets and (room, player)
 * 3. broadcast room state when membership changes
 *
 * The rule that keeps this simple: the socket is the connection, the player
 * token is the identity. A socket dying never deletes a player; only an
 * explicit leave or the grace period does.
 */

type Client = {
  ws: WebSocket;
  /** Stable per-connection id. Distinct from the player id. */
  connId: string;
  alive: boolean;
  /** Set once the connection is bound to a seat. */
  roomCode: string | null;
  playerId: string | null;
};

const clients = new Map<WebSocket, Client>();

// --- send helpers -----------------------------------------------------------

function send(ws: WebSocket, msg: ServerMessage): void {
  if (ws.readyState !== ws.OPEN) return;
  ws.send(JSON.stringify(msg));
}

function sendError(ws: WebSocket, code: ErrorCode, message: string): void {
  send(ws, { type: 'error', code, message });
}

/** Everyone currently connected in a room. */
function roomSockets(code: string): Client[] {
  const out: Client[] = [];
  for (const client of clients.values()) {
    if (client.roomCode === code) out.push(client);
  }
  return out;
}

/** Push the current room view to everyone in it. */
function broadcastRoomState(code: string): void {
  const room = getRoom(code);
  if (!room) return;
  const view = toRoomView(room);
  for (const client of roomSockets(code)) {
    send(client.ws, { type: 'roomState', room: view });
  }
}

/** Send an arbitrary message to every connected socket in a room. */
function broadcast(code: string, msg: ServerMessage): void {
  for (const client of roomSockets(code)) send(client.ws, msg);
}

/**
 * Push round state to the room, and separately give the drawer their word.
 *
 * This is the leak boundary. toRoundView() omits the answer unless the phase
 * reveals it, and drawerView is addressed only to the drawer's own sockets.
 * If you ever need to add information here, put it in DrawerView instead of
 * widening the broadcast.
 */
function broadcastRound(code: string): void {
  const room = getRoom(code);
  const state = getRound(code);
  if (!room || !state) return;

  const view = toRoundView(room, state);
  for (const client of roomSockets(code)) {
    send(client.ws, { type: 'roundState', round: view });

    const isDrawer = state.drawerId !== null && client.playerId === state.drawerId;
    const answerVisible = state.phase === 'DRAWING' || state.phase === 'PROMPT_REVEAL';
    if (isDrawer && answerVisible && state.answer && state.category) {
      send(client.ws, {
        type: 'drawerView',
        answer: state.answer,
        category: state.category,
      });
    }
  }
}

// --- validation -------------------------------------------------------------

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function asString(value: unknown): string | null {
  return typeof value === 'string' ? value : null;
}

/**
 * Parses an inbound frame into a ClientMessage, or returns a specific error.
 * Kept separate from handling so the handlers never see `unknown`.
 */
export function parseClientMessage(raw: string): { ok: true; msg: ClientMessage } | { ok: false; code: ErrorCode; message: string } {
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return { ok: false, code: 'SERVER_ERROR', message: 'Malformed JSON' };
  }

  if (!isRecord(value)) {
    return { ok: false, code: 'SERVER_ERROR', message: 'Expected an object' };
  }

  const type = asString(value['type']);
  switch (type) {
    case 'ping': {
      const t = value['t'];
      if (typeof t !== 'number') return { ok: false, code: 'SERVER_ERROR', message: 'ping.t must be a number' };
      return { ok: true, msg: { type: 'ping', t } };
    }
    case 'createRoom': {
      const name = asString(value['name']);
      const gameType = asString(value['gameType']);
      if (name === null) return { ok: false, code: 'INVALID_NAME', message: 'name is required' };
      if (gameType !== 'draw-and-guess') {
        return { ok: false, code: 'SERVER_ERROR', message: 'unknown gameType' };
      }
      return { ok: true, msg: { type: 'createRoom', name, gameType } };
    }
    case 'joinRoom': {
      const code = asString(value['code']);
      const name = asString(value['name']);
      const token = asString(value['token']) ?? undefined;
      if (code === null) return { ok: false, code: 'INVALID_CODE', message: 'code is required' };
      if (name === null) return { ok: false, code: 'INVALID_NAME', message: 'name is required' };
      return { ok: true, msg: { type: 'joinRoom', code, name, token } };
    }
    case 'leaveRoom': {
      return { ok: true, msg: { type: 'leaveRoom' } };
    }
    case 'startGame': {
      return { ok: true, msg: { type: 'startGame' } };
    }
    case 'guess': {
      const text = asString(value['text']);
      if (text === null) return { ok: false, code: 'SERVER_ERROR', message: 'guess.text is required' };
      // Cap input length: guesses are short, and an unbounded string is a DoS.
      return { ok: true, msg: { type: 'guess', text: text.slice(0, 64) } };
    }
    default:
      return { ok: false, code: 'SERVER_ERROR', message: `Unknown message type: ${String(type)}` };
  }
}

// --- message handling -------------------------------------------------------

function leaveCurrentRoom(client: Client, reason: 'left' | 'closed' | 'kicked'): void {
  const { roomCode, playerId } = client;
  if (!roomCode || !playerId) return;

  client.roomCode = null;
  client.playerId = null;

  const { room, emptied } = removePlayer(roomCode, playerId);
  send(client.ws, { type: 'roomLeft', reason });

  if (emptied || !room) {
    console.log(`[room] ${roomCode} emptied and was deleted`);
    return;
  }
  broadcastRoomState(roomCode);
  console.log(`[room] ${roomCode} player removed, ${room.players.length} remain`);
}

function handleMessage(client: Client, raw: string): void {
  const parsed = parseClientMessage(raw);
  if (!parsed.ok) {
    sendError(client.ws, parsed.code, parsed.message);
    return;
  }

  const msg = parsed.msg;
  switch (msg.type) {
    case 'ping': {
      send(client.ws, { type: 'pong', t: msg.t, serverTime: Date.now() });
      break;
    }

    case 'createRoom': {
      if (client.roomCode) leaveCurrentRoom(client, 'left');

      const result = createRoom(msg.name, msg.gameType, randomUUID());
      if (!result.ok) {
        sendError(client.ws, result.code, 'Could not create room');
        break;
      }

      const { room, player } = result;
      client.roomCode = room.code;
      client.playerId = player.id;

      send(client.ws, {
        type: 'roomJoined',
        code: room.code,
        playerId: player.id,
        token: player.token,
        room: toRoomView(room),
      });
      console.log(`[room] ${room.code} created by ${player.name}`);
      break;
    }

    case 'joinRoom': {
      if (client.roomCode) leaveCurrentRoom(client, 'left');

      const name = msg.name.slice(0, MAX_NAME_LENGTH);
      const result = joinRoom(msg.code, name, randomUUID(), msg.token);
      if (!result.ok) {
        const message =
          result.code === 'ROOM_NOT_FOUND'
            ? `No room with code ${normalizeRoomCode(msg.code)}`
            : result.code === 'ROOM_FULL'
              ? 'That room is full'
              : result.code === 'ROOM_IN_PROGRESS'
                ? 'That game has already started'
                : result.code === 'INVALID_NAME'
                  ? 'Pick a name between 1 and 16 characters'
                  : 'Could not rejoin that room';
        sendError(client.ws, result.code, message);
        break;
      }

      const { room, player, resumed } = result;
      client.roomCode = room.code;
      client.playerId = player.id;

      send(client.ws, {
        type: 'roomJoined',
        code: room.code,
        playerId: player.id,
        token: player.token,
        room: toRoomView(room),
      });
      broadcastRoomState(room.code);
      console.log(
        `[room] ${room.code} ${resumed ? 'resumed' : 'joined'} by ${player.name} (${room.players.length}/${room.players.length})`,
      );
      break;
    }

    case 'leaveRoom': {
      leaveCurrentRoom(client, 'left');
      break;
    }

    case 'startGame': {
      const room = client.roomCode ? getRoom(client.roomCode) : undefined;
      if (!room) {
        sendError(client.ws, 'ROOM_NOT_FOUND', 'You are not in a room');
        break;
      }
      const me = room.players.find((p) => p.id === client.playerId);
      if (!me?.isHost) {
        sendError(client.ws, 'NOT_HOST', 'Only the host can start the game');
        break;
      }

      const result = startGame(room);
      if (!result.ok) {
        const message =
          result.code === 'TOO_FEW_PLAYERS'
            ? 'You need at least 2 players'
            : 'That game has already started';
        sendError(client.ws, result.code, message);
        break;
      }

      broadcastRoomState(room.code);
      broadcastRound(room.code);
      console.log(`[round] ${room.code} game started`);
      break;
    }

    case 'guess': {
      if (!client.roomCode || !client.playerId) break;
      const room = getRoom(client.roomCode);
      const state = getRound(client.roomCode);
      if (!room || !state) break;

      const player = room.players.find((p) => p.id === client.playerId);
      const outcome = submitGuess(state, client.playerId, msg.text);

      switch (outcome.kind) {
        case 'ignored': {
          // Silent: a late guess from an already-solved player is normal.
          break;
        }
        case 'correct': {
          send(client.ws, { type: 'guessResult', result: 'correct', text: msg.text });
          broadcast(client.roomCode, {
            type: 'guessFeed',
            playerId: client.playerId,
            name: player?.name ?? 'someone',
            text: msg.text,
            result: 'correct',
          });

          // Round ends immediately once everyone has guessed.
          if (allGuessersSolved(room, state)) {
            endRound(state);
            broadcastRound(client.roomCode);
            console.log(`[round] ${client.roomCode} all solved, round ended early`);
          } else {
            broadcastRound(client.roomCode);
          }
          break;
        }
        case 'close':
        case 'wrong': {
          send(client.ws, { type: 'guessResult', result: outcome.kind, text: msg.text });
          broadcast(client.roomCode, {
            type: 'guessFeed',
            playerId: client.playerId,
            name: player?.name ?? 'someone',
            text: msg.text,
            result: outcome.kind,
          });
          break;
        }
      }
      break;
    }

    default: {
      // Exhaustiveness guard; see server/src/ws.ts history for the cast note.
      const unreachable = msg as never;
      console.warn('[ws] unhandled message', unreachable);
    }
  }
}

// --- connection lifecycle ---------------------------------------------------

function handleDisconnect(client: Client): void {
  if (!client.roomCode || !client.playerId) return;

  const { roomCode, playerId } = client;

  // If another socket already claimed this seat (phone and laptop, or a fast
  // reconnect where the old socket lingered), do not mark the seat offline.
  const seatStillHeld = roomSockets(roomCode).some(
    (c) => c !== client && c.playerId === playerId,
  );
  if (seatStillHeld) return;

  markDisconnected(roomCode, playerId);
  broadcastRoomState(roomCode);
}

export function attachWebSocket(server: Server): WebSocketServer {
  const wss = new WebSocketServer({ server, path: WS_PATH });

  wss.on('connection', (ws: WebSocket, req: IncomingMessage) => {
    const client: Client = {
      ws,
      connId: randomUUID().slice(0, 8),
      alive: true,
      roomCode: null,
      playerId: null,
    };
    clients.set(ws, client);
    console.log(`[ws] connect ${client.connId} from ${req.socket.remoteAddress ?? 'unknown'} (total ${clients.size})`);

    ws.on('message', (data) => {
      try {
        handleMessage(client, data.toString());
      } catch (err) {
        // A handler bug must never take down the server or other rooms.
        console.error(`[ws] handler error for ${client.connId}:`, err);
        sendError(ws, 'SERVER_ERROR', 'Something went wrong');
      }
    });

    ws.on('pong', () => {
      client.alive = true;
    });

    ws.on('close', (code, reason) => {
      clients.delete(ws);
      handleDisconnect(client);
      console.log(`[ws] close ${client.connId} code=${code} reason=${reason.toString() || 'none'} (total ${clients.size})`);
    });

    ws.on('error', (err) => {
      console.error(`[ws] error ${client.connId}:`, err.message);
    });

    // Greet immediately so the client can measure its first RTT.
    send(ws, { type: 'pong', t: 0, serverTime: Date.now() });
  });

  // Half-open sockets (phone asleep) never emit 'close'. Ping liveness catches them.
  const heartbeat = setInterval(() => {
    for (const client of clients.values()) {
      if (!client.alive) {
        console.log(`[ws] heartbeat timeout ${client.connId}, terminating`);
        client.ws.terminate();
        continue;
      }
      client.alive = false;
      client.ws.ping();
    }
  }, PING_INTERVAL_MS * 2);

  // Reaper: drop long-gone players, then long-empty rooms.
  const reaper = setInterval(() => {
    const expired = reapExpiredPlayers(PLAYER_DISCONNECT_GRACE_MS);
    for (const { code } of expired) broadcastRoomState(code);

    const removed = reapIdleRooms(ROOM_IDLE_TIMEOUT_MS);
    for (const code of removed) {
      clearRoom(code);
      console.log(`[room] ${code} idle, deleted`);
    }
  }, 30_000);

  /**
   * Round clock. Runs often so phase changes land within ~200ms of their
   * deadline; the deadlines themselves are absolute timestamps, so this
   * interval only controls broadcast latency, never game fairness.
   */
  const roundTicker = setInterval(() => {
    const now = Date.now();
    for (const code of [...new Set([...clients.values()].map((c) => c.roomCode))]) {
      if (!code) continue;
      const room = getRoom(code);
      const state = getRound(code);
      if (!room || !state) continue;

      const events = tick(room, state, now);
      if (events.length === 0) continue;
      for (const event of events) {
        console.log(`[round] ${code} ${event.kind}`);
      }
      broadcastRound(code);
    }
  }, 200);

  wss.on('close', () => {
    clearInterval(heartbeat);
    clearInterval(reaper);
    clearInterval(roundTicker);
  });

  return wss;
}

export function closeAllClients(): void {
  for (const client of clients.values()) {
    client.ws.close(1001, 'server shutting down');
  }
  clients.clear();
}
