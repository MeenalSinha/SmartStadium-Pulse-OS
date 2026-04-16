'use strict';

const express   = require('express');
const { v4: uuidv4 } = require('uuid');
const rateLimit = require('express-rate-limit');

const { ZONES, STALLS, RATE, NODE_ENV } = require('../config');
const sim              = require('../services/simulation');
const { dijkstra }     = require('../services/pathfinding');
const { getInsights, invalidateCache } = require('../services/gemini');
const { requireAdminKey } = require('../middleware/auth');
const db               = require('../db');          // hoisted — avoids inline require()
const {
  isValidZone, isValidStall, isValidMode,
  sanitizeItems, sanitizeUserId,
} = require('../middleware/validate');
const log        = require('../utils/logger');
const catchAsync = require('../middleware/catchAsync');

const router = express.Router();

// Rate limiters — disabled in test environment to avoid 429s during rapid test runs
const isTest = NODE_ENV === 'test';

const orderLimiter = isTest
  ? (_req, _res, next) => next()
  : rateLimit({
      ...RATE.ORDER,
      standardHeaders: true, legacyHeaders: false,
      message: { error: 'Too many orders placed. Please wait a moment.' },
    });

const simulateLimiter = isTest
  ? (_req, _res, next) => next()
  : rateLimit({
      ...RATE.SIMULATE,
      standardHeaders: true, legacyHeaders: false,
      message: { error: 'Too many simulation changes.' },
    });

// ─── Health ───────────────────────────────────────────────────────────────────
router.get('/health', (_req, res) => {
  const mem = process.memoryUsage();
  res.json({
    status:           'ok',
    mode:             sim.mode,
    tick:             sim.tick,
    uptime:           Math.round(process.uptime()),
    memoryMB:         Math.round(mem.heapUsed / 1024 / 1024),
    connectedClients: sim.connectedClients,
    ordersStored:     sim.orders.length,
    alertsStored:     sim.alerts.length,
  });
});

// ─── Heatmap ─────────────────────────────────────────────────────────────────
router.get('/heatmap', (_req, res) => {
  const heatmap = Object.entries(sim.density).map(([id, density]) => ({
    zone: id, name: ZONES[id].name, density,
    level: density > 0.75 ? 'critical' : density > 0.50 ? 'high' : density > 0.25 ? 'moderate' : 'low',
    x: ZONES[id].x, y: ZONES[id].y, capacity: ZONES[id].capacity,
    currentCount: Math.round(density * ZONES[id].capacity),
  }));
  res.json({ heatmap, timestamp: Date.now() });
});

// ─── Zones ───────────────────────────────────────────────────────────────────
router.get('/zones', (_req, res) => {
  const zones = Object.values(ZONES).map(z => ({
    ...z,
    density:      sim.density[z.id],
    currentCount: Math.round((sim.density[z.id] || 0) * z.capacity),
  }));
  res.json({ zones });
});

// ─── Route (Dijkstra pathfinding) ────────────────────────────────────────────
router.post('/route', (req, res) => {
  const { from, to } = req.body || {};
  if (!isValidZone(from) || !isValidZone(to)) {
    return res.status(400).json({ error: 'Invalid zone. Valid zones: A–H.' });
  }
  const result = dijkstra(from, to, sim.density);
  if (!result.path || result.path.length === 0) {
    return res.status(422).json({ error: 'No route found between these zones.' });
  }
  const pathDetails = result.path.map(id => ({
    zone: id, name: ZONES[id].name,
    density: sim.density[id],
    x: ZONES[id].x, y: ZONES[id].y,
  }));
  const avgDensity   = pathDetails.reduce((a, z) => a + z.density, 0) / pathDetails.length;
  const pointsEarned = avgDensity < 0.4 ? 15 : avgDensity < 0.6 ? 8 : 3;

  log.info({ from, to, hops: result.path.length, cost: result.cost }, 'Route calculated');

  res.json({
    path: pathDetails,
    estimatedMinutes: result.estimatedMinutes,
    cost:             result.cost,
    pointsEarned,
    recommendation: avgDensity < 0.4
      ? 'Optimal low-density route — reward earned'
      : avgDensity < 0.6
      ? 'Moderate route — consider alternatives'
      : 'High-density route — rerouting recommended',
  });
});

// ─── Queue / Stalls ───────────────────────────────────────────────────────────
router.get('/queue', (_req, res) => {
  const stalls = STALLS.map(stall => {
    const zoneDensity = sim.density[stall.zone] || 0;
    const waitTime    = Math.round(stall.baseWait * (1 + zoneDensity * 2));
    return {
      ...stall, waitTime, density: zoneDensity,
      available: zoneDensity < 0.8,
      level: zoneDensity > 0.7 ? 'busy' : zoneDensity > 0.4 ? 'moderate' : 'quiet',
    };
  });
  const recommended = [...stalls].sort((a, b) => a.waitTime - b.waitTime)[0];
  res.json({ stalls, recommended, timestamp: Date.now() });
});

