import { useCallback, useEffect, useRef, useState } from 'react';
import type { UseSocket } from './socket';

/**
 * Drawing surface for the controller.
 *
 * Ported from the S03 spike, with the differences that matter once a server is
 * involved:
 *
 * 1. **Points are normalised to 0..1.** The drawer's phone and the host screen
 *    have different pixel sizes and aspect ratios. Sending pixels would make a
 *    stroke land in the wrong place everywhere except the device that drew it.
 * 2. **Strokes are emitted on pointerup, not per-move.** A per-move emit would
 *    be one frame per touch event; batching to a single stroke message cuts the
 *    wire traffic by ~50x and the server only needs the finished line.
 * 3. **Local drawing is optimistic.** Your own stroke renders immediately as you
 *    move; the echo from the server is ignored for your own strokes. Waiting for
 *    a round trip is what makes remote drawing feel laggy.
 * 4. **Undo is per-player and server-broadcast**, so remote clients remove the
 *    same stroke rather than drifting out of sync.
 *
 * The iOS CSS requirements from the spike (touch-action, user-select, callout)
 * are carried over; see spike.css and the S03 notes for why each one is needed.
 */

const COLORS = ['#14161a', '#dc2626', '#2563eb', '#16a34a'];
const WIDTHS = [0.006, 0.016]; // normalised: fraction of the canvas width

type Point = { x: number; y: number };

type LocalStroke = {
  strokeId: string;
  color: string;
  width: number;
  points: Point[];
};

type Props = {
  socket: UseSocket;
  /** Milliseconds remaining, derived from the server's endsAt by the caller. */
  remainingMs: number;
  /** The drawer's own word. Never rendered for anyone else. */
  word: string;
  category: string | null;
};

