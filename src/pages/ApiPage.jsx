import { useState } from "react";
import { motion } from "framer-motion";
import { Reveal, Footer, Digit28, useToast } from "../components/ui.jsx";
import { api } from "../lib/api.js";
import { useModelCard } from "../lib/card.js";

const ENDPOINTS = [
  ["POST", "/api/predict", "Classify a 28×28 image. Body: { px: base64 of 784 bytes, or an array of 784 numbers (0–255 or 0–1), model: \"cnn\" | \"dense\" }."],
  ["POST", "/api/drawings", "Save a labelled drawing to the community dataset. The server re-runs the model itself, so the stored prediction can't be faked."],
  ["GET", "/api/stats", "Totals, real-drawing accuracy per model, confusion matrices, and the latest 48 drawings."],
  ["GET", "/api/dataset", "Every saved drawing as CSV: label, model, prediction, 784 pixels."],
  ["POST", "/api/second-opinion", "Send a PNG of the drawing; Gemini replies with the digit it sees and why."],
  ["GET", "/api/health", "Service status and whether Gemini is configured."],
];

export default function ApiPage() {
  const card = useModelCard();
  const toast = useToast();
  const [pick, setPick] = useState(0);
  const [out, setOut] = useState(null);
  const [busy, setBusy] = useState(false);
  const sample = card?.samples[pick];
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const tryIt = async () => {
    setBusy(true);
    try {
      const t0 = performance.now();
      const r = await api.predict(sample.px, "cnn");
      setOut({ ...r, roundTripMs: Math.round(performance.now() - t0) });
    } catch (e) {
      toast(e.message, "error");
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="page">
      <div className="wrap" style={{ paddingTop: "clamp(28px,5vh,56px)" }}>
        <p className="kicker">For developers</p>
        <h1 className="display h1">The model has an <em>API</em> too.</h1>
        <p className="lead">The same weights that run in your browser also run in a Netlify Function, so any app can ask Glyph to read a digit.</p>

        <div className="grid2" style={{ marginTop: 28 }}>
          <Reveal className="sheet">
            <div className="panel-h"><div><h3>Endpoints</h3><p>JSON in, JSON out. Errors look like {"{ \"error\": \"…\" }"}.</p></div></div>
            {ENDPOINTS.map(([v, path, d]) => (
              <div key={path} className="endpoint">
                <span className={`verb verb--${v.toLowerCase()}`}>{v}</span>
                <div><code>{path}</code><p>{d}</p></div>
              </div>
            ))}
          </Reveal>
          <Reveal className="sheet" delay={0.08}>
            <div className="panel-h"><div><h3>Try it</h3><p>Pick an MNIST digit and send it to <span className="mono">/api/predict</span></p></div></div>
            {card && (
              <div className="samples">
                {card.samples.map((s, i) => (
                  <button key={i} onClick={() => { setPick(i); setOut(null); }} style={{ borderColor: i === pick ? "var(--blue)" : "transparent" }} aria-label={`Sample ${s.label}`}><Digit28 px={s.px} /></button>
                ))}
              </div>
            )}
            <div className="code" style={{ marginTop: 10 }}>
              <span className="c"># request</span>{"\n"}curl -X POST {origin}/api/predict \{"\n"}  -H <span className="s">"content-type: application/json"</span> \{"\n"}  -d <span className="s">{`'{"model":"cnn","px":"${sample ? sample.px.slice(0, 18) : ""}…"}'`}</span>
            </div>
            <div className="row" style={{ marginTop: 12 }}>
              <button className="btn btn--blue" onClick={tryIt} disabled={!sample || busy}>{busy ? <span className="spinner" /> : null} Send request <span className="arr">→</span></button>
              {out && <span className="hand" style={{ fontSize: "1.4rem", color: out.digit === sample.label ? "var(--green)" : "var(--red)" }}>{out.digit === sample.label ? `✓ read a ${out.digit}` : `✗ read ${out.digit}`}</span>}
            </div>
            {out && (
              <motion.div className="code" style={{ marginTop: 12 }} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
                <span className="c"># response · {out.roundTripMs} ms round trip</span>{"\n"}
                {JSON.stringify({ digit: out.digit, confidence: out.confidence, model: out.model, ms: out.ms, probs: "__P__" }, null, 2).replace('"__P__"', `[${out.probs.map((p) => +p.toFixed(4)).join(", ")}]`)}
              </motion.div>
            )}
          </Reveal>
        </div>
      </div>
      <Footer />
    </div>
  );
}
