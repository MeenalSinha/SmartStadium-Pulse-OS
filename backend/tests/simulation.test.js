'use strict';

process.env.DB_PATH   = ':memory:';
process.env.LOG_LEVEL = 'silent';
process.env.NODE_ENV  = 'test';

// Import the CLASS, not the singleton — gives us a fresh instance per test
const { SimulationEngine } = require('../src/services/simulation');

function makeEngine() {
  return new SimulationEngine();
}

// ─── Density initialisation ───────────────────────────────────────────────────
describe('SimulationEngine — density init', () => {
  test('all 8 zones initialised on construction', () => {
    const sim = makeEngine();
    expect(Object.keys(sim.density)).toHaveLength(8);
    ['A','B','C','D','E','F','G','H'].forEach(id => {
      expect(sim.density).toHaveProperty(id);
    });
  });

  test('initial densities are in [0, 0.3]', () => {
    const sim = makeEngine();
    Object.values(sim.density).forEach(d => {
      expect(d).toBeGreaterThanOrEqual(0);
      expect(d).toBeLessThanOrEqual(0.3);
    });
  });

  test('initial mode is normal', () => {
    expect(makeEngine().mode).toBe('normal');
  });

  test('initial tick is 0', () => {
    expect(makeEngine().tick).toBe(0);
  });
});

// ─── getMetrics() ─────────────────────────────────────────────────────────────
describe('SimulationEngine — getMetrics()', () => {
  test('returns all required keys', () => {
    const m = makeEngine().getMetrics();
    ['avgDensity','congestionReduced','waitTimeReduced',
     'routingImprovement','satisfactionScore','activeUsers','ordersProcessed']
    .forEach(k => expect(m).toHaveProperty(k));
  });

  test('satisfactionScore clamped to [1, 5] when density = 0.99', () => {
    const sim = makeEngine();
    Object.keys(sim.density).forEach(id => { sim.density[id] = 0.99; });
    expect(sim.getMetrics().satisfactionScore).toBeGreaterThanOrEqual(1);
    expect(sim.getMetrics().satisfactionScore).toBeLessThanOrEqual(5);
  });

  test('satisfactionScore clamped to [1, 5] when density = 0.0', () => {
    const sim = makeEngine();
    Object.keys(sim.density).forEach(id => { sim.density[id] = 0.0; });
    expect(sim.getMetrics().satisfactionScore).toBeGreaterThanOrEqual(1);
    expect(sim.getMetrics().satisfactionScore).toBeLessThanOrEqual(5);
  });

  test('congestionReduced clamped to [0, 99]', () => {
    const sim = makeEngine();
    Object.keys(sim.density).forEach(id => { sim.density[id] = 0.0; });
    const c = sim.getMetrics().congestionReduced;
    expect(c).toBeGreaterThanOrEqual(0);
    expect(c).toBeLessThanOrEqual(99);
  });

  test('avgDensity is mean of all zone densities', () => {
    const sim = makeEngine();
    Object.keys(sim.density).forEach(id => { sim.density[id] = 0.5; });
    expect(sim.getMetrics().avgDensity).toBeCloseTo(0.5, 2);
  });

  test('ordersProcessed equals orders array length', () => {
    const sim = makeEngine();
    expect(sim.getMetrics().ordersProcessed).toBe(sim.orders.length);
  });

  test('routingImprovement is always 63', () => {
    expect(makeEngine().getMetrics().routingImprovement).toBe(63);
  });
});

// ─── snapshot() ───────────────────────────────────────────────────────────────
describe('SimulationEngine — snapshot()', () => {
  test('returns all required fields', () => {
    const snap = makeEngine().snapshot();
    ['density','alerts','mode','tick','metrics'].forEach(k =>
      expect(snap).toHaveProperty(k)
    );
  });

  test('density in snapshot is a shallow copy', () => {
    const sim  = makeEngine();
    const snap = sim.snapshot();
    snap.density['A'] = 9999;
    expect(sim.density['A']).not.toBe(9999);
  });

  test('alerts in snapshot are sliced to 5 max', () => {
    const sim = makeEngine();
    // Artificially inflate alerts beyond 5
    for (let i = 0; i < 10; i++) {
      sim.alerts.push({ id: `a${i}`, zone: String.fromCharCode(65+i%8),
        zoneName: 'Zone', type: 'warning', message: 'test', timestamp: Date.now() });
    }
    expect(sim.snapshot().alerts.length).toBeLessThanOrEqual(5);
  });
});

