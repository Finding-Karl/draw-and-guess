import { useEffect, useState } from 'react';
import type { RoomView } from '@dg/shared';
import type { UseSocket } from './socket';
import { joinUrl, qrDataUrl } from './qr';

/**
 * Room screen (host view).
 *
 * S02 scope: this is the lobby. The big QR code is the point — the product
 * decision is that someone can put this on a laptop or TV and everyone joins
 * by pointing a phone at it. Round rendering arrives in S07.
 */

type Props = {
  socket: UseSocket;
  room: RoomView;
  onLeave: () => void;
};

export default function Room({ socket, room, onLeave }: Props) {
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

  const me = room.players.find((p) => p.id === socket.playerId);
  const isHost = me?.isHost ?? false;
  const connectedCount = room.players.filter((p) => p.connected).length;

  return (
    <div className="room">
      <header className="room-head">
        <div>
          <span className="eyebrow">Room code</span>
          <div className="code-display">{room.code}</div>
        </div>
        <button type="button" className="btn ghost" onClick={onLeave}>
          Leave
        </button>
      </header>

      <section className="join-panel">
        <div className="qr-wrap">
          {qr ? <img src={qr} alt={`QR code to join room ${room.code}`} /> : <div className="qr-skeleton" />}
        </div>
        <div className="join-instructions">
          <h2>Scan to join</h2>
          <p className="join-url">{url.replace(/^https?:\/\//, '')}</p>
          <p className="muted">
            {room.players.length === 1
              ? 'Waiting for the first player…'
              : `${room.players.length} in the room`}
          </p>
        </div>
      </section>

      <section className="players">
        <h2>
          Players <span className="count">({connectedCount}/{room.capacity})</span>
        </h2>
        <ul>
          {room.players.map((p) => (
            <li key={p.id} className={p.connected ? 'player' : 'player offline'}>
              <span className="dot" aria-hidden />
              <span className="player-name">
                {p.name}
                {p.id === socket.playerId && <em> (you)</em>}
              </span>
              {p.isHost && <span className="badge">host</span>}
              {!p.connected && <span className="badge muted">away</span>}
            </li>
          ))}
        </ul>
      </section>

      <footer className="room-foot">
        {isHost ? (
          <p className="muted">Starting the game arrives in a later session.</p>
        ) : (
          <p className="muted">Waiting for the host to start.</p>
        )}
        <p className="muted small">
          {socket.state === 'online' ? `connected · ${socket.latency ?? '—'} ms` : socket.state}
        </p>
      </footer>
    </div>
  );
}
