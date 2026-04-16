/**
 * helpers.js — Shared utility functions for density display, formatting, and labels.
 * Import from here, not from recharts or other third-party libs.
 */

/** @param {number} density 0–1 */
export function getDensityLevel(density) {
  if (density > 0.75) return 'critical';
  if (density > 0.50) return 'high';
  if (density > 0.25) return 'moderate';
  return 'low';
}

/** @param {number} density 0–1 → hex color string */
export function getDensityColor(density) {
  if (density > 0.75) return '#E02424';
  if (density > 0.50) return '#D03801';
  if (density > 0.25) return '#C27803';
  return '#0E9F6E';
}

/** @param {number} density 0–1 → rgba background string */
export function getDensityBg(density) {
  if (density > 0.75) return 'rgba(224,36,36,0.15)';
  if (density > 0.50) return 'rgba(208,56,1,0.13)';
  if (density > 0.25) return 'rgba(194,120,3,0.12)';
  return 'rgba(14,159,110,0.12)';
}

/** @param {number} ms Unix timestamp → "HH:MM" */
export function formatTime(ms) {
  return new Date(ms).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

/** @param {number} ms Unix timestamp → "Xs ago" or "Xm ago" */
export function timeAgo(ms) {
  const diff = Date.now() - ms;
  if (diff < 60000) return `${Math.round(diff / 1000)}s ago`;
  return `${Math.round(diff / 60000)}m ago`;
}

/** @param {number} density 0–1 → integer 0–100 */
export function pct(density) {
  return Math.round(density * 100);
}

/**
 * FIX: clampDensity — ensures density values from the API are always in [0, 1].
 * Guards against any future backend regression that sends out-of-range values.
 * @param {unknown} value
 * @returns {number}
 */
export function clampDensity(value) {
  const n = parseFloat(value);
  if (Number.isNaN(n)) return 0;
  return Math.min(1, Math.max(0, n));
}

/**
 * Canonical simulation mode → human-readable label mapping.
 * Single source of truth used by Topbar and any other component needing mode labels.
 * @param {string} mode
 * @returns {string}
 */
export function formatModeLabel(mode) {
  const LABELS = {
    normal:    'Normal',
    pre_match: 'Pre-Match',
    halftime:  'Half-Time',
    exit_rush: 'Exit Rush',
  };
  return LABELS[mode] ?? mode.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}
