"use strict";

/**
 * Integration tests for all REST API endpoints.
 *
 * Strategy: jest.resetModules() before building the app ensures each test
 * suite gets a fresh module graph — new sim singleton, new DB connection.
 * testApp.js creates an Express app without binding to a port.
 * Supertest drives HTTP directly through the app object.
 */

// Set test env BEFORE any requires
process.env.NODE_ENV = "test";
process.env.DB_PATH = ":memory:";
process.env.LOG_LEVEL = "silent";

const request = require("supertest");

let app, sim;

beforeAll(async () => {
  jest.resetModules();
  // Fresh requires after resetModules — new sim singleton, new in-memory DB
  const { buildApp } = require("./testApp");
  sim = require("../src/services/simulation");
  await sim.init();
  app = buildApp();
});

afterAll(() => {
  if (sim) sim.stop();
});

// ─── Health ───────────────────────────────────────────────────────────────────
describe("GET /api/health", () => {
  test("200 with all required fields", async () => {
    const res = await request(app).get("/api/health");
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("ok");
    expect(typeof res.body.uptime).toBe("number");
    expect(typeof res.body.memoryMB).toBe("number");
    expect(typeof res.body.tick).toBe("number");
    expect(typeof res.body.connectedClients).toBe("number");
    expect(typeof res.body.ordersStored).toBe("number");
    expect(typeof res.body.alertsStored).toBe("number");
  });
});

// ─── Heatmap ─────────────────────────────────────────────────────────────────
describe("GET /api/heatmap", () => {
  test("returns exactly 8 zones", async () => {
    const res = await request(app).get("/api/heatmap");
    expect(res.status).toBe(200);
    expect(res.body.heatmap).toHaveLength(8);
  });

  test("each zone has correct shape and valid density", async () => {
    const res = await request(app).get("/api/heatmap");
    res.body.heatmap.forEach((z) => {
      expect(typeof z.zone).toBe("string");
      expect(typeof z.name).toBe("string");
      expect(typeof z.density).toBe("number");
      expect(["critical", "high", "moderate", "low"]).toContain(z.level);
      expect(z.density).toBeGreaterThanOrEqual(0);
      expect(z.density).toBeLessThanOrEqual(1);
      expect(typeof z.capacity).toBe("number");
      expect(z.capacity).toBeGreaterThan(0);
    });
  });
});

// ─── Zones ───────────────────────────────────────────────────────────────────
describe("GET /api/zones", () => {
  test("returns 8 zones with connections", async () => {
    const res = await request(app).get("/api/zones");
    expect(res.status).toBe(200);
    expect(res.body.zones).toHaveLength(8);
    res.body.zones.forEach((z) => {
      expect(Array.isArray(z.connections)).toBe(true);
      expect(z.connections.length).toBeGreaterThan(0);
      expect(z.capacity).toBeGreaterThan(0);
    });
  });
});

// ─── Queue ───────────────────────────────────────────────────────────────────
describe("GET /api/queue", () => {
  test("returns 4 stalls, recommended has lowest wait", async () => {
    const res = await request(app).get("/api/queue");
    expect(res.status).toBe(200);
    expect(res.body.stalls).toHaveLength(4);
    const minWait = Math.min(...res.body.stalls.map((s) => s.waitTime));
    expect(res.body.recommended.waitTime).toBe(minWait);
  });

  test("stall levels are valid", async () => {
    const res = await request(app).get("/api/queue");
    res.body.stalls.forEach((s) =>
      expect(["busy", "moderate", "quiet"]).toContain(s.level),
    );
  });
});

