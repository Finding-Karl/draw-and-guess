import { randomBytes, randomInt, timingSafeEqual } from 'node:crypto';
import {
  MAX_PLAYERS,
  MIN_NAME_LENGTH,
  MAX_NAME_LENGTH,
  ROOM_CODE_ALPHABET,
  ROOM_CODE_LENGTH,
  isValidName,
  isValidRoomCode,
  normalizeRoomCode,
  type GameType,
  type Player,
  type RoomView,
} from '@dg/shared';

/**
 * In-memory room store.
 *
 * No database in v1: rooms die with the process. That is a documented tradeoff
 * (see PLAN.md), not an oversight. Everything here is synchronous and single
 * threaded, which is what makes it safe: there is only one event loop owning
 * this state, so no locking is needed.
 *
 * Key invariants:
 * - A player is identified by id; a client proves it with a token.
 * - Disconnected players stay in the room (marked connected:false) so a locked
 *   phone can reclaim its seat. They are reaped after PLAYER_DISCONNECT_GRACE_MS.
 * - Room code lookup is case-insensitive and normalized on input.
 */

export type StoredPlayer = {
  id: string;
  name: string;
  isHost: boolean;
  /** Hash-free comparison is fine here; token is random, not a password. */
  token: string;
  connected: boolean;
  /** Set when the socket closes; cleared on reconnect. */
  disconnectedAt: number | null;
};

export type Room = {
  code: string;
  gameType: GameType;
  players: StoredPlayer[];
  createdAt: number;
  /** Set when the game starts. Joining after this point is refused. */
  inProgress: boolean;
};

const rooms = new Map<string, Room>();

function randomToken(): string {
  return randomBytes(32).toString('base64url');
}

function randomCode(): string {
  let out = '';
  for (let i = 0; i < ROOM_CODE_LENGTH; i += 1) {
    out += ROOM_CODE_ALPHABET[randomInt(ROOM_CODE_ALPHABET.length)];
  }
  return out;
}

/** Collision-resistant within the live room set; retries on the rare clash. */
function allocateCode(): string {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    const code = randomCode();
    if (!rooms.has(code)) return code;
  }
  throw new Error('could not allocate a room code');
}

export function toRoomView(room: Room): RoomView {
  return {
    code: room.code,
    gameType: room.gameType,
    capacity: MAX_PLAYERS,
    inProgress: room.inProgress,
    players: room.players.map(
      (p): Player => ({
        id: p.id,
        name: p.name,
        isHost: p.isHost,
        connected: p.connected,
      }),
    ),
  };
}

export type CreateRoomResult =
  | { ok: true; room: Room; player: StoredPlayer }
  | { ok: false; code: 'INVALID_NAME' | 'SERVER_ERROR' };

export function createRoom(
  rawName: string,
  gameType: GameType,
  playerId: string,
): CreateRoomResult {
  if (!isValidName(rawName)) return { ok: false, code: 'INVALID_NAME' };

  let code: string;
  try {
    code = allocateCode();
  } catch {
    return { ok: false, code: 'SERVER_ERROR' };
  }

  const player: StoredPlayer = {
    id: playerId,
    name: rawName.trim(),
    isHost: true,
    token: randomToken(),
    connected: true,
    disconnectedAt: null,
  };

  const room: Room = {
    code,
    gameType,
    players: [player],
    createdAt: Date.now(),
    inProgress: false,
  };

  rooms.set(code, room);
  return { ok: true, room, player };
}

export type JoinRoomResult =
  | { ok: true; room: Room; player: StoredPlayer; resumed: boolean }
  | {
      ok: false;
      code: 'ROOM_NOT_FOUND' | 'ROOM_FULL' | 'ROOM_IN_PROGRESS' | 'INVALID_NAME' | 'BAD_TOKEN';
    };

/**
 * Join or resume.
 *
 * A token that matches an existing player in this room means resume: the same
 * seat is reclaimed, keeping the name and host flag. Anything else is a new
 * player, subject to capacity and lobby-open rules.
 */
export function joinRoom(
  rawCode: string,
  rawName: string,
  playerId: string,
  token?: string,
): JoinRoomResult {
  const code = normalizeRoomCode(rawCode);
  if (!isValidRoomCode(code)) return { ok: false, code: 'ROOM_NOT_FOUND' };

  const room = rooms.get(code);
  if (!room) return { ok: false, code: 'ROOM_NOT_FOUND' };

  if (token) {
    const existing = room.players.find((p) => safeEqual(p.token, token));
    if (!existing) {
      // A stale token after the seat was reaped: treat as a fresh join rather
      // than an error, so a user who left a tab open overnight isn't stuck.
      return joinAsNew(room, rawName, playerId);
    }
    existing.connected = true;
    existing.disconnectedAt = null;
    return { ok: true, room, player: existing, resumed: true };
  }

  return joinAsNew(room, rawName, playerId);
}

