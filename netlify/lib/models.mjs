// The same exported weights the browser uses, decoded once per function instance.
import { loadModel } from "../../shared/nn.js";
import cnnSpec from "../../shared/weights/cnn.js";
import denseSpec from "../../shared/weights/dense.js";
import { HttpError } from "./http.mjs";

const specs = { cnn: cnnSpec, dense: denseSpec };
const cache = {};

export function model(name = "cnn") {
  if (!specs[name]) throw new HttpError(400, 'model must be "cnn" or "dense".');
  cache[name] ??= loadModel(specs[name]);
  return cache[name];
}