// ─── Route ───────────────────────────────────────────────────────────────────
describe("POST /api/route", () => {
  test("A→G returns valid path", async () => {
    const res = await request(app)
      .post("/api/route")
      .send({ from: "A", to: "G" });
    expect(res.status).toBe(200);
    expect(res.body.path[0].zone).toBe("A");
    expect(res.body.path[res.body.path.length - 1].zone).toBe("G");
    expect(typeof res.body.estimatedMinutes).toBe("number");
    expect([3, 8, 15]).toContain(res.body.pointsEarned);
  });

  test("B→B returns zero-cost single-stop path", async () => {
    const res = await request(app)
      .post("/api/route")
      .send({ from: "B", to: "B" });
    expect(res.status).toBe(200);
    expect(res.body.path).toHaveLength(1);
    expect(res.body.estimatedMinutes).toBe(0);
    expect(res.body.cost).toBe(0);
  });

  test("path nodes have all required fields", async () => {
    const res = await request(app)
      .post("/api/route")
      .send({ from: "A", to: "H" });
    res.body.path.forEach((node) => {
      expect(node).toHaveProperty("zone");
      expect(node).toHaveProperty("name");
      expect(node).toHaveProperty("density");
      expect(node).toHaveProperty("x");
      expect(node).toHaveProperty("y");
    });
  });

  test("all zone pairs A–H are routable", async () => {
    const zones = ["A", "B", "C", "D", "E", "F", "G", "H"];
    for (const from of zones.slice(0, 4)) {
      for (const to of zones.slice(4)) {
        const res = await request(app).post("/api/route").send({ from, to });
        expect(res.status).toBe(200);
        expect(res.body.path.length).toBeGreaterThan(0);
      }
    }
  });

  test("invalid zone → 400", async () =>
    expect(
      (await request(app).post("/api/route").send({ from: "Z", to: "A" }))
        .status,
    ).toBe(400));
  test("SQL injection → 400", async () =>
    expect(
      (
        await request(app)
          .post("/api/route")
          .send({ from: "A'; DROP TABLE--", to: "G" })
      ).status,
    ).toBe(400));
  test("numeric zone → 400", async () =>
    expect(
      (await request(app).post("/api/route").send({ from: 1, to: "G" })).status,
    ).toBe(400));
  test("empty body → 400", async () =>
    expect((await request(app).post("/api/route").send({})).status).toBe(400));
});

