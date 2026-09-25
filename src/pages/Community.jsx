import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Confusion, DigitBars } from "../components/Charts.jsx";
import { Reveal, Hl, Footer, Digit28, Seg, useToast } from "../components/ui.jsx";
import { api } from "../lib/api.js";
import { useModelCard } from "../lib/card.js";

const pct = (v, d = 1) => (v == null ? "–" : `${(v * 100).toFixed(d)}%`);

function ago(iso) {
  const s = (Date.now() - Date.parse(iso)) / 1000;
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.round(s / 60)} min ago`;
  if (s < 86400) return `${Math.round(s / 3600)} h ago`;
  return `${Math.round(s / 86400)} d ago`;
}

/** MNIST test accuracy next to accuracy on visitors' drawings. */
function Gap({ card, stats }) {
  const rows = ["cnn", "dense"].map((k) => ({ k, test: card?.models[k].testAccuracy, real: stats.models[k].n ? stats.models[k].correct / stats.models[k].n : null, n: stats.models[k].n }));
  const min = 0.5;
  const w = (v) => `${Math.max(0, ((v - min) / (1 - min)) * 100)}%`;
  return (
    <div style={{ display: "grid", gap: 18 }}>
      <div className="legend">
        <span><i style={{ "--c": "var(--ink-3)", height: 10, width: 14, borderRadius: 3 }} />MNIST test set</span>
        <span><i style={{ "--c": "var(--blue)", height: 10, width: 14, borderRadius: 3 }} />Real drawings from visitors</span>
      </div>
      {rows.map((r, i) => (
        <div key={r.k} style={{ display: "grid", gridTemplateColumns: "70px minmax(0,1fr)", gap: 14, alignItems: "center" }}>
          <b style={{ fontFamily: "var(--f-display)", fontSize: "1.2rem" }}>{r.k === "cnn" ? "CNN" : "Dense"}</b>
          <div style={{ display: "grid", gap: 5 }}>
            {[["test", r.test, "var(--ink-3)"], ["real", r.real, "var(--blue)"]].map(([key, v, c]) => (
              <div key={key} style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) 140px", gap: 10, alignItems: "center" }}>
                <div style={{ height: 14, borderRadius: 4, background: "rgba(29,27,24,.05)", overflow: "hidden" }}>
                  {v != null && <motion.div initial={{ scaleX: 0 }} whileInView={{ scaleX: 1 }} viewport={{ once: true }} transition={{ duration: 1, delay: i * 0.1 + (key === "real" ? 0.15 : 0), ease: [0.2, 0.9, 0.25, 1] }} style={{ height: "100%", width: w(v), transformOrigin: "left", background: c, borderRadius: 4 }} />}
                </div>
                <span className="mono" style={{ fontSize: "0.8rem" }}>{v == null ? "no drawings yet" : pct(v, key === "test" ? 2 : 1)}{key === "real" && r.n ? <span className="dim"> · n={r.n}</span> : null}</span>
              </div>
            ))}
          </div>
        </div>
      ))}
      <div className="dim" style={{ fontSize: "0.76rem" }}>Bars start at 50%. Real-drawing accuracy counts every drawing someone confirmed or corrected.</div>
    </div>
  );
}

export default function Community() {
  const toast = useToast();
  const card = useModelCard();
  const [stats, setStats] = useState(null);
  const [err, setErr] = useState(null);
  const [which, setWhich] = useState("cnn");
  const load = useCallback(() => api.stats().then((s) => { setStats(s); setErr(null); }).catch((e) => setErr(e.message)), []);
  useEffect(() => {
    load();
    const id = setInterval(load, 20000);
    return () => clearInterval(id);
  }, [load]);

  if (err && !stats) return <div className="page"><div className="wrap" style={{ paddingBlock: 60 }}><div className="notice">{err}</div></div></div>;
  if (!stats) return <div className="page"><div className="wrap" style={{ paddingBlock: 48 }}><div className="skeleton" style={{ height: 360 }} /></div></div>;

  const m = stats.models[which];
  const perDigit = m.perDigit.n.map((n, d) => (n ? m.perDigit.correct[d] / n : null));
  const confused = stats.mostConfused;
  return (
    <div className="page">
      <div className="wrap" style={{ paddingTop: "clamp(28px,5vh,56px)" }}>
        <p className="kicker">Community dataset · live</p>
        <h1 className="display h1" style={{ maxWidth: 940 }}>How it does on <em>real</em> handwriting.</h1>
        <p className="lead" style={{ maxWidth: "62ch" }}>
          MNIST digits were written on paper by US Census staff and students in the 1990s. Digits drawn with a mouse or a finger look different. Every time someone tells Glyph whether it was right, the drawing lands here, so this page shows the <Hl>real-world accuracy</Hl>, not just the benchmark.
        </p>

        <div className="stats">
          {[
            { k: "Drawings collected", v: stats.total.toLocaleString(), p: stats.total ? `last one ${ago(stats.updatedAt)}` : "be the first" },
            { k: "CNN on real drawings", v: pct(stats.models.cnn.n ? stats.models.cnn.correct / stats.models.cnn.n : null), p: `${stats.models.cnn.n.toLocaleString()} drawings · ${pct(card?.models.cnn.testAccuracy, 2)} on MNIST` },
            { k: "Dense on real drawings", v: pct(stats.models.dense.n ? stats.models.dense.correct / stats.models.dense.n : null), p: `${stats.models.dense.n.toLocaleString()} drawings · ${pct(card?.models.dense.testAccuracy, 2)} on MNIST` },
            { k: "Most confused", v: confused ? `${confused.label} → ${confused.pred}` : "–", p: confused ? `${confused.count} time${confused.count === 1 ? "" : "s"} a ${confused.label} was read as a ${confused.pred}` : "no mistakes recorded yet" },
          ].map((s, i) => (
            <motion.div key={s.k} className="sheet sheet--lift stat" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, delay: i * 0.06 }}>
              <span className="label">{s.k}</span>
              <div className="stat__v num">{s.v}</div>
              <p>{s.p}</p>
            </motion.div>
          ))}
        </div>

        <div className="grid2">
          <Reveal className="sheet">
            <div className="panel-h"><div><h3>Benchmark vs real world</h3><p>The gap is the interesting part</p></div></div>
            <Gap card={card} stats={stats} />
          </Reveal>
          <Reveal className="sheet" delay={0.08}>
            <div className="panel-h">
              <div><h3>Accuracy per digit, real drawings</h3><p>{m.n ? `${m.n} drawings judged by visitors` : "Appears once people start drawing"}</p></div>
              <Seg id="which" value={which} onChange={setWhich} options={[{ value: "cnn", label: "CNN" }, { value: "dense", label: "Dense" }]} />
            </div>
            <DigitBars values={perDigit} min={0} counts={m.perDigit.n} color={which === "cnn" ? "var(--blue)" : "var(--ink-2)"} />
          </Reveal>
        </div>

        {m.n > 0 && (
          <Reveal className="sheet" style={{ marginTop: 16 }}>
            <div className="panel-h"><div><h3>{which === "cnn" ? "CNN" : "Dense"} · confusion on real drawings</h3><p>Rows: the digit people said they drew. Columns: what the model read.</p></div></div>
            <div style={{ maxWidth: 560 }}><Confusion matrix={m.confusion} rowsLabel="Drawn" colsLabel="Read as" /></div>
          </Reveal>
        )}

        <Reveal className="sheet" style={{ marginTop: 16 }}>
          <div className="panel-h">
            <div><h3>Latest drawings</h3><p>Green tag: the model was right. Red: it was corrected. The number is what the person drew.</p></div>
            <div className="row">
              <button className="btn btn--sketch btn--sm" onClick={() => { load(); toast("Refreshed"); }}>Refresh</button>
              <a className="btn btn--sm" href={api.datasetUrl} download>Download dataset (CSV)</a>
            </div>
          </div>
          {stats.recent.length === 0 ? (
            <div className="empty">
              <p>No drawings yet. Yours could be the first.</p>
              <Link className="btn btn--blue" to="/">Draw a digit <span className="arr">→</span></Link>
            </div>
          ) : (
            <div className="wall">
              {stats.recent.map((r, i) => (
                <motion.div key={r.id} className={`tile ${r.label === r.pred ? "" : "wrong"}`} style={{ "--r": `${((i * 37) % 7) - 3}deg` }}
                  initial={{ opacity: 0, scale: 0.8 }} whileInView={{ opacity: 1, scale: 1 }} viewport={{ once: true }} transition={{ duration: 0.4, delay: (i % 12) * 0.03 }}>
                  <Digit28 px={r.px} />
                  <span className="tile__lab">{r.label}</span>
                  <span className="tile__tip">{r.model.toUpperCase()} read {r.pred} ({pct(r.conf, 0)}) · {ago(r.at)}</span>
                </motion.div>
              ))}
            </div>
          )}
          <p className="dim" style={{ fontSize: "0.8rem", marginBottom: 0 }}>The CSV has one row per drawing: the label, the model, its prediction and 784 pixel values (0–255), ready for retraining.</p>
        </Reveal>
      </div>
      <Footer />
    </div>
  );
}
