import { useEffect, useRef, useState } from 'react';
import DrawCanvas from './DrawCanvas';
import SpectatorCanvas from './SpectatorCanvas';
import type { RoundView, RoomView } from '@dg/shared';
import type { UseSocket } from './socket';

/**
 * Phone controller.
 *
 * Deliberately phone-first: one hand, thumb reach, no horizontal scroll. The
 * desktop host screen (S07) is a separate component for the same state — the
 * split is the point of the product.
 *
 * S05 scope: lobby, ready-up, and the pre-round handoff screens. Drawing (S06)
 * and the big-screen views (S07) are stubs here on purpose.
 */

type Props = {
  socket: UseSocket;
  room: RoomView;
  round: RoundView | null;
  onLeave: () => void;
};

export default function Controller({ socket, room, round, onLeave }: Props) {
  const me = room.players.find((p) => p.id === socket.playerId);
  const isHost = me?.isHost ?? false;
  const connectedCount = room.players.filter((p) => p.connected).length;
  const canStart = connectedCount >= 2;

  const phase = round?.phase ?? 'LOBBY';
  const isDrawer = round?.drawerId != null && round.drawerId === socket.playerId;
  const myScore = round?.scores.find((s) => s.playerId === socket.playerId)?.score ?? 0;

  // Narrow once here so the phase branches below get a non-null RoundView.
  // Each branch is already gated on a phase that only exists when round != null.
  const r = round;

  return (
    <div className="controller">
      <header className="ctrl-head">
        <span className="ctrl-room">
          Room <strong>{room.code}</strong>
        </span>
        <button type="button" className="btn ghost" onClick={onLeave}>
          Leave
        </button>
      </header>

      {phase === 'LOBBY' && (
        <Lobby
          room={room}
          isHost={isHost}
          canStart={canStart}
          connectedCount={connectedCount}
          onStart={() => socket.startGame()}
          meId={socket.playerId}
        />
      )}

      {phase === 'PROMPT_REVEAL' && r && (
        <PreRound
          isDrawer={isDrawer}
          drawerName={room.players.find((p) => p.id === r.drawerId)?.name ?? 'someone'}
        />
      )}

      {phase === 'DRAWING' && r && (
        <DrawingPhase socket={socket} round={r} isDrawer={isDrawer} />
      )}

      {phase === 'ROUND_END' && r && (
        <RoundEnd round={r} solved={socket.lastGuess?.result === 'correct'} meId={socket.playerId} />
      )}

      {phase === 'GAME_END' && r && (
        <GameEnd round={r} isHost={isHost} onLeave={onLeave} />
      )}

      <footer className="ctrl-foot">
        <span className="muted small">
          {socket.state === 'online' ? `connected · ${socket.latency ?? '—'} ms` : socket.state}
        </span>
        {round && phase !== 'LOBBY' && phase !== 'GAME_END' && (
          <span className="muted small">
            Round {round.roundIndex + 1}/{round.totalRounds} · {myScore} pts
          </span>
        )}
      </footer>
    </div>
  );
}

function Lobby({
  room,
  isHost,
  canStart,
  connectedCount,
  onStart,
  meId,
}: {
  room: RoomView;
  isHost: boolean;
  canStart: boolean;
  connectedCount: number;
  onStart: () => void;
  meId: string | null;
}) {
  return (
    <section className="ctrl-panel">
      <h2>Lobby</h2>
      <ul className="players compact">
        {room.players.map((p) => (
          <li key={p.id} className={p.connected ? 'player' : 'player offline'}>
            <span className="dot" aria-hidden />
            <span className="player-name">
              {p.name}
              {p.id === meId && <em> (you)</em>}
            </span>
            {p.isHost && <span className="badge">host</span>}
          </li>
        ))}
      </ul>

      <div className="ctrl-actions">
        {isHost ? (
          <>
            <button
              type="button"
              className="btn primary big"
              onClick={onStart}
              disabled={!canStart}
            >
              Start game
            </button>
            {!canStart && (
              <p className="hint">Need at least 2 players ({connectedCount} here).</p>
            )}
          </>
        ) : (
          <p className="hint centered">Waiting for the host to start…</p>
        )}
      </div>
    </section>
  );
}

function PreRound({ isDrawer, drawerName }: { isDrawer: boolean; drawerName: string }) {
  return (
    <section className={isDrawer ? 'ctrl-panel handoff you' : 'ctrl-panel handoff'}>
      {isDrawer ? (
        <>
          <p className="eyebrow">You're drawing</p>
          <h2 className="big-handoff">Get ready</h2>
          <p className="hint">Your word appears next. You'll have 80 seconds.</p>
        </>
      ) : (
        <>
          <p className="eyebrow">Round starting</p>
          <h2 className="big-handoff">{drawerName} is drawing</h2>
          <p className="hint">Watch the big screen and type your guesses here.</p>
        </>
      )}
    </section>
  );
}

function DrawingPhase({
  socket,
  round,
  isDrawer,
}: {
  socket: UseSocket;
  round: RoundView;
  isDrawer: boolean;
}) {
  const remaining = useRemaining(round.endsAt);

  if (isDrawer) {
    return (
      <DrawCanvas
        socket={socket}
        remainingMs={remaining}
        word={socket.drawerView?.answer ?? ''}
        category={socket.drawerView?.category ?? null}
      />
    );
  }

  return <GuessPanel socket={socket} round={round} remainingMs={remaining} />;
}

