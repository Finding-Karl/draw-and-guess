# notes.md — build log

Running log of gotchas, decisions, and surprises. **This file becomes the blog post.**
Fill in a session entry at the end of every working session.

---

## S01 — Monorepo scaffold + ws echo
Date: 2026-10-27

**What I built**
npm workspaces monorepo: `apps/web` (Vite + React 19 + TS), `apps/server` (Fastify 5 +
`ws` + TS via tsx), `packages/shared` (wire protocol). Typed `ClientMessage | ServerMessage`
union with a ping/pong pair. Diagnostic page shows connection state, last/average RTT,
clock skew estimate, and recent samples, with exponential-backoff reconnect.

**Decisions + why**
- **npm workspaces over pnpm.** pnpm isn't installed and the monorepo needs are trivial.
  One less tool to install means session one actually starts.
- **Single shared http.Server for Fastify + ws.** Avoids two ports, and keeps the
  later same-origin deploy simple. `attachWebSocket(app.server)` after `listen()`.
- **Vite proxies `/ws` in dev.** Client code uses a relative URL, so the same code
  works in dev and after deploy with no env var in dev.
- **Clock skew measured from day one.** `serverTime - (t + rtt/2)` assumes a symmetric
  path. It's wrong under asymmetric latency, but it establishes the primitive that
  S04's server-authoritative timers will depend on.
- **Heartbeat via ws ping/pong every 10s.** Phones going to sleep leave half-open
  sockets that `close` never fires for. Without this, rooms accumulate ghosts.

**What surprised me**
- `localhost` on this machine resolves IPv6-first and Vite binds IPv6-only. Both my
  direct ws test and `curl` failed with "connection refused" while the server was
  demonstrably up and logging startup. Cost real debugging time; the fix was learning
  to test `127.0.0.1` explicitly. *This is a good blog-post aside: "the server was
  running the whole time."*
- Two different TypeScript configs disagreed. `npm run typecheck` passed, `npm run build`
  failed on the same code. Vite's project-references setup (`tsc -b`) is stricter about
  the `never` exhaustiveness pattern than the plain `--noEmit` run.
- `const unreachable: never = msg` does not work after a type-guard `if`. The guard
  narrows, it doesn't exhaustively filter, so the default branch still sees the full
  union. Needs `msg as never`. Both server and client hit this.

**What broke**
- Background dev servers launched with `(cmd &)` inside a one-shot shell get killed when
  that shell exits. Wasted two test cycles chasing a "proxy bug" that was actually a
  dead process.

**Verified**
- Direct ws: connect, ping→pong, RTT 1–4ms, skew ~0.5ms.
- Through Vite proxy: same.
- Kill server → client sees close, enters backoff. Restart → reconnects,
  no page reload. (Mirrors App.tsx logic in a standalone script.)
- `npm run typecheck` and `npm run build` both clean.

**Next session starts with**
S02: rooms, join by code, in-memory Map, player tokens in localStorage,
reconnect-as-same-player, 8-player cap, `/` and `/room/:code` routes.
