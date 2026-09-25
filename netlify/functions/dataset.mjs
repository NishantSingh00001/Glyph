// GET /api/dataset  every saved drawing as CSV (label, model, prediction, 784 pixels)

import { handler } from "../lib/http.mjs";
import { allDrawings } from "../lib/store.mjs";

export default handler(async () => {
  const rows = await allDrawings();
  const header = ["id", "created_at", "label", "model", "prediction", "confidence", ...Array.from({ length: 784 }, (_, i) => `px${i}`)].join(",");
  const lines = [header];
  for (const r of rows) {
    const bytes = Buffer.from(r.px, "base64");
    lines.push([r.id, r.at, r.label, r.model, r.pred, r.conf, ...bytes].join(","));
  }
  return new Response(lines.join("\n") + "\n", {
    headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": 'attachment; filename="glyph-community-digits.csv"', "cache-control": "no-store" },
  });
});

export const config = { path: "/api/dataset", method: "GET" };
