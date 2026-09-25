"""
Checks that Glyph's JavaScript runtime (shared/nn.js, float16 weights)
predicts the same digits as the original TensorFlow models on all 10,000
MNIST test images.

  npm run parity      # from the repo root (runs train first if needed)
"""

import json
import subprocess
import sys
from pathlib import Path

import numpy as np
from tensorflow import keras

import train as t

ROOT = t.ROOT


def main() -> int:
    subprocess.run(["node", "scripts/js-eval.mjs"], cwd=ROOT, check=True)
    js = json.loads((ROOT / "python/data/js_eval.json").read_text())
    d = t.load_mnist()
    x = (d["test_x"].astype("float32") / 255.0)[..., None]
    y = d["test_y"]
    ok = True
    report = {}
    for name in ["dense", "cnn"]:
        model = keras.models.load_model(t.MODELS / f"{name}.keras")
        p = model.predict(x, batch_size=512, verbose=0)
        jp = np.array(js[name]["probs"], dtype="float32")
        agree = float((p.argmax(1) == jp.argmax(1)).mean())
        max_diff = float(np.abs(p - jp).max())
        tf_acc = float((p.argmax(1) == y).mean())
        js_acc = js[name]["accuracy"]
        passed = agree >= 0.999 and abs(tf_acc - js_acc) <= 0.001
        ok &= passed
        report[name] = {"agreement": agree, "maxProbDiff": max_diff, "tensorflowAccuracy": tf_acc, "jsAccuracy": js_acc, "msPerImage": js[name]["msPerImage"], "pass": passed}
        print(f"{'PASS' if passed else 'FAIL'}  {name:5}  same digit on {agree:.2%} of 10,000 images · "
              f"TF {tf_acc:.2%} vs JS {js_acc:.2%} · max prob gap {max_diff:.4f} · {js[name]['msPerImage']} ms/image in JS")
    (ROOT / "python/data/parity_report.json").write_text(json.dumps(report, indent=2))
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main())
