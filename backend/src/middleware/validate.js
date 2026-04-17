"use strict";

const { ZONES, STALLS, SIM_PROFILES } = require("../config");

const ZONE_IDS = new Set(Object.keys(ZONES));
const STALL_IDS = new Set(STALLS.map((s) => s.id));

/**
 * Checks if the given zone ID is valid.
 * @param {string} id - The zone ID to check.
 * @returns {boolean} True if the zone exists.
 */
const isValidZone = (id) => typeof id === "string" && ZONE_IDS.has(id);

/**
 * Checks if the given stall ID is valid.
 * @param {string} id - The stall ID to check.
 * @returns {boolean} True if the stall exists.
 */
const isValidStall = (id) => typeof id === "string" && STALL_IDS.has(id);

/**
 * Checks if the given simulation mode is valid.
 * @param {string} m - The mode string to check.
 * @returns {boolean} True if the mode is valid.
 */
const isValidMode = (m) =>
  typeof m === "string" &&
  Object.prototype.hasOwnProperty.call(SIM_PROFILES, m);

/**
 * Sanitizes an array of items (e.g. food orders), stripping basic XSS vectors.
 * @param {string[]} items - The items array.
 * @returns {string[]|null} The sanitized items, or null if invalid.
 */
function sanitizeItems(items) {
  if (!Array.isArray(items) || items.length === 0 || items.length > 20)
    return null;
  const cleaned = items
    .filter(
      (i) => typeof i === "string" && i.trim().length > 0 && i.length <= 100,
    )
    .map((i) => i.trim().replace(/[<>"']/g, ""));
  return cleaned.length > 0 ? cleaned : null;
}

/**
 * Sanitizes a userId string.
 * @param {string} userId - The user ID to sanitize.
 * @returns {string} The sanitized ID, defaults to 'guest'.
 */
function sanitizeUserId(userId) {
  if (typeof userId !== "string" || userId.length > 64) return "guest";
  return userId.replace(/[<>"']/g, "").trim() || "guest";
}

module.exports = {
  isValidZone,
  isValidStall,
  isValidMode,
  sanitizeItems,
  sanitizeUserId,
};
