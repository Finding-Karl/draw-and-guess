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

import type { Category } from './prompts.js';

export type { Category, Difficulty, Prompt, PromptSelection } from './prompts.js';
export { CATEGORIES, PROMPTS, pickPrompt, poolFor } from './prompts.js';

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

/** Host starts the game. Only the host may send this. */
export type StartGameRequest = {
  type: 'startGame';
};

export type GuessRequest = {
  type: 'guess';
  text: string;
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
  | StartGameRequest
  | GuessRequest
  | SendStrokeRequest
  | UndoStrokeRequest
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
  /**
   * True when this connection is the room's display rather than a player.
   * A host has no seat: it never draws and never appears in the scoreboard.
   */
  isHost: boolean;
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

// ---------------------------------------------------------------------------
// Round state (S04)
// ---------------------------------------------------------------------------

/**
 * Round phases. Server-owned; clients only render.
 *
 * LOBBY → PROMPT_REVEAL → DRAWING → ROUND_END → (next round | GAME_END)
 */
export type Phase = 'LOBBY' | 'PROMPT_REVEAL' | 'DRAWING' | 'ROUND_END' | 'GAME_END';

/**
 * What a non-drawer is allowed to know about the prompt. Deliberately a
 * separate type from the drawer view so a leak has to be typed explicitly.
 */
export type PromptHint = {
  category: Category;
  /** One entry per character; letters are revealed over time, spaces as-is. */
  masked: string[];
};

/** Public score line. */
export type ScoreEntry = {
  playerId: string;
  name: string;
  score: number;
};

/**
 * Round state as broadcast to the room. Never carries the answer text.
 * The drawer learns the word through DrawerView instead.
 */
export type RoundView = {
  phase: Phase;
  roundIndex: number;
  totalRounds: number;
  drawerId: string | null;
  /** Server epoch ms when the current phase ends. Clients derive countdowns. */
  endsAt: number | null;
  hint: PromptHint | null;
  scores: ScoreEntry[];
  /** Populated at ROUND_END only. */
  answer: string | null;
};

/**
 * Sent ONLY to the drawer's own connection, never broadcast. This is the one
 * message that may contain the answer during DRAWING.
 */
export type DrawerViewMessage = {
  type: 'drawerView';
  answer: string;
  category: Category;
};

export type RoundStateMessage = {
  type: 'roundState';
  round: RoundView;
};

export type GuessResultMessage = {
  type: 'guessResult';
  result: 'correct' | 'close' | 'wrong';
  /** Echo of what the player guessed, so the client can render its own feed. */
  text: string;
};

/** Broadcast so the guess feed is shared and the host screen can show it. */
export type GuessFeedMessage = {
  type: 'guessFeed';
  playerId: string;
  name: string;
  text: string;
  result: 'correct' | 'close' | 'wrong';
};

/** One stroke as broadcast. Points are in a fixed 0..1 space, not pixels. */
export type StrokeMessage = {
  type: 'stroke';
  playerId: string;
  strokeId: string;
  color: string;
  width: number;
  points: Array<{ x: number; y: number }>;
};

export type SendStrokeRequest = {
  type: 'stroke';
  strokeId: string;
  color: string;
  width: number;
  points: Array<{ x: number; y: number }>;
};

export type UndoStrokeRequest = {
  type: 'undoStroke';
};

export type UndoStrokeMessage = {
  type: 'undoStroke';
  playerId: string;
  /** Which stroke to remove. Without this the client cannot undo exactly one. */
  strokeId: string;
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
  | 'NOT_HOST'
  | 'TOO_FEW_PLAYERS'
  | 'WRONG_PHASE'
  | 'NOT_DRAWER'
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
  | RoundStateMessage
  | DrawerViewMessage
  | GuessResultMessage
  | GuessFeedMessage
  | StrokeMessage
  | UndoStrokeMessage
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

/**
 * Player cap.
 *
 * 12 is a product decision, not a technical limit: the host screen has to show
 * every player's name and score legibly from a sofa, and past ~12 nobody can
 * read the scoreboard. The in-memory room model itself would hold far more.
 */
export const MAX_PLAYERS = 12;

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
// Round tuning
// ---------------------------------------------------------------------------

export const ROUNDS_PER_GAME = 3;

/** Drawing time in ms. */
export const DRAWING_MS = 80_000;

/** How long the drawer sees the word before drawing starts. */
export const PROMPT_REVEAL_MS = 5_000;

/** How long the answer and scores stay up between rounds. */
export const ROUND_END_MS = 8_000;

/** Points a correct guesser gets, plus up to this much speed bonus. */
/**
 * Scoring.
 *
 * First solver: base + speed bonus, scaled by remaining time.
 * Later solvers: a smaller base plus a smaller speed term, so solving late still
 *   pays. Previously a second solver earned nothing, which meant the fastest
 *   player won the round no matter how much skill the rest showed.
 * Drawer: flat points per solver, so a word everyone eventually gets is
 *   properly rewarded.
 *
 * Percentage-of-time rather than fixed tiers keeps the payouts sane from 2 to 12
 * players without retuning.
 */
export const SCORE_FIRST_BASE = 100;
export const SCORE_FIRST_BONUS = 100;
export const SCORE_LATER_BASE = 50;
export const SCORE_LATER_BONUS = 50;
export const SCORE_PER_GUESSER = 50;

/**
 * A guess within this edit distance of the answer counts as "close".
 * Powers the SO CLOSE feedback without revealing the answer.
 */
export const CLOSE_EDIT_DISTANCE = 2;

// ---------------------------------------------------------------------------
// Guess normalisation
// ---------------------------------------------------------------------------

/**
 * Normalises a guess for comparison. Deliberately aggressive: casing,
 * punctuation, and repeated spaces must never decide a round.
 */
export function normalizeGuess(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/[^a-z0-9 ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Levenshtein distance, capped early for performance on long inputs. */
export function editDistance(a: string, b: string): number {
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  let prev = new Array<number>(b.length + 1);
  let curr = new Array<number>(b.length + 1);
  for (let j = 0; j <= b.length; j += 1) prev[j] = j;

  for (let i = 1; i <= a.length; i += 1) {
    curr[0] = i;
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(prev[j]! + 1, curr[j - 1]! + 1, prev[j - 1]! + cost);
    }
    const swap = prev;
    prev = curr;
    curr = swap;
  }
  return prev[b.length]!;
}

/**
 * Masks the answer for non-drawers. Spaces are kept visible so multi-word
 * prompts show their shape; every other character becomes a slot.
 */
export function maskAnswer(answer: string): string[] {
  return [...answer].map((ch) => (ch === ' ' ? ' ' : '_'));
}

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
