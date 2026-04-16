'use strict';

const { ZONES, STALLS, SIM_PROFILES } = require('../config');

const ZONE_IDS  = new Set(Object.keys(ZONES));
const STALL_IDS = new Set(STALLS.map(s => s.id));

const isValidZone  = id => typeof id === 'string' && ZONE_IDS.has(id);
const isValidStall = id => typeof id === 'string' && STALL_IDS.has(id);
const isValidMode  = m  => typeof m  === 'string' && Object.prototype.hasOwnProperty.call(SIM_PROFILES, m);

function sanitizeItems(items) {
  if (!Array.isArray(items) || items.length === 0 || items.length > 20) return null;
  const cleaned = items
    .filter(i => typeof i === 'string' && i.trim().length > 0 && i.length <= 100)
    .map(i => i.trim().replace(/[<>"']/g, ''));
  return cleaned.length > 0 ? cleaned : null;
}

function sanitizeUserId(userId) {
  if (typeof userId !== 'string' || userId.length > 64) return 'guest';
  return userId.replace(/[<>"']/g, '').trim() || 'guest';
}

module.exports = { isValidZone, isValidStall, isValidMode, sanitizeItems, sanitizeUserId };
