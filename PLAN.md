# Draw & Guess — Project Plan

Portfolio project for karlwong.work. Goal: prove **product frontend** capability (not infra/tooling) via a real-time multiplayer game that strangers can play together.

- **Stack:** React (Vite + TS) frontend, Node (Fastify) + WebSocket backend
- **Budget:** 2–3 focus hrs/day, no hard deadline
- **Definition of done:** deployed, playable by link, host screen + phone controllers, one written case study on the portfolio blog
- **Success metric:** two people who have never met can play a full round in under 2 minutes from clicking a link

---

## Product shape

Two distinct interfaces over one shared real-time state:

| Surface | Who | What it shows |
|---|---|---|
| **Host screen** | Laptop/TV, opens the room | Room code, round timer, canvas being drawn, guess feed, reveal, scoreboard |
| **Controller** | Each player's phone | Lobby ready-up, drawing tools OR guess input, vote/next button, private info (your word) |

The host screen is what makes a screen recording look like a real product. The controller is what makes it feel like a party game. Building both is the portfolio flex.

### Core loop
1. Someone creates a room → gets a 4-letter code + shareable link
2. Others join by code or link, enter a display name
3. Host screen shows lobby, players appear live as they join
4. Round starts → one player is secretly given a prompt, draws on their phone
5. Everyone else guesses in real time on their phones; guesses appear on host screen
6. Correct guess → round ends, scoring reveal animation, next round
7. After N rounds → final scoreboard with a shareable result

### Explicit scope cuts (v1)
- **No public lobby.** Invite links only. Satisfies "anyone on the internet can use it" without moderation burden.
- **No persistent accounts in v1.** Guest name + cookie-based session. Auth comes in v2 if the game earns it. (Documenting this decision is itself good interview material.)
- **No chat besides guesses.** Guesses are the chat.
- **No drawing replay/export in v1.** Nice v2.
- **No i18n, no themes, no custom prompt packs in v1.**

---

## Milestones

### M1 — Core loop, ugly but real (target: ~1 week of sessions)
- Monorepo: `apps/web` (Vite React TS), `apps/server` (Fastify + ws), `packages/shared` (types + game state machine)
- Room create/join by code, in-memory rooms, hardcoded 2-round game
- Canvas drawing with pointer events, broadcast strokes over ws
- Guess input, server-side answer checking, correct-guess detection
- Timers server-authoritative

**Checkpoint:** two browser tabs on your machine can complete a round. No auth, no styling, no animation.

### M2 — Real rooms + identity (~1 week)
- Guest sessions: name + signed cookie, no password
- Lobby: live player list, ready state, host controls
- 8-player cap, disconnect/reconnect handling (phone locks are guaranteed)
- Round rotation so everyone draws, scoring (speed bonus + drawer points)
- Deploy early: Fly.io or Railway for server (needs persistent ws), Vercel/Cloudflare Pages for web. Deploy here, not at the end — hosting surprises are cheaper to hit early.

**Checkpoint:** send the link to a friend on their phone. They can play.

### M3 — The part that matters: feel (~2–3 weeks, protect this time)
This milestone is the actual portfolio value. Do not compress it.
- **Word reveal:** drawer sees prompt with a satisfying reveal animation, not an alert
- **Timer:** last 10 seconds escalate — color, pulse, maybe tick sound
- **Guess proximity:** near-misses get "so close!" feedback (edit distance vs answer)
- **Reveal:** correct guess animates on host screen; scores count up rather than snap
- **Stroke rendering:** smoothed lines, not jagged point-to-point; drawer-side latency feels zero via optimistic local strokes
- **Mobile drawing:** touch handling that doesn't scroll the page, palm rejection basics, undo, eraser, brush size, color palette of 8
- **Reconnect:** locked phone returns to correct state within a second, no "game broken" state
- **Sound:** minimal — timer ticks, correct guess chime, round start. One toggle.

**Checkpoint:** record a 60-second screen capture. If watching it doesn't make someone want to try it, this milestone isn't done.

### M4 — Ship + write (~3–4 sessions)
- Landing page with a playable "try it solo" or bot mode so a visitor with no friends still experiences something
- The blog post (outline below)
- Update karlwong.work: project card, home bio rewrite, blog entry
- Analytics: room created, round completed, round abandoned. These numbers go in the post.

---

## Technical decisions to lock now

- **State authority:** server owns game state; clients send intents (`guess`, `stroke`, `ready`), server broadcasts snapshots + deltas. Never trust client timers.
- **Transport:** plain `ws` with a tiny typed message protocol in `packages/shared`. Do not reach for Socket.IO or a managed realtime service — you want to be able to explain the wire protocol.
- **Rendering:** `<canvas>` with a stroke buffer. Strokes stored as `{points, color, width, tool}`. Redraw on resize. No drawing library; the smoothing is the point.
- **Persistence:** in-memory Map for rooms, no DB in v1. Rooms die with the process — acceptable for a toy, and it's a documented tradeoff.
- **Host/controller split:** same React app, route decides layout. `/room/:code` = host, `/play/:code` = controller. Shared state hook, different components.

---

## Blog post outline (the written deliverable)

Working title: **"Making a party game feel fair when the network doesn't cooperate"**

1. **Why a game.** Product-frontend target; the gap a portfolio has to close.
2. **The architecture.** Host screen + controllers, one server-authoritative state. Diagram.
3. **Problem 1 — latency and the timer.** Why client-side timers produce arguments. How server timestamps + local interpolation made the clock feel identical on every phone.
4. **Problem 2 — drawing that feels instant.** Optimistic local strokes vs. remote stroke replay; what it cost, what it bought.
5. **Problem 3 — reconnection.** A locked phone is not an edge case in a party game. Session resumption design.
6. **Problem 4 — the reveal.** Why the 3-second pause before scores matter more than any feature. What I learned about pacing.
7. **Numbers.** How many rooms got made, how many finished a round, where people dropped.
8. **What I'd do differently.** Auth deferral verdict, what broke, what I'd cut sooner.

This post is what converts the project from "a toy I made" into "an engineer who thinks about product." Write it as you go — keep a `notes.md` of gotchas from day one, because you will not remember them later.

---

## Risks

- **Canvas + touch on iOS Safari** is the single biggest technical risk. Spike it in M1, not M3.
- **Draw-and-guess is the most expensive game in the family.** If M2 slips badly, the fallback is to swap the game for fill-in-the-blank on the same infrastructure — the platform story survives.
- **Host screen needs a second device to test.** Keep two browser windows + one phone in the loop from M1.

---

## Immediate next actions

- [ ] Decide project name + domain/subdomain (needed before deploy)
- [ ] Scaffold monorepo, get `ws` echo working between two tabs
- [ ] Spike: canvas touch drawing on iOS Safari, confirm viability
- [ ] Write `notes.md` with the first "why did I do it this way" entry