export default function DrawCanvas({ socket, remainingMs, word, category }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const strokesRef = useRef<LocalStroke[]>([]);
  const activeRef = useRef<{ pointerId: number; stroke: LocalStroke } | null>(null);
  const rafRef = useRef<number | null>(null);
  const lastServerStrokeRef = useRef<string | null>(null);
  /**
   * Throttle state for live streaming.
   *
   * Strokes used to be sent only on pointerup, which meant spectators saw the
   * line appear all at once after the drawer lifted their finger. Now points
   * stream during the gesture, and this refs track what has already gone out so
   * each tick sends only the new tail rather than the whole stroke again.
   */
  const lastSentRef = useRef<{ strokeId: string; pointCount: number }>({ strokeId: '', pointCount: 0 });
  const lastFlushRef = useRef<number>(0);

  const [color, setColor] = useState(COLORS[0]!);
  const [width, setWidth] = useState(WIDTHS[1]!);
  const [strokeCount, setStrokeCount] = useState(0);

  // --- rendering -----------------------------------------------------------

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
      // Normalised points → device-independent CSS pixels.
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

  /**
   * Stream the in-progress stroke to other players.
   *
   * Throttled to ~60ms: fast enough that a line grows visibly rather than in
   * chunks, slow enough that a fast scribble does not become a message per
   * frame. Sends the FULL point list each time rather than a delta, because the
   * spectator replaces that stroke's points wholesale — deltas would need
   * sequencing to survive a dropped message, which is not worth it at this size.
   */
  const STREAM_INTERVAL_MS = 60;
  const streamProgress = useCallback(() => {
    const active = activeRef.current;
    if (!active) return;

    const now = performance.now();
    if (now - lastFlushRef.current < STREAM_INTERVAL_MS) return;
    lastFlushRef.current = now;

    const { stroke } = active;
    if (stroke.points.length < 2) return;

    socket.sendStroke(stroke.strokeId, stroke.color, stroke.width, stroke.points);
    lastSentRef.current = { strokeId: stroke.strokeId, pointCount: stroke.points.length };
  }, [socket]);

  const resize = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    // Reassigning width/height clears the bitmap; paint() replays from state.
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

  // --- remote strokes ------------------------------------------------------

  useEffect(() => {
    return socket.onStroke((msg) => {
      // Own strokes are already on screen; ignore the echo to avoid doubles.
      if (msg.playerId === socket.playerId) return;
      lastServerStrokeRef.current = msg.strokeId;
      strokesRef.current.push({
        strokeId: msg.strokeId,
        color: msg.color,
        width: msg.width,
        points: msg.points,
      });
      setStrokeCount(strokesRef.current.length);
      schedule();
    });
  }, [socket, schedule]);

  useEffect(() => {
    return socket.onUndoStroke((msg) => {
      const idx = strokesRef.current.findIndex((s) => s.strokeId === msg.strokeId);
      if (idx === -1) return;
      strokesRef.current.splice(idx, 1);
      setStrokeCount(strokesRef.current.length);
      schedule();
    });
  }, [socket, schedule]);

  /** Clears the canvas when a new round begins. */
  useEffect(() => {
    return socket.onRoundReset(() => {
      strokesRef.current = [];
      setStrokeCount(0);
      schedule();
    });
  }, [socket, schedule]);

  // --- pointer input -------------------------------------------------------

  const toNormalised = (e: React.PointerEvent<HTMLCanvasElement>): Point => {
    const rect = e.currentTarget.getBoundingClientRect();
    return {
      x: (e.clientX - rect.left) / rect.width,
      y: (e.clientY - rect.top) / rect.height,
    };
  };

  const onPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    // One stroke at a time: a second finger must not start a new line.
    if (activeRef.current) return;
    if (e.pointerType === 'mouse' && e.button !== 0) return;

    e.currentTarget.setPointerCapture(e.pointerId);
    const stroke: LocalStroke = {
      strokeId: `${socket.playerId ?? 'x'}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      color,
      width,
      points: [toNormalised(e)],
    };
    activeRef.current = { pointerId: e.pointerId, stroke };
    strokesRef.current.push(stroke);
    schedule();

    // Push the first point straight away so spectators see the stroke begin
    // immediately rather than waiting for the first interval tick.
    streamProgress();
  };

  const onPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const active = activeRef.current;
    if (!active || active.pointerId !== e.pointerId) return;

    const native = e.nativeEvent;
    const events =
      typeof native.getCoalescedEvents === 'function' ? native.getCoalescedEvents() : [native];
    const rect = e.currentTarget.getBoundingClientRect();
    for (const ev of events) {
      active.stroke.points.push({
        x: (ev.clientX - rect.left) / rect.width,
        y: (ev.clientY - rect.top) / rect.height,
      });
    }
    schedule();
    streamProgress();
  };

  const finishStroke = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const active = activeRef.current;
    if (!active || active.pointerId !== e.pointerId) return;
    activeRef.current = null;

    // Commit the finished stroke. A cancelled stroke is still sent: losing ink
    // is worse than an extra line, and iOS fires pointercancel routinely.
    socket.sendStroke(
      active.stroke.strokeId,
      active.stroke.color,
      active.stroke.width,
      active.stroke.points,
    );
    lastSentRef.current = { strokeId: active.stroke.strokeId, pointCount: active.stroke.points.length };
    setStrokeCount(strokesRef.current.length);
  };

  const undo = () => {
    socket.sendUndoStroke();
  };

  const secondsLeft = Math.ceil(remainingMs / 1000);
  const urgent = secondsLeft <= 10;

  return (
    <div className="draw-wrap">
      <div className="draw-head">
        <span className="draw-word">
          {category && <span className="draw-cat">{category}</span>}
          <strong>{word}</strong>
        </span>
        <span className={urgent ? 'draw-timer urgent' : 'draw-timer'} aria-live="off">
          {secondsLeft}s
        </span>
      </div>

      <canvas
        ref={canvasRef}
        className="draw-canvas"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={finishStroke}
        onPointerCancel={finishStroke}
        onPointerLeave={finishStroke}
        onContextMenu={(e) => e.preventDefault()}
      />

      <div className="draw-tools">
        <button type="button" className="tool-btn" onClick={undo} aria-label="Undo last stroke">
          Undo
        </button>
        <div className="swatches">
          {COLORS.map((c) => (
            <button
              key={c}
              type="button"
              aria-label={`Colour ${c}`}
              aria-pressed={color === c}
              className={color === c ? 'swatch active' : 'swatch'}
              style={{ background: c }}
              onClick={() => setColor(c)}
            />
          ))}
        </div>
        <div className="widths">
          {WIDTHS.map((w) => (
            <button
              key={w}
              type="button"
              aria-label={w === WIDTHS[0] ? 'Thin brush' : 'Thick brush'}
              aria-pressed={width === w}
              className={width === w ? 'width-btn active' : 'width-btn'}
              onClick={() => setWidth(w)}
            >
              <span style={{ width: w * 900, height: w * 900 }} />
            </button>
          ))}
        </div>
      </div>
      <p className="draw-meta">{strokeCount} strokes</p>
    </div>
  );
}

/** Quadratic midpoint smoothing: de-jags a polyline without a spline library. */
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
