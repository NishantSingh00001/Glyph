import { loadModel, predict } from "../../shared/nn.js";

// Weights are code-split: each model downloads only when first used.
const loaders = {
  cnn: () => import("../../shared/weights/cnn.js"),
  dense: () => import("../../shared/weights/dense.js"),
};
const cache = new Map();

export function getModel(name) {
  if (!cache.has(name)) cache.set(name, loaders[name]().then((m) => loadModel(m.default)));
  return cache.get(name);
}

export function run(model, pixels, trace = true) {
  const t0 = performance.now();
  const r = predict(model, pixels, { trace });
  return { ...r, ms: performance.now() - t0 };
}

export const MODEL_NAMES = { cnn: "CNN", dense: "Dense" };
