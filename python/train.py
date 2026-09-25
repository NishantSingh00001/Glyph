"""
Train Glyph's two digit classifiers on MNIST with TensorFlow / Keras and
export them for the web app.

  dense  784 -> Dense(128, relu) -> Dropout(0.2) -> Dense(10, softmax)
         The original model: Adam, 5 epochs, no augmentation.
  cnn    Conv(16,3x3) -> MaxPool -> Conv(32,3x3) -> MaxPool -> Dense(64)
         -> Dense(10). Trained with small random rotations, shifts and zooms
         so it copes better with digits drawn on a screen.

Outputs
  shared/weights/<model>.js    float16 weights (base64) used by the browser
                               and by the Netlify Functions for inference
  public/model-card.json       metrics, training curves, confusion matrices,
                               misclassified test digits, MNIST samples
  python/models/<model>.keras  the trained Keras models (not committed)

Usage
  python train.py            # trains both
  python train.py --only cnn
"""

from __future__ import annotations

import argparse
import base64
import gzip
import json
import time
import urllib.request
from pathlib import Path

import numpy as np
import tensorflow as tf
from tensorflow import keras
from tensorflow.keras import layers

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "python" / "data"
MODELS = ROOT / "python" / "models"
WEIGHTS = ROOT / "shared" / "weights"
CARD = ROOT / "public" / "model-card.json"
MIRROR = "https://raw.githubusercontent.com/fgnt/mnist/master/"
FILES = {
    "train_x": "train-images-idx3-ubyte.gz",
    "train_y": "train-labels-idx1-ubyte.gz",
    "test_x": "t10k-images-idx3-ubyte.gz",
    "test_y": "t10k-labels-idx1-ubyte.gz",
}
SEED = 42


def load_mnist():
    DATA.mkdir(parents=True, exist_ok=True)
    out = {}
    for key, name in FILES.items():
        path = DATA / name
        if not path.exists():
            print(f"downloading {name}")
            urllib.request.urlretrieve(MIRROR + name, path)
        with gzip.open(path, "rb") as f:
            raw = f.read()
        if key.endswith("_x"):
            out[key] = np.frombuffer(raw, np.uint8, offset=16).reshape(-1, 28, 28)
        else:
            out[key] = np.frombuffer(raw, np.uint8, offset=8)
    return out


def build_dense():
    return keras.Sequential(
        [
            keras.Input((28, 28, 1)),
            layers.Flatten(name="flatten"),
            layers.Dense(128, activation="relu", name="hidden"),
            layers.Dropout(0.2, name="dropout"),
            layers.Dense(10, activation="softmax", name="output"),
        ],
        name="dense",
    )


def build_cnn():
    augment = keras.Sequential(
        [
            layers.RandomRotation(0.05, fill_mode="constant", seed=SEED),
            layers.RandomTranslation(0.06, 0.06, fill_mode="constant", seed=SEED),
            layers.RandomZoom((-0.1, 0.1), fill_mode="constant", seed=SEED),
        ],
        name="augment",
    )
    return keras.Sequential(
        [
            keras.Input((28, 28, 1)),
            augment,
            layers.Conv2D(16, 3, activation="relu", name="conv1"),
            layers.MaxPooling2D(2, name="pool1"),
            layers.Conv2D(32, 3, activation="relu", name="conv2"),
            layers.MaxPooling2D(2, name="pool2"),
            layers.Flatten(name="flatten"),
            layers.Dropout(0.25, name="dropout1"),
            layers.Dense(64, activation="relu", name="hidden"),
            layers.Dropout(0.25, name="dropout2"),
            layers.Dense(10, activation="softmax", name="output"),
        ],
        name="cnn",
    )


RECIPES = {
    "dense": {"build": build_dense, "epochs": 5, "batch": 32, "label": "Dense network"},
    "cnn": {"build": build_cnn, "epochs": 24, "batch": 64, "label": "Convolutional network", "cosine": 2e-3},
}


def f16_b64(arr: np.ndarray) -> str:
    return base64.b64encode(np.ascontiguousarray(arr, dtype="<f2").tobytes()).decode()


def export_weights(model: keras.Model, name: str) -> dict:
    """Write the trainable layers as float16 base64 in a small JS module."""
    spec = []
    for layer in model.layers:
        if isinstance(layer, layers.Conv2D):
            k, b = layer.get_weights()  # k: (kh, kw, in, out)
            spec.append({"type": "conv2d", "name": layer.name, "shape": list(k.shape), "activation": layer.get_config()["activation"], "kernel": f16_b64(k), "bias": f16_b64(b)})
        elif isinstance(layer, layers.MaxPooling2D):
            spec.append({"type": "maxpool", "name": layer.name, "size": 2})
        elif isinstance(layer, layers.Flatten):
            spec.append({"type": "flatten", "name": layer.name})
        elif isinstance(layer, layers.Dense):
            k, b = layer.get_weights()  # k: (in, out)
            act = layer.get_config()["activation"]
            spec.append({"type": "dense", "name": layer.name, "shape": list(k.shape), "activation": act, "kernel": f16_b64(k), "bias": f16_b64(b)})
    WEIGHTS.mkdir(parents=True, exist_ok=True)
    body = json.dumps({"name": name, "input": [28, 28, 1], "layers": spec}, separators=(",", ":"))
    path = WEIGHTS / f"{name}.js"
    path.write_text(
        f"// Generated by python/train.py. Do not edit.\n// {name}: float16 weights, base64-encoded.\nexport default {body};\n"
    )
    return {"file": f"shared/weights/{name}.js", "bytes": path.stat().st_size}


