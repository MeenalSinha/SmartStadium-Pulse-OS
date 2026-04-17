"use strict";

/**
 * @module gemini
 * @description Vertex AI (Gemini 2.5 Flash) integration for SmartStadium Pulse OS.
 *
 * Uses Application Default Credentials (ADC) via the GCE Metadata Server,
 * which works automatically in Cloud Run, GKE, and any GCP-hosted environment.
 * Gracefully degrades to a rule-based engine when Vertex AI is unavailable
 * (local dev, missing project config, quota exhaustion, etc.).
 *
 * Responses are cached for CACHE_TTL_MS to avoid unnecessary API calls on
 * every fan-facing poll — critical for cost-efficiency at scale.
 */

const log = require("../utils/logger");

const PROJECT_ID =
  process.env.GOOGLE_CLOUD_PROJECT || process.env.GCLOUD_PROJECT || null;
const LOCATION = process.env.VERTEX_LOCATION || "us-central1";
const MODEL = "gemini-2.5-flash";
const CACHE_TTL_MS = 30_000; // 30-second cache — balances freshness with API cost

/** @type {{ insights: object|null, generatedAt: number }} */
let _cache = { insights: null, generatedAt: 0 };

const {
  VertexAI,
  HarmCategory,
  HarmBlockThreshold,
} = require("@google-cloud/vertexai");

// ─── Vertex AI SDK Setup ──────────────────────────────────────────────────────
const vertexAI = PROJECT_ID
  ? new VertexAI({ project: PROJECT_ID, location: LOCATION })
  : null;

const generativeModel = vertexAI
  ? vertexAI.getGenerativeModel({
      model: MODEL,
      generationConfig: {
        maxOutputTokens: 300,
        temperature: 0.3,
        topP: 0.95,
      },
      safetySettings: [
        {
          category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
          threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH,
        },
        {
          category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
          threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH,
        },
      ],
    })
  : null;

// ─── Vertex AI API Call ───────────────────────────────────────────────────────

/**
 * Send a single-turn prompt to Vertex AI Gemini and return the text response.
 *
 * @param {string} prompt - The natural-language prompt to send
 * @returns {Promise<string>} The model's text output
 * @throws {Error} On auth failure, network error, or non-2xx API response
 */
async function callGemini(prompt) {
  if (!generativeModel) {
    throw new Error(
      "GOOGLE_CLOUD_PROJECT env var not set — Vertex AI SDK not initialized",
    );
  }

  const request = {
    contents: [{ role: "user", parts: [{ text: prompt }] }],
  };

  const result = await generativeModel.generateContent(request);
  const text = result?.response?.candidates?.[0]?.content?.parts?.[0]?.text;

  if (!text) {
    throw new Error(
      "Vertex AI SDK returned an empty response or was blocked by safety settings",
    );
  }

  return text;
}

// ─── Fallback (rule-based) ────────────────────────────────────────────────────

/**
 * Deterministic, rule-based insight generator used when Vertex AI is
 * unavailable. Produces structurally identical output so callers are
 * decoupled from the AI availability status.
 *
 * @param {Object<string, number>} densityMap - Zone ID → density (0–1)
 * @param {string} mode - Current simulation mode
 * @returns {{ summary: string, actions: string[], source: string, model: string }}
 */
