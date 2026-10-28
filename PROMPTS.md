# Draw & Guess — Iterative Build Prompts

Feed these to Claude Code (or equivalent) **one at a time, in order**. Each prompt = one working session (~2–3 focus hours) and ends with a verifiable exit criterion. Do not skip ahead to the next prompt until the exit criterion is actually true in a browser.

Rules that apply to every prompt:
- Commit at the end of each session. Tag the session number in the message: `S03: canvas drawing`.
- Append any surprise or non-obvious decision to `notes.md` before ending the session. Not optional — this file becomes the blog post.
- If a prompt balloons past one session, split it and record why in `notes.md`.
- Never let the model refactor working code it wasn't asked about.

---

## Phase 1 — Skeleton (Sessions 1–3)

### S01 — Monorepo scaffold + ws echo
**Goal:** prove the transport works before any game exists.

```
Set up a pnpm monorepo in this directory with three packages:

- apps/web — Vite + React + TypeScript
- apps/server — Fastify + ws (plain ws, not Socket.IO) + TypeScript, tsx for dev
- packages/shared — TypeScript types and constants imported by both

Requirements:
- Root package.json with scripts: `dev` (runs both concurrently), `build`, `typecheck`
- packages/shared exports a typed message union `ClientMessage | ServerMessage` with a single working pair: { type: 'ping', t: number } / { type: 'pong', t: number, serverTime: number }
- The web app connects to ws://localhost:3001/ws on mount, sends a ping every 5s, and renders the last round-trip latency plus online/offline status
- Server logs connections, cleans up on close, and echoes correctly
- Shared types are imported via workspace reference, not relative paths into another package

Do not build the game yet. Do not add styling, routing, state management libraries, or a database.
Acceptance: `pnpm dev` starts both, browser shows a live latency number, killing the server flips the status to offline.
```

**Exit:** latency number updates every 5s; killing the server shows offline, restarting reconnects.

### S02 — Room creation and joining (in-memory)
```
Add rooms on top of the existing ws server.

Server:
- In-memory Map<code, Room>. Room = { code, createdAt, players: Player[], state }
- Player = { id, name, connected, isHost }
- 4-letter room code from an unambiguous alphabet (no O/0, I/1), unique while alive
- Messages: createRoom, joinRoom { code, name }, leaveRoom
- Server generates playerId + playerToken (crypto-random). Client stores token in localStorage keyed by room code.
- On reconnect with a valid token, rejoin as the same player instead of creating a duplicate.
- Rooms with zero connected players for 10 minutes get garbage collected.
- 8 player cap, with a specific error code when exceeded.

Web:
- Two routes without a router library: `/` (create/join form) and `/room/:code` (placeholder, just lists player names)
- Creating a room navigates to /room/[code]
- Joining by code from `/` works
- Player list is live; open/close tabs and watch it change

Acceptance: two browser windows join the same room by code; closing and reopening one keeps the same player rather than adding a new one.
```

**Exit:** close a tab, reopen `/room/CODE`, you're back as yourself. Third window with a wrong code shows a clean error.

### S03 — iOS touch canvas spike (de-risk now, not later)
```
Build a throwaway canvas drawing page at `/spike/draw` — this is a technical spike, not product code.

Requirements:
- Full-viewport <canvas>, high-DPI aware via devicePixelRatio scaling
- Pointer events (pointerdown/move/up), supports mouse, stylus, and touch simultaneously
- Touch drawing must NOT scroll, zoom, or trigger iOS Safari double-tap-to-zoom
- Strokes are smoothed (quadratic midpoint or Catmull-Rom), not jagged polylines
- Local stroke renders optimistically during drawing; a separate function `drawRemoteStroke(stroke)` replays a stroke received from elsewhere
- Basic toolbar: 4 colors, 2 brush sizes, undo (removes last of YOUR strokes only)
- Redraw everything correctly on resize and orientation change

Add a comment block at the top of the file answering: what iOS quirks did you hit, what CSS was required, what still doesn't feel right.
Acceptance: test on a real iPhone over the local network (vite --host). Drawing feels lag-free and the page never scrolls.
```

**Exit:** you've drawn on a real phone. The comment block has real findings in it. Copy them into `notes.md`.

---

## Phase 2 — Core loop (Sessions 4–7)

