import { useCallback, useEffect, useRef } from 'react';
import type { UseSocket } from './socket';

/**
 * Read-only drawing view for spectators.
 *
 * This is the missing half of the game: the drawer sees their own strokes
 * optimistically, everyone else needs to see them arrive. Without this, the
 * only person who can see the picture is the person holding the phone.
 *
 * Deliberately separate from DrawCanvas rather than a `readOnly` flag on it:
 * the two have different jobs (input vs. display), different lifetimes, and
 * keeping them apart means a spectator can never accidentally emit a stroke.
 *
 * Strokes arrive as normalised 0..1 coordinates and are scaled to whatever
 * this canvas happens to be, so a phone and a TV show the same picture.
 */

type Point = { x: number; y: number };

type Stroke = {
  strokeId: string;
  color: string;
  width: number;
  points: Point[];
};

type Props = {
  socket: UseSocket;
  className?: string;
};

export default function SpectatorCanvas({ socket, className }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const strokesRef = useRef<Stroke[]>([]);
  const rafRef = useRef<number | null>(null);

  const paint = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    const w = rect.width;
    const h = rect.height;

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, w, h);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    for (const stroke of strokesRef.current) {
      const pts = stroke.points.map((p) => ({ x: p.x * w, y: p.y * h }));
      ctx.strokeStyle = stroke.color;
      ctx.lineWidth = Math.max(1, stroke.width * w);
      drawSmooth(ctx, pts);
    }
  }, []);

  const schedule = useCallback(() => {
    if (rafRef.current !== null) return;
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = null;
      paint();
    });
  }, [paint]);

  const resize = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = Math.round(rect.width * dpr);
    canvas.height = Math.round(rect.height * dpr);
    paint();
  }, [paint]);

  useEffect(() => {
    resize();
    window.addEventListener('resize', resize);
    window.addEventListener('orientationchange', resize);
    return () => {
      window.removeEventListener('resize', resize);
      window.removeEventListener('orientationchange', resize);
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [resize]);

  useEffect(() => {
    return socket.onStroke((msg) => {
      // On the drawer's own device the local canvas already has this stroke.
      if (msg.playerId === socket.playerId) return;
      strokesRef.current.push({
        strokeId: msg.strokeId,
        color: msg.color,
        width: msg.width,
        points: msg.points,
      });
      schedule();
    });
  }, [socket, schedule]);

  useEffect(() => {
    return socket.onUndoStroke((msg) => {
      const idx = strokesRef.current.findIndex((s) => s.strokeId === msg.strokeId);
      if (idx === -1) return;
      strokesRef.current.splice(idx, 1);
      schedule();
    });
  }, [socket, schedule]);

  useEffect(() => {
    return socket.onRoundReset(() => {
      strokesRef.current = [];
      schedule();
    });
  }, [socket, schedule]);

  return <canvas ref={canvasRef} className={className ?? 'spectator-canvas'} aria-label="Drawing" />;
}

/** Same smoothing as the drawer's canvas so both devices look identical. */
function drawSmooth(ctx: CanvasRenderingContext2D, pts: Point[]): void {
  if (pts.length === 0) return;

  if (pts.length === 1) {
    const p = pts[0]!;
    ctx.beginPath();
    ctx.arc(p.x, p.y, ctx.lineWidth / 2, 0, Math.PI * 2);
    ctx.fillStyle = ctx.strokeStyle as string;
    ctx.fill();
    return;
  }

  if (pts.length === 2) {
    const [a, b] = [pts[0]!, pts[1]!];
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
    return;
  }

  ctx.beginPath();
  ctx.moveTo(pts[0]!.x, pts[0]!.y);
  for (let i = 1; i < pts.length - 1; i += 1) {
    const c = pts[i]!;
    const n = pts[i + 1]!;
    ctx.quadraticCurveTo(c.x, c.y, (c.x + n.x) / 2, (c.y + n.y) / 2);
  }
  const secondLast = pts[pts.length - 2]!;
  const last = pts[pts.length - 1]!;
  ctx.quadraticCurveTo(secondLast.x, secondLast.y, last.x, last.y);
  ctx.stroke();
}
