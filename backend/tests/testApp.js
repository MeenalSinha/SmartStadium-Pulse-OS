'use strict';

/**
 * testApp.js — Isolated Express app for integration tests.
 *
 * - No port binding (supertest drives through the app object directly)
 * - In-memory SQLite (no disk writes during tests)
 * - Logs suppressed
 * - Rate limiters set to 10,000/min (effectively disabled)
 * - Body-parser errors (malformed JSON, oversized body) correctly return 400
 */

process.env.NODE_ENV   = 'test';
process.env.DB_PATH    = ':memory:';
process.env.LOG_LEVEL  = 'silent';
process.env.PORT       = '0';

const express   = require('express');
const cors      = require('cors');
const helmet    = require('helmet');
const rateLimit = require('express-rate-limit');

const apiRouter = require('../src/routes/api');

function buildApp() {
  const app = express();

  app.use(helmet({ contentSecurityPolicy: false }));
  app.use(cors({ origin: '*' }));

  // json() with limit — errors are caught in the error handler below
  app.use(express.json({ limit: '50kb' }));

  // General rate limit set very high — tests must not get 429s
  app.use('/api/', rateLimit({
    windowMs: 1000, max: 10_000,
    standardHeaders: false, legacyHeaders: false,
  }));

  app.use('/api', apiRouter);

  app.use('/api/*', (_req, res) => res.status(404).json({ error: 'Not found.' }));

  // Error handler — must come last and have 4 parameters
  // Handles body-parser errors (malformed JSON → 400, body too large → 413)
  // eslint-disable-next-line no-unused-vars
  app.use((err, _req, res, _next) => {
    // express.json() body-parser errors carry a status property
    if (err.status === 400 || err.type === 'entity.parse.failed') {
      return res.status(400).json({ error: 'Invalid request body — malformed JSON.' });
    }
    if (err.status === 413 || err.type === 'entity.too.large') {
      return res.status(413).json({ error: 'Request body too large.' });
    }
    const status = err.status || err.statusCode || 500;
    res.status(status).json({ error: err.message || 'Internal error.' });
  });

  return app;
}

module.exports = { buildApp };