def architecture(model: keras.Model) -> list[dict]:
    rows = []
    for layer in model.layers:
        if layer.name == "augment":
            continue
        rows.append({"name": layer.name, "type": type(layer).__name__, "output": [d for d in layer.output.shape[1:]], "params": int(layer.count_params())})
    return rows


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--only", choices=list(RECIPES), default=None)
    args = ap.parse_args()

    tf.keras.utils.set_random_seed(SEED)
    d = load_mnist()
    x_train = (d["train_x"].astype("float32") / 255.0)[..., None]
    x_test = (d["test_x"].astype("float32") / 255.0)[..., None]
    y_train, y_test = d["train_y"].astype("int64"), d["test_y"].astype("int64")
    print(f"train {x_train.shape}, test {x_test.shape}")

    card = json.loads(CARD.read_text()) if CARD.exists() else {"models": {}}
    card["dataset"] = {"name": "MNIST", "train": int(len(x_train)), "test": int(len(x_test)), "source": "Yann LeCun, Corinna Cortes, Christopher Burges"}
    # A few test digits the app can offer as "try an example".
    rng = np.random.default_rng(SEED)
    picks = [int(rng.choice(np.where(y_test == k)[0])) for k in range(10) for _ in range(2)]
    card["samples"] = [{"label": int(y_test[i]), "px": base64.b64encode(d["test_x"][i].tobytes()).decode()} for i in picks]

    MODELS.mkdir(parents=True, exist_ok=True)
    for name, r in RECIPES.items():
        if args.only and name != args.only:
            continue
        tf.keras.utils.set_random_seed(SEED)
        model = r["build"]()
        if r.get("cosine"):
            steps = int(np.ceil(len(x_train) * 0.9 / r["batch"])) * r["epochs"]
            opt = keras.optimizers.Adam(keras.optimizers.schedules.CosineDecay(r["cosine"], steps, alpha=0.02))
            opt_label = f"Adam, cosine decay from {r['cosine']}"
        else:
            opt, opt_label = "adam", "Adam (lr 0.001)"
        model.compile(optimizer=opt, loss="sparse_categorical_crossentropy", metrics=["accuracy"])
        t0 = time.time()
        hist = model.fit(x_train, y_train, epochs=r["epochs"], batch_size=r["batch"], validation_split=0.1, verbose=2)
        train_s = time.time() - t0
        loss, acc = model.evaluate(x_test, y_test, verbose=0)
        probs = model.predict(x_test, batch_size=512, verbose=0)
        pred = probs.argmax(1)
        cm = tf.math.confusion_matrix(y_test, pred, num_classes=10).numpy()
        per_class = (cm.diagonal() / cm.sum(1)).round(4).tolist()
        wrong = np.where(pred != y_test)[0]
        # the most confident mistakes are the most interesting ones to show
        wrong = wrong[np.argsort(-probs[wrong].max(1))][:24]
        misclassified = [
            {"label": int(y_test[i]), "pred": int(pred[i]), "conf": round(float(probs[i].max()), 4), "px": base64.b64encode(d["test_x"][i].tobytes()).decode()}
            for i in wrong
        ]
        model.save(MODELS / f"{name}.keras")
        exported = export_weights(model, name)
        card["models"][name] = {
            "label": r["label"],
            "epochs": r["epochs"],
            "batchSize": r["batch"],
            "optimizer": opt_label,
            "augmentation": name == "cnn",
            "trainSeconds": round(train_s, 1),
            "testAccuracy": round(float(acc), 4),
            "testLoss": round(float(loss), 4),
            "errors": int((pred != y_test).sum()),
            "params": int(model.count_params()),
            "architecture": architecture(model),
            "history": {k: [round(float(v), 4) for v in vals] for k, vals in hist.history.items()},
            "confusion": cm.tolist(),
            "perClass": per_class,
            "misclassified": misclassified,
            "weights": exported,
        }
        print(f"{name}: test accuracy {acc:.4f}, {int((pred != y_test).sum())} errors, {model.count_params():,} params, {train_s:.0f}s")

    card["generatedAt"] = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
    card["tensorflow"] = tf.__version__
    CARD.write_text(json.dumps(card, separators=(",", ":")))
    print(f"wrote {CARD.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
