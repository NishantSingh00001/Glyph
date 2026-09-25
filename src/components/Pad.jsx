import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";

const INK = "#17214f";

/** Ghost "3" that writes itself while the pad is empty. */
function Hint() {
  return (
    <motion.div className="pad__hint" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, transition: { duration: 0.2 } }}>
      <svg viewBox="0 0 200 200" width="46%" aria-hidden="true">
        <motion.path
          d="M62 58c14-22 70-26 76 6 5 26-30 34-44 36 18-2 52 4 50 34-2 34-60 40-82 12"
          fill="none" stroke="rgba(23,33,79,.16)" strokeWidth="16" strokeLinecap="round" strokeLinejoin="round"
          initial={{ pathLength: 0 }} animate={{ pathLength: [0, 1, 1, 0] }}
          transition={{ duration: 4.2, times: [0, 0.45, 0.8, 1], repeat: Infinity, ease: "easeInOut" }}
        />
      </svg>
      <p>draw a digit, 0 to 9</p>
    </motion.div>
  );
}

/**
 * Drawing surface. Calls onChange(strokes) as the drawing changes.
 * ref: { clear(), undo(), strokes }
 */
const Pad = forwardRef(function Pad({ onChange, bbox, disabled }, ref) {
  const wrapRef = useRef(null);
  const canvasRef = useRef(null);
  const strokes = useRef([]);
  const drawing = useRef(null);
  const [empty, setEmpty] = useState(true);
  const [size, setSize] = useState(400);
  const sizeRef = useRef(0);

  const width = useCallback((speed) => {
    const base = size * 0.05;
    return Math.max(base * 0.55, base * (1.15 - Math.min(speed, 2.2) * 0.25));
  }, [size]);

  const redraw = useCallback(() => {
    const c = canvasRef.current;
    if (!c) return;
    const ctx = c.getContext("2d");
    ctx.clearRect(0, 0, c.width, c.height);
    for (const s of strokes.current) drawStroke(ctx, s, 0);
  }, []);

  function drawStroke(ctx, s, from) {
    ctx.strokeStyle = INK;
    ctx.fillStyle = INK;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    if (s.length === 1) {
      ctx.beginPath();
      ctx.arc(s[0].x, s[0].y, s[0].w / 2, 0, Math.PI * 2);
      ctx.fill();
      return;
    }
    for (let i = Math.max(1, from); i < s.length; i++) {
      const a = s[i - 1], b = s[i];
      const p = s[i - 2] || a;
      ctx.beginPath();
      ctx.lineWidth = (a.w + b.w) / 2;
      ctx.moveTo((p.x + a.x) / 2, (p.y + a.y) / 2);
      ctx.quadraticCurveTo(a.x, a.y, (a.x + b.x) / 2, (a.y + b.y) / 2);
      ctx.stroke();
    }
  }

  // Keep the canvas crisp on any screen density and size.
  useEffect(() => {
    const el = wrapRef.current;
    const ro = new ResizeObserver(([e]) => {
      const w = e.contentRect.width;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const c = canvasRef.current;
      const prev = sizeRef.current;
      sizeRef.current = w;
      c.width = Math.round(w * dpr);
      c.height = Math.round(w * dpr);
      c.getContext("2d").setTransform(dpr, 0, 0, dpr, 0, 0);
      if (prev && prev !== w) {
        const k = w / prev;
        strokes.current = strokes.current.map((s) => s.map((p) => ({ x: p.x * k, y: p.y * k, w: p.w * k })));
      }
      setSize(w);
      redraw();
    });
    ro.observe(el);
    return () => ro.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [redraw]);

  const emit = () => {
    setEmpty(strokes.current.length === 0);
    onChange?.(strokes.current.map((s) => s.map(({ x, y }) => ({ x, y }))));
  };

  const pos = (e) => {
    const r = canvasRef.current.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top, t: performance.now() };
  };

  const onDown = (e) => {
    if (disabled) return;
    e.preventDefault();
    canvasRef.current.setPointerCapture(e.pointerId);
    const p = pos(e);
    const s = [{ x: p.x, y: p.y, w: width(0) }];
    drawing.current = { s, last: p };
    strokes.current = [...strokes.current, s];
    drawStroke(canvasRef.current.getContext("2d"), s, 0);
    setEmpty(false);
  };
  const onMove = (e) => {
    const d = drawing.current;
    if (!d) return;
    const events = e.getCoalescedEvents ? e.getCoalescedEvents() : [e];
    const ctx = canvasRef.current.getContext("2d");
    for (const ev of events) {
      const p = pos(ev);
      const dist = Math.hypot(p.x - d.last.x, p.y - d.last.y);
      if (dist < 1.5) continue;
      const speed = dist / Math.max(1, p.t - d.last.t);
      const prevW = d.s[d.s.length - 1].w;
      d.s.push({ x: p.x, y: p.y, w: prevW * 0.7 + width(speed) * 0.3 });
      d.last = p;
      drawStroke(ctx, d.s, d.s.length - 1);
    }
    emit();
  };
  const onUp = () => {
    if (!drawing.current) return;
    drawing.current = null;
    emit();
  };

  useImperativeHandle(ref, () => ({
    clear() { strokes.current = []; redraw(); emit(); },
    undo() { strokes.current = strokes.current.slice(0, -1); redraw(); emit(); },
    get count() { return strokes.current.length; },
    get size() { return size; },
  }));

  const pad = bbox && !empty ? 0.16 * Math.max(bbox.w, bbox.h) : 0;
  return (
    <div className="pad" ref={wrapRef}>
      <span className="pad__margin" />
      <canvas ref={canvasRef} onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp} aria-label="Drawing pad. Draw a single digit with your mouse, finger or pen." role="img" />
      <AnimatePresence>{empty && <Hint key="hint" />}</AnimatePresence>
      {bbox && !empty && (
        <div className="pad__box" style={{ left: bbox.x - pad, top: bbox.y - pad, width: bbox.w + pad * 2, height: bbox.h + pad * 2 }}>
          <span>scaled to 20×20, centred in 28×28</span>
        </div>
      )}
    </div>
  );
});

export default Pad;
