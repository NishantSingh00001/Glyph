import { memo, useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";

// Chalk colour ramp: slate -> blue chalk -> yellow chalk -> white.
const STOPS = [[17, 20, 26], [70, 98, 190], [127, 162, 255], [255, 224, 122], [255, 250, 235]];
function chalk(t) {
  const x = Math.max(0, Math.min(0.9999, t)) * (STOPS.length - 1);
  const i = Math.floor(x), f = x - i;
  const a = STOPS[i], b = STOPS[i + 1];
  return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f];
}

function paintMap(canvas, data, [H, W, C], ch, max) {
  if (!canvas) return;
  if (canvas.width !== W) { canvas.width = W; canvas.height = H; }
  const ctx = canvas.getContext("2d");
  const img = ctx.createImageData(W, H);
  for (let i = 0; i < H * W; i++) {
    const v = data ? data[i * C + ch] / (max || 1) : 0;
    const [r, g, b] = chalk(v);
    img.data[i * 4] = r; img.data[i * 4 + 1] = g; img.data[i * 4 + 2] = b; img.data[i * 4 + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
}

function layerMax(data) {
  let m = 0;
  if (data) for (const v of data) if (v > m) m = v;
  return m;
}

function FeatureMaps({ act, shape, cols, px, kernels, label, sub }) {
  const refs = useRef([]);
  const [hover, setHover] = useState(null);
  const C = shape[2];
  useEffect(() => {
    const max = layerMax(act);
    for (let c = 0; c < C; c++) paintMap(refs.current[c], act, shape, c, max);
  }, [act, shape, C]);
  return (
    <div className="net__col" style={{ position: "relative" }}>
      <span className="label">{label}</span>
      <div className="fmaps" style={{ gridTemplateColumns: `repeat(${cols}, ${px}px)` }}>
        {Array.from({ length: C }, (_, c) => (
          <canvas key={c} ref={(el) => (refs.current[c] = el)} style={{ width: px, height: px }}
            onPointerEnter={() => setHover(c)} onPointerLeave={() => setHover(null)} />
        ))}
      </div>
      <small>{sub}</small>
      {hover != null && kernels && (
        <div style={{ position: "absolute", top: "100%", left: "50%", transform: "translate(-50%, 8px)", zIndex: 5, background: "#0f1216", border: "1px solid rgba(255,255,255,.12)", borderRadius: 12, padding: 10, width: 150, fontSize: "0.74rem", color: "var(--chalk-2)" }}>
          Filter {hover + 1}: the 3×3 pattern it learned
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 3, marginTop: 8 }}>
            {kernels[hover].map((w, i) => (
              <span key={i} style={{ aspectRatio: "1", borderRadius: 3, background: w >= 0 ? `rgba(255,224,122,${Math.min(1, Math.abs(w) / kernels.max)})` : `rgba(127,162,255,${Math.min(1, Math.abs(w) / kernels.max)})` }} />
            ))}
          </div>
          <div style={{ marginTop: 6 }}>yellow = excites · blue = inhibits</div>
        </div>
      )}
    </div>
  );
}

function Neurons({ act, cols, label, sub }) {
  const max = layerMax(act) || 1;
  const n = act ? act.length : 0;
  return (
    <div className="net__col">
      <span className="label">{label}</span>
      <div className="neurons" style={{ gridTemplateColumns: `repeat(${cols}, 12px)` }}>
        {Array.from({ length: n }, (_, i) => {
          const v = act[i] / max;
          return <i key={i} style={{ opacity: 0.08 + v * 0.92, transform: `scale(${0.7 + v * 0.45})`, background: v > 0.6 ? "var(--chalk-yellow)" : "var(--chalk)", boxShadow: v > 0.6 ? "0 0 10px rgba(255,224,122,.6)" : "none" }} />;
        })}
      </div>
      <small>{sub}</small>
    </div>
  );
}

function Outputs({ probs }) {
  const top = probs ? probs.indexOf(Math.max(...probs)) : -1;
  return (
    <div className="net__col">
      <span className="label">Softmax</span>
      <div className="outs">
        {Array.from({ length: 10 }, (_, d) => (
          <div key={d} className={`out ${d === top ? "top" : ""}`}>
            <b>{d}</b>
            <div><span style={{ width: `${probs ? probs[d] * 100 : 0}%` }} /></div>
          </div>
        ))}
      </div>
      <small>10 probabilities</small>
    </div>
  );
}

function Flow() {
  return (
    <svg className="net__arrow" width="34" height="14" viewBox="0 0 34 14" aria-hidden="true">
      <motion.path d="M1 7h28" stroke="currentColor" strokeWidth="1.5" strokeDasharray="3 4" fill="none" animate={{ strokeDashoffset: [0, -14] }} transition={{ duration: 0.8, repeat: Infinity, ease: "linear" }} />
      <path d="M26 2l6 5-6 5" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" />
    </svg>
  );
}

/** Live view of every layer while you draw. */
function NetworkView({ model, result, pixels }) {
  const inputRef = useRef(null);
  useEffect(() => {
    paintMap(inputRef.current, pixels, [28, 28, 1], 0, 1);
  }, [pixels]);
  if (!model) return <div className="skeleton" style={{ height: 300, opacity: 0.2 }} />;
  const acts = Object.fromEntries((result?.activations || []).map((a) => [a.name, a]));
  const conv1 = model.layers.find((l) => l.name === "conv1");
  let kernels = null;
  if (conv1) {
    const [kh, kw, , cout] = conv1.shape;
    kernels = Array.from({ length: cout }, (_, f) => Array.from({ length: kh * kw }, (_, i) => conv1.kernel[i * cout + f]));
    kernels.max = Math.max(...conv1.kernel.map(Math.abs));
  }
  const isCnn = model.name === "cnn";
  const hidden = model.layers.find((l) => l.name === "hidden");
  return (
    <div className="net">
      <div className="net__col">
        <span className="label">Input</span>
        <canvas ref={inputRef} width={28} height={28} style={{ width: 96, height: 96, imageRendering: "pixelated", borderRadius: 6, background: "#11141a" }} />
        <small>28 × 28 pixels</small>
      </div>
      <Flow />
      {isCnn ? (
        <>
          <FeatureMaps act={acts.conv1?.data} shape={acts.conv1?.shape || [26, 26, 16]} cols={4} px={34} kernels={kernels} label="Conv 1" sub="16 filters · edges & strokes" />
          <Flow />
          <FeatureMaps act={acts.conv2?.data} shape={acts.conv2?.shape || [11, 11, 32]} cols={8} px={20} label="Conv 2" sub="32 filters · curves & corners" />
          <Flow />
          <Neurons act={acts.hidden?.data || new Float32Array(hidden.shape[1])} cols={8} label="Dense" sub="64 neurons" />
        </>
      ) : (
        <Neurons act={acts.hidden?.data || new Float32Array(hidden.shape[1])} cols={16} label="Hidden layer" sub="128 ReLU neurons" />
      )}
      <Flow />
      <Outputs probs={result?.probs} />
    </div>
  );
}

export default memo(NetworkView);
