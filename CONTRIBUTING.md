# Branching

Short-lived feature branches merged into `main`. No long-running develop branch —
this is a solo project and `main` should always be deployable.

## Convention

Branch names follow the session number from `PROMPTS.md`, so a branch maps to
exactly one unit of work:

```
s04-round-state-machine
s05-controller-lobby
s16-host-screen-design
```

Fix branches use `fix/` instead:

```
fix/reconnect-race
fix/qr-lan-url
```

## Flow

```bash
git switch main
git pull --ff-only
git switch -c s04-round-state-machine

# ... work ...

git add -A
git commit -m "S04: server-authoritative round state machine."

git switch main
git merge --no-ff s04-round-state-machine
git push origin main
git branch -d s04-round-state-machine
```

`--no-ff` keeps the branch visible in history, which makes the commit log read as
a session-by-session build log. That is useful here: it is the raw material for
the case-study blog post.

## Rules

- `main` is always deployable. If `main` is broken, fixing it outranks new work.
- One session per branch. If a branch spans two sessions, that is a signal the
  session was scoped too large, and it belongs in `notes.md` as such.
- Never push directly to `main`. Merge locally, then push.
- Delete the branch after merging. A pile of merged branches is noise.
- Deploy from `main` only, so the live site always matches the repo.

## Deploying

`fly deploy` deploys the working tree, not a branch. Since `main` is always
deployable, deploy after merging, from `main`:

```bash
git switch main
fly deploy
```

## Before merging

```bash
npm run typecheck && npm run build
```

Both must pass. `build` is the stricter of the two and catches things
`typecheck` misses (see the `never` exhaustiveness note in `README.md`).