### S04 — Server-authoritative game state machine
```
Add the round state machine to packages/shared and the server. No UI changes beyond debugging text.

States: LOBBY → PROMPT_REVEAL → DRAWING → ROUND_END → (next round | GAME_END)

Rules:
- Server owns all timers. Clients render countdowns from a server-sent `endsAt` epoch timestamp plus periodic sync, never from a locally started timer.
- Round flow: pick a drawer (rotate through players, skip disconnected), pick a prompt from a bundled list of 500+ tagged by difficulty (easy/medium/hard), broadcast round start.
- DRAWING lasts 80s. Server emits a tick or the client derives from endsAt (your call — document it).
- Guesses go through the server: it compares normalized strings (lowercase, trim, collapse whitespace, strip punctuation) and answers with one of: correct | close | wrong. "close" = edit distance <= 2 vs the answer.
- A correct guess ends the round immediately. First correct player wins the round.
- Scoring: correct guesser gets 100 + up to 100 speed bonus based on remaining time; drawer gets 50 per correct guesser.
- 3 rounds total. Then GAME_END with final scores.
- The answer is NEVER sent to non-drawer clients until ROUND_END.

Acceptance: a node script (or two browser tabs with debug output) can drive a full 3-round game with hardcoded guesses. Verify by hand that the answer never appears in a non-drawer client's received messages before ROUND_END.
```

**Exit:** you've captured the ws traffic and confirmed no answer leak. That verification is worth a `notes.md` line.

### S05 — Controller: join, lobby, ready-up
```
Build the phone controller UI at `/play/:code`.

- Mobile-first layout, designed for one hand, no horizontal scroll
- Joining shows the player name and "waiting for host"
- Lobby: player list with ready indicators, a big "I'm ready" button that toggles ready state
- Host (first player, or whoever created) sees an extra "Start game" button, enabled only when >= 2 players and all ready
- Round start: if you're the drawer, full-screen "YOUR TURN — you're drawing [WORD]" with a tap-to-continue; if not, "Guess the drawing on the big screen", with the guess input pinned to the bottom and the virtual keyboard behavior sane
- Show remaining time as a slim progress bar on the controller too

Acceptance: on a phone, join, ready up, and reach the pre-round screen in under 15 seconds from opening the link.
```

**Exit:** time yourself doing this on a phone. Note the number in `notes.md` — it's a baseline you'll defend in M3.

### S06 — Controller: drawing mode + guess mode
```
Wire the canvas from the spike into the real controller.

- If you are the drawer: the canvas fills the screen, toolbar at the bottom (undo, eraser, 4 colors, 2 sizes). Word is shown in a small collapsible banner.
- Strokes are sent to the server as individual stroke objects on pointerup (batched points), and the server broadcasts to the room.
- Local drawing is optimistic: your own stroke renders immediately, it does NOT wait for the server echo.
- If you are NOT the drawer: no canvas. Guess input, last 5 guesses from others shown as a scrollable feed, and a proximity hint area.
- Guess feedback: correct → green flash + "Got it!"; close → amber "SO CLOSE"; wrong → feed entry.

Acceptance: one phone draws, another phone guesses, both feel responsive. Drawing latency on the drawing phone is imperceptible.
```

**Exit:** two real devices over LAN complete a round without the drawer experiencing lag.

### S07 — Host screen
```
Build the host screen at `/room/:code`, designed for a laptop or TV viewed from across a room.

- Large room code + join URL, always visible in the lobby (this is the QR-worthy screen)
- Render a QR code for the join link (small dependency is fine)
- Live player list with join animation
- During DRAWING: the shared canvas scaled to fit, large countdown, guess feed on the right with newest at top, prompt length shown as underscores with revealed letters over time (e.g. "_ _ _ _ _" → "_ A _ _ _" at 40% of time remaining)
- ROUND_END: reveal the answer, animate correct guessers in, count scores up (not snap)
- GAME_END: final podium/scoreboard, plus a "play again" control
- Readable from 3 meters: type scale that assumes you're squinting, not reading

Acceptance: put the host screen on a laptop 3m away and confirm you can read the timer, the answer, and who's winning without leaning in.
```

**Exit:** a full round is watchable from across the room. **Phase 2 is done — deploy.**

---

## Phase 3 — Deploy early (Session 8)

