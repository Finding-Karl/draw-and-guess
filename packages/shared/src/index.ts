/**
 * Wire protocol shared by client and server.
 *
 * Design notes:
 * - Every message is a JSON object with a `type` discriminator. Discriminated
 *   unions + exhaustive switches on both sides means adding a message type is a
 *   compile error until both ends handle it.
 * - Game state is deliberately NOT here. The client receives views, not rules.
 * - S04 will add round messages. S02 covers rooms and membership only.
 */

// ---------------------------------------------------------------------------
// Domain types
// ---------------------------------------------------------------------------

/**
 * Which game a room plays. Only one exists today, but the field ships now so
 * adding game #2 needs no state migration (see PLAN.md).
 */
export type GameType = 'draw-and-guess';

export type Player = {
  id: string;
  name: string;
  isHost: boolean;
  connected: boolean;
};

/** What every client in a room can see about the room. */
export type RoomView = {
  code: string;
  gameType: GameType;
  players: Player[];
  capacity: number;
  /** True once the room has started its first round. Lobby is closed after. */
  inProgress: boolean;
};

// ---------------------------------------------------------------------------
// Client -> server
// ---------------------------------------------------------------------------

export type CreateRoomRequest = {
  type: 'createRoom';
  name: string;
  gameType: GameType;
};

export type JoinRoomRequest = {
  type: 'joinRoom';
  code: string;
  name: string;
  /** Present on reconnect so the server can resume the same player. */
  token?: string;
};

export type LeaveRoomRequest = {
  type: 'leaveRoom';
};

export type PingMessage = {
  type: 'ping';
  /** Client-side send time, echoed back so RTT can be computed. */
  t: number;
};

export type ClientMessage =
  | CreateRoomRequest
  | JoinRoomRequest
  | LeaveRoomRequest
  | PingMessage;

// ---------------------------------------------------------------------------
// Server -> client
// ---------------------------------------------------------------------------

export type PongMessage = {
  type: 'pong';
  /** Echo of the client's send time. t === 0 means a server greeting. */
  t: number;
  /** Server clock at time of handling. Used for timer sync in S04. */
  serverTime: number;
};

/** Sent after a successful create or join. The token is the client's identity. */
export type RoomJoinedMessage = {
  type: 'roomJoined';
  code: string;
  playerId: string;
  token: string;
  room: RoomView;
};

/** Broadcast to everyone whenever membership changes. */
export type RoomStateMessage = {
  type: 'roomState';
  room: RoomView;
};

export type RoomLeftMessage = {
  type: 'roomLeft';
  reason: 'left' | 'closed' | 'kicked';
};

/**
 * Error codes are stable strings so the client can map them to friendly copy
 * without parsing message text.
 */
export type ErrorCode =
  | 'ROOM_NOT_FOUND'
  | 'ROOM_FULL'
  | 'ROOM_IN_PROGRESS'
  | 'INVALID_CODE'
  | 'INVALID_NAME'
  | 'BAD_TOKEN'
  | 'SERVER_ERROR';

export type ErrorMessage = {
  type: 'error';
  code: ErrorCode;
  message: string;
};

export type ServerMessage =
  | PongMessage
  | RoomJoinedMessage
  | RoomStateMessage
  | RoomLeftMessage
  | ErrorMessage;

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** How often the client probes the server, in ms. */
export const PING_INTERVAL_MS = 5_000;

/** WebSocket path, shared so client and server cannot drift. */
export const WS_PATH = '/ws';

/** Dev fallback port. The server reads PORT from env first. */
export const DEFAULT_SERVER_PORT = 3001;

export const MAX_PLAYERS = 8;

export const MIN_NAME_LENGTH = 1;
export const MAX_NAME_LENGTH = 16;

export const ROOM_CODE_LENGTH = 4;

/**
 * Unambiguous alphabet: no O/0, I/1, L. People read these codes off a screen
 * and type them on a phone, so visually confusable glyphs are pure error.
 */
export const ROOM_CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

/** Idle rooms (zero connected players) are reaped after this long. */
export const ROOM_IDLE_TIMEOUT_MS = 10 * 60 * 1000;

/** A disconnected player is dropped from the room after this long. */
export const PLAYER_DISCONNECT_GRACE_MS = 5 * 60 * 1000;

// ---------------------------------------------------------------------------
// Helpers (shared so client and server agree on validation)
// ---------------------------------------------------------------------------

export function normalizeRoomCode(raw: string): string {
  return raw.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
}

export function isValidRoomCode(code: string): boolean {
  if (code.length !== ROOM_CODE_LENGTH) return false;
  for (const ch of code) {
    if (!ROOM_CODE_ALPHABET.includes(ch)) return false;
  }
  return true;
}

export function isValidName(raw: string): boolean {
  const name = raw.trim();
  return name.length >= MIN_NAME_LENGTH && name.length <= MAX_NAME_LENGTH;
}
