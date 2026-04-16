'use strict';

const crypto = require('crypto');
// Read config object (not destructured value) so tests can mutate config.ADMIN_API_KEY
const config = require('../config');
const log    = require('../utils/logger');

/**
 * requireAdminKey — Express middleware that enforces X-Admin-Key header
 * on sensitive mutation endpoints (/api/simulate).
 *
 * In production: set ADMIN_API_KEY to a random 32+ char secret.
 * Clients send: X-Admin-Key: <secret>
 */
function requireAdminKey(req, res, next) {
  const ADMIN_API_KEY = config.ADMIN_API_KEY;
  if (!ADMIN_API_KEY) {
    // Failing closed if no key configured
    log.error('ADMIN_API_KEY is not set — refusing admin endpoint access for security.');
    return res.status(500).json({ error: 'Server configuration error.' });
  }

  const provided = req.headers['x-admin-key'];
  if (!provided) {
    return res.status(401).json({ error: 'Missing X-Admin-Key header.' });
  }

  // Uses Node's builtin crypto.timingSafeEqual which is actually timing safe
  const bufferA = Buffer.from(provided, 'utf8');
  const bufferB = Buffer.from(ADMIN_API_KEY, 'utf8');

  let isEqual = false;
  try {
    // Use length check to avoid buffer length mismatch errors thrown by crypto
    if (bufferA.length === bufferB.length) {
      isEqual = crypto.timingSafeEqual(bufferA, bufferB);
    }
  } catch (_err) {
    // Handle any crypto errors gracefully
  }

  if (!isEqual) {
    log.warn({ ip: req.ip, path: req.path }, 'Admin auth failed — invalid key');
    return res.status(403).json({ error: 'Invalid admin key.' });
  }

  next();
}

module.exports = { requireAdminKey };