// ─── Place order ─────────────────────────────────────────────────────────────
router.post('/order', orderLimiter, catchAsync(async (req, res) => {
  const { stallId, items, userId } = req.body || {};
  if (!isValidStall(stallId)) {
    return res.status(400).json({ error: 'Invalid stall ID.' });
  }
  const sanitized = sanitizeItems(items);
  if (!sanitized) {
    return res.status(400).json({ error: 'Items must be a non-empty array of up to 20 strings.' });
  }
  const stall       = STALLS.find(s => s.id === stallId);
  const zoneDensity = sim.density[stall.zone] || 0;
  const waitTime    = Math.round(stall.baseWait * (1 + zoneDensity * 2));
  const order = {
    id:           uuidv4(),
    stallId,
    stallName:    stall.name,
    zone:         stall.zone,
    items:        sanitized,
    userId:       sanitizeUserId(userId),
    status:       'confirmed',
    waitTime,
    readyAt:      Date.now() + waitTime * 60_000,
    pointsEarned: Math.max(5, 20 - waitTime),
    timestamp:    Date.now(),
  };
  await sim.addOrder(order);
  log.info({ orderId: order.id, stall: stall.name, userId: order.userId }, 'Order placed');
  res.json(order);
}));

// ─── Recommendations ─────────────────────────────────────────────────────────
router.get('/recommendations', (_req, res) => {
  const lowZones = Object.entries(sim.density)
    .filter(([, d]) => d < 0.4)
    .sort(([, a], [, b]) => a - b)
    .slice(0, 3)
    .map(([id]) => ({ zone: id, name: ZONES[id].name, density: sim.density[id] }));

  const bestStall = STALLS
    .map(s => ({
      ...s,
      waitTime: Math.round(s.baseWait * (1 + (sim.density[s.zone] || 0) * 2)),
    }))
    .sort((a, b) => a.waitTime - b.waitTime)[0];

  const recs = [
    ...lowZones.map(z => ({
      type: 'routing', title: `Move to ${z.name}`,
      description: `${z.name} has only ${Math.round(z.density * 100)}% occupancy — 15 points reward`,
      points: 15, zone: z.zone,
    })),
    {
      type: 'order', title: `Order from ${bestStall.name}`,
      description: `${bestStall.name} currently has ${bestStall.waitTime}-min wait — lowest in the stadium`,
      points: 10, zone: bestStall.zone,
    },
  ];
  res.json({ recommendations: recs.slice(0, 4), timestamp: Date.now() });
});

// ─── AI Insights (Vertex AI — Gemini 1.5 Flash) ───────────────────────────────
/**
 * Returns AI-generated stadium operational insights.
 * Backed by Vertex AI in Cloud Run; falls back to rule-based engine elsewhere.
 * Results cached for 30 s to control API costs.
 */
router.get('/ai-insights', catchAsync(async (_req, res) => {
  const insights = await getInsights(sim.density, sim.mode);
  res.json({ insights, timestamp: Date.now() });
}));

// ─── Alerts ───────────────────────────────────────────────────────────────────
router.get('/alerts', (_req, res) => {
  res.json({ alerts: sim.alerts.slice(0, 10), timestamp: Date.now() });
});

// ─── Metrics ─────────────────────────────────────────────────────────────────
router.get('/metrics', (_req, res) => {
  res.json({ metrics: sim.getMetrics(), timestamp: Date.now() });
});

// ─── Simulate (admin-protected) ───────────────────────────────────────────────
router.post('/simulate', simulateLimiter, requireAdminKey, catchAsync(async (req, res) => {
  const { mode } = req.body || {};
  if (!isValidMode(mode)) {
    return res.status(400).json({
      error: 'Invalid mode. Valid: normal, pre_match, halftime, exit_rush.',
    });
  }
  await sim.setMode(mode);
  invalidateCache(); // Force fresh AI insights after mode change
  res.json({ success: true, mode });
}));



