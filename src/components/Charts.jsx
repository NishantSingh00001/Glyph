import { useRef, useState } from "react";
import { motion } from "framer-motion";

function useWidth(initial = 460) {
  const [w, setW] = useState(initial);
  const obs = useRef(null);
  const ref = (el) => {
    if (!el || obs.current?.el === el) return;
    obs.current?.ro.disconnect();
    const ro = new ResizeObserver(([e]) => setW(Math.max(240, e.contentRect.width)));
    ro.observe(el);
    obs.current = { el, ro };
  };
  return [ref, w];
}

/**
 * Line chart for training curves. series: [{ name, values, color, dash }].
 * ref: optional horizontal reference line { value, label }.
 */
export function LineChart({ series, yLabel, format = (v) => v.toFixed(3), domain, refLine, height = 210 }) {
  const [ref, w] = useWidth();
  const [hover, setHover] = useState(null);
  const pad = { l: 46, r: 16, t: 14, b: 28 };
  const n = Math.max(...series.map((s) => s.values.length));
  const all = series.flatMap((s) => s.values).concat(refLine ? [refLine.value] : []);
  let [lo, hi] = domain || [Math.min(...all), Math.max(...all)];
  const span = hi - lo || 1;
  lo -= span * 0.08; hi += span * 0.08;
  const x = (i) => pad.l + (n <= 1 ? 0 : (i / (n - 1)) * (w - pad.l - pad.r));
  const y = (v) => pad.t + (1 - (v - lo) / (hi - lo)) * (height - pad.t - pad.b);
  const ticks = Array.from({ length: 4 }, (_, i) => lo + ((hi - lo) * (i + 0.5)) / 4);
  const xticks = n > 12 ? [0, Math.floor(n / 4), Math.floor(n / 2), Math.floor((3 * n) / 4), n - 1] : Array.from({ length: n }, (_, i) => i);
  return (
    <div ref={ref} style={{ position: "relative" }}>
      <div className="legend">
        {series.map((s) => <span key={s.name}><i className={s.dash ? "dash" : ""} style={{ "--c": s.color }} />{s.name}</span>)}
        {refLine && <span><i className="dash" style={{ "--c": "#1d8047" }} />{refLine.label}</span>}
      </div>
      <svg className="chart" width={w} height={height} role="img" aria-label={yLabel}
        onPointerMove={(e) => {
          const r = e.currentTarget.getBoundingClientRect();
          const i = Math.round(((e.clientX - r.left - pad.l) / (w - pad.l - pad.r)) * (n - 1));
          setHover(i >= 0 && i < n ? i : null);
        }}
        onPointerLeave={() => setHover(null)}>
        <g className="gridl">{ticks.map((t) => <line key={t} x1={pad.l} x2={w - pad.r} y1={y(t)} y2={y(t)} />)}</g>
        {ticks.map((t) => <text key={t} x={pad.l - 8} y={y(t) + 3} textAnchor="end">{format(t)}</text>)}
        {xticks.map((i) => <text key={i} x={x(i)} y={height - 8} textAnchor="middle">{i + 1}</text>)}
        {refLine && <line x1={pad.l} x2={w - pad.r} y1={y(refLine.value)} y2={y(refLine.value)} stroke="#1d8047" strokeWidth={1.5} strokeDasharray="2 4" />}
        {series.map((s, si) => (
          <motion.path key={s.name} d={s.values.map((v, i) => `${i ? "L" : "M"}${x(i)},${y(v)}`).join("")} fill="none" stroke={s.color} strokeWidth={2.2} strokeLinejoin="round" strokeLinecap="round" strokeDasharray={s.dash ? "6 5" : undefined}
            initial={{ pathLength: 0, opacity: 0 }} whileInView={{ pathLength: 1, opacity: 1 }} viewport={{ once: true }} transition={{ duration: 1.3, delay: si * 0.15, ease: "easeInOut" }} />
        ))}
        {hover != null && (
          <g>
            <line x1={x(hover)} x2={x(hover)} y1={pad.t} y2={height - pad.b} stroke="rgba(29,27,24,.3)" />
            {series.map((s) => s.values[hover] != null && <circle key={s.name} cx={x(hover)} cy={y(s.values[hover])} r={4.5} fill="#fbf8f1" stroke={s.color} strokeWidth={2} />)}
          </g>
        )}
      </svg>
      {hover != null && (
        <div className="chart-tip" style={{ left: x(hover), top: pad.t + 20 }}>
          Epoch {hover + 1} · {series.map((s) => `${s.name} ${s.values[hover] != null ? format(s.values[hover]) : "–"}`).join(" · ")}
        </div>
      )}
    </div>
  );
}

