// POST /api/predict  { px: base64 of 784 bytes | number[784], model?: "cnn" | "dense" }

import { handler, json, fail, readJson } from "../lib/http.mjs";
import { model } from "../lib/models.mjs";
import { predict, normalizePixels, pixelsFromBase64 } from "../../shared/nn.js";

export function readPixels(px) {
  try {
    return typeof px === "string" ? pixelsFromBase64(px) : normalizePixels(px);
  } catch (e) {
    const err = new Error(e.message);
    err.status = 400;
    throw err;
  }
}

export default handler(async (req) => {
  const body = await readJson(req);
  const name = body.model || "cnn";
  const m = model(name);
  const pixels = readPixels(body.px);
  const t0 = performance.now();
  const r = predict(m, pixels);
  return json({ digit: r.digit, confidence: +r.confidence.toFixed(5), probs: r.probs.map((p) => +p.toFixed(6)), model: name, ms: +(performance.now() - t0).toFixed(2) });
});

export const config = { path: "/api/predict", method: "POST" };
