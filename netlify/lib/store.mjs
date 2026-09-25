// Community dataset on Netlify Blobs.
//   stats            running totals and confusion matrices per model
//   recent           the latest 48 drawings (for the wall)
//   day/<YYYY-MM-DD> every drawing saved that day (for the CSV export)
//   limit/...        per-IP counters

import { getStore } from "@netlify/blobs";
import { createHash, randomBytes } from "node:crypto";
import { HttpError } from "./http.mjs";

const store = () => getStore({ name: "glyph", consistency: "strong" });
const zeros = () => Array.from({ length: 10 }, () => new Array(10).fill(0));
const emptyModel = () => ({ n: 0, correct: 0, confusion: zeros(), perDigit: { n: new Array(10).fill(0), correct: new Array(10).fill(0) } });

export function emptyStats() {
  return { total: 0, updatedAt: null, models: { cnn: emptyModel(), dense: emptyModel() } };
}

export async function getStats() {
  return (await store().get("stats", { type: "json" })) || emptyStats();
}

export async function getRecent() {
  return (await store().get("recent", { type: "json" })) || [];
}

export function newId() {
  return randomBytes(6).toString("base64url");
}

export async function saveDrawing(rec) {
  const s = store();
  const day = rec.at.slice(0, 10);
  const [stats, recent, dayList] = await Promise.all([
    getStats(),
    getRecent(),
    s.get(`day/${day}`, { type: "json" }).then((v) => v || []),
  ]);
  const m = stats.models[rec.model];
  m.n += 1;
  m.correct += rec.pred === rec.label ? 1 : 0;
  m.confusion[rec.label][rec.pred] += 1;
  m.perDigit.n[rec.label] += 1;
  m.perDigit.correct[rec.label] += rec.pred === rec.label ? 1 : 0;
  stats.total += 1;
  stats.updatedAt = rec.at;
  recent.unshift(rec);
  dayList.push(rec);
  await Promise.all([
    s.setJSON("stats", stats),
    s.setJSON("recent", recent.slice(0, 48)),
    s.setJSON(`day/${day}`, dayList),
  ]);
  return stats;
}

export async function allDrawings() {
  const s = store();
  const { blobs } = await s.list({ prefix: "day/" });
  const days = blobs.map((b) => b.key).sort();
  const lists = await Promise.all(days.map((k) => s.get(k, { type: "json" })));
  return lists.flat().filter(Boolean);
}

export function mostConfused(stats) {
  let best = null;
  for (const m of Object.values(stats.models)) {
    m.confusion.forEach((row, label) => row.forEach((count, pred) => {
      if (label !== pred && count > 0 && (!best || count > best.count)) best = { label, pred, count };
    }));
  }
  return best;
}

const hash = (v) => createHash("sha256").update(String(v || "unknown")).digest("hex").slice(0, 16);

/** Fixed-window limiter. kind: "save" or "ai". */
export async function rateLimit(ip, kind, { perHour, perDay }) {
  const s = store();
  const now = new Date().toISOString();
  const hourKey = `limit/${kind}/ip/${hash(ip)}/${now.slice(0, 13)}`;
  const dayKey = `limit/${kind}/day/${now.slice(0, 10)}`;
  const [h, d] = await Promise.all([s.get(hourKey, { type: "json" }), s.get(dayKey, { type: "json" })]);
  if ((h || 0) >= perHour) throw new HttpError(429, kind === "ai" ? "You've used this hour's Gemini requests. Try again later." : "That's a lot of drawings for one hour! Try again a bit later.");
  if ((d || 0) >= perDay) throw new HttpError(429, kind === "ai" ? "Today's Gemini budget for this demo is used up." : "The dataset has hit today's limit. Come back tomorrow.");
  await Promise.all([s.setJSON(hourKey, (h || 0) + 1), s.setJSON(dayKey, (d || 0) + 1)]);
}