### S08 — Ship it
```
Deploy the app so a stranger can play.

- Server: deploy apps/server to Fly.io (needs persistent WebSocket support; document the fly.toml choices). Include a health check endpoint.
- Web: deploy apps/web to Cloudflare Pages or Vercel, with an env var for the ws URL.
- Serve web same-origin where possible to avoid CORS/ws-origin headaches; if not, restrict allowed origins explicitly to your domain.
- Add basic rate limiting on room creation per IP to stop accidental floods.
- Add /healthz and confirm it returns 200 from the public URL.
- Write a DEPLOY.md with the exact commands to redeploy, so future-you doesn't re-derive them.

Acceptance: you send the public link to one person and they play a round on their phone with zero instructions from you.
```

**Exit:** a friend plays without you explaining anything. Whatever confused them is your top M3 backlog item.

---

## Phase 4 — Feel (Sessions 9–14) — this is the portfolio

### S09 — Reveal and pacing
```
Focus entirely on the 20 seconds of feel. Do not add features.

- Drawer's word reveal: staged animation — screen dims, three beats, then the word stamps in. Feels like being dealt a card.
- Round start on host: countdown 3-2-1 with a satisfying transition into the canvas
- ROUND_END: freeze the canvas first (with a subtle treatment so it's obvious it's over), reveal the answer, then reveal each correct guesser one at a time with a beat between them, then count scores up.
- Correct guess on the guesser's phone: haptic (navigator.vibrate where supported) + a color flash
- Every animation must be interruptible — if the round ends mid-animation, state must not desync.

Acceptance: record a 60s screen capture. Watch it without the sound on and decide honestly whether a stranger would want to try it.
```

**Exit:** the recording is one you'd put on the portfolio as-is.

### S10 — Timer tension + sound
```
- Last 10 seconds: timer turns from neutral to red, pulses subtly, and the guess input on controllers gets a matching border treatment
- Add a tiny sound layer: a soft tick in the last 5s, a correct-guess chime, a round-start tone. Single master toggle, default ON, persisted in localStorage.
- Sound must be lazily initialized on first user tap (iOS autoplay). No errors before interaction.
- Respect prefers-reduced-motion: disable the pulsing and staggers, keep the information.

Acceptance: play a round with your eyes closed during the last 10s — you can tell time is running out.
```

### S11 — Reconnection and resilience
```
A locked phone is the normal case, not an edge case.

- Client detects dropped ws, shows a non-alarming reconnecting bar, retries with exponential backoff + jitter, and re-authenticates with its stored token.
- On reconnect, the server sends a full state snapshot (including whether you're the drawer, the prompt if so, elapsed time, and current score).
- If a player disconnects during their own drawing turn, the round pauses with a visible "waiting for [name]" overlay for up to 15s; on timeout, that round is skipped and the drawing turn passes.
- If the host screen disconnects, players see "reconnecting the big screen" and the game state is preserved.
- Reloading the page at any point returns you to the correct screen with correct state.

Acceptance: lock a phone mid-guess, unlock after 20s — you're back in the round with the right timer value. Repeat as drawer.
```

**Exit:** you've tested the locked-phone path on a real device, twice, as both roles.

### S12 — Mobile drawing quality pass
```
- Palm rejection: ignore touch events while a stylus is in use (if detectable), and ignore multi-touch beyond the first pointer during a stroke
- Smoothing pass on strokes so remote viewers see the same curve quality the drawer sees
- Undo works per-player and is broadcast (remote clients remove the stroke too)
- Eraser that doesn't leave gaps — decide pixel-erase vs stroke-erase and document the tradeoff
- Prevent accidental pinch-zoom and pull-to-refresh during drawing (but keep the page scrollable in all non-drawing states)
- Canvas letterboxing: drawing should be a fixed aspect ratio on all devices so what the drawer sees matches the host screen

Acceptance: draw the same thing on an iPhone and a laptop trackpad; the host screen renders both identically framed.
```

### S13 — Prompt content + pacing of a whole game
```
- Expand prompts to 500+, tagged by difficulty, curated so they're drawable (concrete nouns/scenes, not abstractions). Include a `prompts.ts` with a comment on selection strategy (difficulty ramps across rounds).
- Add a post-round summary beat between rounds: who drew what, who guessed, time to solve.
- Tune numbers: round length, points, speed bonus curve. Play 5 full games solo with 3+ tabs and write down where it drags.
- Optional but cheap: skip-vote — if 2/3 of guessers vote skip, the round ends with no points. Prevents dead rounds.
```

