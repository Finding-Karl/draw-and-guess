import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * S03 — iOS touch canvas spike.
 *
 * THIS IS A THROWAWAY SPIKE. It is not product code and will not be used
 * directly in the real game (S06 builds that, talking to the server). Its only
 * job is to answer, on a real iPhone, the question that could invalidate the
 * whole project: can you draw sensibly with a finger in mobile Safari?
 *
 * ── iOS quirks hit while building this ───────────────────────────────────────
 *
 * 1. Double-tap-to-zoom. Safari zooms on rapid taps. Fixed with
 *    `touch-action: none` on the canvas element, which also stops panning and
 *    pinch-zoom on that element while leaving the rest of the page alone.
 *    `user-select: none` is needed as well or a slow drag starts a text
 *    selection instead of a stroke.
 *
 * 2. Rubber-band scroll / pull-to-refresh. Even with touch-action none on the
 *    canvas, dragging near the viewport edge can bounce the document. Fixed by
 *    making the drawing area its own fixed-height flex region and setting
 *    `overscroll-behavior: none` on html/body. On iOS < 16 overscroll-behavior
 *    is partially unsupported, so the layout must also simply not overflow.
 *
 * 3. touchcancel. iOS fires pointercancel when it decides a gesture belongs to
 *    it (e.g. the user drags from the very edge, or a system gesture wins).
 *    A stroke interrupted this way must be committed, not discarded, or the
 *    drawing silently loses ink.
 *
 * 4. 300ms tap delay / pointer events support. Modern Safari implements
 *    Pointer Events properly; we use them exclusively rather than
 *    touch+mouse pairs, which avoids double-firing strokes.
 *
 * 5. Multi-touch. A second finger landing mid-stroke previously produced a
 *    second stroke from the same start point. Fixed by tracking a single
 *    active pointerId and ignoring all others until it lifts.
 *
 * 6. High DPI. Canvas must be sized in device pixels and scaled by
 *    devicePixelRatio, then given a CSS size in CSS pixels. Forgetting this
 *    makes every line look soft. Must also be re-applied on resize AND
 *    orientation change, and the existing strokes redrawn from their stored
 *    points (canvas contents are lost when width/height is reassigned).
 *
 * 7. Visual viewport on keyboard. Not relevant here (no inputs), but noted for
 *    the real controller: iOS shrinks visualViewport, not innerHeight.
 *
 * ── What still doesn't feel right ───────────────────────────────────────────
 *
 * - Smoothing is quadratic-midpoint based. It looks good at speed but a very
 *   slow deliberate line still shows slight faceting between points. The real
 *   game should sample more aggressively at low velocity.
 * - No pressure/tilt handling. iPad pencil users get a uniform line.
 * - Undo is stroke-level only. Expected for a spike.
 */

type Point = { x: number; y: number };

type Stroke = {
  /** Owner id, so undo can remove only this player's strokes. */
  owner: string;
  color: string;
  width: number;
  points: Point[];
};

const COLORS = ['#14161a', '#dc2626', '#2563eb', '#16a34a'];
const WIDTHS = [3, 8];
const OWNER = 'me';