/**
 * Guess input for non-drawers.
 *
 * The keyboard matters here: on iOS the visual viewport shrinks, not
 * innerHeight, so the feed is kept above the input and the panel is bottom-
 * anchored rather than centred — otherwise the keyboard eats the history you
 * need to avoid repeating someone else's guess.
 */
function GuessPanel({
  socket,
  round,
  remainingMs,
}: {
  socket: UseSocket;
  round: RoundView;
  remainingMs: number;
}) {
  const [text, setText] = useState('');
  const inputRef = useRef<HTMLInputElement | null>(null);
  const secondsLeft = Math.ceil(remainingMs / 1000);
  const urgent = secondsLeft <= 10;

  const solved = socket.lastGuess?.result === 'correct';

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const value = text.trim();
    if (!value) return;
    socket.submitGuess(value);
    setText('');
  };

  return (
    <div className="guess-wrap">
      {/* Spectators need to SEE the drawing. Without this the only person who
          can see the picture is the one holding the drawer's phone. */}
      <SpectatorCanvas socket={socket} />

      <div className="guess-head">
        <div className="guess-hint">
          {round.hint && (
            <>
              <span className="draw-cat">{round.hint.category}</span>
              <span className="masked">{round.hint.masked.join('')}</span>
            </>
          )}
        </div>
        <span className={urgent ? 'draw-timer urgent' : 'draw-timer'}>{secondsLeft}s</span>
      </div>

      {solved ? (
        <div className="guess-solved">Got it! 🎉</div>
      ) : (
        <form className="guess-form" onSubmit={submit}>
          <input
            ref={inputRef}
            value={text}
            onChange={(e) => setText(e.target.value.slice(0, 40))}
            placeholder="Type your guess…"
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="none"
            spellCheck={false}
            enterKeyHint="send"
            className={
              socket.lastGuess?.result === 'close'
                ? 'guess-input close'
                : socket.lastGuess?.result === 'wrong'
                  ? 'guess-input wrong'
                  : 'guess-input'
            }
          />
          <button type="submit" className="btn primary" disabled={!text.trim()}>
            Guess
          </button>
        </form>
      )}

      {socket.lastGuess && socket.lastGuess.result !== 'correct' && (
        <p className={socket.lastGuess.result === 'close' ? 'guess-feedback close' : 'guess-feedback'}>
          {socket.lastGuess.result === 'close' ? 'SO CLOSE' : 'Not it'}
        </p>
      )}

      <ul className="feed">
        {socket.feed.length === 0 && <li className="feed-empty">No guesses yet.</li>}
        {socket.feed.map((g, i) => (
          <li key={`${g.playerId}-${i}`} className={g.result === 'correct' ? 'correct' : ''}>
            <span className="feed-name">{g.name}</span>
            <span className="feed-text">{g.result === 'correct' ? 'guessed it!' : g.text}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * Countdown derived from the server's absolute endsAt.
 *
 * Never starts a local timer from "80 seconds" — that is how phones end up
 * disagreeing about when the round finished.
 */
function useRemaining(endsAt: number | null): number {
  const [remaining, setRemaining] = useState(() =>
    endsAt ? Math.max(0, endsAt - Date.now()) : 0,
  );

  useEffect(() => {
    if (!endsAt) return;
    const id = window.setInterval(() => {
      setRemaining(Math.max(0, endsAt - Date.now()));
    }, 200);
    return () => clearInterval(id);
  }, [endsAt]);

  return remaining;
}

function RoundEnd({
  round,
  solved,
  meId,
}: {
  round: RoundView;
  solved: boolean;
  meId: string | null;
}) {
  return (
    <section className="ctrl-panel">
      {solved && <p className="guess-solved">Got it! 🎉</p>}
      <p className="eyebrow">The answer was</p>
      <h2 className="big-handoff">{round.answer ?? '—'}</h2>
      <ol className="scores">
        {round.scores.map((s, i) => (
          <li key={s.playerId} className={s.playerId === meId ? 'me' : undefined}>
            <span className="rank">{i + 1}</span>
            <span className="player-name">
              {s.name}
              {s.playerId === meId && <em> (you)</em>}
            </span>
            <span className="score">{s.score}</span>
          </li>
        ))}
      </ol>
    </section>
  );
}

function GameEnd({
  round,
  isHost,
  onLeave,
}: {
  round: RoundView;
  isHost: boolean;
  onLeave: () => void;
}) {
  const winner = round.scores[0];
  return (
    <section className="ctrl-panel">
      <p className="eyebrow">Game over</p>
      <h2 className="big-handoff">{winner ? `${winner.name} wins` : 'Finished'}</h2>
      <ol className="scores">
        {round.scores.map((s, i) => (
          <li key={s.playerId}>
            <span className="rank">{i + 1}</span>
            <span className="player-name">{s.name}</span>
            <span className="score">{s.score}</span>
          </li>
        ))}
      </ol>
      {isHost && <p className="hint">Play again arrives with S07's host controls.</p>}
      <button type="button" className="btn ghost" onClick={onLeave}>
        Leave room
      </button>
    </section>
  );
}
