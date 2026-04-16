# SmartStadium Pulse OS — Changelog

## [1.3.0] — 2026-04-16

### Added
- **Vertex AI Integration:** Gemini 2.5 Flash operational insights.
- **API Caching:** 2-second in-memory TTL for dashboard-hot endpoints (`/heatmap`, `/metrics`).
- **Security Middleware:** Integrated `compression`, `xss-clean`, and `hpp` (HTTP Parameter Pollution).
- **Hardened CSP:** Updated Helmet configuration with strict `default-src 'none'` for API.
- **Accessibility:** Added Skip-to-Content, screen-reader regions, and reduced-motion support.

### Changed
- **Model Upgrade:** Migrated from Gemini 1.5 Flash to **Gemini 2.5 Flash**.
- **Test Suite:** Expanded coverage from 114 to **174 passing tests**, including Vertex AI mocked integration.
- **Documentation:** Complete overhaul of README and internal docs.

### Fixed
- **npm vulnerabilities:** Resolved 27 production vulnerabilities via audit fix.
- **Stateless Persistence:** Improved SQLite sync-to-disk logic for better simulation reliability.
- **Linting:** Standardized codebase with **ESLint 10** across both frontend and backend.

---

## [1.2.0] — 2026-04-16

### Added
- Pathfinding rewards engine (15 pts for safe routing).
- Dijkstra-based multi-zone routing.
- Admin scenario controls (`pre_match`, `halftime`, `exit_rush`).

---

## [1.0.0] — 2026-04-10
### Initial Release
- Real-time heatmapping engine.
- WebSocket live-sync.
- Basic fan navigation and food ordering.
