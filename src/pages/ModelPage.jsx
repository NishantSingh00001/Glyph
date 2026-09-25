import { motion } from "framer-motion";
import { LineChart, Confusion, DigitBars } from "../components/Charts.jsx";
import { Reveal, Hl, Footer, Digit28 } from "../components/ui.jsx";
import { useModelCard } from "../lib/card.js";

const pct = (v, d = 2) => `${(v * 100).toFixed(d)}%`;

function ModelCard({ m, name, i }) {
  const h = m.history;
  const trainAcc = h.accuracy[h.accuracy.length - 1];
  return (
    <motion.article className="sheet sheet--lift" initial={{ opacity: 0, y: 26, rotate: i ? 0.8 : -0.8 }} whileInView={{ opacity: 1, y: 0, rotate: 0 }} viewport={{ once: true }} transition={{ duration: 0.8, delay: i * 0.1, ease: [0.2, 0.9, 0.25, 1] }}>
      <div className="row" style={{ justifyContent: "space-between" }}>
        <span className="label">{name === "cnn" ? "Model B · the upgrade" : "Model A · the original"}</span>
        <span className="hand" style={{ fontSize: "1.3rem", color: name === "cnn" ? "var(--blue)" : "var(--ink-2)" }}>{name === "cnn" ? "default in the app" : "as on my résumé"}</span>
      </div>
      <h3 className="h3" style={{ marginTop: 10 }}>{m.label}</h3>
      <div className="mcard__acc num">{pct(m.testAccuracy)}</div>
      <p className="muted" style={{ margin: 0 }}>accuracy on 10,000 MNIST test digits it never saw in training · {m.errors} mistakes</p>
      <dl className="facts">
        <div><dt>Parameters</dt><dd>{m.params.toLocaleString()}</dd></div>
        <div><dt>Epochs</dt><dd>{m.epochs}</dd></div>
        <div><dt>Train time</dt><dd>{Math.round(m.trainSeconds)} s on CPU</dd></div>
        <div><dt>Optimizer</dt><dd>{m.optimizer}</dd></div>
        <div><dt>Augmentation</dt><dd>{m.augmentation ? "rotate, shift, zoom" : "none"}</dd></div>
        <div><dt>Train accuracy</dt><dd>{pct(trainAcc, 1)}{m.augmentation ? " (augmented)" : ""}</dd></div>
      </dl>
      <div className="arch">
        {m.architecture.map((l) => (
          <div key={l.name} className="arch__l">
            <b>{l.type.replace("2D", " 2D").replace("MaxPooling", "Max pool")}</b>
            <span>{l.output.join(" × ")}</span>
            <span>{l.params ? `${l.params.toLocaleString()} params` : "–"}</span>
          </div>
        ))}
      </div>
    </motion.article>
  );
}

