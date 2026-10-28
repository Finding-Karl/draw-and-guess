# Draw & Guess

Real-time multiplayer drawing game. Portfolio project — see `PLAN.md`, `PROMPTS.md`, `DISTRIBUTION.md`.

## Stack

- `apps/web` — Vite + React 19 + TypeScript
- `apps/server` — Fastify 5 + `ws` (plain, no Socket.IO) + TypeScript, `tsx watch` in dev
- `packages/shared` — wire protocol types and constants, imported by both

npm workspaces (not pnpm — see notes).

## Commands

```bash
npm install          # once
npm run dev          # server :3001 + web :5173, both watched
npm run typecheck    # all three workspaces
npm run build        # shared → server → web
```

Open http://localhost:5173 for the S01 transport check page.

- Server health: http://localhost:3001/healthz
- WebSocket path: `/ws` (proxied by Vite in dev, so client code uses a relative URL)

## Dev gotchas learned the hard way

**`localhost` on this machine resolves to IPv6 first.** Vite binds IPv6-only by default.
If a curl or ws test to `localhost:5173` fails with connection refused, try
`127.0.0.1:5173` or `[::1]:5173`. In the browser it's a non-issue.

**Background dev servers die when the spawning shell exits.** To test the app
programmatically, start it with `nohup`/a persistent process handle, or run
`npm run dev` in its own terminal. Do not start it with `(... &)` inside a
one-shot command and expect it to survive.

**Two different TypeScript configs, two different strictnesses.** `npm run typecheck`
in `apps/web` uses `tsconfig.app.json`, but `npm run build` uses `tsc -b` against
the project references. They can disagree. Always run `npm run build` before
declaring a session done.

**The `never` exhaustiveness guard needs a cast.** Because `isClientMessage`
narrows rather than filters types, the `default` branch of a switch still sees
the full union. Use `const unreachable = msg as never`, not `const unreachable: never = msg`.

## Layout

```
apps/server/src/index.ts   HTTP entry, health check, shutdown
apps/server/src/ws.ts      ws transport: connections, ping/pong, heartbeat
apps/web/src/App.tsx       S01 diagnostic UI (replaced in S02)
packages/shared/src/index.ts  wire protocol
```