// ─── Order ───────────────────────────────────────────────────────────────────
describe("POST /api/order", () => {
  test("valid order returns confirmed order with UUID", async () => {
    const res = await request(app)
      .post("/api/order")
      .send({ stallId: "s1", items: ["1x Classic Burger"], userId: "fan_001" });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("confirmed");
    expect(res.body.stallId).toBe("s1");
    expect(res.body.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(res.body.waitTime).toBeGreaterThan(0);
    expect(res.body.pointsEarned).toBeGreaterThanOrEqual(5);
    expect(res.body.readyAt).toBeGreaterThan(Date.now() - 1000);
    expect(Array.isArray(res.body.items)).toBe(true);
    expect(res.body.items.length).toBeGreaterThan(0);
  });

  test("XSS in items is stripped", async () => {
    const res = await request(app)
      .post("/api/order")
      .send({
        stallId: "s1",
        items: ["<script>alert(1)</script>"],
        userId: "u1",
      });
    expect(res.status).toBe(200);
    expect(res.body.items[0]).not.toContain("<");
    expect(res.body.items[0]).not.toContain(">");
  });

  test("XSS in userId is stripped", async () => {
    const res = await request(app)
      .post("/api/order")
      .send({ stallId: "s1", items: ["1x Soda"], userId: '<evil>"user' });
    expect(res.status).toBe(200);
    expect(res.body.userId).not.toContain("<");
    expect(res.body.userId).not.toContain('"');
  });

  test("missing userId defaults to guest", async () => {
    const res = await request(app)
      .post("/api/order")
      .send({ stallId: "s1", items: ["1x Cola"] });
    expect(res.status).toBe(200);
    expect(res.body.userId).toBe("guest");
  });

  test("all 4 stalls accept orders", async () => {
    for (const stallId of ["s1", "s2", "s3", "s4"]) {
      const res = await request(app)
        .post("/api/order")
        .send({ stallId, items: ["1x item"], userId: "u1" });
      expect(res.status).toBe(200);
      expect(res.body.stallId).toBe(stallId);
    }
  });

  test("ordersStored increments after order", async () => {
    const before = (await request(app).get("/api/health")).body.ordersStored;
    await request(app)
      .post("/api/order")
      .send({ stallId: "s2", items: ["1x Pizza"], userId: "u1" });
    const after = (await request(app).get("/api/health")).body.ordersStored;
    expect(after).toBe(before + 1);
  });

  test("invalid stall → 400", async () =>
    expect(
      (
        await request(app)
          .post("/api/order")
          .send({ stallId: "bad", items: ["x"], userId: "u1" })
      ).status,
    ).toBe(400));
  test("empty items → 400", async () =>
    expect(
      (
        await request(app)
          .post("/api/order")
          .send({ stallId: "s1", items: [], userId: "u1" })
      ).status,
    ).toBe(400));
  test("non-array items → 400", async () =>
    expect(
      (
        await request(app)
          .post("/api/order")
          .send({ stallId: "s1", items: "burger", userId: "u1" })
      ).status,
    ).toBe(400));
  test(">20 items → 400", async () =>
    expect(
      (
        await request(app)
          .post("/api/order")
          .send({ stallId: "s1", items: Array(21).fill("x"), userId: "u1" })
      ).status,
    ).toBe(400));
});

// ─── Recommendations ─────────────────────────────────────────────────────────
describe("GET /api/recommendations", () => {
  test("returns ≤4 recommendations with required fields", async () => {
    const res = await request(app).get("/api/recommendations");
    expect(res.status).toBe(200);
    expect(res.body.recommendations.length).toBeLessThanOrEqual(4);
    res.body.recommendations.forEach((r) => {
      expect(["routing", "order"]).toContain(r.type);
      expect(typeof r.title).toBe("string");
      expect(typeof r.description).toBe("string");
      expect(typeof r.points).toBe("number");
      expect(r.points).toBeGreaterThan(0);
      expect(typeof r.zone).toBe("string");
    });
  });

  test("always includes at least one order type", async () => {
    const res = await request(app).get("/api/recommendations");
    expect(res.body.recommendations.some((r) => r.type === "order")).toBe(true);
  });
});

// ─── Alerts ──────────────────────────────────────────────────────────────────
describe("GET /api/alerts", () => {
  test("returns alerts array (may be empty on fresh start)", async () => {
    const res = await request(app).get("/api/alerts");
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.alerts)).toBe(true);
    expect(res.body.alerts.length).toBeLessThanOrEqual(10);
  });
});

// ─── Metrics ─────────────────────────────────────────────────────────────────
describe("GET /api/metrics", () => {
  test("all fields present with correct types and ranges", async () => {
    const res = await request(app).get("/api/metrics");
    expect(res.status).toBe(200);
    const m = res.body.metrics;
    expect(m.avgDensity).toBeGreaterThanOrEqual(0);
    expect(m.avgDensity).toBeLessThanOrEqual(1);
    expect(m.congestionReduced).toBeGreaterThanOrEqual(0);
    expect(m.congestionReduced).toBeLessThanOrEqual(99);
    expect(m.waitTimeReduced).toBeGreaterThanOrEqual(0);
    expect(m.waitTimeReduced).toBeLessThanOrEqual(99);
    expect(m.satisfactionScore).toBeGreaterThanOrEqual(1);
    expect(m.satisfactionScore).toBeLessThanOrEqual(5);
    // routingImprovement is now dynamically derived from live density (range 40–99)
    expect(m.routingImprovement).toBeGreaterThanOrEqual(40);
    expect(m.routingImprovement).toBeLessThanOrEqual(99);
    expect(typeof m.activeUsers).toBe("number");
    expect(typeof m.ordersProcessed).toBe("number");
  });
});

