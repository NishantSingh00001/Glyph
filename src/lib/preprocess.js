// Turn pen strokes into a 28×28 image the way MNIST was made:
// fit the digit into a 20×20 box (keeping its aspect ratio), anti-alias it,
// then shift it so its centre of mass sits at the centre of a 28×28 frame.

const SUPER = 10; // draw at 280×280, then average down to 28×28
const BOX = 20;
const STROKE = 2.6; // stroke width in 28-pixel units (MNIST strokes are ~2–3 px)

export function strokesBBox(strokes) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const s of strokes) for (const p of s) {
    if (p.x < minX) minX = p.x; if (p.y < minY) minY = p.y;
    if (p.x > maxX) maxX = p.x; if (p.y > maxY) maxY = p.y;
  }
  if (!Number.isFinite(minX)) return null;
  return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
}

/**
 * strokes: [[{x, y}, ...], ...] in any coordinate space.
 * Returns { pixels: Float32Array(784), bbox } or null when nothing is drawn.
 */
export function strokesToMnist(strokes) {
  const bbox = strokesBBox(strokes);
  if (!bbox) return null;
  const size = Math.max(bbox.w, bbox.h);
  if (size < 4 && strokes.flat().length < 3) return null;
  const S = 28 * SUPER;
  const canvas = typeof OffscreenCanvas !== "undefined" ? new OffscreenCanvas(S, S) : Object.assign(document.createElement("canvas"), { width: S, height: S });
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, S, S);
  // Scale so the longer side spans the 20-px box (minus the stroke, which adds thickness).
  const inner = (BOX - STROKE) * SUPER;
  const scale = size > 0 ? inner / size : 1;
  const ox = (S - bbox.w * scale) / 2 - bbox.x * scale;
  const oy = (S - bbox.h * scale) / 2 - bbox.y * scale;
  ctx.strokeStyle = "#fff";
  ctx.fillStyle = "#fff";
  ctx.lineWidth = STROKE * SUPER;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  for (const s of strokes) {
    if (s.length === 1) {
      ctx.beginPath();
      ctx.arc(s[0].x * scale + ox, s[0].y * scale + oy, (STROKE * SUPER) / 2, 0, Math.PI * 2);
      ctx.fill();
      continue;
    }
    ctx.beginPath();
    ctx.moveTo(s[0].x * scale + ox, s[0].y * scale + oy);
    for (let i = 1; i < s.length - 1; i++) {
      const mx = (s[i].x + s[i + 1].x) / 2, my = (s[i].y + s[i + 1].y) / 2;
      ctx.quadraticCurveTo(s[i].x * scale + ox, s[i].y * scale + oy, mx * scale + ox, my * scale + oy);
    }
    const last = s[s.length - 1];
    ctx.lineTo(last.x * scale + ox, last.y * scale + oy);
    ctx.stroke();
  }
  const data = ctx.getImageData(0, 0, S, S).data;
  // Average 10×10 blocks down to 28×28.
  const small = new Float32Array(784);
  for (let y = 0; y < S; y++) {
    const row = Math.floor(y / SUPER) * 28;
    for (let x = 0; x < S; x++) small[row + Math.floor(x / SUPER)] += data[(y * S + x) * 4];
  }
  let mass = 0, cx = 0, cy = 0;
  for (let i = 0; i < 784; i++) {
    const v = small[i] / (SUPER * SUPER * 255);
    small[i] = v;
    mass += v; cx += (i % 28) * v; cy += Math.floor(i / 28) * v;
  }
  if (mass < 0.5) return null;
  // Centre of mass to (13.5, 13.5), like MNIST.
  const dx = Math.round(13.5 - cx / mass), dy = Math.round(13.5 - cy / mass);
  const pixels = new Float32Array(784);
  for (let y = 0; y < 28; y++) for (let x = 0; x < 28; x++) {
    const sx = x - dx, sy = y - dy;
    if (sx >= 0 && sx < 28 && sy >= 0 && sy < 28) pixels[y * 28 + x] = small[sy * 28 + sx];
  }
  return { pixels, bbox };
}

/** Paint 784 values (0..1) into a canvas as a 28×28 grayscale image. */
export function paintPixels(canvas, pixels, tint = [255, 255, 255]) {
  canvas.width = 28;
  canvas.height = 28;
  const ctx = canvas.getContext("2d");
  const img = ctx.createImageData(28, 28);
  for (let i = 0; i < 784; i++) {
    const v = pixels ? pixels[i] : 0;
    img.data[i * 4] = tint[0] * v;
    img.data[i * 4 + 1] = tint[1] * v;
    img.data[i * 4 + 2] = tint[2] * v;
    img.data[i * 4 + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
}

/** Render the drawing as a black-on-white PNG (for Gemini's second opinion). */
export function strokesToPng(strokes, size = 336) {
  const bbox = strokesBBox(strokes);
  if (!bbox) return null;
  const c = document.createElement("canvas");
  c.width = size;
  c.height = size;
  const ctx = c.getContext("2d");
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, size, size);
  const inner = size * 0.7;
  const scale = inner / Math.max(bbox.w, bbox.h, 1);
  const ox = (size - bbox.w * scale) / 2 - bbox.x * scale;
  const oy = (size - bbox.h * scale) / 2 - bbox.y * scale;
  ctx.strokeStyle = "#111";
  ctx.lineWidth = size * 0.045;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  for (const s of strokes) {
    ctx.beginPath();
    ctx.moveTo(s[0].x * scale + ox, s[0].y * scale + oy);
    for (const p of s.slice(1)) ctx.lineTo(p.x * scale + ox, p.y * scale + oy);
    if (s.length === 1) ctx.lineTo(s[0].x * scale + ox + 0.1, s[0].y * scale + oy);
    ctx.stroke();
  }
  return c.toDataURL("image/png");
}

/** Pixels (0..1) as a PNG data URL, used when a sample MNIST digit is loaded instead of a drawing. */
export function pixelsToPng(pixels, size = 336) {
  const small = document.createElement("canvas");
  paintPixels(small, pixels.map((v) => 1 - v), [255, 255, 255]);
  const c = document.createElement("canvas");
  c.width = size;
  c.height = size;
  const ctx = c.getContext("2d");
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(small, 0, 0, size, size);
  return c.toDataURL("image/png");
}
