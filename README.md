# SmartStadium Pulse OS

**Official Repository:** [https://github.com/MeenalSinha/SmartStadium-Pulse-OS](https://github.com/MeenalSinha/SmartStadium-Pulse-OS)

SmartStadium Pulse OS is an enterprise-grade, cloud-native operational dashboard designed to optimize crowd management and fan experience in massive sports and entertainment venues. By combining real-time IoT simulation, Dijkstra-based pathfinding, and Google Vertex AI, it prevents crowd crushes, eliminates queues, and provides staff with actionable intelligence.

---

## 🌟 Key Features

*   **Real-time Heatmapping:** Live occupancy tracking across 8 stadium zones using simulated IoT telemetry.
*   **Behavioral AI Dashboard:** Operational insights powered by **Google Gemini 2.5 Flash**, providing situational summaries and tactical recommendations.
*   **Dynamic Fan Guidance:** Safe routing for fans that avoids high-density chokepoints using density-weighted Dijkstra pathfinding.
*   **ZeroQueue Rewards:** Incentivized crowd redistribution that rewards fans for moving to low-congestion areas.
*   **Production-Hardened:** Built with strict CSP, rate limiting, GZIP compression, and 170+ automated tests.

---

## 🏗️ Project Architecture

The system is designed as a high-performance **Layered Monolith**:
-   **Frontend:** React 18 SPA utilizing Recharts for analytics and Socket.IO for real-time updates.
-   **Backend:** Node.js/Express server managing a deterministic crowd simulation engine.
-   **Intelligence:** Google Vertex AI (Gemini 2.5 Flash) integration via Application Default Credentials.
-   **Database:** Persistent SQLite (via `sql.js`) for order history and system state.

---

## 🚦 Getting Started

### Prerequisites
- Node.js 20+
- npm 10+
- A Google Cloud Project (for Vertex AI features)

### Local Setup
```bash
# 1. Clone and install all dependencies
npm run install:all

# 2. Configure Environment
cd backend
cp .env.example .env
# Required: Set GOOGLE_CLOUD_PROJECT for AI features

# 3. Running in Development
npm run dev
```

### Environment Variables
| Variable | Description | Default |
|---|---|---|
| `PORT` | Backend service port | `3001` |
| `ADMIN_API_KEY` | Secret for simulation controls | `test-secret` |
| `GOOGLE_CLOUD_PROJECT` | Your GCP project ID | *(required)* |
| `DB_PATH` | Path to SQLite file | `./data/stadium.db` |

---

## 🛠️ Operational Commands

| Command | Description |
|---|---|
| `npm run dev` | Starts frontend and backend concurrently |
| `npm test` | Runs the full backend test suite (174 tests) |
| `npm run build` | Generates a production-ready frontend bundle |
| `docker-compose up` | Launches the entire stack in containers |

---

## 🧪 Documentation Index

*   [**Architecture Reference**](docs/ARCHITECTURE.md) — Detailed internal module mapping and data flow.
*   [**API Documentation**](docs/API.md) — Complete REST and WebSocket endpoint reference.
*   [**Deployment Guide**](docs/DEPLOYMENT.md) — Instructions for Google Cloud Run and Docker deployment.
*   [**Setup Guide**](docs/SETUP.md) — Detailed local environment preparation.
*   [**Contribution Standards**](CONTRIBUTING.md) — Code style and testing requirements.

---

## 🛡️ Security & Performance
-   **Helmet.js:** Strict Content Security Policy (`default-src 'none'`) and XSS protection.
-   **Rate Limiting:** Global and endpoint-specific caps to prevent DDoS and brute-force.
-   **API Caching:** 2-second in-memory caching for hot endpoints (Heatmap, Metrics) to maximize CPU efficiency.
-   **Data Integrity:** Constant-time admin key comparison and sanitized inputs via DOMPurify and Regex.

---

## ❓ Troubleshooting

**AI Insights showing 0%?**
Ensure `GOOGLE_CLOUD_PROJECT` is set in `backend/.env` and that your terminal/environment is authenticated with Google Cloud (`gcloud auth application-default login`).

**WebSocket Connection Failed?**
Check if `REACT_APP_API_URL` in `frontend/.env` matches your backend port (default 3001).

**Tests Failing?**
Ensure the `data/` directory is writable for the SQLite engine.

---

## 📜 License
This project is proprietary and built for technical evaluation.