// ─── Simulate ────────────────────────────────────────────────────────────────
describe("POST /api/simulate", () => {
  test("all 4 valid modes accepted", async () => {
    for (const mode of ["normal", "pre_match", "halftime", "exit_rush"]) {
      const res = await request(app)
        .post("/api/simulate")
        .set("x-admin-key", "test-secret")
        .send({ mode });
      expect(res.status).toBe(200);
      expect(res.body.mode).toBe(mode);
    }
  });

  test("invalid mode → 400", async () =>
    expect(
      (
        await request(app)
          .post("/api/simulate")
          .set("x-admin-key", "test-secret")
          .send({ mode: "invalid" })
      ).status,
    ).toBe(400));
  test("__proto__ injection → 400", async () =>
    expect(
      (
        await request(app)
          .post("/api/simulate")
          .set("x-admin-key", "test-secret")
          .send({ mode: "__proto__" })
      ).status,
    ).toBe(400));
  test("constructor injection → 400", async () =>
    expect(
      (
        await request(app)
          .post("/api/simulate")
          .set("x-admin-key", "test-secret")
          .send({ mode: "constructor" })
      ).status,
    ).toBe(400));
  test("empty body → 400", async () =>
    expect(
      (
        await request(app)
          .post("/api/simulate")
          .set("x-admin-key", "test-secret")
          .send({})
      ).status,
    ).toBe(400));
});

// ─── /api/ai-insights ───────────────────────────────────────────────────────────────────────
describe("GET /api/ai-insights", () => {
  test("returns valid insights object with required fields", async () => {
    const res = await request(app).get("/api/ai-insights");
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("insights");
    expect(res.body).toHaveProperty("timestamp");
    const { insights } = res.body;
    expect(typeof insights.summary).toBe("string");
    expect(insights.summary.length).toBeGreaterThan(0);
    expect(Array.isArray(insights.actions)).toBe(true);
    expect(insights.actions.length).toBeGreaterThan(0);
    expect(typeof insights.source).toBe("string");
    // In test env (no GCP metadata), should fall back to rule-based engine
    expect(["rule-based", "vertex-ai"]).toContain(insights.source);
    expect(typeof insights.model).toBe("string");
  });

  test("summary is a non-trivial string (>10 chars)", async () => {
    const res = await request(app).get("/api/ai-insights");
    expect(res.body.insights.summary.length).toBeGreaterThan(10);
  });

  test("actions array contains non-empty strings", async () => {
    const res = await request(app).get("/api/ai-insights");
    res.body.insights.actions.forEach((a) => {
      expect(typeof a).toBe("string");
      expect(a.length).toBeGreaterThan(0);
    });
  });

  test("second call within cache window is marked cached", async () => {
    // First call primes the cache
    await request(app).get("/api/ai-insights");
    // Second call within 30s TTL should be cached
    const res = await request(app).get("/api/ai-insights");
    expect(res.status).toBe(200);
    // cached flag is set to true when returned from cache
    expect(res.body.insights.cached).toBe(true);
  });

  test("timestamp is a recent Unix ms timestamp", async () => {
    const before = Date.now();
    const res = await request(app).get("/api/ai-insights");
    const after = Date.now();
    expect(res.body.timestamp).toBeGreaterThanOrEqual(before);
    expect(res.body.timestamp).toBeLessThanOrEqual(after + 100);
  });
});

// ─── 404 catch-all ───────────────────────────────────────────────────────────
describe("Unknown routes", () => {
  test("GET unknown /api/* → 404 JSON", async () => {
    const res = await request(app).get("/api/unknown_endpoint");
    expect(res.status).toBe(404);
    expect(res.body).toHaveProperty("error");
  });
  test("POST unknown /api/* → 404 JSON", async () => {
    const res = await request(app).post("/api/unknown_endpoint").send({});
    expect(res.status).toBe(404);
    expect(res.body).toHaveProperty("error");
  });
});

