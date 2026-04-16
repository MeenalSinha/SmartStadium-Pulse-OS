# SmartStadium Pulse OS

A real-time stadium operations platform: crowd density simulation, AI-assisted routing (Dijkstra), queue elimination, staff dispatch, and a fan rewards engine.

---

## Quick Start

```bash
# 1. Install all dependencies
npm run install:all

# 2. Configure backend
cp backend/.env.example backend/.env
# Edit backend/.env — set ADMIN_API_KEY for production

# 3. Start both servers (requires concurrently)
npm run dev
# Backend:  http://localhost:3001
# Frontend: http://localhost:3000
```

---

## Project Structure

```
smartstadium/
├── backend/
│   ├── server.js              # Thin entrypoint — wires Express + Socket.IO
│   ├── src/
│   │   ├── config/index.js    # All constants: zones, stalls, rate limits, sim profiles
│   │   ├── db/index.js        # SQLite persistence (sql.js) — orders, alerts, sim state
│   │   ├── middleware/
│   │   │   ├── auth.js        # X-Admin-Key guard with constant-time comparison
│   │   │   └── validate.js    # Input sanitisation — zones, stalls, items, userIds
│   │   ├── routes/api.js      # All REST endpoints
│   │   ├── services/
│   │   │   ├── simulation.js  # SimulationEngine class — tick loop, density, metrics
│   │   │   └── pathfinding.js # dijkstra() — pure function, testable in isolation
│   │   └── utils/logger.js    # Pino structured logger (silent in test env)
│   └── tests/
│       ├── pathfinding.test.js  # 8 unit tests
│       ├── simulation.test.js   # 12 unit tests
│       ├── validate.test.js     # 28 unit tests
│       ├── middleware.test.js   # auth middleware tests
│       └── api.test.js          # 42+ integration tests (supertest)
│
├── frontend/
│   └── src/
│       ├── App.jsx                    # Router, global state, connection error banner
│       ├── index.js                   # ReactDOM root + ErrorBoundary
│       ├── components/
│       │   ├── charts/index.js        # Recharts re-export wrapper (swap-safe)
│       │   └── shared/
│       │       ├── ErrorBoundary.jsx  # Catches white-screen render crashes
│       │       ├── NotificationsPanel.jsx
│       │       ├── Sidebar.jsx
│       │       ├── StadiumMap.jsx     # SVG heatmap + Dijkstra path overlay
│       │       └── Topbar.jsx
│       ├── hooks/
│       │   ├── useSocket.js           # Socket.IO with auto-reconnect + error state
│       │   └── useRecommendations.js  # Shared polling hook (prevents duplicate requests)
│       ├── pages/                     # 9 pages: Admin + Fan views
│       ├── services/api.js            # Typed fetch wrapper with rich error messages
│       └── utils/helpers.js           # clampDensity, formatModeLabel, getDensityColor
│
├── docker-compose.yml    # Backend + frontend + SQLite volume
├── ecosystem.config.js   # PM2 process manager
└── docs/ARCHITECTURE.md  # Full architecture reference
```

---

## Environment Variables

### Backend (`backend/.env`)

| Variable | Default | Description |
|---|---|---|
| `PORT` | `3001` | HTTP server port |
| `NODE_ENV` | `development` | `development` / `production` / `test` |
| `ALLOWED_ORIGINS` | `http://localhost:3000,...` | Comma-separated CORS allowlist |
| `ADMIN_API_KEY` | *(empty)* | If set, `POST /api/simulate` requires `X-Admin-Key` header. Generate: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` |
| `DB_PATH` | `./data/stadium.db` | SQLite file path. Use `:memory:` for ephemeral storage |
| `LOG_LEVEL` | `info` | Pino log level: `fatal\|error\|warn\|info\|debug\|silent` |

### Frontend (`frontend/.env`)

| Variable | Default | Description |
|---|---|---|
| `REACT_APP_API_URL` | `http://localhost:3001` | Backend URL — baked into the bundle at build time |

---

## Docker

```bash
# Build and start
cp backend/.env.example backend/.env   # set ADMIN_API_KEY
docker-compose up --build -d

# SQLite data persists in a named Docker volume (smartstadium-db-data)
# It survives container restarts and docker-compose down (not docker-compose down -v)

# Logs
docker-compose logs -f backend

# Stop
docker-compose down
```

For cloud deployments, pass the API URL at build time:
```bash
docker-compose build --build-arg REACT_APP_API_URL=https://api.yourdomain.com frontend
```

---

## PM2

```bash
npm install -g pm2
cd backend && npm install --production
pm2 start ../ecosystem.config.js --env production
pm2 save && pm2 startup     # survive server reboots
pm2 logs smartstadium-backend
```

---

## Tests

```bash
cd backend
npm test                  # run all 114 tests
npm run test:coverage     # with coverage report
```

Coverage targets: 70% lines / functions / statements, 60% branches.

---

## API Reference

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/api/health` | None | Deep health check (memory, tick, clients) |
| GET | `/api/heatmap` | None | Zone density map |
| GET | `/api/zones` | None | All zones with live density |
| GET | `/api/queue` | None | Stall wait times, AI-ranked |
| GET | `/api/alerts` | None | Last 10 active alerts |
| GET | `/api/metrics` | None | Live KPIs (all derived, not hardcoded) |
| GET | `/api/recommendations` | None | Up to 4 live AI suggestions |
| POST | `/api/route` | None | Dijkstra pathfinding `{ from, to }` |
| POST | `/api/order` | None | Place order `{ stallId, items, userId }` — rate limited 10/min |
| POST | `/api/simulate` | `X-Admin-Key` | Change sim mode — rate limited 20/min |

---

## Security

- **Helmet** — sets X-Frame-Options, X-Content-Type-Options, HSTS, etc.
- **CORS allowlist** — only listed origins accepted; `*` never used
- **Rate limiting** — general 120/min, orders 10/min, simulate 20/min
- **Body size cap** — 50 KB limit prevents JSON bomb DoS
- **Input validation** — all POST bodies validated and sanitised (zone IDs, stall IDs, items, userId)
- **Admin auth** — constant-time key comparison on sensitive endpoints (timing-attack safe)
- **Structured logging** — every request logged with unique ID; no secrets in logs

cp .env.example .env # Ensure GOOGLE_CLOUD_PROJECT is set for Vertex AI
npm run dev

# Frontend
cd frontend
npm start
```
