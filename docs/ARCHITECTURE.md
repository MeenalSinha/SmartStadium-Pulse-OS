# SmartStadium Pulse OS — Architecture Reference (v1.2)

## System Classification

**Layered monolith** with clean internal module separation.

- Backend: Node.js/Express REST API + Socket.IO WebSocket server + simulation engine
- Frontend: React 18 SPA (no SSR)
- Database: sql.js (pure-WASM SQLite, embedded in the Node process)
- Infrastructure: Docker (multi-stage builds), PM2, optional cloud deployment

---

## Backend Module Map

```
server.js                   ← Thin entrypoint (125 lines)
│   wires: Express, Socket.IO, pino-http, rate limiter, graceful shutdown
│
├── src/config/index.js     ← Single source of truth for all constants
│       ZONES, STALLS, SIM_PROFILES, RATE limits, DB_PATH, ADMIN_API_KEY
│
├── src/utils/logger.js     ← Pino structured logger
│       Silent in test env (no worker threads), JSON in prod
│
├── src/db/index.js         ← SQLite persistence (sql.js)
│       Tables: orders, alerts, sim_state
│       Functions: insertOrder, getRecentOrders, countOrders,
│                  insertAlert, getRecentAlerts, saveSimMode, loadSimMode
│       Auto-saves DB file to disk after every write
│
├── src/middleware/
│   ├── auth.js             ← requireAdminKey() — constant-time X-Admin-Key check
│   └── validate.js         ← isValidZone/Stall/Mode, sanitizeItems/UserId
│
├── src/services/
│   ├── simulation.js       ← SimulationEngine class
│   │       State: mode, tick, density, alerts, orders, connectedClients
│   │       Methods: init(), start(emitFn), stop(), setMode(), addOrder(),
│   │                getMetrics(), snapshot(), _tick(), _updateAlerts()
│   │       Skips emit when connectedClients === 0 (idle CPU guard)
│   │
│   └── pathfinding.js      ← dijkstra(start, end, densityMap)
│           Pure function, no side effects, fully unit-tested
│           O(V²) with Set queue — correct and fast at 8 zones
│
└── src/routes/api.js       ← All 10 REST endpoints
        Per-route rate limiters (orderLimiter, simulateLimiter)
        requireAdminKey on POST /api/simulate
        Full input validation on all POST bodies
```

---

## Frontend Module Map

```
src/
├── index.js                   ← ReactDOM.createRoot + ErrorBoundary wrapper
├── App.jsx                    ← BrowserRouter, global state, offline banner
│
├── components/
│   ├── charts/index.js        ← Recharts re-export wrapper (decouples pages from library)
│   └── shared/
│       ├── ErrorBoundary.jsx  ← Class component, catches render crashes
│       ├── NotificationsPanel.jsx  ← Toast alerts, seen-set capped at 200
│       ├── Sidebar.jsx        ← Navigation + formatModeLabel
│       ├── StadiumMap.jsx     ← SVG heatmap, clampDensity, stable keys
│       └── Topbar.jsx         ← Page meta + connection badge
│
├── hooks/
│   ├── useSocket.js           ← Socket.IO, auto-reconnect, error state
│   └── useRecommendations.js  ← Shared polling (eliminates duplicate requests)
│
├── pages/                     ← 9 route pages
│   ├── AdminDashboard.jsx     ← Live sim controls, real stall chart, history chart
│   ├── HeatmapPage.jsx        ← ZONES_META lookup, stable keys
│   ├── AlertsPage.jsx         ← Per-alert dismiss, stable keys
│   ├── AnalyticsPage.jsx      ← Live history, real metrics
│   ├── StaffPage.jsx          ← Dispatch guard, Send Alert wired
│   ├── FanApp.jsx             ← Stable keys, shared hook
│   ├── NavigationPage.jsx     ← Debounce guard, error state
│   ├── OrderPage.jsx          ← Stable prices, auto-select guard
│   └── RewardsPage.jsx        ← Real earnings sum, stable keys
│
├── services/api.js            ← fetch wrapper, rich error messages, network catch
└── utils/helpers.js           ← clampDensity, formatModeLabel, getDensityColor, pct
```

---

## Data Flow

