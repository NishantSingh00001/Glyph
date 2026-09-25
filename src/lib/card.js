import { useEffect, useState } from "react";

// public/model-card.json is written by python/train.py: metrics, curves,
// confusion matrices, misclassified test digits and sample digits.
let cached = null;
let pending = null;

export function loadCard() {
  if (cached) return Promise.resolve(cached);
  pending ??= fetch("/model-card.json").then((r) => r.json()).then((c) => (cached = c));
  return pending;
}

export function useModelCard() {
  const [card, setCard] = useState(cached);
  useEffect(() => {
    if (!cached) loadCard().then(setCard).catch(() => {});
  }, []);
  return card;
}
