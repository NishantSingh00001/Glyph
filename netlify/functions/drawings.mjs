// POST /api/drawings  { px: base64 (784 bytes), label: 0-9, model: "cnn" | "dense", clientDigit? }
// Saves a labelled drawing. The prediction is recomputed here so it can't be spoofed.

import { handler, json, readJson, HttpError } from "../lib/http.mjs";
import { model } from "../lib/models.mjs";
import { saveDrawing, rateLimit, newId } from "../lib/store.mjs";
import { predict, pixelsToBase64 } from "../../shared/nn.js";
import { readPixels } from "./predict.mjs";

export default handler(async (req, context) => {
  const body = await readJson(req);
  const label = Number(body.label);
  if (!Number.isInteger(label) || label < 0 || label > 9) throw new HttpError(400, "label must be a digit from 0 to 9.");
  const name = body.model === "dense" ? "dense" : "cnn";
  const pixels = readPixels(body.px);
  let ink = 0;
  for (const v of pixels) ink += v;
  if (ink < 8) throw new HttpError(422, "That drawing is almost empty.");
  await rateLimit(context.ip, "save", { perHour: 120, perDay: 3000 });
  const r = predict(model(name), pixels);
  const rec = { id: newId(), at: new Date().toISOString(), label, pred: r.digit, conf: +r.confidence.toFixed(4), model: name, px: pixelsToBase64(pixels) };
  const stats = await saveDrawing(rec);
  return json({ id: rec.id, pred: rec.pred, correct: rec.pred === label, stats: { total: stats.total } }, 201);
});

export const config = { path: "/api/drawings", method: "POST" };
