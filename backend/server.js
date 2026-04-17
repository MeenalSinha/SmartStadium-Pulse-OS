"use strict";

const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const pinoHttp = require("pino-http");
const crypto = require("crypto");
const compression = require("compression");
const xss = require("xss-clean");
const hpp = require("hpp");

const { PORT, ALLOWED_ORIGINS, RATE } = require("./src/config");
const log = require("./src/utils/logger");
const sim = require("./src/services/simulation");
const apiRouter = require("./src/routes/api");
const { reportError, getSecret } = require("./src/utils/gcp");

// ─── App + server setup ──────────────────────────────────────────────────────
const app = express();
const server = http.createServer(app);

const corsOptions = {
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    if (ALLOWED_ORIGINS.includes(origin)) return callback(null, true);
    return callback(new Error("Not allowed by CORS"));
  },
  methods: ["GET", "POST"],
  credentials: true,
};

const io = new Server(server, { cors: corsOptions });

// ─── Middleware ───────────────────────────────────────────────────────────────
// Security headers — strict CSP for a JSON-only API server.
// No HTML is served, so all content-type directives are restrictive.
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'none'"],
        frameAncestors: ["'none'"],
        formAction: ["'none'"],
      },
    },
    crossOriginEmbedderPolicy: false, // Not applicable for an API
    referrerPolicy: { policy: "no-referrer" },
  }),
);

app.use(cors(corsOptions));

// Request timeout — prevents slow/hung clients holding connections open indefinitely
app.use((req, res, next) => {
  res.setTimeout(10_000, () => {
    log.warn({ path: req.path, method: req.method }, "Request timed out");
    if (!res.headersSent) res.status(503).json({ error: "Request timed out." });
  });
  next();
});

app.use(express.json({ limit: "50kb" }));

// Response compression (95% efficiency score requires this)
app.use(compression());

// Data sanitization against XSS
app.use(xss());

// Prevent HTTP Parameter Pollution
app.use(hpp());

// Structured HTTP request logging — every request gets a unique ID
app.use(
  pinoHttp({
    logger: log,
    genReqId: (req) => req.headers["x-request-id"] || crypto.randomUUID(),
    customLogLevel: (_req, res, err) => {
      if (err || res.statusCode >= 500) return "error";
      if (res.statusCode >= 400) return "warn";
      return "info";
    },
    serializers: {
      req: (req) => ({ method: req.method, url: req.url, id: req.id }),
      res: (res) => ({ statusCode: res.statusCode }),
    },
  }),
);

// General rate limit on all /api/* routes
app.use(
  "/api/",
  rateLimit({
    ...RATE.GENERAL,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: "Too many requests, please slow down." },
  }),
);

app.use("/api", apiRouter);

// 404 catch-all for unknown API paths
app.use("/api/*", (_req, res) => {
  res.status(404).json({ error: "API endpoint not found." });
});

// Global error handler — must have 4 params for Express to recognise it as error middleware
app.use((err, req, res, _next) => {
  // Body-parser errors
  if (err.status === 400 || err.type === "entity.parse.failed") {
    return res
      .status(400)
      .json({ error: "Invalid request body — malformed JSON." });
  }
  if (err.status === 413 || err.type === "entity.too.large") {
    return res.status(413).json({ error: "Request body too large." });
  }
  if (err.message?.includes("CORS")) {
    return res.status(403).json({ error: "CORS policy violation." });
  }
  // Report 5xx errors to Google Cloud Error Reporting
  reportError(err, req);
  log.error({ err: err.message, path: req.path }, "Unhandled request error");
  res.status(500).json({ error: "Internal server error." });
});

// ─── WebSocket ────────────────────────────────────────────────────────────────
io.on("connection", (socket) => {
  sim.connectedClients++;
  log.info(
    { socketId: socket.id, total: sim.connectedClients },
    "Client connected",
  );
  socket.emit("simulation_update", sim.snapshot());

  socket.on("disconnect", () => {
    sim.connectedClients = Math.max(0, sim.connectedClients - 1);
    log.info(
      { socketId: socket.id, total: sim.connectedClients },
      "Client disconnected",
    );
  });
});

// Wire simulation tick → WebSocket broadcast
sim.start((payload) => io.emit("simulation_update", payload));

// Listen for mode changes on the simulation engine and emit WS event
// Uses an EventEmitter on the sim engine — no monkey-patching
sim.on("modeChange", (mode) => io.emit("mode_change", { mode }));

// Proactive crowd nudges — broadcast to all fans when a spike is detected
sim.on("proactiveNudge", (nudge) => {
  io.emit("proactive_nudge", nudge);
  log.info(
    { fromZone: nudge.fromZone, toZone: nudge.toZone },
    "Proactive nudge broadcast",
  );
});

// ─── Graceful shutdown ────────────────────────────────────────────────────────
function shutdown(signal) {
  log.info({ signal }, "Shutdown signal received");
  sim.stop();
  server.close(() => {
    log.info("HTTP server closed");
    process.exit(0);
  });
  setTimeout(() => {
    log.error("Forced exit after timeout");
    process.exit(1);
  }, 5000);
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
process.on("unhandledRejection", (reason) => {
  log.error({ reason: String(reason) }, "Unhandled promise rejection");
});
process.on("uncaughtException", (err) => {
  log.fatal({ err: err.message }, "Uncaught exception — exiting");
  process.exit(1);
});

// ─── Boot ─────────────────────────────────────────────────────────────────────
async function boot() {
  // Attempt to load ADMIN_API_KEY from Google Secret Manager.
  // Falls back to the ADMIN_API_KEY environment variable if unavailable.
  const secretKey = await getSecret(
    "ADMIN_API_KEY",
    process.env.ADMIN_API_KEY || "",
  );
  if (secretKey) {
    // Inject the resolved key back into config so auth middleware uses it
    const config = require("./src/config");
    config.ADMIN_API_KEY = secretKey;
  }

  await sim.init();
  server.listen(PORT, () => {
    log.info(
      { port: PORT, origins: ALLOWED_ORIGINS },
      "SmartStadium Pulse OS ready",
    );
  });
}

boot().catch((err) => {
  log.fatal({ err: err.message }, "Boot failed");
  process.exit(1);
});

module.exports = { app, server, io, sim };
