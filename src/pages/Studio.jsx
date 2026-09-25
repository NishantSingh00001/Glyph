import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import Pad from "../components/Pad.jsx";
import NetworkView from "../components/NetworkView.jsx";
import { Seg, useToast, Reveal, Hl, Footer, Digit28 } from "../components/ui.jsx";
import { strokesToMnist, strokesToPng, pixelsToPng, paintPixels } from "../lib/preprocess.js";
import { getModel, run } from "../lib/models.js";
import { api } from "../lib/api.js";
import { pixelsFromBase64, pixelsToBase64 } from "../../shared/nn.js";
import { useModelCard } from "../lib/card.js";

const spring = { type: "spring", stiffness: 420, damping: 30 };

function Probs({ probs }) {
  const top = probs ? probs.indexOf(Math.max(...probs)) : -1;
  return (
    <div className="probs" aria-label="Probability for each digit">
      {Array.from({ length: 10 }, (_, d) => {
        const p = probs ? probs[d] : 0;
        return (
          <div key={d} className={`prob ${d === top ? "top" : ""}`}>
            <b>{d}</b>
            <div className="prob__track"><motion.div className="prob__fill" animate={{ width: `${Math.max(0.5, p * 100)}%` }} transition={spring} /></div>
            <span>{probs ? `${(p * 100).toFixed(1)}%` : "–"}</span>
          </div>
        );
      })}
    </div>
  );
}

