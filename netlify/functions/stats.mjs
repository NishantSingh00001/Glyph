// GET /api/stats  totals, per-model accuracy on real drawings, confusion matrices, latest drawings

import { handler, json } from "../lib/http.mjs";
import { getStats, getRecent, mostConfused } from "../lib/store.mjs";

export default handler(async () => {
  const [stats, recent] = await Promise.all([getStats(), getRecent()]);
  return json({ ...stats, mostConfused: mostConfused(stats), recent });
});

export const config = { path: "/api/stats", method: "GET" };
