import React, { useState } from "react";
import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
  useLocation,
  useNavigate,
} from "react-router-dom";
import { api } from "./services/api";
import { useSocket } from "./hooks/useSocket";
import Sidebar from "./components/shared/Sidebar";
import Topbar from "./components/shared/Topbar";
import NotificationsPanel from "./components/shared/NotificationsPanel";

import AdminDashboard from "./pages/AdminDashboard";
import HeatmapPage from "./pages/HeatmapPage";
import AlertsPage from "./pages/AlertsPage";
import AnalyticsPage from "./pages/AnalyticsPage";
import StaffPage from "./pages/StaffPage";
import FanApp from "./pages/FanApp";
import NavigationPage from "./pages/NavigationPage";
import OrderPage from "./pages/OrderPage";
import RewardsPage from "./pages/RewardsPage";

import "./styles/global.css";

function AppInner() {
  const location = useLocation();
  const navigate = useNavigate();
  const {
    connected,
    simData,
    mode,
    connectionError,
    activeNudge,
    dismissNudge,
  } = useSocket();
  const [points, setPoints] = useState(0);
  const [recentActivity, setRecentActivity] = useState([]);

  const handlePointsEarned = (pts, action) => {
    setPoints((prev) => prev + pts);
    setRecentActivity((prev) => [
      ...prev,
      {
        action: action || "Points earned",
        points: pts,
        time: new Date().toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        }),
      },
    ]);
  };

  const handleModeChange = (newMode) => {
    api.setSimMode(newMode).catch(console.error);
  };

  const alerts = simData?.alerts || [];

  return (
    <div className="app-shell">
      <Sidebar connected={connected} mode={mode} />
      <div className="main-content">
        <Topbar
          pathname={location.pathname}
          connected={connected}
          points={points}
          mode={mode}
        />

        {/* Offline banner */}
        {connectionError && (
          <div
            style={{
              padding: "10px 24px",
              background: "rgba(245,158,11,0.1)",
              borderBottom: "1px solid rgba(245,158,11,0.2)",
              fontSize: 12,
              color: "var(--yellow)",
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            <span>⚠️</span>
            <strong>Backend offline:</strong>&nbsp;{connectionError}. Retrying
            automatically…
          </div>
        )}

        {/* Proactive nudge banner — fan routes only */}
        {activeNudge && location.pathname.startsWith("/app") && (
          <div
            style={{
              padding: "14px 24px",
              background:
                "linear-gradient(135deg, rgba(59,130,246,0.15) 0%, rgba(139,92,246,0.12) 50%, rgba(16,185,129,0.10) 100%)",
              borderBottom: "1px solid rgba(59,130,246,0.25)",
              display: "flex",
              alignItems: "center",
              gap: 14,
              position: "relative",
              overflow: "hidden",
            }}
          >
            <div className="scan-line" style={{ opacity: 0.5 }} />
            <div style={{ fontSize: 24, flexShrink: 0 }}>🤖</div>
            <div style={{ flex: 1 }}>
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  letterSpacing: "0.08em",
                  color: "var(--accent-hover)",
                  fontFamily: "'JetBrains Mono',monospace",
                  marginBottom: 2,
                }}
              >
                AI CROWD ALERT — {activeNudge.fromZoneName?.toUpperCase()} IS{" "}
                {activeNudge.crowdedPct}% FULL
              </div>
              <div style={{ fontSize: 13, color: "var(--text-primary)" }}>
                {activeNudge.message}
              </div>
            </div>
            <button
              onClick={() => {
                dismissNudge();
                navigate("/app/navigate", {
                  state: {
                    autoFrom: activeNudge.fromZone,
                    autoTo: activeNudge.toZone,
                  },
                });
              }}
              className="btn btn-primary"
              style={{ flexShrink: 0, gap: 6 }}
            >
              +{activeNudge.pointsReward} pts — Navigate Now
            </button>
            <button
              onClick={dismissNudge}
              style={{
                background: "none",
                border: "none",
                color: "var(--text-muted)",
                cursor: "pointer",
                padding: 4,
                fontSize: 18,
                lineHeight: 1,
                flexShrink: 0,
              }}
            >
              ×
            </button>
          </div>
        )}

        <div className="page-content">
          <Routes>
            <Route
              path="/admin"
              element={
                <AdminDashboard
                  simData={simData}
                  mode={mode}
                  onModeChange={handleModeChange}
                />
              }
            />
            <Route
              path="/admin/heatmap"
              element={<HeatmapPage simData={simData} />}
            />
            <Route
              path="/admin/alerts"
              element={<AlertsPage simData={simData} />}
            />
            <Route
              path="/admin/analytics"
              element={<AnalyticsPage simData={simData} />}
            />
            <Route
              path="/admin/staff"
              element={<StaffPage simData={simData} />}
            />
            <Route
              path="/app"
              element={<FanApp simData={simData} points={points} />}
            />
            <Route
              path="/app/navigate"
              element={
                <NavigationPage
                  simData={simData}
                  onPointsEarned={handlePointsEarned}
                />
              }
            />
            <Route
              path="/app/order"
              element={<OrderPage onPointsEarned={handlePointsEarned} />}
            />
            <Route
              path="/app/rewards"
              element={
                <RewardsPage points={points} recentActivity={recentActivity} />
              }
            />
            <Route path="*" element={<Navigate to="/admin" replace />} />
          </Routes>
        </div>
      </div>
      <NotificationsPanel alerts={alerts} />
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AppInner />
    </BrowserRouter>
  );
}