**Exit:** you can play 5 consecutive games without a boring round.

### S14 — Empty-room fallback: solo mode
```
A visitor with no friends is most of your traffic.

- On the landing page, a "Play solo" button that puts you in a room with 1 bot.
- The bot draws from a small set of pre-authored stroke recordings (not generative drawing) and, as a guesser, guesses on a timer with a difficulty setting that makes it beatable.
- Solo mode is explicitly labeled as a demo, and offers "invite friends" at the end.
- Make it clear whether solo games count toward any stored stats (recommend: they don't).

Acceptance: click landing page → play a round → finish, all without a second device, in under 60 seconds.
```

**Exit:** landing page → fun in 60 seconds with nobody else involved.

---

## Phase 4b — Visual design (Sessions 15–17) — the portfolio surface

**Why this is its own phase.** S09–S14 make the game *feel* right — timing, reveals,
latency, reconnection. This phase makes it *look* right. They are different skills and
different work, and lumping them together is how side projects end up functionally
correct and visually generic. Recruiters screenshot; a portfolio piece has to survive
that screenshot.

**Gate:** only start this once S14 is done and the whole loop is playable end to end.
Styling a flow that still changes is wasted work.

**Do this before analytics and the blog post**, because the screenshots and the demo
recording come from this phase, and the post needs them.

### S15 — Visual direction + design tokens
```
Establish a real visual identity before touching individual screens.

- Write a short DESIGN.md (half a page max) answering: who is this for, what should it
  feel like (3 adjectives), what is the one memorable visual element? For a party game
  the answer is usually "playful, tactile, slightly hand-drawn" — not "clean SaaS".
- Define design tokens in CSS custom properties: a limited color palette (1 accent,
  1 surface, 2 neutrals, semantic success/warning/danger), a type scale (5 sizes max),
  spacing scale (4px base), radii, and 2-3 shadow levels. Put them in one tokens file.
- Pick the type pairing. One display face for the word reveal and scoreboard, one
  legible UI face for everything else. Self-host via a local woff2 — no runtime font CDN
  during a round, it causes a visible reflow on first paint of the reveal.
- Decide the dark/light question NOW: a party game is usually played in a dim room,
  so dark-first is defensible, but you must pick one and commit. Document the call.
- Delete every ad-hoc color and font-size from the S02-S14 code and replace with tokens.
  This is mechanical and boring; do it fully anyway.

Acceptance: grep the codebase for hex colors and px font sizes outside the tokens file
and find zero. DESIGN.md exists and you believe it.
```

**Exit:** one tokens file, one DESIGN.md, no stray colors in components.

### S16 — Host screen: make it read from 3 meters
```
The host screen is the thing in every screenshot and every demo recording. Treat it as
its own design problem, not a scaled-up phone UI.

- Type scale for distance: the round timer, the room code, and the scoreboard must be
  legible at 3m on a laptop. Test by literally standing back.
- The canvas: give it a deliberate frame — a border or matte so it reads as a "sheet"
  rather than floating pixels. Drawer name and word-length shown above it.
- Layout rhythm during a round: canvas dominant, guess feed secondary, timer unmissable.
  Nothing on this screen should move position when a new guess arrives.
- Scoreboard: this is the shareable artifact. Design it as one. Avatars or initials,
  a clear 1st place, and room for a "built by" line that will become the share card.
- Empty and long states: 1 player, 8 players, 8 players at differing name lengths.
  Handle all three.

Acceptance: display it on a TV or a laptop across the room and read everything without
leaning in. Then screenshot it and check it still looks intentional at 400px wide.
```

**Exit:** the host screen is the screenshot you'd lead the blog post with.

