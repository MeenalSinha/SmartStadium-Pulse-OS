import React from "react";
import PropTypes from "prop-types";
import { formatModeLabel } from "../../utils/helpers";

const PAGE_META = {
  "/admin": { title: "Command Dashboard", sub: "AI behavioral engine active" },
  "/admin/heatmap": { title: "Live Heatmap", sub: "Real-time zone density" },
  "/admin/alerts": {
    title: "Alerts & Dispatch",
    sub: "Automated + staff alerts",
  },
  "/admin/analytics": { title: "Analytics", sub: "System performance metrics" },
  "/admin/staff": {
    title: "Staff Dispatch",
    sub: "AI-recommended deployments",
  },
  "/app": { title: "Fan Experience", sub: "Pulse OS companion" },
  "/app/navigate": { title: "Smart Navigation", sub: "Crowd-avoiding routes" },
  "/app/order": { title: "ZeroQueue Order", sub: "Skip every queue" },
  "/app/rewards": {
    title: "Pulse Rewards",
    sub: "Behavioral incentive engine",
  },
};

const MODE_COLORS = {
  normal: "#10B981",
  pre_match: "#F59E0B",
  halftime: "#EF4444",
  exit_rush: "#8B5CF6",
};

export default function Topbar({ pathname, connected, points, mode }) {
  const meta = PAGE_META[pathname] || {
    title: "SmartStadium",
    sub: "Pulse OS",
  };

  return (
    <header className="topbar">
      <div>
        <div
          style={{
            fontSize: 15,
            fontWeight: 700,
            color: "var(--text-primary)",
            letterSpacing: "-0.02em",
            fontFamily: "'Bricolage Grotesque', sans-serif",
          }}
        >
          {meta.title}
        </div>
        <div
          style={{
            fontSize: 10,
            color: "var(--text-muted)",
            marginTop: 1,
            fontFamily: "'JetBrains Mono', monospace",
            letterSpacing: "0.04em",
          }}
        >
          {meta.sub}
        </div>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        {/* Mode indicator */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            padding: "4px 12px",
            borderRadius: 100,
            background: `${MODE_COLORS[mode] ?? "#10B981"}18`,
            border: `1px solid ${MODE_COLORS[mode] ?? "#10B981"}40`,
            fontSize: 10,
            fontWeight: 700,
            color: MODE_COLORS[mode] ?? "var(--green)",
            fontFamily: "'JetBrains Mono', monospace",
            letterSpacing: "0.06em",
          }}
        >
          <div
            style={{
              width: 5,
              height: 5,
              borderRadius: "50%",
              background: "currentColor",
              opacity: 0.8,
            }}
          />
          {formatModeLabel(mode).toUpperCase()}
        </div>

        {/* Points */}
        {points > 0 && <div className="points-chip">⭐ {points} pts</div>}

        {/* Connection */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 5,
            fontSize: 10,
            fontFamily: "'JetBrains Mono', monospace",
            color: connected ? "var(--green)" : "var(--red)",
          }}
        >
          <div
            style={{
              width: 6,
              height: 6,
              borderRadius: "50%",
              background: "currentColor",
              boxShadow: connected ? "0 0 6px var(--green-glow)" : "none",
            }}
          />
          {connected ? "LIVE" : "OFFLINE"}
        </div>
      </div>
    </header>
  );
}

Topbar.propTypes = {
  /** Current route pathname (e.g. '/admin/heatmap'). */
  pathname: PropTypes.string.isRequired,
  /** Whether the WebSocket connection is active. */
  connected: PropTypes.bool.isRequired,
  /** Accumulated fan reward points. */
  points: PropTypes.number,
  /** Current simulation mode string. */
  mode: PropTypes.string.isRequired,
};

Topbar.defaultProps = {
  points: 0,
};