export default function ModelPage() {
  const card = useModelCard();
  if (!card) return <div className="page"><div className="wrap" style={{ paddingBlock: 48 }}><div className="skeleton" style={{ height: 420 }} /></div></div>;
  const { cnn, dense } = card.models;
  return (
    <div className="page">
      <div className="wrap" style={{ paddingTop: "clamp(28px,5vh,56px)" }}>
        <p className="kicker">Model card</p>
        <h1 className="display h1" style={{ maxWidth: 900 }}>Two networks, <em>one test set.</em></h1>
        <p className="lead" style={{ maxWidth: "64ch" }}>
          Both models were trained with TensorFlow on MNIST's 60,000 training digits (10% held out for validation) and scored once on its separate 10,000-digit test set. The weights were exported to float16 and run by a small JavaScript runtime, which gives the same answer as TensorFlow on all 10,000 test digits.
        </p>

        <div className="compare">
          <ModelCard m={dense} name="dense" i={0} />
          <ModelCard m={cnn} name="cnn" i={1} />
        </div>

        <Reveal className="sheet" style={{ marginTop: 16 }}>
          <div className="panel-h"><div><h3>Is it overfitting?</h3><p>Training vs validation curves, per epoch</p></div></div>
          <p className="muted" style={{ marginTop: 0, maxWidth: "80ch" }}>
            A model that memorises its training data scores much higher on it than on new data. Here the validation curve tracks training closely for the dense model, and for the CNN <Hl>training accuracy stays below validation</Hl>, because it trains on randomly rotated and shifted digits that are harder than the originals.
          </p>
          <div className="grid2" style={{ marginTop: 0 }}>
            <div>
              <span className="label">Dense · accuracy</span>
              <LineChart yLabel="Dense accuracy per epoch" format={(v) => pct(v, 1)} refLine={{ value: dense.testAccuracy, label: "test" }}
                series={[{ name: "train", values: dense.history.accuracy, color: "#2346d4" }, { name: "validation", values: dense.history.val_accuracy, color: "#1d1b18", dash: true }]} />
            </div>
            <div>
              <span className="label">CNN · accuracy</span>
              <LineChart yLabel="CNN accuracy per epoch" format={(v) => pct(v, 1)} refLine={{ value: cnn.testAccuracy, label: "test" }}
                series={[{ name: "train", values: cnn.history.accuracy, color: "#2346d4" }, { name: "validation", values: cnn.history.val_accuracy, color: "#1d1b18", dash: true }]} />
            </div>
            <div>
              <span className="label">Dense · loss</span>
              <LineChart yLabel="Dense loss per epoch" series={[{ name: "train", values: dense.history.loss, color: "#d33f2c" }, { name: "validation", values: dense.history.val_loss, color: "#1d1b18", dash: true }]} />
            </div>
            <div>
              <span className="label">CNN · loss</span>
              <LineChart yLabel="CNN loss per epoch" series={[{ name: "train", values: cnn.history.loss, color: "#d33f2c" }, { name: "validation", values: cnn.history.val_loss, color: "#1d1b18", dash: true }]} />
            </div>
          </div>
        </Reveal>

        <div className="grid2">
          {[["cnn", cnn], ["dense", dense]].map(([k, m], i) => (
            <Reveal key={k} className="sheet" delay={i * 0.08}>
              <div className="panel-h"><div><h3>{k === "cnn" ? "CNN" : "Dense"} · confusion matrix</h3><p>Rows are the true digit, columns what the model said. {m.errors} mistakes in 10,000.</p></div></div>
              <Confusion matrix={m.confusion} />
            </Reveal>
          ))}
        </div>

        <div className="grid2">
          {[["cnn", cnn], ["dense", dense]].map(([k, m], i) => (
            <Reveal key={k} className="sheet" delay={i * 0.08}>
              <div className="panel-h"><div><h3>{k === "cnn" ? "CNN" : "Dense"} · accuracy per digit</h3><p>Which digits it finds hardest</p></div></div>
              <DigitBars values={m.perClass} min={0.9} color={k === "cnn" ? "var(--blue)" : "var(--ink-2)"} />
            </Reveal>
          ))}
        </div>

        <Reveal className="sheet" style={{ marginTop: 16 }}>
          <div className="panel-h"><div><h3>The CNN's most confident mistakes</h3><p>Real MNIST test digits it got wrong, most confident first. Several are hard for people too.</p></div></div>
          <div className="mistakes">
            {cnn.misclassified.slice(0, 18).map((m, i) => (
              <motion.div key={i} className="mistake" initial={{ opacity: 0, y: 14, rotate: (i % 3) - 1 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.6, delay: (i % 6) * 0.05 }}>
                <Digit28 px={m.px} />
                <p>said {m.pred}</p>
                <small>true {m.label} · {pct(m.conf, 0)} sure</small>
              </motion.div>
            ))}
          </div>
        </Reveal>

        <Reveal className="sheet" style={{ marginTop: 16, marginBottom: 20 }}>
          <div className="panel-h"><div><h3>How it was built</h3></div></div>
          <ol style={{ margin: 0, paddingLeft: "1.2em", display: "grid", gap: 8, color: "var(--ink-2)", maxWidth: "80ch" }}>
            <li><b style={{ color: "var(--ink)" }}>Train</b> with TensorFlow {card.tensorflow} / Keras in <span className="mono">python/train.py</span>: Adam optimiser, sparse categorical cross-entropy, 10% of the training set held out for validation.</li>
            <li><b style={{ color: "var(--ink)" }}>Evaluate</b> once on the 10,000-digit test set: accuracy, confusion matrix, per-digit accuracy, most confident mistakes.</li>
            <li><b style={{ color: "var(--ink)" }}>Export</b> the weights as float16, about {Math.round(cnn.weights.bytes / 1024)} KB for the CNN, into a JavaScript module.</li>
            <li><b style={{ color: "var(--ink)" }}>Serve</b> the same weights in two places: the browser (live predictions as you draw) and a Netlify Function (<span className="mono">POST /api/predict</span>).</li>
            <li><b style={{ color: "var(--ink)" }}>Verify</b> with <span className="mono">python/parity.py</span>: the JavaScript runtime and TensorFlow pick the same digit for 100% of the test set.</li>
          </ol>
        </Reveal>
      </div>
      <Footer />
    </div>
  );
}
