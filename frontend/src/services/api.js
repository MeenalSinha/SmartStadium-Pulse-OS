const BASE = process.env.REACT_APP_API_URL || "http://localhost:3001";

async function apiFetch(path, options = {}) {
  let res;
  try {
    res = await fetch(`${BASE}${path}`, {
      headers: { "Content-Type": "application/json" },
      ...options,
    });
  } catch (networkErr) {
    throw new Error(
      `Network error: cannot reach backend at ${BASE}. Is it running?`,
    );
  }
  if (!res.ok) {
    let serverMessage = `Request failed (HTTP ${res.status})`;
    try {
      const body = await res.json();
      if (body?.error) serverMessage = body.error;
    } catch {
      /* non-JSON error body — keep default message */
    }
    const err = new Error(serverMessage);
    err.status = res.status;
    throw err;
  }
  return res.json();
}

export const api = {
  getHeatmap: () => apiFetch("/api/heatmap"),
  getZones: () => apiFetch("/api/zones"),
  getQueue: () => apiFetch("/api/queue"),
  getAlerts: () => apiFetch("/api/alerts"),
  getMetrics: () => apiFetch("/api/metrics"),
  getRecommendations: () => apiFetch("/api/recommendations"),
  getCrowdStatus: () => apiFetch("/api/crowd-status"),
  getAiInsights: () => apiFetch("/api/ai-insights"),

  getRoute: (from, to) =>
    apiFetch("/api/route", {
      method: "POST",
      body: JSON.stringify({ from, to }),
    }),

  // Auto-routing: given current zone, finds best escape route
  getBestRoute: (from) =>
    apiFetch("/api/best-route", {
      method: "POST",
      body: JSON.stringify({ from }),
    }),

  placeOrder: (stallId, items, userId) =>
    apiFetch("/api/order", {
      method: "POST",
      body: JSON.stringify({ stallId, items, userId }),
    }),

  sendStaffAlert: (zone, message, type = "warning") =>
    apiFetch("/api/alert", {
      method: "POST",
      body: JSON.stringify({ zone, message, type }),
    }),

  setSimMode: (mode) =>
    apiFetch("/api/simulate", {
      method: "POST",
      body: JSON.stringify({ mode }),
    }),
};