export default function SpikeDraw() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const strokesRef = useRef<Stroke[]>([]);
  const activeRef = useRef<{ pointerId: number; stroke: Stroke } | null>(null);
  const rafRef = useRef<number | null>(null);

  const [color, setColor] = useState(COLORS[0]!);
  const [width, setWidth] = useState(WIDTHS[1]!);
  const [strokes, setStrokes] = useState(0);
  const [lastEvent, setLastEvent] = useState('—');

  // --- rendering ------------------------------------------------------------

  const resize = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();

    // Reassigning width/height clears the canvas, so record and replay.
    canvas.width = Math.round(rect.width * dpr);
    canvas.height = Math.round(rect.height * dpr);

    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, rect.width, rect.height);

    for (const stroke of strokesRef.current) drawStroke(ctx, stroke);
  }, []);

  /** Quadratic midpoint smoothing: the standard way to de-jag a polyline. */
  const drawStroke = (ctx: CanvasRenderingContext2D, stroke: Stroke) => {
    const pts = stroke.points;
    if (pts.length === 0) return;

    ctx.strokeStyle = stroke.color;
    ctx.lineWidth = stroke.width;
    ctx.beginPath();

    if (pts.length === 1) {
      const p = pts[0]!;
      ctx.arc(p.x, p.y, stroke.width / 2, 0, Math.PI * 2);
      ctx.fillStyle = stroke.color;
      ctx.fill();
      return;
    }

    if (pts.length === 2) {
      const [a, b] = [pts[0]!, pts[1]!];
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
      return;
    }

    const first = pts[0]!;
    ctx.moveTo(first.x, first.y);

    for (let i = 1; i < pts.length - 1; i += 1) {
      const current = pts[i]!;
      const next = pts[i + 1]!;
      const midX = (current.x + next.x) / 2;
      const midY = (current.y + next.y) / 2;
      ctx.quadraticCurveTo(current.x, current.y, midX, midY);
    }

    const secondLast = pts[pts.length - 2]!;
    const last = pts[pts.length - 1]!;
    ctx.quadraticCurveTo(secondLast.x, secondLast.y, last.x, last.y);
    ctx.stroke();
  };

  const scheduleRedraw = useCallback(() => {
    if (rafRef.current !== null) return;
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = null;
      const canvas = canvasRef.current;
      const ctx = canvas?.getContext('2d');
      if (!canvas || !ctx) return;
      const dpr = window.devicePixelRatio || 1;
      const rect = canvas.getBoundingClientRect();

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, rect.width, rect.height);
      for (const stroke of strokesRef.current) drawStroke(ctx, stroke);
    });
  }, []);

  /** Replays a stroke that came from somewhere else (the S06 seam). */
  const drawRemoteStroke = useCallback(
    (stroke: Stroke) => {
      strokesRef.current.push(stroke);
      setStrokes(strokesRef.current.length);
      scheduleRedraw();
    },
    [scheduleRedraw],
  );

  // Expose the remote-draw seam for manual testing from the console.
  useEffect(() => {
    (window as unknown as Record<string, unknown>)['drawRemoteStroke'] = drawRemoteStroke;
  }, [drawRemoteStroke]);

  useEffect(() => {
    resize();
    const onResize = () => resize();
    window.addEventListener('resize', onResize);
    window.addEventListener('orientationchange', onResize);
    return () => {
      window.removeEventListener('resize', onResize);
      window.removeEventListener('orientationchange', onResize);
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [resize]);

  // --- pointer handling -----------------------------------------------------

  const pointFromEvent = (e: React.PointerEvent<HTMLCanvasElement>): Point => {
    const rect = e.currentTarget.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const onPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    // Only one stroke at a time: a second finger must not start a new line.
    if (activeRef.current) return;
    // Ignore secondary mouse buttons.
    if (e.pointerType === 'mouse' && e.button !== 0) return;

    e.currentTarget.setPointerCapture(e.pointerId);
    const stroke: Stroke = {
      owner: OWNER,
      color,
      width,
      points: [pointFromEvent(e)],
    };
    // Optimistic local render: draw immediately, do not wait for any echo.
    activeRef.current = { pointerId: e.pointerId, stroke };
    strokesRef.current.push(stroke);
    scheduleRedraw();
    setLastEvent(`down (${e.pointerType})`);
  };

  const onPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const active = activeRef.current;
    if (!active || active.pointerId !== e.pointerId) return;

    // Coalesced events give smoother input on 120Hz displays where supported.
    const native = e.nativeEvent;
    const events = typeof native.getCoalescedEvents === 'function' ? native.getCoalescedEvents() : [native];
    const rect = e.currentTarget.getBoundingClientRect();
    for (const ev of events) {
      active.stroke.points.push({ x: ev.clientX - rect.left, y: ev.clientY - rect.top });
    }
    scheduleRedraw();
  };

  const finishStroke = (e: React.PointerEvent<HTMLCanvasElement>, reason: string) => {
    const active = activeRef.current;
    if (!active || active.pointerId !== e.pointerId) return;
    activeRef.current = null;
    // A cancelled stroke is still committed — losing ink silently is worse.
    setStrokes(strokesRef.current.length);
    setLastEvent(`${reason} (${e.pointerType})`);
  };

  const undo = () => {
    for (let i = strokesRef.current.length - 1; i >= 0; i -= 1) {
      if (strokesRef.current[i]!.owner === OWNER) {
        strokesRef.current.splice(i, 1);
        break;
      }
    }
    setStrokes(strokesRef.current.length);
    scheduleRedraw();
  };

  const clearAll = () => {
    strokesRef.current = [];
    setStrokes(0);
    scheduleRedraw();
  };

  return (
    <div className="spike">
      <header className="spike-head">
        <div>
          <h1>S03 · touch canvas</h1>
          <p className="spike-sub">
            Draw with a finger. The page must not scroll or zoom. {strokes} strokes · last:{' '}
            {lastEvent}
          </p>
        </div>
        <button type="button" className="spike-btn" onClick={clearAll}>
          Clear
        </button>
      </header>

      <canvas
        ref={canvasRef}
        className="spike-canvas"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={(e) => finishStroke(e, 'up')}
        onPointerCancel={(e) => finishStroke(e, 'cancelled')}
        onPointerLeave={(e) => finishStroke(e, 'leave')}
        onContextMenu={(e) => e.preventDefault()}
      />

      <footer className="spike-tools">
        <button type="button" className="spike-btn" onClick={undo}>
          Undo
        </button>
        <div className="spike-swatches">
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
        <div className="spike-widths">
          {WIDTHS.map((w) => (
            <button
              key={w}
              type="button"
              aria-label={`Brush size ${w}`}
              aria-pressed={width === w}
              className={width === w ? 'width-btn active' : 'width-btn'}
              onClick={() => setWidth(w)}
            >
              <span style={{ width: w * 2, height: w * 2 }} />
            </button>
          ))}
        </div>
      </footer>
    </div>
  );
}