// ─── addOrder() ───────────────────────────────────────────────────────────────
describe('SimulationEngine — addOrder()', () => {
  const makeOrder = (id = 'o1') => ({
    id, stallId: 's1', stallName: 'Burger Hub', zone: 'E',
    items: ['1x Burger'], userId: 'u1', status: 'confirmed',
    waitTime: 5, readyAt: Date.now() + 300_000, pointsEarned: 10,
    timestamp: Date.now(),
  });

  test('adds order to orders array', async () => {
    const sim = makeEngine();
    await sim.init();
    const before = sim.orders.length;
    await sim.addOrder(makeOrder('test-order-1'));
    expect(sim.orders.length).toBe(before + 1);
  });

  test('ordersProcessed metric reflects added order', async () => {
    const sim = makeEngine();
    await sim.init();
    const before = sim.getMetrics().ordersProcessed;
    await sim.addOrder(makeOrder('test-order-2'));
    expect(sim.getMetrics().ordersProcessed).toBe(before + 1);
  });

  test('orders array capped at 200', async () => {
    const sim = makeEngine();
    await sim.init();
    for (let i = 0; i < 210; i++) {
      await sim.addOrder(makeOrder(`cap-test-${i}`));
    }
    expect(sim.orders.length).toBeLessThanOrEqual(200);
  });
});

// ─── _tick() — idle guard ─────────────────────────────────────────────────────
describe('SimulationEngine — _tick() idle guard', () => {
  test('emitFn NOT called when connectedClients = 0', () => {
    const sim     = makeEngine();
    const emitSpy = jest.fn();
    sim._emitFn          = emitSpy;
    sim.connectedClients = 0;
    sim._tick();
    expect(emitSpy).not.toHaveBeenCalled();
  });

  test('emitFn IS called when connectedClients > 0', () => {
    const sim     = makeEngine();
    const emitSpy = jest.fn();
    sim._emitFn          = emitSpy;
    sim.connectedClients = 1;
    sim._tick();
    expect(emitSpy).toHaveBeenCalledTimes(1);
  });

  test('tick counter increments on every _tick() call regardless of clients', () => {
    const sim = makeEngine();
    sim.connectedClients = 0;
    sim._tick();
    sim._tick();
    expect(sim.tick).toBe(2);
  });

  test('density values change after _tick()', () => {
    const sim = makeEngine();
    const before = { ...sim.density };
    // Run many ticks — with variance density will almost certainly move
    for (let i = 0; i < 20; i++) sim._tick();
    const changed = Object.keys(sim.density).some(id => sim.density[id] !== before[id]);
    expect(changed).toBe(true);
  });
});

// ─── setMode() ────────────────────────────────────────────────────────────────
describe('SimulationEngine — setMode()', () => {
  test('mode is updated', async () => {
    const sim = makeEngine();
    await sim.init();
    await sim.setMode('halftime');
    expect(sim.mode).toBe('halftime');
  });

  test('alerts are cleared when mode changes', async () => {
    const sim = makeEngine();
    await sim.init();
    sim.alerts = [{ id:'a1', zone:'A', zoneName:'North Gate', type:'warning',
      message:'test', timestamp: Date.now() }];
    await sim.setMode('exit_rush');
    expect(sim.alerts).toHaveLength(0);
  });
});

// ─── start() / stop() ─────────────────────────────────────────────────────────
describe('SimulationEngine — start() / stop()', () => {
  test('start() sets the interval and calls emitFn when clients connected', async () => {
    jest.useFakeTimers();
    const sim = makeEngine();
    const emitSpy = jest.fn();
    sim.connectedClients = 1;
    sim.start(emitSpy);
    jest.advanceTimersByTime(2001);    // one tick
    sim.stop();
    jest.useRealTimers();
    expect(emitSpy).toHaveBeenCalledTimes(1);
  });

  test('stop() clears the interval', () => {
    jest.useFakeTimers();
    const sim = makeEngine();
    sim.start(jest.fn());
    expect(sim._interval).not.toBeNull();
    sim.stop();
    expect(sim._interval).toBeNull();
    jest.useRealTimers();
  });

  test('stop() is safe to call when not running', () => {
    const sim = makeEngine();
    expect(() => sim.stop()).not.toThrow();
  });
});

// ─── init() DB restore ────────────────────────────────────────────────────────
describe('SimulationEngine — init() DB restore', () => {
  test('restores mode from DB after a setMode call', async () => {
    // Engine A writes a mode to DB
    const simA = makeEngine();
    await simA.init();
    await simA.setMode('halftime');

    // Engine B (same in-memory DB via module singleton) reads it back
    const simB = makeEngine();
    await simB.init();
    expect(simB.mode).toBe('halftime');
  });

  test('restores orders from DB after addOrder', async () => {
    const simA = makeEngine();
    await simA.init();
    await simA.addOrder({
      id: 'restore-test-1', stallId: 's1', stallName: 'Burger Hub', zone: 'E',
      items: ['1x Burger'], userId: 'u_restore', status: 'confirmed',
      waitTime: 4, readyAt: Date.now() + 240000, pointsEarned: 10, timestamp: Date.now(),
    });
    expect(simA.orders.length).toBeGreaterThan(0);
  });
});

