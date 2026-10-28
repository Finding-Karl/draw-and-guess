import { useEffect, useState } from 'react';
import type { RoomView, RoundView } from '@dg/shared';
import type { UseSocket } from './socket';
import { joinUrl, qrDataUrl } from './qr';
import SpectatorCanvas from './SpectatorCanvas';

/**
 * Host screen — the big public display.
 *
 * Lives on a laptop or TV that the room gathers around. Deliberately NOT a
 * scaled-up phone layout: everything here is sized for reading from ~3 metres,
 * and the canvas is the dominant element because watching the drawing is the
 * whole point of the shared screen.
 *
 * The phone controller is a separate component with a separate job. That split
 * — private input surface vs. public display — is the product.
 */

type Props = {
  socket: UseSocket;
  room: RoomView;
  round?: RoundView | null;
  onLeave: () => void;
};

export default function Room({ socket, room, round, onLeave }: Props) {
  const [qr, setQr] = useState<string | null>(null);
  const url = joinUrl(room.code);

  useEffect(() => {
    let cancelled = false;
    void qrDataUrl(url, 640).then((dataUrl) => {
      if (!cancelled && dataUrl) setQr(dataUrl);
    });
    return () => {
      cancelled = true;
    };
  }, [url]);

  const connectedCount = room.players.filter((p) => p.connected).length;
  const phase = round?.phase ?? 'LOBBY';

  return (
    <div className="host">
      <header className="host-head">
        <div className="host-code">
          <span className="host-eyebrow">Room</span>
          <span className="host-code-value">{room.code}</span>
        </div>
        <div className="host-status">
          <span className="host-eyebrow">{room.players.length}/{room.capacity} players</span>
          <button type="button" className="btn ghost" onClick={onLeave}>
            Leave
          </button>
        </div>
      </header>

      {phase === 'LOBBY' && (
        <HostLobby
          room={room}
          qr={qr}
          url={url}
          connectedCount={connectedCount}
          meId={socket.playerId}
          onStart={() => socket.startGame()}
        />
      )}

      {(phase === 'PROMPT_REVEAL' || phase === 'DRAWING') && round && (
        <section className="host-stage">
          <div className="host-stage-bar">
            <DrawerBadge round={round} room={room} />
            <WordSlots round={round} />
            <RoundTimer endsAt={round.endsAt} />
          </div>
          <SpectatorCanvas socket={socket} className="host-canvas" />
          {phase === 'PROMPT_REVEAL' && (
            <div className="host-veil">
              <span className="host-eyebrow">get ready</span>
            </div>
          )}
        </section>
      )}

      {phase === 'ROUND_END' && round && (
        <section className="host-stage host-round-end">
          <div className="host-answer">
            <span className="host-eyebrow">the answer was</span>
            <h2>{round.answer ?? '—'}</h2>
          </div>
          <RoundScores round={round} meId={socket.playerId} />
        </section>
      )}

      {phase === 'GAME_END' && round && (
        <section className="host-stage host-round-end">
          <div className="host-answer">
            <span className="host-eyebrow">final scores</span>
            <h2>{round.scores[0] ? `${round.scores[0].name} wins` : 'Finished'}</h2>
          </div>
          <RoundScores round={round} meId={socket.playerId} final />
        </section>
      )}

      <footer className="host-foot">
        <GuessFeed socket={socket} />
      </footer>
    </div>
  );
}

