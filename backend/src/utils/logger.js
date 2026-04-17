"use strict";

const pino = require("pino");
const { NODE_ENV } = require("../config");

const isTest = NODE_ENV === "test" || process.env.LOG_LEVEL === "silent";

/**
 * Structured logger — pino.
 * - test:        silent (no output, no worker threads)
 * - production:  JSON to stdout (structured, parseable by log aggregators)
 * - development: JSON to stdout (readable via `pino-pretty` pipe if desired)
 *
 * Never use console.log directly — use log.info / log.warn / log.error.
 * Every HTTP request is automatically logged with a unique req.id by pino-http.
 */
const log = pino({
  level: isTest ? "silent" : process.env.LOG_LEVEL || "info",
  // No transport worker threads — write directly to stdout
  // Run `node server.js | pino-pretty` in dev for human-readable output
  formatters: {
    level(label) {
      return { level: label };
    },
  },
  base: { service: "smartstadium-backend", env: NODE_ENV },
  timestamp: pino.stdTimeFunctions.isoTime,
});

module.exports = log;
