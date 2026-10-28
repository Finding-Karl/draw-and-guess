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

**UPDATE — verified on real hardware (2026-10-28, evening)**
Deployed to Fly.io and opened https://draw-guess.fly.dev/spike on a physical iPhone
over cellular. Confirmed working by Karl. This closes the project's biggest technical
risk: finger drawing in mobile Safari works, the canvas does not scroll or zoom, and
the touch-action/user-select findings documented above hold on real Safari rather
than only in simulated touch.

Implication for S06: touch drawing is a known quantity now. The fallback plan
(swap the game for fill-in-the-blank on the same infrastructure) is no longer
needed for technical reasons.

Deploy notes that will matter again:
- Fly's trial caps machines at 5 minutes without a payment method on file. Symptom
  is a clean SIGINT shutdown in the logs with "Trial machine stopping" warnings and
  a healthy /healthz the whole time. Not a code bug.
- `fly launch` created a second machine alongside the deployed one. Two machines means
  two separate in-memory room stores — players would silently end up on different
  instances and not see each other. Keep exactly one machine until there is a shared
  store or sticky sessions.

---

## S04 — Round state machine
Date: 2026-10-28

**What I built**
Server-authoritative round engine: LOBBY → PROMPT_REVEAL → DRAWING → ROUND_END →
GAME_END. Drawer rotation skipping disconnected players, server-side guess
validation (correct / close / wrong), speed-bonus scoring, early round end when
every connected guesser has solved, and a 200ms ticker driving phase transitions.
536 prompts across 18 categories, difficulty ramping by round, with a
greatest-hits bias so strong words recur across games.

**Decisions + why**
- **Absolute `endsAt` timestamps, resolved lazily.** The ticker only controls
  broadcast *latency* (~200ms), never correctness. A blocked event loop or a
  paused process cannot make a round run long, and every client derives the same
  countdown from the same number. This is the "feels fair" mechanism the blog
  post is about.
- **The answer is a separate message type.** `DrawerViewMessage` is sent only to
  the drawer's own socket; `RoundView.answer` is null unless the phase reveals it.
  Making the leak a distinct, explicitly-addressed type means a leak has to be
  written deliberately, not fall out of a widening broadcast.
- **Category shown to the drawer only.** Solves a drawer freezing on a blank
  prompt without narrowing the guess space for everyone.
- **Difficulty ramps easy → medium → hard.** Round three being hard is what stops
  games ending flat.
- **Hits bias (~40%).** With a uniform 536-word draw, no single word surfaces
  often enough to tune by playtesting, and you lose the running-joke effect that
  makes repeat sessions fun. Repeats are a feature.

**What broke — and it was architectural**
`packages/shared` exported raw TypeScript source as its entry point
(`"main": "./src/index.ts"`). Fine when it was one file with no internal imports.
The moment it imported `./prompts.js`, Vite's config loader hit Node's ESM
resolver, which wants a real `.js` on disk — and there wasn't one until compiled.
The web build then failed at *config load*, before React was involved, which made
the error look unrelated to the change that caused it.

I chased it with three wrong fixes (`.js` specifier, `.ts` specifier,
`allowImportingTsExtensions`) before doing the right thing: compile `shared` to
`dist/` and point `main`/`types`/`exports` at the build output. Lesson worth
keeping: when a monorepo package is consumed by two different resolvers (Vite's
dev server and Node's runtime), export built artifacts, not source.

`npm run dev` now builds shared first, since dev servers were otherwise reading
stale or missing output.

**Verified — 24/24 protocol checks**
Including the acceptance criterion: the answer never appears in non-drawer wire
traffic before ROUND_END (asserted by scanning every received frame for the word).
Also: non-host cannot start, drawer cannot guess their own word, near-miss returns
`close` (edit distance ≤ 2), case-insensitive correctness, guess feed broadcast,
scores awarded, all-solved ends the round early, drawer rotates between rounds,
new answer differs.

**Still missing**
No UI for any of this yet — the round engine is only reachable by protocol. Host
screen is S07, controller drawing/guessing is S05–S06. `soloMode` and analytics
also unbuilt.

**Next session starts with**
S05: controller lobby, ready-up, and the pre-round screens.

---

## S05 — Controller lobby + pre-round handoff
Date: 2026-10-28

**What I built**
A phone-first `Controller` component at `/play/:code` with a phase switch:
lobby (player list, host start button gated at 2+ players), PROMPT_REVEAL
handoff ("You're drawing / Get ready" vs. "X is drawing"), DRAWING stub,
ROUND_END answer + scores, GAME_END winner + final table.

`socket.ts` now holds the full server state: `round`, `drawerView`, `lastGuess`,
and a 20-entry `feed`. The drawer's word is cleared whenever the phase leaves
DRAWING/PROMPT_REVEAL, so a stale word can't leak into the next round.

**Decisions + why**
- **Controller is a separate component from the host screen**, not a responsive
  variant. Two different devices, two different jobs: the phone is a private
  input surface, the TV is a public display. That split is the product.
- **Start is gated client-side at 2 players** *and* server-side (`TOO_FEW_PLAYERS`).
  The client gate is UX; the server gate is the actual rule.
- **Leave now clears the stored token.** Previously a reload after leaving would
  silently resume the seat you just gave up.

**Two bugs the screenshots caught that the tests did not**
1. **The controller had no CSS at all.** I wrote the component but never added
   its styles, so everything sat flush against the top-left with "Leave" touching
   the room code. My Playwright test asserted elements *existed* and passed 12/12
   while the page looked broken. Lesson: a passing DOM test says nothing about
   layout. Look at the screenshot every time a new screen appears.
2. **The footer spans ran together** — "— msRound 1/3 · 0 pts" — because two
   spans in a flex row had no separation.

**Type errors that `vite build` hid**
`npm run build` is `tsc -b && vite build`; the vite step succeeded while `tsc -b`
failed, and the npm script only surfaced the workspace path, not the actual
errors. Running `npx tsc -b` inside `apps/web` showed them plainly. Missing type
imports (`RoundView`, `Category`, `GuessFeedMessage`) plus null-narrowing on
`round` in the phase branches. Fixed with a single `const r = round` narrowing
and `&& r` guards.

**Verified — 12/12 browser checks**
Host alone sees a disabled start button and the 2-player hint. Phone joins as a
non-host with no start button. After the second player joins, start enables.
Pressing it moves both clients out of the lobby, exactly one player is told
they're drawing, and the other is told who is. No page errors.

**Still missing**
Drawing and guessing inputs (S06), everything on the big screen (S07).

**Next session starts with**
S06: wire the canvas into the controller for the drawer, guess input + feed for
everyone else.
