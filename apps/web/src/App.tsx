import { useEffect, useRef, useState } from 'react';
import { PING_INTERVAL_MS, WS_PATH, type ClientMessage, type ServerMessage } from '@dg/shared';

/**
 * S01 diagnostic surface.
 *
 * Deliberately ugly and throwaway. It exists to make three things visible:
 * 1. the socket is actually connected through the dev proxy
 * 2. round-trip latency is measurable and stable
 * 3. losing the server is obvious (kill it and watch the status flip)
 *
 * This file gets replaced by real routing in S02. Don't style it.
 */

type ConnState = 'connecting' | 'online' | 'offline';

type Sample = { rtt: number; at: number };

export default function App() {
  const [state, setState] = useState<ConnState>('connecting');
  const [latency, setLatency] = useState<number | null>(null);
  const [clockSkew, setClockSkew] = useState<number | null>(null);
  const [history, setHistory] = useState<Sample[]>([]);
  const [attempt, setAttempt] = useState(0);

  // Refs avoid re-creating the socket on every state change.
  const socketRef = useRef<WebSocket | null>(null);
  const intervalRef = useRef<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    let retryTimer: number | null = null;
    let backoff = 500;

    const connect = () => {
      if (cancelled) return;

      const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
      const url = `${proto}//${location.host}${WS_PATH}`;
      setState((prev) => (prev === 'online' ? prev : 'connecting'));

      const ws = new WebSocket(url);
      socketRef.current = ws;

      ws.onopen = () => {
        if (cancelled) return;
        backoff = 500;
        setState('online');
        sendPing();
      };

      ws.onmessage = (event: MessageEvent<string>) => {
        let msg: ServerMessage;
        try {
          msg = JSON.parse(event.data) as ServerMessage;
        } catch {
          return;
        }
        switch (msg.type) {
          case 'pong': {
            // t === 0 is the server's greeting; no RTT to compute.
            if (msg.t === 0) return;
            const rtt = Date.now() - msg.t;
            setLatency(rtt);
            setHistory((prev) => [...prev.slice(-19), { rtt, at: Date.now() }]);
            // Rough skew estimate: assume symmetric path, server time is
            // "now + half the RTT". S04 needs this for timer sync.
            setClockSkew(msg.serverTime - (msg.t + rtt / 2));
            break;
          }
          default: {
            // Exhaustiveness guard; see server/src/ws.ts for why the cast is needed.
            const unreachable = msg as never;
            console.warn('unhandled server message', unreachable);
          }
        }
      };

      ws.onclose = () => {
        if (cancelled) return;
        setState('offline');
        socketRef.current = null;
        retryTimer = window.setTimeout(connect, backoff);
        backoff = Math.min(backoff * 2, 5_000);
        setAttempt((n) => n + 1);
      };

      ws.onerror = () => {
        // onclose handles retry; avoid double-scheduling.
      };
    };

    const sendPing = () => {
      const ws = socketRef.current;
      if (!ws || ws.readyState !== WebSocket.OPEN) return;
      const msg: ClientMessage = { type: 'ping', t: Date.now() };
      ws.send(JSON.stringify(msg));
    };

    connect();
    intervalRef.current = window.setInterval(sendPing, PING_INTERVAL_MS);

    return () => {
      cancelled = true;
      if (retryTimer !== null) clearTimeout(retryTimer);
      if (intervalRef.current !== null) clearInterval(intervalRef.current);
      socketRef.current?.close();
    };
  }, []);

  const statusColor =
    state === 'online' ? '#1a7f37' : state === 'connecting' ? '#9a6700' : '#cf222e';

  const avg =
    history.length > 0
      ? Math.round(history.reduce((sum, s) => sum + s.rtt, 0) / history.length)
      : null;

  return (
    <main>
      <h1>Draw &amp; Guess — transport check</h1>
      <p>Session 01 diagnostic. This page is replaced in S02.</p>

      <dl>
        <dt>Connection</dt>
        <dd>
          <strong style={{ color: statusColor }}>{state}</strong>
          {attempt > 0 && state !== 'online' && ` (reconnect attempt ${attempt})`}
        </dd>

        <dt>Last RTT</dt>
        <dd>{latency === null ? '—' : `${latency} ms`}</dd>

        <dt>Average RTT (last {history.length})</dt>
        <dd>{avg === null ? '—' : `${avg} ms`}</dd>

        <dt>Clock skew vs server</dt>
        <dd>{clockSkew === null ? '—' : `${clockSkew} ms`}</dd>
      </dl>

      <h2>Recent samples</h2>
      <ul>
        {history
          .slice()
          .reverse()
          .map((s, i) => (
            <li key={`${s.at}-${i}`}>
              {new Date(s.at).toLocaleTimeString()} — {s.rtt} ms
            </li>
          ))}
      </ul>

      <hr />
      <p>
        <strong>Exit criterion:</strong> the RTT number updates every 5s. Kill the server
        process — status flips to <em>offline</em>. Restart it — status returns to{' '}
        <em>online</em> without a page reload.
      </p>
    </main>
  );
}
