/**
 * Wire protocol shared by client and server.
 *
 * Design notes:
 * - Every message is a JSON object with a `type` discriminator. Discriminated
 *   unions + exhaustive switches on both sides means adding a message type is a
 *   compile error until both ends handle it.
 * - S01 only implements the `ping`/`pong` pair. It exists to prove transport,
 *   latency measurement, and the reconnect status before any game logic lands.
 * - S04 will extend this with room + round messages. Keep game state out of
 *   this file; it belongs in `@dg/shared` only if the client truly needs it.
 */

/** Sent by the browser. */
export type ClientMessage = {
  type: 'ping';
  /** Client-side send time, echoed back so RTT can be computed. */
  t: number;
};

/** Sent by the server. */
export type ServerMessage = {
  type: 'pong';
  /** Echo of the client's send time. */
  t: number;
  /** Server clock at time of handling. Useful later for timer sync (S04). */
  serverTime: number;
};

export type ClientMessageType = ClientMessage['type'];
export type ServerMessageType = ServerMessage['type'];

/** How often the client probes the server, in ms. */
export const PING_INTERVAL_MS = 5_000;

/** WebSocket path, shared so client and server cannot drift. */
export const WS_PATH = '/ws';

/**
 * Dev ports. Single source of truth so a port change is a one-line edit.
 * The server reads its port from env and falls back to this.
 */
export const DEFAULT_SERVER_PORT = 3001;