function HostLobby({
  room,
  qr,
  url,
  connectedCount,
  meId,
  onStart,
}: {
  room: RoomView;
  qr: string | null;
  url: string;
  connectedCount: number;
  meId: string | null;
  onStart: () => void;
}) {
  const canStart = connectedCount >= 2;

  return (
    <section className="host-lobby">
      <div className="host-qr">
        {qr ? <img src={qr} alt={`QR code for room ${room.code}`} /> : <div className="qr-skeleton" />}
        <p className="join-url">{url.replace(/^https?:\/\//, '')}</p>
        <p className="host-hint">Scan with a phone to join</p>
      </div>

      <div className="host-players">
        <h2>Players</h2>
        <ul>
          {room.players.map((p) => (
            <li key={p.id} className={p.connected ? 'host-player' : 'host-player offline'}>
              <span className="dot" aria-hidden />
              <span className="host-player-name">
                {p.name}
                {p.id === meId && <em> (you)</em>}
              </span>
            </li>
          ))}
          {room.players.length === 0 && (
            <li className="host-player empty">No phones joined yet</li>
          )}
        </ul>

        {/*
          The display owns Start.

          The host is a screen, not a seat, so it is the only sensible owner of
          the "begin the game" action: whoever set up the laptop is standing at
          it. This also means no phone needs to be designated as the starter,
          which keeps screenshare setups working with zero coordination.
        */}
        <button type="button" className="btn primary big" onClick={onStart} disabled={!canStart}>
          Start game
        </button>
        {!canStart && (
          <p className="host-hint">
            {connectedCount === 0
              ? 'Waiting for phones to join'
              : 'Need at least 2 phones to start'}
          </p>
        )}
      </div>
    </section>
  );
}

function DrawerBadge({ round, room }: { round: RoundView; room: RoomView }) {
  const drawer = room.players.find((p) => p.id === round.drawerId);
  return (
    <span className="host-drawer">
      <span className="host-eyebrow">drawing</span>
      <strong>{drawer?.name ?? '—'}</strong>
    </span>
  );
}

/** Underscores with spaces preserved, so multi-word prompts show their shape. */
function WordSlots({ round }: { round: RoundView }) {
  if (!round.hint) return <span className="host-slots" />;
  return (
    <span className="host-slots" aria-label={`${round.hint.masked.filter((c) => c === '_').length} letters`}>
      {round.hint.masked.map((ch, i) =>
        ch === ' ' ? (
          <span key={i} className="slot-gap" />
        ) : (
          <span key={i} className="slot">
            {ch === '_' ? '' : ch}
          </span>
        ),
      )}
    </span>
  );
}

/** Countdown derived from the server's absolute endsAt — never a local timer. */
function RoundTimer({ endsAt }: { endsAt: number | null }) {
  const [remaining, setRemaining] = useState(() => (endsAt ? Math.max(0, endsAt - Date.now()) : 0));

  useEffect(() => {
    if (!endsAt) return;
    setRemaining(Math.max(0, endsAt - Date.now()));
    const id = window.setInterval(() => setRemaining(Math.max(0, endsAt - Date.now())), 200);
    return () => clearInterval(id);
  }, [endsAt]);

  const secs = Math.ceil(remaining / 1000);
  const urgent = secs <= 10;

  return (
    <span className={urgent ? 'host-timer urgent' : 'host-timer'} aria-live="off">
      {secs}
    </span>
  );
}

function RoundScores({
  round,
  meId,
  final,
}: {
  round: RoundView;
  meId: string | null;
  final?: boolean;
}) {
  return (
    <ol className={final ? 'host-scores final' : 'host-scores'}>
      {round.scores.map((s, i) => (
        <li key={s.playerId} className={s.playerId === meId ? 'me' : undefined}>
          <span className="host-rank">{i + 1}</span>
          <span className="host-score-name">
            {s.name}
            {s.playerId === meId && <em> (you)</em>}
          </span>
          <span className="host-score-value">{s.score}</span>
        </li>
      ))}
    </ol>
  );
}

/**
 * Public guess feed.
 *
 * Guesses are the shared comedy of a drawing game, so they belong on the big
 * screen where the whole room can react to them — not only on the guesser's
 * phone. Newest first, capped so the panel never grows without bound.
 */
function GuessFeed({ socket }: { socket: UseSocket }) {
  const items = socket.feed.slice(0, 6);

  return (
    <div className="host-feed">
      {items.length === 0 && <p className="host-hint">Guesses appear here</p>}
      {items.map((g, i) => (
        <p key={`${g.playerId}-${i}`} className={g.result === 'correct' ? 'host-feed-item correct' : 'host-feed-item'}>
          <span className="host-feed-name">{g.name}</span>
          <span className="host-feed-text">{g.result === 'correct' ? 'got it!' : g.text}</span>
        </p>
      ))}
    </div>
  );
}
