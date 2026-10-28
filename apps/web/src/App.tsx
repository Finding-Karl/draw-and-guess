import { useEffect, useState } from 'react';
import Home from './Home';
import Room from './Room';
import SpikeDraw from './SpikeDraw';
import { useSocket } from './socket';
import { parseRoomParam } from './qr';
import './spike.css';

/**
 * Routing without a router library.
 *
 * Three shapes, and that is the whole app:
 *   /?room=CODE   join flow with the code prefilled (this is what the QR encodes)
 *   /room/CODE    host screen, lives on the laptop or TV
 *   /play/CODE    controller, lives on each player's phone
 *
 * The host and controller screens arrive in S05-S07. For now both room shapes
 * render the lobby, which is enough to prove joining works from a phone.
 */

type Route =
  | { name: 'home'; roomParam: string | null }
  | { name: 'room'; code: string }
  | { name: 'play'; code: string }
  | { name: 'spike' };

function parsePath(pathname: string): Route {
  const roomParam = parseRoomParam(new URLSearchParams(location.search).get('room'));
  const parts = pathname.split('/').filter(Boolean);

  if (parts.length === 2 && parts[0] === 'room') {
    return { name: 'room', code: (parts[1] ?? '').toUpperCase() };
  }
  if (parts.length === 2 && parts[0] === 'play') {
    return { name: 'play', code: (parts[1] ?? '').toUpperCase() };
  }
  if (parts.length === 1 && parts[0] === 'spike') {
    return { name: 'spike' };
  }
  return { name: 'home', roomParam };
}

export default function App() {
  const socket = useSocket();
  const [route, setRoute] = useState<Route>(() => parsePath(location.pathname));

  // Back/forward support without pulling in a router.
  useEffect(() => {
    const onPop = () => setRoute(parsePath(location.pathname));
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  const navigate = (path: string) => {
    if (location.pathname + location.search === path) return;
    history.pushState(null, '', path);
    setRoute(parsePath(path));
  };

  // If the server says we're in a room but the URL doesn't say so (e.g. the
  // join happened on `/`), correct the URL so a refresh lands in the right place.
  useEffect(() => {
    if (route.name === 'home' && socket.room) {
      const target = `/play/${socket.room.code}`;
      history.replaceState(null, '', target);
      setRoute(parsePath(target));
    }
  }, [route.name, socket.room]);

  // Direct navigation to /room/CODE or /play/CODE without a session: attempt
  // to resume using a stored token, otherwise bounce to the join form.
  useEffect(() => {
    // Any route without a `code` field (home, spike) is not a room resume.
    if (route.name !== 'room' && route.name !== 'play') return;
    if (socket.room) return;
    if (socket.state === 'offline') return;

    const code = route.code;
    const storedName = localStorage.getItem('dg:name') ?? '';
    if (storedName) {
      socket.joinRoom(code, storedName);
    } else {
      navigate(`/?room=${code}`);
    }
  }, [route, socket]);

  const leave = () => {
    socket.leaveRoom();
    navigate('/');
  };

  // The spike is standalone: no socket, no room. Kept above the room logic so
  // it renders even when the server is unreachable (that's the point of a spike).
  if (route.name === 'spike') {
    return <SpikeDraw />;
  }

  let body: React.ReactNode;
  if (socket.room && route.name !== 'home') {
    body = <Room socket={socket} room={socket.room} onLeave={leave} />;
  } else if (route.name === 'home') {
    body = (
      <Home
        socket={socket}
        initialCode={route.roomParam ?? undefined}
        onEnterRoom={(code) => navigate(`/play/${code}`)}
      />
    );
  } else {
    body = <div className="home">Joining room {route.code}…</div>;
  }

  return (
    <>
      {socket.state !== 'online' && (
        <div className={`conn-bar ${socket.state}`}>
          {socket.state === 'offline' ? 'Reconnecting…' : 'Connecting…'}
        </div>
      )}
      {body}
    </>
  );
}
