import { useEffect } from "react";
import { Routes, Route, useLocation, Link } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { Nav, ToastProvider } from "./components/ui.jsx";
import Studio from "./pages/Studio.jsx";
import ModelPage from "./pages/ModelPage.jsx";
import Community from "./pages/Community.jsx";
import ApiPage from "./pages/ApiPage.jsx";

function Page({ children }) {
  return (
    <motion.main initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.35, ease: [0.2, 0.9, 0.25, 1] }}>
      {children}
    </motion.main>
  );
}

function NotFound() {
  return (
    <div className="page"><div className="wrap" style={{ paddingBlock: 90 }}>
      <p className="kicker">404</p>
      <h1 className="display h1">This page is <em>blank.</em></h1>
      <p className="lead">Nothing written here yet.</p>
      <div className="row" style={{ marginTop: 24 }}><Link className="btn" to="/">Back to the pad</Link></div>
    </div></div>
  );
}

export default function App() {
  const loc = useLocation();
  useEffect(() => { window.scrollTo(0, 0); }, [loc.pathname]);
  useEffect(() => {
    const titles = { "/": "Glyph · Draw a digit", "/model": "The models · Glyph", "/community": "Community · Glyph", "/api": "API · Glyph" };
    document.title = titles[loc.pathname] || "Glyph";
  }, [loc.pathname]);
  return (
    <ToastProvider>
      <Nav />
      <AnimatePresence mode="wait">
        <Routes location={loc} key={loc.pathname}>
          <Route path="/" element={<Page><Studio /></Page>} />
          <Route path="/model" element={<Page><ModelPage /></Page>} />
          <Route path="/community" element={<Page><Community /></Page>} />
          <Route path="/api" element={<Page><ApiPage /></Page>} />
          <Route path="*" element={<Page><NotFound /></Page>} />
        </Routes>
      </AnimatePresence>
    </ToastProvider>
  );
}