### S17 — Controller: thumb-first craft
```
The controller is used with one thumb, standing up, possibly a drink in the other hand.
- Redesign against those constraints, not as a shrunken desktop layout.
- Touch targets: 44px minimum, 48px where the button is pressed often (undo, color,
  guess submit). Verify with a thumb, not a mouse.
- The drawing toolbar must never be accidentally triggered while drawing: inset it,
  add a dead zone, or use a drag-up reveal. Document what you chose and why.
- Guess input: the virtual keyboard must not push the layout in a way that hides the
  guess feed. Handle the visual-viewport resize case explicitly.
- Feedback states: correct / close / wrong need to be unmistakable at a glance and
  reachable with haptics where supported.
- Safe-area insets for notched phones: nothing tappable under the home indicator.

Acceptance: play a full round one-handed on a real phone without a single mis-tap and
without the keyboard hiding anything you need.
```

**Exit:** one-handed play is comfortable on a real device.

### S18 — Motion, sound, and the finish pass
```
Final visual pass. Constraint: every animation must survive prefers-reduced-motion and
must be interruptible without state desync.

- Motion language: define 3 durations (fast/standard/emphatic) and 1-2 easing curves in
  the tokens file, then use nothing else. Inconsistent timing is the tell of a prototype.
- The word reveal: this is the signature moment. Give it real character — a stamp, a
  deal, a flip. It should be the thing people describe when telling a friend about the
  game.
- Guess feed entries animate in without shifting layout; correct guesses get a distinct
  treatment.
- Empty states: no players yet, everyone waiting, round about to start. These get seen
  constantly in a real game and are usually skipped.
- Favicon, page title per screen, OG image. The OG image is what shows up when someone
  pastes the link in Discord — design it, don't autogenerate a screenshot.
- Dark mode (if that was the S15 call) verified on both surfaces.

Acceptance: record a 60s capture. Show it to one person who hasn't seen the game and ask
what they think it is. If they can't tell it's a party game from the visuals alone,
keep going.
```

**Exit:** the recording is portfolio-ready before a single line of the blog post exists.

---

## Phase 5 — Ship the story (Sessions 19–21)

### S19 — Analytics from day one (retrofit allowed, but note it)
```
Add minimal, privacy-respecting analytics. No cookies, no third-party trackers if avoidable — server-side event logging into a JSON file or a free tier of a hosted store is fine.

Events, each with roomCode and timestamp:
- room_created
- player_joined
- round_started, round_completed, round_abandoned
- game_completed (all 3 rounds finished)
- solo_mode_started

Expose a private /stats endpoint with aggregate counts. You need: rooms created, % of rooms with a completed round, rounds completed per room.

Acceptance: the /stats endpoint returns real numbers after you play a game.
```

**Exit:** you have real numbers. These go in the blog post verbatim.

### S16 — Blog post draft
```
Write the case study. Pull from notes.md — do not invent.

Filename: apps/web/src/content/blog/party-game-latency.md (or wherever the blog content lives)
Title: Making a party game feel fair when the network doesn't cooperate

Sections per PLAN.md. Requirements:
- Every technical claim must reference a real thing that happened in notes.md
- Include the numbers from S15
- Include at least one thing that broke and how you found it
- Include one honest "what I'd do differently"
- 1200–1800 words, no fluff openings, no "in today's fast-paced world"
- Include 2 diagrams: the host/controller architecture, and the timer sync approach

Acceptance: you'd be comfortable sending this post to an interviewer who then asks follow-up questions about any paragraph.
```

**Exit:** the post exists and you can defend any sentence in it.

### S17 — Portfolio integration
```
Update karlwong.work:

- Home bio rewrite: lead with product frontend — building interactive, real-time interfaces that people enjoy using. Keep the Atlassian depth as evidence, not identity. Remove "specialized in frontend performance, build systems, developer experience."
- Projects page: add Draw & Guess as the lead card. Card needs: title, one-line description, live "Play now" link, and a link to the case study. The "View →" button must actually navigate.
- Blog page: populate with the case study post.
- Remove or de-emphasize stack pills that undercut the product narrative (Java, MongoDB, GCP etc. unless you can speak to them) — a shorter, sharper stack is stronger.
- Add the live link to the resume PDF.

Acceptance: a stranger lands on the site, plays the game, and reads the post without any dead links.
```

---

## Distribution checklist (runs parallel to Phase 4/5)

See `DISTRIBUTION.md`. Do not start posting until S08 is deployed and S09–S11 are done — you only get one first impression in r/InternetIsBeautiful.

---

## Session log template (append to notes.md each session)

```
## Sxx — <title>
Date:
Time spent:
What I built:
What surprised me:
What broke:
Decision + why:
Next session starts with:
```