function joinAsNew(room: Room, rawName: string, playerId: string): JoinRoomResult {
  if (!isValidName(rawName)) return { ok: false, code: 'INVALID_NAME' };

  const name = rawName.trim();
  if (name.length < MIN_NAME_LENGTH || name.length > MAX_NAME_LENGTH) {
    return { ok: false, code: 'INVALID_NAME' };
  }

  if (room.inProgress) return { ok: false, code: 'ROOM_IN_PROGRESS' };
  if (room.players.length >= MAX_PLAYERS) return { ok: false, code: 'ROOM_FULL' };

  const player: StoredPlayer = {
    id: playerId,
    name: uniqueName(room, name),
    isHost: false,
    token: randomToken(),
    connected: true,
    disconnectedAt: null,
  };
  room.players.push(player);
  return { ok: true, room, player, resumed: false };
}

/** Duplicate display names are confusing in a game; disambiguate instead of reject. */
function uniqueName(room: Room, name: string): string {
  const taken = new Set(room.players.map((p) => p.name.toLowerCase()));
  if (!taken.has(name.toLowerCase())) return name;
  for (let n = 2; n < 100; n += 1) {
    const candidate = `${name} ${n}`;
    if (!taken.has(candidate.toLowerCase())) return candidate;
  }
  return `${name} ${randomInt(1000, 9999)}`;
}

function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

export function getRoom(code: string): Room | undefined {
  return rooms.get(normalizeRoomCode(code));
}

/** Marks a player disconnected but keeps the seat for reconnect. */
export function markDisconnected(code: string, playerId: string): void {
  const room = getRoom(code);
  if (!room) return;
  const player = room.players.find((p) => p.id === playerId);
  if (!player) return;
  player.connected = false;
  player.disconnectedAt = Date.now();
}

/**
 * Removes a player entirely (explicit leave, or grace period expiry).
 * Host migration: if the host leaves, the earliest-connected remaining player
 * takes over, so a room never ends up without a way to start.
 */
export function removePlayer(code: string, playerId: string): { room: Room | null; emptied: boolean } {
  const room = getRoom(code);
  if (!room) return { room: null, emptied: false };

  const idx = room.players.findIndex((p) => p.id === playerId);
  if (idx === -1) return { room, emptied: false };

  const [removed] = room.players.splice(idx, 1);
  if (room.players.length === 0) {
    rooms.delete(room.code);
    return { room: null, emptied: true };
  }

  if (removed?.isHost) {
    const heir = room.players.find((p) => p.connected) ?? room.players[0];
    if (heir) heir.isHost = true;
  }

  return { room, emptied: false };
}

/** Players who have been gone longer than the grace period are dropped. */
export function reapExpiredPlayers(graceMs: number): Array<{ code: string; room: Room | null }> {
  const now = Date.now();
  const results: Array<{ code: string; room: Room | null }> = [];

  for (const room of [...rooms.values()]) {
    const expired = room.players.filter(
      (p) => !p.connected && p.disconnectedAt !== null && now - p.disconnectedAt > graceMs,
    );
    for (const player of expired) {
      const { room: updated } = removePlayer(room.code, player.id);
      results.push({ code: room.code, room: updated });
    }
  }
  return results;
}

/** Rooms with nobody connected for longer than the idle timeout are deleted. */
export function reapIdleRooms(idleMs: number): string[] {
  const now = Date.now();
  const removed: string[] = [];

  for (const room of [...rooms.values()]) {
    const anyConnected = room.players.some((p) => p.connected);
    if (anyConnected) continue;
    // If everyone is gone, the room is only as old as its most recent departure.
    const lastSeen = Math.max(
      ...room.players.map((p) => p.disconnectedAt ?? room.createdAt),
    );
    if (now - lastSeen > idleMs) {
      rooms.delete(room.code);
      removed.push(room.code);
    }
  }
  return removed;
}

/** Test/debug helper. Not exposed over the wire. */
export function roomCount(): number {
  return rooms.size;
}

export function allRooms(): Room[] {
  return [...rooms.values()];
}
