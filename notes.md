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

---

## S03 — iOS touch canvas spike
Date: 2026-10-28

**What I built**
A throwaway `/spike` route: full-height canvas, pointer-event drawing, quadratic
midpoint smoothing, 4 colors, 2 brush widths, stroke-level undo, and a
`drawRemoteStroke(stroke)` seam for the S06 server path.

**Findings — the CSS that makes finger drawing work on iOS**
Three properties on the canvas element, and one without the others is not enough:
- `touch-action: none` — kills pan, pinch-zoom AND double-tap zoom on that element
  only. This is the single most important line in the spike.
- `user-select: none` + `-webkit-touch-callout: none` — without these a slow drag
  starts a text selection or opens the long-press menu mid-stroke.
- `-webkit-tap-highlight-color: transparent` — cosmetic but the grey flash on
  every touch looks broken.

Plus, at the layout level: `overscroll-behavior: none` and a fixed `100dvh` flex
column, because dragging near the viewport edge will otherwise rubber-band the
document even with touch-action set.

**Surprises**
- **`pointercancel` is not an error, it's normal.** iOS fires it when a system
  gesture wins (edge swipe, notification pull). If you discard the stroke on
  cancel you silently lose ink. Commit it instead.
- **A second finger used to start a second stroke** from the same origin. Fixed
  by tracking one `activePointerId` and ignoring everything else until it lifts.
  Two-finger drawing is a real user behaviour, not an edge case.
- **Reassigning canvas width/height wipes the bitmap.** Every resize path must
  replay stored strokes. Rotation on a phone hits this constantly.
- **`getCoalescedEvents()` matters** on 120Hz displays — without it fast strokes
  visibly staircase.

**Bug I introduced and caught**
My route-resume effect did `if (route.name === 'home' || socket.room) return;`
then read `route.code`. Adding a route variant with no `code` field made it
navigate to `/?room=undefined` and the spike never rendered. TypeScript didn't
catch it because the effect was written before the variant existed. Lesson: when
adding a route variant, re-read every effect that switches on route name — the
compiler won't. Fixed by narrowing positively (`if (route.name !== 'room' &&
route.name !== 'play') return;`) instead of blacklisting.

**Verified (simulated touch, Chromium + CDP touch events)**
13/13: DPI backing store correct at dpr 3, touch-action/user-select applied,
stroke paints real pixels, page never scrolls, second finger ignored, undo works,
all 44px+ touch targets, no page errors.

**NOT YET VERIFIED**
Real iPhone Safari. Everything above is simulated touch in Chromium, which
proves the logic but not the platform. Still needs a physical-device pass — and
that is blocked on having a URL reachable from the phone (S08 deploy).

**Open questions for S06**
- Smoothing looks good at speed but a deliberately slow line still facets.
  Consider distance-based point sampling rather than event-based.
- No pressure/tilt. Apple Pencil users get a uniform line.

**Next session starts with**
Either S08 (deploy, so the phone test is unblocked) or S04 (round state machine)
if the phone test is deferred.
