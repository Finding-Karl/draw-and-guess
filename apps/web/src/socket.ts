import { useEffect, useRef, useCallback, useState } from 'react';
import {
  PING_INTERVAL_MS,
  WS_PATH,
  type ClientMessage,
  type ErrorMessage,
  type RoomView,
  type ServerMessage,
} from '@dg/shared';

/**
 * Single socket owner for the whole app.
 *
 * Everything that talks to the server goes through here. This exists because
 * reconnection, the identity token, and room membership are all cross-cutting:
 * if each screen opened its own socket, a route change would drop the room.
 *
 * Deliberate choices:
 * - One socket, created once, survives route changes.
 * - Sends are queued while offline so a join issued during a blip still lands.
 * - The last roomJoined response is retained so a remount can rebuild state
 *   without re-running the join.
 */

export type ConnState = 'connecting' | 'online' | 'offline';

export type JoinResult = {
  code: string;
  playerId: string;
  token: string;
  room: RoomView;
};

/** localStorage key for a room token, namespaced by room code. */
function tokenKey(code: string): string {
  return `dg:token:${code}`;
}

export function readToken(code: string): string | null {
  try {
    return localStorage.getItem(tokenKey(code));
  } catch {
    return null;
  }
}

export function writeToken(code: string, token: string): void {
  try {
    localStorage.setItem(tokenKey(code), token);
  } catch {
    // Private browsing or storage disabled: reconnect degrades to "join fresh".
  }
}

export function clearToken(code: string): void {
  try {
    localStorage.removeItem(tokenKey(code));
  } catch {
    /* ignore */
  }
}

export type UseSocket = {
  state: ConnState;
  latency: number | null;
  room: RoomView | null;
  playerId: string | null;
  error: ErrorMessage | null;
  clearError: () => void;
  createRoom: (name: string) => void;
  joinRoom: (code: string, name: string) => void;
  leaveRoom: () => void;
  /** Registers a handler for roomJoined; returns an unsubscribe function. */
  onJoined: (fn: (result: JoinResult) => void) => () => void;
};

export function useSocket(): UseSocket {
  const [state, setState] = useState<ConnState>('connecting');
  const [latency, setLatency] = useState<number | null>(null);
  const [room, setRoom] = useState<RoomView | null>(null);
  const [playerId, setPlayerId] = useState<string | null>(null);
  const [error, setError] = useState<ErrorMessage | null>(null);

  const socketRef = useRef<WebSocket | null>(null);
  const queueRef = useRef<string[]>([]);
  const joinedHandlers = useRef(new Set<(r: JoinResult) => void>());
  /** Last join intent, replayed on reconnect so a blip doesn't eject the user. */
  const lastJoinRef = useRef<{ code: string; name: string } | null>(null);

  const rawSend = useCallback((msg: ClientMessage) => {
    const ws = socketRef.current;
    const payload = JSON.stringify(msg);
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(payload);
    } else {
      queueRef.current.push(payload);
    }
  }, []);

  const clearError = useCallback(() => setError(null), []);

  const createRoom = useCallback(
    (name: string) => {
      lastJoinRef.current = null;
      rawSend({ type: 'createRoom', name, gameType: 'draw-and-guess' });
    },
    [rawSend],
  );

  const joinRoom = useCallback(
    (code: string, name: string) => {
      lastJoinRef.current = { code, name };
      rawSend({ type: 'joinRoom', code, name, token: readToken(code) ?? undefined });
    },
    [rawSend],
  );

  const leaveRoom = useCallback(() => {
    lastJoinRef.current = null;
    if (room) clearToken(room.code);
    setRoom(null);
    setPlayerId(null);
    rawSend({ type: 'leaveRoom' });
  }, [rawSend, room]);

  const onJoined = useCallback((fn: (r: JoinResult) => void) => {
    joinedHandlers.current.add(fn);
    return () => {
      joinedHandlers.current.delete(fn);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    let retryTimer: number | null = null;
    let backoff = 500;

    const handleServerMessage = (msg: ServerMessage) => {
      switch (msg.type) {
        case 'pong': {
          if (msg.t === 0) return;
          setLatency(Date.now() - msg.t);
          break;
        }
        case 'roomJoined': {
          writeToken(msg.code, msg.token);
          setRoom(msg.room);
          setPlayerId(msg.playerId);
          setError(null);
          for (const fn of joinedHandlers.current) {
            fn({ code: msg.code, playerId: msg.playerId, token: msg.token, room: msg.room });
          }
          break;
        }
        case 'roomState': {
          setRoom(msg.room);
          break;
        }
        case 'roomLeft': {
          setRoom(null);
          setPlayerId(null);
          break;
        }
        case 'error': {
          setError(msg);
          break;
        }
        default: {
          const unreachable = msg as never;
          console.warn('unhandled server message', unreachable);
        }
      }
    };

    const connect = () => {
      if (cancelled) return;
      const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
      const ws = new WebSocket(`${proto}//${location.host}${WS_PATH}`);
      socketRef.current = ws;

      ws.onopen = () => {
        if (cancelled) return;
        backoff = 500;
        setState('online');
        // Flush anything queued while offline, then re-establish membership.
        const queued = queueRef.current.splice(0);
        for (const payload of queued) ws.send(payload);
        const last = lastJoinRef.current;
        if (last) {
          ws.send(
            JSON.stringify({
              type: 'joinRoom',
              code: last.code,
              name: last.name,
              token: readToken(last.code) ?? undefined,
            } satisfies ClientMessage),
          );
        }
      };

      ws.onmessage = (event: MessageEvent<string>) => {
        let msg: ServerMessage;
        try {
          msg = JSON.parse(event.data) as ServerMessage;
        } catch {
          return;
        }
        handleServerMessage(msg);
      };

      ws.onclose = () => {
        if (cancelled) return;
        setState('offline');
        socketRef.current = null;
        retryTimer = window.setTimeout(connect, backoff);
        backoff = Math.min(backoff * 2, 5_000);
      };
    };

    connect();
    const pingTimer = window.setInterval(() => {
      const ws = socketRef.current;
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'ping', t: Date.now() } satisfies ClientMessage));
      }
    }, PING_INTERVAL_MS);

    return () => {
      cancelled = true;
      if (retryTimer !== null) clearTimeout(retryTimer);
      clearInterval(pingTimer);
      socketRef.current?.close();
    };
  }, []);

  return {
    state,
    latency,
    room,
    playerId,
    error,
    clearError,
    createRoom,
    joinRoom,
    leaveRoom,
    onJoined,
  };
}
