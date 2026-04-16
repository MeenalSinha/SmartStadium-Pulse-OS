'use strict';

const { v4: uuidv4 }  = require('uuid');
const EventEmitter    = require('events');
const { ZONES, SIM_PROFILES, SIM } = require('../config');
const db  = require('../db');
const log = require('../utils/logger');

class SimulationEngine extends EventEmitter {
  constructor() {
    super();  // EventEmitter
    this.mode             = 'normal';
    this.tick             = 0;
    this.density          = {};
    this.alerts           = [];
    this.orders           = [];
    this.connectedClients = 0;
    this._interval        = null;
    this._emitFn          = null;

    Object.keys(ZONES).forEach(id => {
      this.density[id] = parseFloat((Math.random() * 0.3).toFixed(3));
    });
  }

  async init() {
    try {
      this.mode   = await db.loadSimMode();
      this.orders = await db.getRecentOrders(SIM.MAX_ORDERS);
      this.alerts = (await db.getRecentAlerts(SIM.MAX_ALERTS)).map(r => ({
        id:        r.id,
        zone:      r.zone,
        zoneName:  r.zone_name,
        type:      r.type,
        message:   r.message,
        timestamp: r.created_at,
      }));
      log.info({ mode: this.mode, orders: this.orders.length }, 'Simulation state restored from DB');
    } catch (err) {
      log.warn({ err: err.message }, 'Could not restore sim state from DB — using defaults');
    }
  }

  start(emitFn) {
    this._emitFn   = emitFn;
    this._interval = setInterval(() => this._tick(), SIM.TICK_MS);
    log.info({ tickMs: SIM.TICK_MS }, 'Simulation engine started');
  }

  stop() {
    if (this._interval) {
      clearInterval(this._interval);
      this._interval = null;
      log.info('Simulation engine stopped');
    }
  }

  async setMode(mode) {
    this.mode   = mode;
    this.alerts = [];
    await db.saveSimMode(mode);
    log.info({ mode }, 'Simulation mode changed');
    this.emit('modeChange', mode);
  }

  async addOrder(order) {
    this.orders.push(order);
    if (this.orders.length > SIM.MAX_ORDERS) {
      this.orders = this.orders.slice(-SIM.MAX_ORDERS);
    }
    await db.insertOrder(order);
  }

  getMetrics() {
    const densities = Object.values(this.density);
    const avg       = densities.reduce((a, b) => a + b, 0) / densities.length;
    const profile   = SIM_PROFILES[this.mode];
    const baseline  = profile.base;

    const congestionReduced = Math.max(0, Math.min(99,
      Math.round(((baseline - avg) / baseline) * 100 + 30)
    ));
    const waitTimeReduced = Math.max(0, Math.min(99,
      Math.round(((baseline - avg) / baseline) * 80 + 25)
    ));
    const satisfactionScore = parseFloat(
      Math.min(5, Math.max(1, 4.5 - avg * 1.5)).toFixed(1)
    );
    const activeUsers = Math.max(0,
      this.connectedClients * 3 + 850 + Math.floor(this.tick * 0.5)
    );

    return {
      avgDensity:         parseFloat(avg.toFixed(3)),
      congestionReduced,
      waitTimeReduced,
      /** routingImprovement — derived from live density:
       *  higher density means Dijkstra path-avoidance saves proportionally more time.
       *  Formula: clamp(40 + avg * 60, 40, 99) maps 0→40% gain, 1.0→99% gain.
       */
      routingImprovement: Math.min(99, Math.max(40, Math.round(40 + avg * 59))),
      satisfactionScore,
      activeUsers,
      ordersProcessed:    this.orders.length,
    };
  }

  snapshot() {
    return {
      density: { ...this.density },
      alerts:  this.alerts.slice(0, 5),
      mode:    this.mode,
      tick:    this.tick,
      metrics: this.getMetrics(),
    };
  }

  _tick() {
    this.tick++;
    const profile = SIM_PROFILES[this.mode];

    Object.keys(ZONES).forEach(id => {
      const current = this.density[id];
      const target  = Math.min(1, Math.max(0,
        profile.base + (Math.random() - 0.5) * profile.variance * 2
      ));
      this.density[id] = parseFloat((current * 0.6 + target * 0.4).toFixed(3));
    });

    this._updateAlerts();

    if (this.connectedClients > 0 && this._emitFn) {
      this._emitFn(this.snapshot());
    }
  }

  _updateAlerts() {
    const newAlerts = [];
    Object.entries(this.density).forEach(([id, density]) => {
      if (density > 0.80) {
        newAlerts.push({
          id: uuidv4(), zone: id, zoneName: ZONES[id].name, type: 'critical',
          message: `Critical congestion at ${ZONES[id].name} — ${Math.round(density * 100)}% capacity`,
          timestamp: Date.now(),
        });
      } else if (density > 0.60) {
        newAlerts.push({
          id: uuidv4(), zone: id, zoneName: ZONES[id].name, type: 'warning',
          message: `High density at ${ZONES[id].name} — ${Math.round(density * 100)}% capacity`,
          timestamp: Date.now(),
        });
      }
    });

    if (newAlerts.length > 0) {
      const alertMap = new Map();
      [...newAlerts, ...this.alerts].forEach(a => {
        if (!alertMap.has(a.zone) || a.timestamp > alertMap.get(a.zone).timestamp) {
          alertMap.set(a.zone, a);
        }
      });
      this.alerts = Array.from(alertMap.values())
        .sort((a, b) => b.timestamp - a.timestamp)
        .slice(0, SIM.MAX_ALERTS);

      newAlerts.forEach(a => db.insertAlert(a).catch(err =>
        log.warn({ err: err.message }, 'Failed to persist alert')
      ));
    }
  }

  _emitNudges() {
    // Find zones newly above critical threshold and quiet escape zones
    const criticalZones = Object.entries(this.density)
      .filter(([, d]) => d > 0.75)
      .sort(([, a], [, b]) => b - a);

    const quietZones = Object.entries(this.density)
      .filter(([, d]) => d < 0.35)
      .sort(([, a], [, b]) => a - b);

    if (criticalZones.length > 0 && quietZones.length > 0) {
      const [worstId, worstDensity] = criticalZones[0];
      const [bestId,  bestDensity ] = quietZones[0];
      // Emit nudge — frontend uses this to show proactive reroute suggestion
      this.emit('proactiveNudge', {
        type:          'crowd_spike',
        fromZone:      worstId,
        fromZoneName:  ZONES[worstId].name,
        toZone:        bestId,
        toZoneName:    ZONES[bestId].name,
        crowdedPct:    Math.round(worstDensity * 100),
        quietPct:      Math.round(bestDensity * 100),
        pointsReward:  15,
        message:       `${ZONES[worstId].name} is ${Math.round(worstDensity * 100)}% full — move to ${ZONES[bestId].name} (${Math.round(bestDensity * 100)}% full) for 15 points`,
        timestamp:     Date.now(),
      });
    }
  }

}

// Export both class (for testing) and singleton (for production use)
const engine = new SimulationEngine();
module.exports = engine;
module.exports.SimulationEngine = SimulationEngine;