// ─── Body size / malformed ───────────────────────────────────────────────────
describe("Edge cases", () => {
  test("oversized body returns 413 or 400", async () => {
    const bigString = "x".repeat(52 * 1024);
    const res = await request(app)
      .post("/api/order")
      .set("Content-Type", "application/json")
      .send(
        JSON.stringify({ stallId: "s1", items: [bigString], userId: "u1" }),
      );
    expect([400, 413]).toContain(res.status);
  });

  test("malformed JSON returns 400", async () => {
    const res = await request(app)
      .post("/api/route")
      .set("Content-Type", "application/json")
      .send("{ bad json }");
    expect(res.status).toBe(400);
  });
});

// ─── DB persistence verification ─────────────────────────────────────────────
describe("DB persistence — orders and alerts survive in-session", () => {
  test("multiple orders are all retrievable via health endpoint", async () => {
    const before = (await request(app).get("/api/health")).body.ordersStored;
    // Place 3 orders
    for (const stallId of ["s1", "s2", "s3"]) {
      await request(app)
        .post("/api/order")
        .send({
          stallId,
          items: [`1x item from ${stallId}`],
          userId: "db_test",
        });
    }
    const after = (await request(app).get("/api/health")).body.ordersStored;
    expect(after).toBe(before + 3);
  });

  test("queue stalls reflect live density from sim engine", async () => {
    const queue = await request(app).get("/api/queue");
    const heatmap = await request(app).get("/api/heatmap");
    // Each stall zone's density should match heatmap
    queue.body.stalls.forEach((stall) => {
      const zone = heatmap.body.heatmap.find((z) => z.zone === stall.zone);
      expect(stall.density).toBeCloseTo(zone.density, 3);
    });
  });

  test("recommendations order rec reflects live queue wait times", async () => {
    const queue = await request(app).get("/api/queue");
    const recs = await request(app).get("/api/recommendations");
    const orderRec = recs.body.recommendations.find((r) => r.type === "order");
    const minWait = Math.min(...queue.body.stalls.map((s) => s.waitTime));
    // The order recommendation should reference the stall with the lowest wait
    expect(orderRec.description).toContain(`${minWait}-min`);
  });
});

// ─── Async route error forwarding (catchAsync) ────────────────────────────────
describe("Async route error handling", () => {
  test("DB failure in /api/order returns 500 not a hang", async () => {
    // Temporarily break the sim's addOrder to simulate a DB failure
    const simModule = require("../src/services/simulation");
    const original = simModule.addOrder.bind(simModule);
    simModule.addOrder = async () => {
      throw new Error("DB write failed");
    };

    const res = await request(app)
      .post("/api/order")
      .send({ stallId: "s1", items: ["1x Burger"], userId: "error_test" });

    // Restore
    simModule.addOrder = original;

    // Should return 500, NOT hang indefinitely
    expect(res.status).toBe(500);
    expect(res.body).toHaveProperty("error");
  });
});

// ─── /api/best-route ─────────────────────────────────────────────────────────
describe("POST /api/best-route", () => {
  test("returns auto-calculated best route from zone A", async () => {
    const res = await request(app).post("/api/best-route").send({ from: "A" });
    expect(res.status).toBe(200);
    expect(res.body.from).toBe("A");
    expect(res.body.to).not.toBe("A"); // must suggest a different zone
    expect(Array.isArray(res.body.path)).toBe(true);
    expect(res.body.path.length).toBeGreaterThan(0);
    expect(res.body.path[0].zone).toBe("A");
    expect(typeof res.body.toName).toBe("string");
    expect(typeof res.body.estimatedMinutes).toBe("number");
    expect([3, 8, 15]).toContain(res.body.pointsEarned);
    expect(typeof res.body.reason).toBe("string");
    expect(typeof res.body.currentDensity).toBe("number");
    expect(typeof res.body.destDensity).toBe("number");
    expect(typeof res.body.improvement).toBe("number");
  });

  test("works for all 8 starting zones", async () => {
    for (const from of ["A", "B", "C", "D", "E", "F", "G", "H"]) {
      const res = await request(app).post("/api/best-route").send({ from });
      expect(res.status).toBe(200);
      expect(res.body.from).toBe(from);
      expect(res.body.to).not.toBe(from);
    }
  });

  test("invalid zone returns 400", async () => {
    const res = await request(app).post("/api/best-route").send({ from: "Z" });
    expect(res.status).toBe(400);
  });

  test("missing from returns 400", async () => {
    const res = await request(app).post("/api/best-route").send({});
    expect(res.status).toBe(400);
  });
});

