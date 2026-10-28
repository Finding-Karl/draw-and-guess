import { randomUUID } from 'node:crypto';
import {
  CLOSE_EDIT_DISTANCE,
  DRAWING_MS,
  PROMPT_REVEAL_MS,
  ROUNDS_PER_GAME,
  ROUND_END_MS,
  SCORE_FIRST_BASE,
  SCORE_FIRST_BONUS,
  SCORE_LATER_BASE,
  SCORE_LATER_BONUS,
  SCORE_PER_GUESSER,
  editDistance,
  maskAnswer,
  normalizeGuess,
  pickPrompt,
  type Category,
  type Phase,
  type PromptHint,
  type ScoreEntry,
} from '@dg/shared';
import type { Room, StoredPlayer } from './rooms.js';

/**
 * Round engine.
 *
 * The single most important rule in this file: the answer never enters any
 * broadcast payload. Non-drawers receive a masked hint; the drawer receives the
 * word on their own connection only (see ws.ts drawerView).
 *
 * Timers are stored as absolute epoch `endsAt` values and resolved lazily by
 * `tick()`. That means a paused process (or a slow event loop) cannot make a
 * round run long — the deadline is a timestamp, not a countdown being decremented.
 */

export type RoundPlayer = {
  id: string;
  name: string;
  score: number;
};

export type SentStroke = {
  playerId: string;
  strokeId: string;
  color: string;
  width: number;
  points: Array<{ x: number; y: number }>;
};

export type RoundState = {
  phase: Phase;
  roundIndex: number;
  drawerId: string | null;
  endsAt: number | null;
  /** The answer. NEVER broadcast while phase is DRAWING. */
  answer: string | null;
  category: Category | null;
  hint: PromptHint | null;
  /** Words already used this game, so nobody repeats a prompt. */
  used: Set<string>;
  /** Player ids who already guessed correctly this round. */
  solvers: Set<string>;
  scores: Map<string, number>;
  /**
   * Strokes drawn this round, in arrival order. Kept server-side so a player
   * who reconnects mid-round can be sent the current picture instead of an
   * empty canvas. Cleared when a new round begins.
   */
  strokes: SentStroke[];
  /** Set once GAME_END is reached. */
  finishedAt: number | null;
};

const rounds = new Map<string, RoundState>();

export function getRound(code: string): RoundState | undefined {
  return rounds.get(code);
}

function scoreEntries(room: Room, state: RoundState): ScoreEntry[] {
  return room.players
    .map((p) => ({
      playerId: p.id,
      name: p.name,
      score: state.scores.get(p.id) ?? 0,
    }))
    .sort((a, b) => b.score - a.score);
}

/**
 * Public view. Asserted-by-construction: there is no code path here that puts
 * the answer in during DRAWING.
 */
export function toRoundView(room: Room, state: RoundState) {
  const revealAnswer = state.phase === 'ROUND_END' || state.phase === 'GAME_END';
  return {
    phase: state.phase,
    roundIndex: state.roundIndex,
    totalRounds: ROUNDS_PER_GAME,
    drawerId: state.drawerId,
    endsAt: state.endsAt,
    hint: revealAnswer ? null : state.hint,
    scores: scoreEntries(room, state),
    answer: revealAnswer ? state.answer : null,
  };
}

/** Picks the next drawer: rotation order, skipping disconnected players. */
function nextDrawer(room: Room, state: RoundState): StoredPlayer | null {
  const connected = room.players.filter((p) => p.connected);
  if (connected.length < 2) return null;

  if (!state.drawerId) return connected[0] ?? null;

  const currentIndex = connected.findIndex((p) => p.id === state.drawerId);
  if (currentIndex === -1) {
    // Current drawer left. Start from the first connected player who hasn't drawn.
    return connected[0] ?? null;
  }
  return connected[(currentIndex + 1) % connected.length] ?? null;
}

export type StartResult = { ok: true } | { ok: false; code: 'TOO_FEW_PLAYERS' | 'WRONG_PHASE' };

/** Begins a fresh game. Called when the host presses start in the lobby. */
export function startGame(room: Room): StartResult {
  if (room.inProgress) return { ok: false, code: 'WRONG_PHASE' };

  const connected = room.players.filter((p) => p.connected);
  if (connected.length < 2) return { ok: false, code: 'TOO_FEW_PLAYERS' };

  const state: RoundState = {
    phase: 'LOBBY',
    roundIndex: -1,
    drawerId: null,
    endsAt: null,
    answer: null,
    category: null,
    hint: null,
    used: new Set(),
    solvers: new Set(),
    scores: new Map(room.players.map((p) => [p.id, 0])),
    strokes: [],
    finishedAt: null,
  };
  rounds.set(room.code, state);
  room.inProgress = true;

  beginRound(room, state);
  return { ok: true };
}

