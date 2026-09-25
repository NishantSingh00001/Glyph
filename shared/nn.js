// A tiny neural-network runtime for Glyph's two Keras models.
//
// It runs the exported layers (conv2d, maxpool, flatten, dense) directly,
// so the browser needs no ML library and the Netlify Functions can serve the
// same model. It can also return every layer's activations, which is what
// the "Inside the network" view draws. python/parity.py checks its output
// against TensorFlow.

function bytesFromBase64(b64) {
  if (typeof Buffer !== "undefined") return new Uint8Array(Buffer.from(b64, "base64"));
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function halfToFloat(h) {
  const s = h & 0x8000 ? -1 : 1;
  const e = (h >> 10) & 0x1f;
  const f = h & 0x3ff;
  if (e === 0) return s * 2 ** -14 * (f / 1024);
  if (e === 31) return f ? NaN : s * Infinity;
  return s * 2 ** (e - 15) * (1 + f / 1024);
}

export function decodeF16(b64) {
  const bytes = bytesFromBase64(b64);
  const n = bytes.length / 2;
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) out[i] = halfToFloat(bytes[2 * i] | (bytes[2 * i + 1] << 8));
  return out;
}

/** Decode an exported model once; the result is reused for every prediction. */
export function loadModel(spec) {
  const layers = spec.layers.map((l) => {
    if (l.type === "conv2d" || l.type === "dense") {
      return { ...l, kernel: decodeF16(l.kernel), bias: decodeF16(l.bias), activation: l.activation || "relu" };
    }
    return { ...l };
  });
  const params = layers.reduce((s, l) => s + (l.kernel ? l.kernel.length + l.bias.length : 0), 0);
  return { name: spec.name, input: spec.input, layers, params };
}

function relu(a) {
  for (let i = 0; i < a.length; i++) if (a[i] < 0) a[i] = 0;
  return a;
}

function softmax(a) {
  let max = -Infinity;
  for (const v of a) if (v > max) max = v;
  let sum = 0;
  for (let i = 0; i < a.length; i++) { a[i] = Math.exp(a[i] - max); sum += a[i]; }
  for (let i = 0; i < a.length; i++) a[i] /= sum;
  return a;
}

// "valid" 2D convolution, stride 1, channels-last (same layout as Keras).
function conv2d(x, [H, W, C], layer) {
  const [kh, kw, cin, cout] = layer.shape;
  const oh = H - kh + 1, ow = W - kw + 1;
  const out = new Float32Array(oh * ow * cout);
  const k = layer.kernel, b = layer.bias;
  for (let y = 0; y < oh; y++) {
    for (let xx = 0; xx < ow; xx++) {
      const o = (y * ow + xx) * cout;
      for (let co = 0; co < cout; co++) out[o + co] = b[co];
      for (let dy = 0; dy < kh; dy++) {
        for (let dx = 0; dx < kw; dx++) {
          const ib = ((y + dy) * W + (xx + dx)) * C;
          const kb = (dy * kw + dx) * cin * cout;
          for (let ci = 0; ci < cin; ci++) {
            const v = x[ib + ci];
            if (v === 0) continue;
            const kr = kb + ci * cout;
            for (let co = 0; co < cout; co++) out[o + co] += v * k[kr + co];
          }
        }
      }
    }
  }
  return { data: layer.activation === "relu" ? relu(out) : out, shape: [oh, ow, cout] };
}

function maxpool(x, [H, W, C], size = 2) {
  const oh = Math.floor(H / size), ow = Math.floor(W / size);
  const out = new Float32Array(oh * ow * C).fill(-Infinity);
  for (let y = 0; y < oh * size; y++) {
    for (let xx = 0; xx < ow * size; xx++) {
      const o = (Math.floor(y / size) * ow + Math.floor(xx / size)) * C;
      const i = (y * W + xx) * C;
      for (let c = 0; c < C; c++) if (x[i + c] > out[o + c]) out[o + c] = x[i + c];
    }
  }
  return { data: out, shape: [oh, ow, C] };
}

function dense(x, layer) {
  const [nin, nout] = layer.shape;
  const out = Float32Array.from(layer.bias);
  const k = layer.kernel;
  for (let i = 0; i < nin; i++) {
    const v = x[i];
    if (v === 0) continue;
    const r = i * nout;
    for (let j = 0; j < nout; j++) out[j] += v * k[r + j];
  }
  if (layer.activation === "relu") relu(out);
  else if (layer.activation === "softmax") softmax(out);
  return out;
}

/**
 * Run the model on a 28×28 image.
 * pixels: 784 values in [0, 1] (row-major, white digit on black, like MNIST).
 * Returns { probs, digit, confidence, activations? }.
 */
export function predict(model, pixels, { trace = false } = {}) {
  let x = pixels instanceof Float32Array ? pixels : Float32Array.from(pixels);
  let shape = [28, 28, 1];
  const activations = [];
  for (const layer of model.layers) {
    if (layer.type === "conv2d") ({ data: x, shape } = conv2d(x, shape, layer));
    else if (layer.type === "maxpool") ({ data: x, shape } = maxpool(x, shape, layer.size));
    else if (layer.type === "flatten") shape = [x.length];
    else if (layer.type === "dense") { x = dense(x, layer); shape = [x.length]; }
    if (trace && layer.type !== "flatten") activations.push({ name: layer.name, type: layer.type, shape, data: x });
  }
  const probs = x;
  let digit = 0;
  for (let i = 1; i < probs.length; i++) if (probs[i] > probs[digit]) digit = i;
  return { probs: Array.from(probs), digit, confidence: probs[digit], activations: trace ? activations : undefined };
}

/** Accept 784 bytes (0–255) or floats (0–1) and return floats in [0, 1]. */
export function normalizePixels(input) {
  if (!input || input.length !== 784) throw new Error("Expected 784 pixel values (a 28×28 image).");
  const out = new Float32Array(784);
  let max = 0;
  for (let i = 0; i < 784; i++) {
    const v = Number(input[i]);
    if (!Number.isFinite(v) || v < 0) throw new Error("Pixel values must be numbers ≥ 0.");
    out[i] = v;
    if (v > max) max = v;
  }
  if (max > 1) for (let i = 0; i < 784; i++) out[i] = Math.min(255, out[i]) / 255;
  return out;
}

export function pixelsToBase64(pixels) {
  const bytes = new Uint8Array(784);
  for (let i = 0; i < 784; i++) bytes[i] = Math.round(Math.max(0, Math.min(1, pixels[i])) * 255);
  if (typeof Buffer !== "undefined") return Buffer.from(bytes).toString("base64");
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s);
}

export function pixelsFromBase64(b64) {
  const bytes = bytesFromBase64(b64);
  if (bytes.length !== 784) throw new Error("Expected 784 bytes.");
  const out = new Float32Array(784);
  for (let i = 0; i < 784; i++) out[i] = bytes[i] / 255;
  return out;
}
