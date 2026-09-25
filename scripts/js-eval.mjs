// Runs the exported models with shared/nn.js on the full MNIST test set.
// Used by python/parity.py (and handy on its own: `node scripts/js-eval.mjs`).
import { readFileSync, writeFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { loadModel, predict } from "../shared/nn.js";

const imgs = gunzipSync(readFileSync("python/data/t10k-images-idx3-ubyte.gz")).subarray(16);
const labels = gunzipSync(readFileSync("python/data/t10k-labels-idx1-ubyte.gz")).subarray(8);
const n = labels.length;
const out = {};
for (const name of ["dense", "cnn"]) {
  const model = loadModel((await import(`../shared/weights/${name}.js`)).default);
  const preds = new Uint8Array(n);
  const probs = [];
  let correct = 0;
  const t0 = performance.now();
  for (let i = 0; i < n; i++) {
    const px = new Float32Array(784);
    for (let j = 0; j < 784; j++) px[j] = imgs[i * 784 + j] / 255;
    const r = predict(model, px);
    preds[i] = r.digit;
    probs.push(r.probs.map((p) => +p.toFixed(6)));
    if (r.digit === labels[i]) correct++;
  }
  const ms = (performance.now() - t0) / n;
  out[name] = { accuracy: correct / n, msPerImage: +ms.toFixed(3), preds: Array.from(preds), probs };
  console.log(`${name}: ${(100 * correct / n).toFixed(2)}% on ${n} test images, ${ms.toFixed(2)} ms/image, ${model.params.toLocaleString()} params`);
}
writeFileSync("python/data/js_eval.json", JSON.stringify(out));