/** Transitions into PROMPT_REVEAL for the next round. */
export function beginRound(room: Room, state: RoundState): void {
  state.roundIndex += 1;
  state.solvers.clear();
  state.strokes = [];
  state.answer = null;
  state.hint = null;
  state.category = null;

  const drawer = nextDrawer(room, state);

  if (!drawer || state.roundIndex >= ROUNDS_PER_GAME) {
    endGame(state);
    return;
  }

  const prompt = pickPrompt('free-for-all', state.roundIndex, state.used);
  state.used.add(prompt.word);
  state.answer = prompt.word;
  state.category = prompt.category;
  state.hint = { category: prompt.category, masked: maskAnswer(prompt.word) };
  state.drawerId = drawer.id;
  state.phase = 'PROMPT_REVEAL';
  state.endsAt = Date.now() + PROMPT_REVEAL_MS;
}

/** PROMPT_REVEAL → DRAWING. */
export function beginDrawing(state: RoundState): void {
  state.phase = 'DRAWING';
  state.endsAt = Date.now() + DRAWING_MS;
}

/** DRAWING → ROUND_END, or straight to the next round. */
export function endRound(state: RoundState): void {
  state.phase = 'ROUND_END';
  state.endsAt = Date.now() + ROUND_END_MS;
}

function endGame(state: RoundState): void {
  state.phase = 'GAME_END';
  state.drawerId = null;
  state.endsAt = null;
  state.finishedAt = Date.now();
}

export type GuessOutcome =
  | { kind: 'correct'; scoreDelta: number; position: number }
  | { kind: 'close' }
  | { kind: 'wrong' }
  | { kind: 'ignored'; reason: 'not-drawing' | 'drawer' | 'already-solved' | 'empty' };

/**
 * Validates a guess. Comparison happens on the server so a client cannot read
 * the answer out of its own bundle or spoof a win.
 */
export function submitGuess(
  state: RoundState,
  playerId: string,
  raw: string,
): GuessOutcome {
  if (state.phase !== 'DRAWING') return { kind: 'ignored', reason: 'not-drawing' };
  if (state.drawerId === playerId) return { kind: 'ignored', reason: 'drawer' };
  if (state.solvers.has(playerId)) return { kind: 'ignored', reason: 'already-solved' };
  if (!state.answer) return { kind: 'ignored', reason: 'not-drawing' };

  const guess = normalizeGuess(raw);
  if (guess.length === 0) return { kind: 'ignored', reason: 'empty' };

  const answer = normalizeGuess(state.answer);

  if (guess === answer) {
    // Position decides the payout. Order matters, but solving always pays:
    // a second or third solver still earns something, just less than the first.
    const position = state.solvers.size; // 0-based: 0 means this is the first
    state.solvers.add(playerId);

    const remaining = state.endsAt ? Math.max(0, state.endsAt - Date.now()) : 0;
    const fraction = Math.max(0, Math.min(1, remaining / DRAWING_MS));

    const base = position === 0 ? SCORE_FIRST_BASE : SCORE_LATER_BASE;
    const bonusCap = position === 0 ? SCORE_FIRST_BONUS : SCORE_LATER_BONUS;
    const gained = Math.round(base + fraction * bonusCap);

    state.scores.set(playerId, (state.scores.get(playerId) ?? 0) + gained);
    if (state.drawerId) {
      state.scores.set(
        state.drawerId,
        (state.scores.get(state.drawerId) ?? 0) + SCORE_PER_GUESSER,
      );
    }

    return { kind: 'correct', scoreDelta: gained, position };
  }

  if (editDistance(guess, answer) <= CLOSE_EDIT_DISTANCE) return { kind: 'close' };
  return { kind: 'wrong' };
}

/** Everyone guessed: the round can end early rather than burning the clock. */
export function allGuessersSolved(room: Room, state: RoundState): boolean {
  const guessers = room.players.filter((p) => p.connected && p.id !== state.drawerId);
  return guessers.length > 0 && guessers.every((p) => state.solvers.has(p.id));
}

export type TickEvent =
  | { kind: 'reveal-to-drawing' }
  | { kind: 'round-ended' }
  | { kind: 'round-started' }
  | { kind: 'game-ended' };

/**
 * Advances any expired phase. Returns the transitions that happened so the
 * caller can broadcast/attach the drawer view. Called on a short interval.
 */
export function tick(room: Room, state: RoundState, now: number): TickEvent[] {
  const events: TickEvent[] = [];
  if (state.endsAt === null || now < state.endsAt) return events;

  switch (state.phase) {
    case 'PROMPT_REVEAL': {
      beginDrawing(state);
      events.push({ kind: 'reveal-to-drawing' });
      break;
    }
    case 'DRAWING': {
      endRound(state);
      events.push({ kind: 'round-ended' });
      break;
    }
    case 'ROUND_END': {
      if (state.roundIndex + 1 >= ROUNDS_PER_GAME) {
        endGame(state);
        events.push({ kind: 'game-ended' });
      } else {
        beginRound(room, state);
        events.push({ kind: 'round-started' });
      }
      break;
    }
    default:
      break;
  }
  return events;
}

/** Removes a player's round participation when they leave for good. */export function forgetPlayer(code: string, playerId: string): void {
  const state = rounds.get(code);
  if (!state) return;
  state.scores.delete(playerId);
  state.solvers.delete(playerId);
}

/** Clears round state when a room dies. */
export function clearRoom(code: string): void {
  rounds.delete(code);
}

export function newStrokeId(): string {
  return randomUUID();
}