/** 10×10 confusion matrix: correct counts on the diagonal (blue), mistakes off it (red). */
export function Confusion({ matrix, rowsLabel = "True digit", colsLabel = "Predicted" }) {
  const [tip, setTip] = useState(null);
  const off = matrix.flatMap((r, i) => r.filter((_, j) => j !== i));
  const maxOff = Math.max(1, ...off);
  const maxDiag = Math.max(1, ...matrix.map((r, i) => r[i]));
  return (
    <div style={{ position: "relative" }}>
      <div className="row dim" style={{ fontSize: "0.78rem", justifyContent: "space-between", marginBottom: 6 }}>
        <span>↓ {rowsLabel}</span><span>{colsLabel} →</span>
      </div>
      <div className="cm" role="table">
        <span />
        {Array.from({ length: 10 }, (_, j) => <span key={j} className="cm__h">{j}</span>)}
        {matrix.map((row, i) => (
          <FragmentRow key={i}>
            <span className="cm__h">{i}</span>
            {row.map((v, j) => {
              const diag = i === j;
              const bg = !v ? "rgba(29,27,24,.03)" : diag ? `rgba(35,70,212,${0.18 + 0.82 * (v / maxDiag)})` : `rgba(211,63,44,${0.1 + 0.9 * Math.sqrt(v / maxOff)})`;
              const fg = diag ? "#fff" : v / maxOff > 0.45 ? "#fff" : "var(--ink-2)";
              return (
                <span key={j} className="cm__c" style={{ background: bg, color: fg }}
                  onPointerEnter={() => setTip({ i, j, v })} onPointerLeave={() => setTip(null)}>
                  {v || ""}
                </span>
              );
            })}
          </FragmentRow>
        ))}
      </div>
      {tip && (
        <div className="chart-tip" style={{ left: "50%", top: 0 }}>
          {tip.i === tip.j ? `${tip.v.toLocaleString()} ${tip.i}s read correctly` : `${tip.v} time${tip.v === 1 ? "" : "s"} a ${tip.i} was read as a ${tip.j}`}
        </div>
      )}
    </div>
  );
}

function FragmentRow({ children }) {
  return <>{children}</>;
}

/** Horizontal bars for accuracy per digit. */
export function DigitBars({ values, format = (v) => `${(v * 100).toFixed(1)}%`, min = 0.9, color = "var(--blue)", counts }) {
  return (
    <div style={{ display: "grid", gap: 7 }}>
      {values.map((v, d) => (
        <div key={d} style={{ display: "grid", gridTemplateColumns: "22px minmax(0,1fr) 92px", gap: 10, alignItems: "center" }}>
          <b style={{ fontFamily: "var(--f-display)", textAlign: "center", fontWeight: 560 }}>{d}</b>
          <div style={{ height: 12, borderRadius: 4, background: "rgba(29,27,24,.05)", overflow: "hidden" }}>
            {v != null && (
              <motion.div initial={{ scaleX: 0 }} whileInView={{ scaleX: 1 }} viewport={{ once: true }} transition={{ duration: 0.9, delay: d * 0.04, ease: [0.2, 0.9, 0.25, 1] }}
                style={{ height: "100%", borderRadius: 4, background: color, transformOrigin: "left", width: `${Math.max(2, ((v - min) / (1 - min)) * 100)}%` }} />
            )}
          </div>
          <span className="mono" style={{ fontSize: "0.76rem", textAlign: "right", color: "var(--ink-2)" }}>
            {v == null ? "no data" : format(v)}{counts ? <span className="dim"> · {counts[d]}</span> : null}
          </span>
        </div>
      ))}
      <div className="dim" style={{ fontSize: "0.74rem" }}>Bars start at {(min * 100).toFixed(0)}% so small differences are visible.</div>
    </div>
  );
}