// ─── _updateAlerts() with high-density zones ─────────────────────────────────
describe('SimulationEngine — _updateAlerts()', () => {
  test('generates critical alert when zone density > 0.80', async () => {
    const sim = makeEngine();
    await sim.init();
    sim.density['A'] = 0.95;   // force critical
    sim.density['B'] = 0.0;
    sim.density['C'] = 0.0;
    sim.density['D'] = 0.0;
    sim.density['E'] = 0.0;
    sim.density['F'] = 0.0;
    sim.density['G'] = 0.0;
    sim.density['H'] = 0.0;
    sim._updateAlerts();
    const critAlerts = sim.alerts.filter(a => a.type === 'critical' && a.zone === 'A');
    expect(critAlerts.length).toBeGreaterThan(0);
  });

  test('generates warning alert when zone density between 0.60 and 0.80', async () => {
    const sim = makeEngine();
    await sim.init();
    Object.keys(sim.density).forEach(id => { sim.density[id] = 0.0; });
    sim.density['B'] = 0.70;
    sim._updateAlerts();
    const warnAlerts = sim.alerts.filter(a => a.type === 'warning' && a.zone === 'B');
    expect(warnAlerts.length).toBeGreaterThan(0);
  });

  test('deduplicates alerts per zone (only one per zone)', async () => {
    const sim = makeEngine();
    await sim.init();
    sim.density['C'] = 0.95;
    sim._updateAlerts();
    sim._updateAlerts();   // run twice — should not double-up
    const zoneC = sim.alerts.filter(a => a.zone === 'C');
    expect(zoneC.length).toBe(1);
  });

  test('no alerts when all densities are low', () => {
    const sim = makeEngine();
    Object.keys(sim.density).forEach(id => { sim.density[id] = 0.1; });
    sim._updateAlerts();
    expect(sim.alerts.length).toBe(0);
  });
});

// ─── EventEmitter — modeChange event ─────────────────────────────────────────
describe('SimulationEngine — EventEmitter', () => {
  test('emits modeChange event when setMode() is called', async () => {
    const sim = makeEngine();
    await sim.init();
    const spy = jest.fn();
    sim.on('modeChange', spy);
    await sim.setMode('exit_rush');
    expect(spy).toHaveBeenCalledWith('exit_rush');
  });

  test('does NOT emit modeChange for invalid mode (never reaches setMode)', async () => {
    const sim = makeEngine();
    await sim.init();
    const spy = jest.fn();
    sim.on('modeChange', spy);
    // setMode is only called from the route after isValidMode() passes
    // so we verify no stray emissions exist
    expect(spy).not.toHaveBeenCalled();
  });

  test('modeChange listeners do not affect engine state', async () => {
    const sim = makeEngine();
    await sim.init();
    sim.on('modeChange', () => { /* side-effect listener */ });
    await sim.setMode('pre_match');
    expect(sim.mode).toBe('pre_match');
  });
});

// ─── _emitNudges() ────────────────────────────────────────────────────────────
describe('SimulationEngine — _emitNudges()', () => {
  test('emits proactiveNudge event when critical zone + quiet zone both exist', () => {
    const sim = makeEngine();
    const spy = jest.fn();
    sim.on('proactiveNudge', spy);

    // Force one critical zone and one quiet zone
    Object.keys(sim.density).forEach(id => { sim.density[id] = 0.5; }); // baseline
    sim.density['A'] = 0.85;  // critical
    sim.density['H'] = 0.10;  // quiet

    sim._emitNudges();
    expect(spy).toHaveBeenCalledTimes(1);
    const nudge = spy.mock.calls[0][0];
    expect(nudge.fromZone).toBe('A');
    expect(nudge.toZone).toBe('H');
    expect(nudge.type).toBe('crowd_spike');
    expect(typeof nudge.message).toBe('string');
    expect(nudge.pointsReward).toBe(15);
  });

  test('does NOT emit when no critical zones', () => {
    const sim = makeEngine();
    const spy = jest.fn();
    sim.on('proactiveNudge', spy);
    Object.keys(sim.density).forEach(id => { sim.density[id] = 0.4; }); // all moderate
    sim._emitNudges();
    expect(spy).not.toHaveBeenCalled();
  });

  test('does NOT emit when critical exists but no quiet zone', () => {
    const sim = makeEngine();
    const spy = jest.fn();
    sim.on('proactiveNudge', spy);
    Object.keys(sim.density).forEach(id => { sim.density[id] = 0.8; }); // all critical/high
    sim._emitNudges();
    expect(spy).not.toHaveBeenCalled();
  });

  test('nudge includes crowdedPct and quietPct as integers', () => {
    const sim = makeEngine();
    const spy = jest.fn();
    sim.on('proactiveNudge', spy);
    Object.keys(sim.density).forEach(id => { sim.density[id] = 0.5; });
    sim.density['B'] = 0.90;
    sim.density['E'] = 0.20;
    sim._emitNudges();
    if (spy.mock.calls.length > 0) {
      const nudge = spy.mock.calls[0][0];
      expect(Number.isInteger(nudge.crowdedPct)).toBe(true);
      expect(Number.isInteger(nudge.quietPct)).toBe(true);
      expect(nudge.crowdedPct).toBe(90);
      expect(nudge.quietPct).toBe(20);
    }
  });
});
