import { useEffect, useState } from 'react';
import { isValidName, MAX_NAME_LENGTH, normalizeRoomCode } from '@dg/shared';
import type { UseSocket } from './socket';

/**
 * Entry screen: create a room or join one by code.
 *
 * Copy rules learned from the plan: the join path is the high-traffic one, so
 * it is the default focus, the code input is uppercase-friendly, and there is
 * no signup wall anywhere. Name is requested, not verified.
 */

type Props = {
  socket: UseSocket;
  /** Prefilled from a QR link (?room=ABCD). */
  initialCode?: string;
  onEnterRoom: (code: string) => void;
};

export default function Home({ socket, initialCode, onEnterRoom }: Props) {
  const [name, setName] = useState(() => localStorage.getItem('dg:name') ?? '');
  const [code, setCode] = useState(initialCode ?? '');
  const [mode, setMode] = useState<'join' | 'create'>(initialCode ? 'join' : 'join');
  const [touched, setTouched] = useState(false);

  // Remember the name across visits; retyping it on every join is friction.
  useEffect(() => {
    if (!isValidName(name)) return;
    try {
      localStorage.setItem('dg:name', name.trim());
    } catch {
      /* ignore */
    }
  }, [name]);

  // Navigate once the server confirms membership.
  useEffect(() => {
    return socket.onJoined((result) => onEnterRoom(result.code));
  }, [socket, onEnterRoom]);

  const nameOk = isValidName(name);
  const codeOk = normalizeRoomCode(code).length === 4;

  const canSubmit = mode === 'join' ? nameOk && codeOk : nameOk;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setTouched(true);
    if (!canSubmit) return;
    if (mode === 'join') {
      socket.joinRoom(code, name.trim());
    } else {
      socket.createRoom(name.trim());
    }
  };

  return (
    <div className="home">
      <header className="home-header">
        <h1>Draw &amp; Guess</h1>
        <p>One person draws, everyone else guesses. Best on your phone.</p>
      </header>

      <form onSubmit={submit} className="card">
        <div className="tabs" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'join'}
            className={mode === 'join' ? 'tab active' : 'tab'}
            onClick={() => setMode('join')}
          >
            Join a room
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'create'}
            className={mode === 'create' ? 'tab active' : 'tab'}
            onClick={() => setMode('create')}
          >
            Create a room
          </button>
        </div>

        {mode === 'join' && (
          <label className="field">
            <span>Room code</span>
            <input
              className="code-input"
              value={code}
              onChange={(e) => setCode(normalizeRoomCode(e.target.value).slice(0, 4))}
              placeholder="ABCD"
              autoCapitalize="characters"
              autoComplete="off"
              autoCorrect="off"
              spellCheck={false}
              inputMode="text"
              maxLength={4}
              aria-invalid={touched && !codeOk}
            />
            {touched && !codeOk && <small className="hint error">Enter the 4-character code</small>}
          </label>
        )}

        <label className="field">
          <span>Your name</span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value.slice(0, MAX_NAME_LENGTH))}
            placeholder="Karl"
            autoComplete="nickname"
            maxLength={MAX_NAME_LENGTH}
            aria-invalid={touched && !nameOk}
          />
          {touched && !nameOk && <small className="hint error">Pick a name</small>}
        </label>

        <button type="submit" className="btn primary" disabled={!canSubmit && touched}>
          {mode === 'join' ? 'Join room' : 'Create room'}
        </button>
      </form>

      {socket.error && (
        <div className="banner error" role="alert">
          {socket.error.message}
          <button type="button" onClick={socket.clearError} aria-label="Dismiss">
            ×
          </button>
        </div>
      )}
    </div>
  );
}
