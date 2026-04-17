import React, { useState, useCallback } from "react";
import { pct, getDensityLevel } from "../utils/helpers";
import { api } from "../services/api";

const INITIAL_STAFF = [
  {
    id: "st1",
    name: "Team Alpha",
    role: "Crowd Control",
    count: 4,
    status: "available",
    zone: null,
  },
  {
    id: "st2",
    name: "Team Beta",
    role: "Stewards",
    count: 6,
    status: "deployed",
    zone: "B",
  },
  {
    id: "st3",
    name: "Team Gamma",
    role: "Medical",
    count: 2,
    status: "standby",
    zone: null,
  },
  {
    id: "st4",
    name: "Team Delta",
    role: "Security",
    count: 5,
    status: "deployed",
    zone: "D",
  },
  {
    id: "st5",
    name: "Team Echo",
    role: "Crowd Control",
    count: 3,
    status: "available",
    zone: null,
  },
];

const ZONE_NAMES = {
  A: "North Gate",
  B: "West Stand",
  C: "South Gate",
  D: "East Stand",
  E: "Food Court N",
  F: "Concourse W",
  G: "Food Court S",
  H: "Concourse E",
};

const ALERT_MESSAGES = {
  critical: (zone) =>
    `CRITICAL: Immediate crowd control required at ${ZONE_NAMES[zone]} — unsafe density`,
  moderate: (zone) =>
    `CAUTION: Stewards needed at ${ZONE_NAMES[zone]} to guide crowd flow`,
};

