// GET /api/health

import { handler, json } from "../lib/http.mjs";
import { getStats } from "../lib/store.mjs";
import { aiConfigured, modelChain } from "../lib/gemini.mjs";
import { model } from "../lib/models.mjs";

export default handler(async () => {
  let storage = "ok", total = null;
  try { total = (await getStats()).total; } catch (e) { storage = "unavailable"; console.error(e); }
  return json({
    ok: storage === "ok",
    storage,
    models: { cnn: model("cnn").params, dense: model("dense").params },
    ai: aiConfigured() ? { enabled: true, model: modelChain()[0] } : { enabled: false },
    drawings: total,
    time: new Date().toISOString(),
  });
});

export const config = { path: "/api/health", method: "GET" };