function ruleBasedInsights(densityMap, mode) {
  const entries = Object.entries(densityMap);
  const avg = entries.reduce((s, [, d]) => s + d, 0) / entries.length;
  const critical = entries.filter(([, d]) => d > 0.75).map(([id]) => id);
  const quiet = entries.filter(([, d]) => d < 0.35).map(([id]) => id);

  const modeLabels = {
    normal: "normal operations",
    pre_match: "pre-match build-up",
    halftime: "halftime surge",
    exit_rush: "exit rush",
  };
  const modeLabel = modeLabels[mode] || mode;
  const avgPct = Math.round(avg * 100);

  let summary;
  if (avg > 0.65) {
    summary = `Stadium is at ${avgPct}% average capacity during ${modeLabel}. Crowd pressure is elevated — immediate staff coordination recommended.`;
  } else if (avg > 0.4) {
    summary = `Moderate crowd levels at ${avgPct}% average density during ${modeLabel}. Active monitoring and smart routing are keeping flow controlled.`;
  } else {
    summary = `Low crowd density at ${avgPct}% average during ${modeLabel}. Stadium is flowing well — fan experience conditions are optimal.`;
  }

  const actions = [];
  if (critical.length > 0)
    actions.push(
      `Deploy additional stewards to high-density zones: ${critical.join(", ")}.`,
    );
  if (quiet.length > 0)
    actions.push(
      `Encourage crowd redistribution toward low-density zones: ${quiet.join(", ")}.`,
    );
  if (actions.length === 0)
    actions.push(
      "Continue normal operations. All zones within acceptable thresholds.",
    );

  return { summary, actions, source: "rule-based", model: "fallback" };
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Get AI-powered operational insights for the current stadium state.
 *
 * Attempts to call Vertex AI (Gemini 2.5 Flash) first. On any failure,
 * silently falls back to the rule-based engine. Results are cached for
 * CACHE_TTL_MS to control API costs.
 *
 * @param {Object<string, number>} densityMap - Zone ID → occupancy (0–1)
 * @param {string} mode - Current simulation mode
 * @returns {Promise<{ summary: string, actions: string[], source: string, model: string, cached?: boolean }>}
 */
async function getInsights(densityMap, mode) {
  const now = Date.now();

  // Return cached result if still fresh
  if (_cache.insights && now - _cache.generatedAt < CACHE_TTL_MS) {
    return { ..._cache.insights, cached: true };
  }

  const entries = Object.entries(densityMap);
  const avg = entries.reduce((s, [, d]) => s + d, 0) / entries.length;
  const topZones = entries
    .sort(([, a], [, b]) => b - a)
    .slice(0, 3)
    .map(([id, d]) => `Zone ${id} (${Math.round(d * 100)}%)`)
    .join(", ");
  const quietZones = entries
    .sort(([, a], [, b]) => a - b)
    .slice(0, 2)
    .map(([id, d]) => `Zone ${id} (${Math.round(d * 100)}%)`)
    .join(", ");

  const modeLabels = {
    normal: "Normal Operations",
    pre_match: "Pre-Match (gates open)",
    halftime: "Halftime (concourse surge)",
    exit_rush: "Exit Rush",
  };

  const prompt = [
    "You are an expert AI operations analyst for SmartStadium Pulse OS, a real-time crowd management platform.",
    "",
    `Current stadium state:`,
    `- Phase: ${modeLabels[mode] || mode}`,
    `- Average occupancy: ${Math.round(avg * 100)}%`,
    `- Busiest zones: ${topZones}`,
    `- Quietest zones: ${quietZones}`,
    "",
    "Provide exactly 2 items:",
    "1. A single, authoritative operational summary sentence (max 30 words) describing current crowd conditions.",
    "2. One specific, actionable staff recommendation starting with a verb (max 20 words).",
    "",
    "Format your response as:",
    "SUMMARY: <your summary>",
    "ACTION: <your recommendation>",
  ].join("\n");

  try {
    const rawText = await callGemini(prompt);

    // Parse structured response
    const summaryMatch = rawText.match(/SUMMARY:\s*(.+?)(?=ACTION:|$)/is);
    const actionMatch = rawText.match(/ACTION:\s*(.+)/is);

    const summary = (
      summaryMatch?.[1] ||
      rawText.split("\n")[0] ||
      rawText
    ).trim();
    const action = (
      actionMatch?.[1] ||
      rawText.split("\n")[1] ||
      "Monitor all zones."
    ).trim();

    const result = {
      summary,
      actions: [action],
      source: "vertex-ai",
      model: MODEL,
    };

    _cache = { insights: result, generatedAt: now };
    log.info(
      { mode, avgDensity: avg.toFixed(2), model: MODEL, source: "vertex-ai" },
      "Gemini stadium insights generated",
    );
    return result;
  } catch (err) {
    log.warn(
      { err: err.message },
      "Vertex AI unavailable — using rule-based fallback",
    );
    const fallback = ruleBasedInsights(densityMap, mode);
    _cache = { insights: fallback, generatedAt: now };
    return fallback;
  }
}

/**
 * Invalidate the insight cache — call this when simulation mode changes
 * so the next request gets fresh AI context reflecting the new mode.
 */
function invalidateCache() {
  _cache = { insights: null, generatedAt: 0 };
}

module.exports = { getInsights, invalidateCache };