export default function StaffPage({ simData }) {
  const [staff, setStaff] = useState(INITIAL_STAFF);
  const [sentAlerts, setSentAlerts] = useState(new Set());
  const [alertStatus, setAlertStatus] = useState({}); // zoneId → 'sending' | 'sent' | 'error'
  const density = simData?.density || {};

  const dispatch = useCallback((staffId, zoneId) => {
    setStaff((prev) =>
      prev.map((s) =>
        s.id === staffId && s.status !== "deployed"
          ? { ...s, status: "deployed", zone: zoneId }
          : s,
      ),
    );
  }, []);

  const recall = useCallback((staffId) => {
    setStaff((prev) =>
      prev.map((s) =>
        s.id === staffId ? { ...s, status: "available", zone: null } : s,
      ),
    );
  }, []);

  // Wired to real backend — injects alert into live sim state and broadcasts via WS
  const sendAlert = useCallback(
    async (zoneId, urgency) => {
      if (sentAlerts.has(zoneId)) return;
      setAlertStatus((prev) => ({ ...prev, [zoneId]: "sending" }));
      try {
        const message =
          urgency === "critical"
            ? ALERT_MESSAGES.critical(zoneId)
            : ALERT_MESSAGES.moderate(zoneId);
        await api.sendStaffAlert(
          zoneId,
          message,
          urgency === "critical" ? "critical" : "warning",
        );
        setSentAlerts((prev) => new Set([...prev, zoneId]));
        setAlertStatus((prev) => ({ ...prev, [zoneId]: "sent" }));
      } catch (err) {
        console.error("sendAlert failed:", err.message);
        setAlertStatus((prev) => ({ ...prev, [zoneId]: "error" }));
        setTimeout(
          () =>
            setAlertStatus((prev) => {
              const next = { ...prev };
              delete next[zoneId];
              return next;
            }),
          3000,
        );
      }
    },
    [sentAlerts],
  );

  const highZones = Object.entries(density)
    .filter(([, d]) => d > 0.55)
    .sort(([, a], [, b]) => b - a)
    .map(([id, d]) => ({
      id,
      name: ZONE_NAMES[id],
      density: d,
      level: getDensityLevel(d),
    }));

  const statusBadge = {
    available: "badge-green",
    deployed: "badge-blue",
    standby: "badge-yellow",
  };

  return (
    <div>
      <div className="section-title">Staff Dispatch</div>
      <div className="section-desc">
        AI-recommended deployment based on real-time crowd data
      </div>

      <div className="grid-3 mb-4">
        <div className="metric-card">
          <div className="metric-label">Teams Available</div>
          <div className="metric-value">
            {staff.filter((s) => s.status === "available").length}
          </div>
          <div className="metric-change">ready for deployment</div>
        </div>
        <div className="metric-card">
          <div className="metric-label">Teams Deployed</div>
          <div className="metric-value">
            {staff.filter((s) => s.status === "deployed").length}
          </div>
          <div className="metric-change">active in field</div>
        </div>
        <div className="metric-card">
          <div className="metric-label">Zones Needing Cover</div>
          <div
            className="metric-value"
            style={{
              color: highZones.length > 0 ? "var(--red)" : "var(--green)",
            }}
          >
            {highZones.length}
          </div>
          <div
            className={`metric-change${highZones.length > 0 ? " negative" : ""}`}
          >
            {highZones.length > 0 ? "above 55% capacity" : "all zones nominal"}
          </div>
        </div>
      </div>

      <div className="grid-2">
        <div className="card">
          <div className="card-header">
            <div className="card-title">AI Dispatch Recommendations</div>
            <div className="live-badge">
              <div className="live-dot" />
              Live
            </div>
          </div>

          {highZones.length === 0 ? (
            <div className="empty-state">
              <svg
                width="32"
                height="32"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
              >
                <circle cx="9" cy="7" r="4" />
                <path d="M3 21a6 6 0 0112 0" />
                <path d="M16 11l2 2 4-4" />
              </svg>
              <p>All zones within safe limits — no dispatch needed</p>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {highZones.map((zone) => {
                const availableTeam = staff.find(
                  (s) => s.status === "available",
                );
                const alertState = alertStatus[zone.id];
                const alerted = sentAlerts.has(zone.id);

                return (
                  <div
                    key={zone.id}
                    style={{
                      padding: "14px",
                      border: `1px solid ${zone.level === "critical" ? "#FCA5A5" : "#FCD34D"}`,
                      borderRadius: "var(--radius-md)",
                      background:
                        zone.level === "critical"
                          ? "var(--red-light)"
                          : "var(--yellow-light)",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        marginBottom: 8,
                      }}
                    >
                      <div>
                        <span
                          style={{
                            fontSize: 13,
                            fontWeight: 700,
                            color: "var(--text-primary)",
                          }}
                        >
                          {zone.name}
                        </span>
                        <span
                          style={{
                            fontSize: 11,
                            color: "var(--text-muted)",
                            marginLeft: 8,
                          }}
                        >
                          Zone {zone.id}
                        </span>
                      </div>
                      <span
                        className={`badge badge-${zone.level === "critical" ? "red" : "yellow"}`}
                      >
                        {pct(zone.density)}% — {zone.level}
                      </span>
                    </div>
                    <p
                      style={{
                        fontSize: 12,
                        color: "var(--text-secondary)",
                        marginBottom: 10,
                      }}
                    >
                      {zone.level === "critical"
                        ? "Immediate crowd control deployment required. Risk of unsafe conditions."
                        : "Steward presence recommended to guide fan movement and prevent escalation."}
                    </p>
                    <div
                      style={{ display: "flex", gap: 8, alignItems: "center" }}
                    >
                      {availableTeam ? (
                        <button
                          className="btn btn-primary btn-sm"
                          onClick={() => dispatch(availableTeam.id, zone.id)}
                        >
                          Deploy {availableTeam.name}
                        </button>
                      ) : (
                        <span
                          style={{ fontSize: 11, color: "var(--text-muted)" }}
                        >
                          No teams available
                        </span>
                      )}
                      {/* Wired to POST /api/alert — injects real alert into live WS feed */}
                      <button
                        className={`btn btn-sm ${alerted ? "btn-ghost" : "btn-secondary"}`}
                        onClick={() => sendAlert(zone.id, zone.level)}
                        disabled={alerted || alertState === "sending"}
                        style={{ opacity: alerted ? 0.7 : 1, minWidth: 90 }}
                      >
                        {alertState === "sending"
                          ? "…Sending"
                          : alerted
                            ? "✓ Alerted"
                            : alertState === "error"
                              ? "⚠ Retry"
                              : "Send Alert"}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="card">
          <div className="card-header">
            <div className="card-title">Staff Roster</div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {staff.map((s) => (
              <div
                key={s.id}
                style={{
                  padding: "12px 14px",
                  border: "1px solid var(--border)",
                  borderRadius: "var(--radius-md)",
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                }}
              >
                <div
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: "50%",
                    background: "var(--bg-surface)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 13,
                    fontWeight: 700,
                    color: "var(--text-secondary)",
                    flexShrink: 0,
                  }}
                >
                  {s.count}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      fontWeight: 600,
                      fontSize: 13,
                      color: "var(--text-primary)",
                    }}
                  >
                    {s.name}
                  </div>
                  <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
                    {s.role}
                    {s.zone ? ` — Zone ${s.zone} (${ZONE_NAMES[s.zone]})` : ""}
                  </div>
                </div>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    flexShrink: 0,
                  }}
                >
                  <span
                    className={`badge ${statusBadge[s.status]}`}
                    style={{ textTransform: "capitalize" }}
                  >
                    {s.status}
                  </span>
                  {s.status === "deployed" && (
                    <button
                      className="btn btn-secondary btn-sm"
                      onClick={() => recall(s.id)}
                    >
                      Recall
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
