export class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

async function request(path, { method = "GET", body } = {}) {
  let res;
  try {
    res = await fetch(path, { method, headers: body ? { "content-type": "application/json" } : {}, body: body ? JSON.stringify(body) : undefined });
  } catch {
    throw new ApiError("Can't reach the server. Check your connection.", 0);
  }
  const text = await res.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { /* not JSON */ }
  if (!res.ok) throw new ApiError(data?.error || `Request failed (${res.status})`, res.status);
  if (data === null) throw new ApiError("Unexpected response from the server.", res.status);
  return data;
}

export const api = {
  health: () => request("/api/health"),
  stats: () => request("/api/stats"),
  predict: (px, model) => request("/api/predict", { method: "POST", body: { px, model } }),
  save: (px, label, model, clientDigit) => request("/api/drawings", { method: "POST", body: { px, label, model, clientDigit } }),
  secondOpinion: (image, modelDigit) => request("/api/second-opinion", { method: "POST", body: { image, modelDigit } }),
  datasetUrl: "/api/dataset",
};