export default function Studio() {
  const toast = useToast();
  const card = useModelCard();
  const padRef = useRef(null);
  const seesRef = useRef(null);
  const [modelName, setModelName] = useState("cnn");
  const [model, setModel] = useState(null);
  const [strokes, setStrokes] = useState([]);
  const [input, setInput] = useState(null); // { pixels, bbox, source }
  const [result, setResult] = useState(null);
  const [mode, setMode] = useState("ask"); // ask | pick | saving | saved
  const [gemini, setGemini] = useState(null);
  const [geminiBusy, setGeminiBusy] = useState(false);
  const [aiOn, setAiOn] = useState(false);
  const [real, setReal] = useState(null);
  const frame = useRef(0);

  useEffect(() => { api.health().then((h) => setAiOn(Boolean(h.ai?.enabled))).catch(() => {}); }, []);
  useEffect(() => { api.stats().then((s) => setReal(s.models)).catch(() => {}); }, [mode === "saved"]);
  useEffect(() => {
    let alive = true;
    setModel(null);
    getModel(modelName).then((m) => alive && setModel(m)).catch(() => toast("Couldn't load the model weights.", "error"));
    return () => { alive = false; };
  }, [modelName, toast]);

  // Preprocess + predict on the next animation frame after the drawing changes.
  const onStrokes = useCallback((s) => {
    setStrokes(s);
    cancelAnimationFrame(frame.current);
    frame.current = requestAnimationFrame(() => {
      const r = strokesToMnist(s);
      setInput(r ? { ...r, source: "draw" } : null);
      setGemini(null);
      setMode("ask");
    });
  }, []);

  useEffect(() => {
    if (!model || !input) { setResult(null); return; }
    setResult(run(model, input.pixels, true));
  }, [model, input]);

  useEffect(() => {
    if (seesRef.current) paintPixels(seesRef.current, input?.pixels || null);
  }, [input]);

  const clear = () => {
    padRef.current?.clear();
    setInput(null);
    setGemini(null);
    setMode("ask");
  };

  const loadSample = (s) => {
    padRef.current?.clear();
    setStrokes([]);
    setInput({ pixels: pixelsFromBase64(s.px), bbox: null, source: "sample", label: s.label });
    setGemini(null);
    setMode("ask");
  };

  const save = async (label) => {
    if (!input || !result) return;
    setMode("saving");
    try {
      const r = await api.save(pixelsToBase64(input.pixels), label, modelName, result.digit);
      setMode("saved");
      toast(r.correct ? <>Saved. The {modelName.toUpperCase()} got it right. <b>{r.stats.total.toLocaleString()}</b> drawings so far.</> : <>Saved as a <b>{label}</b>. Thanks, this helps show where the model struggles.</>, "ok");
      setTimeout(clear, 900);
    } catch (e) {
      setMode("ask");
      toast(e.message, "error");
    }
  };

  const askGemini = async () => {
    if (!input || geminiBusy) return;
    setGeminiBusy(true);
    try {
      const image = input.source === "draw" ? strokesToPng(strokes) : pixelsToPng(input.pixels);
      setGemini(await api.secondOpinion(image, result?.digit));
    } catch (e) {
      toast(e.message, "error");
    } finally {
      setGeminiBusy(false);
    }
  };

  const conf = result ? result.confidence : 0;
  const acc = card?.models?.[modelName]?.testAccuracy;
  const options = useMemo(() => [
    { value: "cnn", label: "CNN", note: card ? `${(card.models.cnn.testAccuracy * 100).toFixed(1)}%` : "" },
    { value: "dense", label: "Dense", note: card ? `${(card.models.dense.testAccuracy * 100).toFixed(1)}%` : "" },
  ], [card]);

  return (
    <div className="page">
      <div className="wrap">
        <div className="studio-head">
          <div>
            <motion.p className="kicker" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>Handwritten digit recognition</motion.p>
            <motion.h1 className="display h1 h1--studio" initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, ease: [0.2, 0.9, 0.25, 1] }}>
              Draw a digit.<br />Watch a network <em>read</em> it.
            </motion.h1>
          </div>
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }} style={{ display: "grid", gap: 8, justifyItems: "end" }}>
            <span className="label">Model · MNIST test accuracy</span>
            <Seg id="model" value={modelName} onChange={setModelName} options={options} />
            <span className="dim" style={{ fontSize: "0.82rem" }}>
              {real && real[modelName].n
                ? <>On visitors' real drawings: <b style={{ color: "var(--ink)" }}>{((real[modelName].correct / real[modelName].n) * 100).toFixed(1)}%</b> of {real[modelName].n.toLocaleString()}</>
                : "Real-world accuracy appears once visitors label drawings"}
            </span>
          </motion.div>
        </div>

        <div className="studio">
          <motion.div className="sheet pad-card" initial={{ opacity: 0, y: 30, rotate: -1 }} animate={{ opacity: 1, y: 0, rotate: 0 }} transition={{ duration: 0.9, ease: [0.2, 0.9, 0.25, 1] }}>
            <span className="tape" />
            <Pad ref={padRef} onChange={onStrokes} bbox={input?.source === "draw" ? input.bbox : null} disabled={mode === "saving"} />
            <div className="pad__tools">
              <button className="icon-btn" onClick={() => padRef.current?.undo()} disabled={!strokes.length} aria-label="Undo last stroke" title="Undo">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 14 4 9l5-5" /><path d="M4 9h10a6 6 0 0 1 0 12h-3" /></svg>
              </button>
              <button className="btn btn--sketch btn--sm" onClick={clear} disabled={!input}>Clear</button>
              <span className="spacer" />
              <span className="hand dim" style={{ fontSize: "1.2rem" }}>{input?.source === "sample" ? `a real MNIST ${input.label}` : "one digit, big and centred"}</span>
            </div>
            {card && (
              <div style={{ marginTop: 16 }}>
                <span className="label">Or try a digit from the MNIST test set</span>
                <div className="samples" style={{ marginTop: 8 }}>
                  {card.samples.map((s, i) => (
                    <button key={i} onClick={() => loadSample(s)} aria-label={`MNIST sample of a ${s.label}`}><Digit28 px={s.px} /></button>
                  ))}
                </div>
              </div>
            )}
          </motion.div>

          <motion.div className="sheet" initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.9, delay: 0.1, ease: [0.2, 0.9, 0.25, 1] }}>
            <div className="guess">
              <div className="guess__digit">
                <AnimatePresence mode="popLayout">
                  <motion.b key={result ? result.digit : "q"} className={result ? "" : "q"} initial={{ opacity: 0, y: 30, rotate: -8, scale: 0.8 }} animate={{ opacity: 1, y: 0, rotate: 0, scale: 1 }} exit={{ opacity: 0, y: -30, rotate: 8, scale: 0.8 }} transition={spring}>
                    {result ? result.digit : "?"}
                  </motion.b>
                </AnimatePresence>
              </div>
              <div>
                <span className="label">{result ? `${modelName.toUpperCase()} is` : "Waiting for ink"}</span>
                <div className="guess__conf num">{result ? `${(conf * 100).toFixed(1)}% sure` : "–"}</div>
                <div className="meter"><motion.span animate={{ width: `${conf * 100}%`, backgroundColor: conf > 0.8 ? "#2346d4" : conf > 0.5 ? "#c98500" : "#d33f2c" }} transition={spring} /></div>
                <p className="dim" style={{ margin: "10px 0 0", fontSize: "0.84rem" }}>
                  {result ? `Ran in ${result.ms.toFixed(1)} ms, right here in your browser.` : acc ? `This model scored ${(acc * 100).toFixed(2)}% on 10,000 MNIST test digits.` : ""}
                </p>
              </div>
            </div>

            <Probs probs={result?.probs} />

            <div className="sees">
              <canvas ref={seesRef} width={28} height={28} aria-label="The 28 by 28 image the model sees" />
              <div>
                <span className="label">What the model sees</span>
                <p>Your drawing, shrunk to fit a 20×20 box and centred by its centre of mass in 28×28 pixels, just like the MNIST training images.</p>
              </div>
            </div>

            <div className="feedback">
              <AnimatePresence mode="wait">
                {!result ? (
                  <motion.p key="none" className="hand" style={{ margin: 0, fontSize: "1.35rem", color: "var(--ink-3)" }} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                    ← start drawing on the pad
                  </motion.p>
                ) : mode === "pick" ? (
                  <motion.div key="pick" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                    <div className="row"><span className="pen-note">Which digit did you draw?</span><span className="spacer" /><button className="btn btn--sketch btn--sm" onClick={() => setMode("ask")}>Back</button></div>
                    <div className="picker">
                      {Array.from({ length: 10 }, (_, d) => <button key={d} onClick={() => save(d)} disabled={d === result.digit}>{d}</button>)}
                    </div>
                  </motion.div>
                ) : (
                  <motion.div key="ask" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                    <span className="label">Did it get it right? Your answer goes into the community dataset.</span>
                    <div className="row" style={{ marginTop: 10 }}>
                      <button className="btn btn--good" onClick={() => save(result.digit)} disabled={mode !== "ask"}>
                        {mode === "saving" ? <span className="spinner" /> : "✓"} Yes, it's a {result.digit}
                      </button>
                      <button className="btn btn--bad" onClick={() => setMode("pick")} disabled={mode !== "ask"}>✗ No, it's wrong</button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
              {result && (
                <div style={{ marginTop: 14 }}>
                  <button className="btn btn--sketch btn--sm" onClick={askGemini} disabled={geminiBusy || !aiOn} title={aiOn ? "" : "Gemini isn't configured on this deployment"}>
                    {geminiBusy ? <span className="spinner spinner--ink" /> : "✦"} Second opinion from Gemini
                  </button>
                </div>
              )}
              <AnimatePresence>
                {gemini && (
                  <motion.div className="gemini" initial={{ opacity: 0, y: 12, rotate: 1 }} animate={{ opacity: 1, y: 0, rotate: 0 }} exit={{ opacity: 0 }} transition={spring}>
                    <div className="gemini__h">
                      <span>✦ {gemini.model}</span><span className="spacer" />
                      <span className="gemini__d">{gemini.digit >= 0 ? gemini.digit : "?"}</span>
                    </div>
                    <p>“{gemini.reasoning}”</p>
                    <div className="dim" style={{ fontSize: "0.8rem", marginTop: 8 }}>
                      {gemini.digit < 0 ? "Gemini doesn't think this is a digit." : gemini.digit === result?.digit ? `Agrees with the ${modelName.toUpperCase()} (${gemini.confidence} confidence).` : `Disagrees with the ${modelName.toUpperCase()}, which said ${result?.digit} (${gemini.confidence} confidence).`}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        </div>

        <Reveal className="slate">
          <div className="row" style={{ justifyContent: "space-between", alignItems: "flex-end" }}>
            <div>
              <p className="kicker">Inside the network, live</p>
              <h2 className="display h2">Every layer, <em>as you draw.</em></h2>
            </div>
            <p style={{ maxWidth: "44ch", margin: 0, color: "var(--chalk-2)", fontSize: "0.95rem" }}>
              {modelName === "cnn"
                ? "Early filters light up on edges and stroke directions; later ones respond to curves and corners. Hover a Conv 1 map to see the 3×3 pattern it learned."
                : "Each dot is one of 128 hidden neurons. Brighter means more active. The dense network sees raw pixels, with no idea which pixels are neighbours."}
            </p>
          </div>
          <NetworkView model={model} result={result} pixels={input?.pixels} />
          <div className="slate__foot">
            <span><b>{model ? model.params.toLocaleString() : "–"}</b> parameters</span>
            <span><b>{result ? `${result.ms.toFixed(1)} ms` : "–"}</b> per prediction in your browser</span>
            <span>Weights trained with <b>TensorFlow</b>, run by a 170-line JavaScript runtime</span>
          </div>
        </Reveal>

        <section className="section" style={{ paddingBottom: 20 }}>
          <Reveal>
            <p className="kicker">Why two models?</p>
            <h2 className="display h2" style={{ maxWidth: 780 }}>The dense network is the <Hl>original</Hl>. The CNN is what it grew into.</h2>
            <p className="lead" style={{ maxWidth: "62ch" }}>
              Both were trained on the same 60,000 MNIST digits. The dense network flattens the image into 784 numbers, so it can't tell which pixels are next to each other. The CNN slides small filters across the image, and was trained on slightly rotated, shifted and zoomed digits, so it copes better with handwriting on a screen.
            </p>
          </Reveal>
        </section>
      </div>
      <Footer />
    </div>
  );
}
