import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { Link, NavLink, useLocation } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { api } from "../lib/api.js";

export const REPO_URL = "https://github.com/NishantSingh00001/glyph";
export const PORTFOLIO_URL = "https://nishant-singhaa0240274.netlify.app";

export function Mark({ size = 30 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" aria-hidden="true">
      <rect x="2" y="2" width="36" height="36" rx="11" fill="#1d1b18" />
      <path d="M13 13.5c2.6-3.2 11.4-3.4 12.6 1.4 1 4.2-7.6 8.4-11.2 13.3h12.4" fill="none" stroke="#fbf8f1" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="30.5" cy="10" r="3" fill="#ffd84a" />
    </svg>
  );
}

const TABS = [
  { to: "/", label: "Draw", end: true },
  { to: "/model", label: "The models" },
  { to: "/community", label: "Community" },
  { to: "/api", label: "API" },
];

/** A hand-drawn underline that "writes" itself under the active tab. */
function Scribble() {
  return (
    <svg className="tab__mark" viewBox="0 0 100 8" preserveAspectRatio="none" aria-hidden="true">
      <motion.path d="M2 5.5c18-3 34-3.6 50-2.2S84 5.8 98 3.6" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.5, ease: "easeOut" }} />
    </svg>
  );
}

export function Nav() {
  const [health, setHealth] = useState(null);
  const loc = useLocation();
  useEffect(() => { api.health().then(setHealth).catch(() => setHealth({ ok: false })); }, []);
  return (
    <>
      <header className="nav">
        <div className="wrap nav__in">
          <Link to="/" className="brand" aria-label="Glyph home"><Mark /> Glyph</Link>
          <nav className="tabs" aria-label="Primary">
            {TABS.map((t) => (
              <NavLink key={t.to} to={t.to} end={t.end} className={({ isActive }) => `tab ${isActive ? "active" : ""}`}>
                {({ isActive }) => <>{t.label}{isActive && <Scribble key={loc.pathname} />}</>}
              </NavLink>
            ))}
          </nav>
          <div className="nav__right">
            {health && (
              <span className={`status ${health.ok ? "" : "off"}`} title={health.ai?.enabled ? `Gemini: ${health.ai.model}` : "Gemini not configured"}>
                <i /> {health.ok ? `API online${health.ai?.enabled ? " · Gemini on" : ""}` : "API offline"}
              </span>
            )}
            <a className="btn btn--sm" href={REPO_URL} target="_blank" rel="noreferrer">Code ↗</a>
          </div>
        </div>
      </header>
      <nav className="mnav" aria-label="Sections">
        {TABS.map((t) => <NavLink key={t.to} to={t.to} end={t.end} className={({ isActive }) => (isActive ? "active" : "")}>{t.label}</NavLink>)}
      </nav>
    </>
  );
}

export function Footer() {
  return (
    <footer className="footer">
      <div className="wrap row">
        <span>Glyph · made by <a className="link" href={PORTFOLIO_URL} target="_blank" rel="noreferrer">Nishant Singh</a></span>
        <span className="spacer" />
        <span>Trained on MNIST (LeCun, Cortes &amp; Burges)</span>
        <span>·</span>
        <a className="link" href={REPO_URL} target="_blank" rel="noreferrer">Source</a>
      </div>
    </footer>
  );
}

export function Seg({ options, value, onChange, id }) {
  return (
    <div className="seg" role="radiogroup">
      {options.map((o) => (
        <button key={o.value} type="button" role="radio" aria-checked={value === o.value} className={value === o.value ? "on" : ""} onClick={() => onChange(o.value)}>
          {value === o.value && <motion.span layoutId={`seg-${id}`} className="seg__bg" transition={{ type: "spring", stiffness: 480, damping: 36 }} />}
          {o.label}{o.note && <small>{o.note}</small>}
        </button>
      ))}
    </div>
  );
}

export function Reveal({ children, delay = 0, className, style }) {
  return (
    <motion.div className={className} style={style} initial={{ opacity: 0, y: 22 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: "-50px" }} transition={{ duration: 0.8, delay, ease: [0.2, 0.9, 0.25, 1] }}>
      {children}
    </motion.div>
  );
}

/** Highlighter sweep that plays when the text scrolls into view. */
export function Hl({ children }) {
  return (
    <motion.span className="hl hl-anim" initial={{ backgroundSize: "0% 0.62em" }} whileInView={{ backgroundSize: "100% 0.62em" }} viewport={{ once: true }} transition={{ duration: 1, delay: 0.3, ease: [0.2, 0.9, 0.25, 1] }}>
      {children}
    </motion.span>
  );
}

const ToastCtx = createContext(() => {});
export const useToast = () => useContext(ToastCtx);
export function ToastProvider({ children }) {
  const [items, setItems] = useState([]);
  const push = useCallback((text, kind = "info") => {
    const id = Math.random().toString(36).slice(2);
    setItems((l) => [...l, { id, text, kind }]);
    setTimeout(() => setItems((l) => l.filter((t) => t.id !== id)), kind === "error" ? 6000 : 3200);
  }, []);
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="toasts" role="status" aria-live="polite">
        <AnimatePresence>
          {items.map((t) => (
            <motion.div key={t.id} className={`toast toast--${t.kind}`} initial={{ opacity: 0, y: 18, rotate: -2 }} animate={{ opacity: 1, y: 0, rotate: 0 }} exit={{ opacity: 0, y: 10 }} transition={{ type: "spring", stiffness: 380, damping: 28 }}>
              {t.text}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </ToastCtx.Provider>
  );
}

/** Tiny 28×28 image drawn from base64 bytes or floats. */
export function Digit28({ px, className, title }) {
  return (
    <canvas
      className={className}
      title={title}
      width={28}
      height={28}
      ref={(c) => {
        if (!c || !px) return;
        const ctx = c.getContext("2d");
        const img = ctx.createImageData(28, 28);
        let bytes = px;
        if (typeof px === "string") {
          const bin = atob(px);
          bytes = new Uint8Array(bin.length);
          for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
        }
        const isFloat = !(bytes instanceof Uint8Array);
        for (let i = 0; i < 784; i++) {
          const v = isFloat ? Math.round(bytes[i] * 255) : bytes[i];
          img.data[i * 4] = v; img.data[i * 4 + 1] = v; img.data[i * 4 + 2] = v; img.data[i * 4 + 3] = 255;
        }
        ctx.putImageData(img, 0, 0);
      }}
    />
  );
}