// ─── Send manual staff alert ──────────────────────────────────────────────────
// Called when a staff member taps "Send Alert" or "Dispatch" in the dashboard.
// Injects a real alert into the simulation state and broadcasts it via WebSocket.
router.post('/alert', catchAsync(async (req, res) => {
  const { zone, message, type = 'warning' } = req.body || {};

  if (!isValidZone(zone)) {
    return res.status(400).json({ error: 'Invalid zone. Valid zones: A–H.' });
  }
  if (!message || typeof message !== 'string' || message.trim().length === 0) {
    return res.status(400).json({ error: 'Message is required.' });
  }
  if (!['warning', 'critical', 'info'].includes(type)) {
    return res.status(400).json({ error: 'Type must be warning, critical, or info.' });
  }

  const alert = {
    id:        uuidv4(),
    zone,
    zoneName:  ZONES[zone].name,
    type,
    message:   message.trim().slice(0, 200),
    timestamp: Date.now(),
    source:    'staff',   // distinguishes manual from auto-generated alerts
  };

  // Merge into live alerts state (one per zone, most-recent wins)
  const alertMap = new Map();
  [alert, ...sim.alerts].forEach(a => {
    if (!alertMap.has(a.zone) || a.timestamp > alertMap.get(a.zone).timestamp) {
      alertMap.set(a.zone, a);
    }
  });
  sim.alerts = Array.from(alertMap.values())
    .sort((a, b) => b.timestamp - a.timestamp)
    .slice(0, 20);

  await db.insertAlert(alert); // db hoisted at module top — no inline require

  log.info({ zone, type, source: 'staff' }, 'Manual staff alert sent');
  res.json({ success: true, alert });
}));

// ─── Best Route (auto-suggest from current zone) ──────────────────────────────
// Given a starting zone, finds the best low-density destination and the optimal
// path to get there. Powers the "smart reroute" feature in the Fan App.
router.post('/best-route', (req, res) => {
  const { from } = req.body || {};
  if (!isValidZone(from)) {
    return res.status(400).json({ error: 'Invalid zone. Valid zones: A–H.' });
  }

  // Find the lowest-density zone that is not the current zone
  const candidates = Object.entries(sim.density)
    .filter(([id]) => id !== from)
    .sort(([, a], [, b]) => a - b);

  if (!candidates.length) {
    return res.status(422).json({ error: 'No alternative zones available.' });
  }

  // Try candidates in order until we find a reachable one
  for (const [to] of candidates) {
    const result = dijkstra(from, to, sim.density);
    if (result.path && result.path.length > 0 && result.cost !== Infinity) {
      const pathDetails = result.path.map(id => ({
        zone: id, name: ZONES[id].name,
        density: sim.density[id],
        x: ZONES[id].x, y: ZONES[id].y,
      }));
      const avgDensity   = pathDetails.reduce((a, z) => a + z.density, 0) / pathDetails.length;
      const pointsEarned = avgDensity < 0.4 ? 15 : avgDensity < 0.6 ? 8 : 3;
      const destDensity  = sim.density[to];

      log.info({ from, to, improvement: sim.density[from] - destDensity }, 'Best route calculated');

      return res.json({
        from,
        to,
        toName:           ZONES[to].name,
        path:             pathDetails,
        estimatedMinutes: result.estimatedMinutes,
        cost:             result.cost,
        pointsEarned,
        currentDensity:   sim.density[from],
        destDensity,
        improvement:      parseFloat((sim.density[from] - destDensity).toFixed(3)),
        reason: destDensity < 0.3
          ? `${ZONES[to].name} is nearly empty — ideal escape route`
          : destDensity < 0.5
          ? `${ZONES[to].name} has significantly less crowd than your current zone`
          : `Best available zone given current conditions`,
      });
    }
  }

  res.status(422).json({ error: 'No better route found from this zone.' });
});

// ─── Crowd status — real-time summary for Fan App landing page ────────────────
router.get('/crowd-status', (_req, res) => {
  const densities  = Object.entries(sim.density);
  const avgDensity = densities.reduce((s, [, d]) => s + d, 0) / densities.length;
  const critical   = densities.filter(([, d]) => d > 0.75).map(([id]) => ({ id, name: ZONES[id].name, density: sim.density[id] }));
  const quiet      = densities.filter(([, d]) => d < 0.35).map(([id]) => ({ id, name: ZONES[id].name, density: sim.density[id] }));
  const bestStall  = STALLS
    .map(s => ({ ...s, waitTime: Math.round(s.baseWait * (1 + (sim.density[s.zone] || 0) * 2)) }))
    .sort((a, b) => a.waitTime - b.waitTime)[0];

  const level = avgDensity > 0.70 ? 'critical' : avgDensity > 0.50 ? 'high' : avgDensity > 0.30 ? 'moderate' : 'calm';
  const statusMessages = {
    critical: 'Stadium is very crowded. Follow AI guidance to avoid congestion.',
    high:     'Moderate congestion in several zones. Smart routing active.',
    moderate: 'Stadium operating normally. Some busy areas.',
    calm:     'Stadium is flowing well. Great time to move around.',
  };

  res.json({
    level,
    message:    statusMessages[level],
    avgDensity: parseFloat(avgDensity.toFixed(3)),
    mode:       sim.mode,
    critical,
    quiet,
    bestStall:  { id: bestStall.id, name: bestStall.name, waitTime: bestStall.waitTime, zone: bestStall.zone },
    timestamp:  Date.now(),
  });
});

module.exports = router;