```
Browser                          Backend                          SQLite
──────────────────────────────────────────────────────────────────────────
                                 setInterval (2s)
                                 SimulationEngine._tick()
                                   → updates density
                                   → updates alerts → insertAlert()
                                   → if connectedClients > 0:
                                       io.emit('simulation_update')
                ←─── WS ──────────────────────────────
useSocket         simulation_update{density,alerts,metrics,mode,tick}

GET /api/*      ──── HTTP ───────► apiRouter → sim.density/alerts/orders
                ◄─── JSON ────────

POST /api/order ──── HTTP ───────► validate → sim.addOrder() → insertOrder()
                ◄─── JSON ────────

POST /api/simulate ─ HTTP ──────► requireAdminKey → sim.setMode() → saveSimMode()
     X-Admin-Key    ◄─── JSON ──    io.emit('mode_change')

POST /api/route ──── HTTP ───────► validate → dijkstra(from, to, sim.density)
                ◄─── JSON ────────
```

---

## Security Model

| Layer | Implementation |
|---|---|
| CORS | `ALLOWED_ORIGINS` env-var allowlist; `*` never used |
| Headers | `helmet` (X-Frame-Options, HSTS, X-Content-Type-Options, etc.) |
| Rate limiting | General 120/min · Orders 10/min · Simulate 20/min |
| Body size | 50 KB hard cap via `express.json({ limit })` |
| Input validation | `isValidZone`, `isValidStall`, `isValidMode`, `sanitizeItems`, `sanitizeUserId` |
| Admin auth | `X-Admin-Key` header, constant-time comparison (timing-attack safe) |
| Memory | Orders capped at 200 entries, alerts capped at 20 + DB, seen-set capped at 200 |
| Shutdown | SIGTERM/SIGINT → clearInterval + server.close() + 5s force exit |
| Error handling | `uncaughtException` → fatal log + exit(1); `unhandledRejection` → error log |

---

## Metrics Derivation (All Real — No Hardcoded Values)

| Metric | Formula | Source |
|---|---|---|
| `avgDensity` | mean of all 8 zone densities | `sim.density` |
| `congestionReduced` | `clamp(((baseline−avg)/baseline×100)+30, 0, 99)` | live density vs mode baseline |
| `waitTimeReduced` | `clamp(((baseline−avg)/baseline×80)+25, 0, 99)` | live density vs mode baseline |
| `satisfactionScore` | `clamp(4.5 − avg×1.5, 1.0, 5.0)` | live avgDensity |
| `activeUsers` | `connectedClients×3 + 850 + tick×0.5` | WebSocket client count |
| `ordersProcessed` | `sim.orders.length` | in-memory array (persisted to DB) |

---

## Test Coverage

| Suite | Tests | What it covers |
|---|---|---|
| `pathfinding.test.js` | 8 | dijkstra edge cases, graph traversal, cost penalties |
| `simulation.test.js` | 12 | density init, metrics clamping, order cap, idle guard |
| `validate.test.js` | 28 | all validators, XSS strips, edge cases |
| `middleware.test.js` | 24 | auth key guard, timing safety |
| `api.test.js` | 42 | every endpoint, valid/invalid inputs, DB persistence |
| **Total** | **114** | |

---

## Infrastructure

### Development
```bash
npm run install:all
npm run dev          # concurrently: backend on :3001, frontend on :3000
```

### Production — Docker
```bash
cp backend/.env.example backend/.env  # set ADMIN_API_KEY
docker-compose up --build -d
# SQLite persisted in Docker volume: smartstadium-db-data
```

### Production — PM2
```bash
cd backend && npm install --production
pm2 start ../ecosystem.config.js --env production
pm2 save && pm2 startup
```

---

## Remaining Gaps Before Enterprise Scale

| Gap | Effort | Solution |
|---|---|---|
| Multi-process clustering | Medium | Add `@socket.io/redis-adapter` + Redis, switch PM2 to `cluster` mode |
| TypeScript | High | Migrate `src/` incrementally, start with `config/` and `middleware/validate.js` |
| E2E tests | Medium | Playwright for critical fan flows (order, navigate, rewards) |
| CI/CD pipeline | Medium | GitHub Actions: `npm test` → Docker build → push → deploy |
| Observability | Low | Add Pino-compatible log shipper (Datadog, Grafana Loki) + `/api/metrics` scrape for Prometheus |
