// POST /api/second-opinion  { image: PNG data URL, modelDigit? }
// Asks Gemini (multimodal) which digit it sees, as a comparison with the CNN.

import { handler, json, fail, readJson, HttpError } from "../lib/http.mjs";
import { generate, aiConfigured } from "../lib/gemini.mjs";
import { rateLimit } from "../lib/store.mjs";

const SYSTEM = `You look at a single handwritten character drawn with a mouse or finger and say which digit (0-9) it is.
Rules:
- If it is clearly not a digit (a letter, a doodle, several characters, an empty image), answer digit -1.
- reasoning: one short, plain sentence about the strokes you see (for example "a closed loop on top with a straight tail going down"). No more than 20 words.
- Be honest about uncertainty with the confidence field.`;

const SCHEMA = {
  type: "OBJECT",
  properties: {
    digit: { type: "INTEGER", description: "0-9, or -1 if it is not a digit" },
    confidence: { type: "STRING", enum: ["high", "medium", "low"] },
    reasoning: { type: "STRING" },
  },
  required: ["digit", "confidence", "reasoning"],
};

export default handler(async (req, context) => {
  if (!aiConfigured()) return fail(503, "Gemini isn't set up on this deployment. Add GEMINI_API_KEY in Netlify.");
  const body = await readJson(req);
  const m = /^data:image\/png;base64,([A-Za-z0-9+/=]+)$/.exec(String(body.image || ""));
  if (!m) throw new HttpError(400, "Send the drawing as a PNG data URL.");
  if (m[1].length > 400_000) throw new HttpError(413, "Image too large.");
  await rateLimit(context.ip, "ai", { perHour: 20, perDay: 400 });
  const { data, model } = await generate({
    system: SYSTEM,
    prompt: "Which digit is this?",
    image: { mimeType: "image/png", data: m[1] },
    schema: SCHEMA,
    temperature: 0.2,
    maxOutputTokens: 1024,
    deadlineMs: 25000,
  });
  let digit = Number(data?.digit);
  if (!Number.isInteger(digit) || digit < -1 || digit > 9) digit = -1;
  const confidence = ["high", "medium", "low"].includes(data?.confidence) ? data.confidence : "low";
  const reasoning = String(data?.reasoning || "").trim().slice(0, 200) || "No explanation given.";
  return json({ digit, confidence, reasoning, model });
});

export const config = { path: "/api/second-opinion", method: "POST" };