// ─── /api/crowd-status ───────────────────────────────────────────────────────
describe("GET /api/crowd-status", () => {
  test("returns all required fields", async () => {
    const res = await request(app).get("/api/crowd-status");
    expect(res.status).toBe(200);
    expect(["critical", "high", "moderate", "calm"]).toContain(res.body.level);
    expect(typeof res.body.message).toBe("string");
    expect(typeof res.body.avgDensity).toBe("number");
    expect(res.body.avgDensity).toBeGreaterThanOrEqual(0);
    expect(res.body.avgDensity).toBeLessThanOrEqual(1);
    expect(Array.isArray(res.body.critical)).toBe(true);
    expect(Array.isArray(res.body.quiet)).toBe(true);
    expect(res.body.bestStall).toHaveProperty("name");
    expect(res.body.bestStall).toHaveProperty("waitTime");
    expect(res.body.bestStall.waitTime).toBeGreaterThan(0);
    expect(typeof res.body.timestamp).toBe("number");
  });

  test("bestStall has lowest wait time of all stalls", async () => {
    const status = await request(app).get("/api/crowd-status");
    const queue = await request(app).get("/api/queue");
    const minWait = Math.min(...queue.body.stalls.map((s) => s.waitTime));
    expect(status.body.bestStall.waitTime).toBe(minWait);
  });
});

// ─── /api/alert (POST manual staff alert) ────────────────────────────────────
describe("POST /api/alert", () => {
  test("valid alert injected and returned", async () => {
    const res = await request(app)
      .post("/api/alert")
      .send({
        zone: "B",
        message: "Crowd control needed at West Stand",
        type: "warning",
      });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.alert.zone).toBe("B");
    expect(res.body.alert.type).toBe("warning");
    expect(res.body.alert.source).toBe("staff");
    expect(typeof res.body.alert.id).toBe("string");
  });

  test("critical type accepted", async () => {
    const res = await request(app)
      .post("/api/alert")
      .send({
        zone: "A",
        message: "Emergency at North Gate",
        type: "critical",
      });
    expect(res.status).toBe(200);
    expect(res.body.alert.type).toBe("critical");
  });

  test("defaults to warning type when type omitted", async () => {
    const res = await request(app)
      .post("/api/alert")
      .send({ zone: "C", message: "Monitoring South Gate" });
    expect(res.status).toBe(200);
    expect(res.body.alert.type).toBe("warning");
  });

  test("alert appears in subsequent /api/alerts response", async () => {
    await request(app)
      .post("/api/alert")
      .send({
        zone: "D",
        message: "East Stand — stewards deployed",
        type: "warning",
      });
    const alertsRes = await request(app).get("/api/alerts");
    const found = alertsRes.body.alerts.some(
      (a) => a.zone === "D" && a.source === "staff",
    );
    expect(found).toBe(true);
  });

  test("invalid zone returns 400", async () =>
    expect(
      (
        await request(app)
          .post("/api/alert")
          .send({ zone: "Z", message: "test" })
      ).status,
    ).toBe(400));
  test("missing message returns 400", async () =>
    expect(
      (await request(app).post("/api/alert").send({ zone: "A", message: "" }))
        .status,
    ).toBe(400));
  test("invalid type returns 400", async () =>
    expect(
      (
        await request(app)
          .post("/api/alert")
          .send({ zone: "A", message: "test", type: "fake" })
      ).status,
    ).toBe(400));
  test("message capped at 200 chars", async () => {
    const long = "x".repeat(300);
    const res = await request(app)
      .post("/api/alert")
      .send({ zone: "E", message: long });
    expect(res.status).toBe(200);
    expect(res.body.alert.message.length).toBeLessThanOrEqual(200);
  });
});
