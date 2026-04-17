import React, { useEffect, useState } from "react";
import StadiumMap from "../components/shared/StadiumMap";
import { api } from "../services/api";
import { getDensityLevel, pct } from "../utils/helpers";

// FIX: single source of truth for zone metadata — no more scattered magic numbers
const ZONES_META = {
  A: { name: "North Gate", capacity: 500 },
  B: { name: "West Stand", capacity: 800 },
  C: { name: "South Gate", capacity: 500 },
  D: { name: "East Stand", capacity: 800 },
  E: { name: "Food Court North", capacity: 300 },
  F: { name: "Concourse West", capacity: 400 },
  G: { name: "Food Court South", capacity: 300 },
  H: { name: "Concourse East", capacity: 400 },
};

export default function HeatmapPage({ simData }) {
  const [zones, setZones] = useState([]);
  const [selected, setSelected] = useState(null);
  const [error, setError] = useState(null);

  // Initial load from API (includes server-side capacity data)
  useEffect(() => {
    api
      .getZones()
      .then((d) => setZones(d.zones))
      .catch(() => setError("Could not load zone data."));
  }, []);

  // FIX: derive zone list from simData + ZONES_META — no hardcoded capacity branches
  useEffect(() => {
    if (simData?.density) {
      setZones(
        Object.entries(simData.density).map(([id, d]) => {
          const meta = ZONES_META[id] || { name: id, capacity: 0 };
          return {
            id,
            name: meta.name,
            density: d,
            level: getDensityLevel(d),
            capacity: meta.capacity,
            currentCount: Math.round(d * meta.capacity),
          };
        }),
      );
    }
  }, [simData]);

  const density = simData?.density || {};
  const selectedZone = zones.find((z) => z.id === selected);

  return (
    <div>
      <div className="section-title mb-4">Live Crowd Heatmap</div>

      {error && (
        <div
          style={{
            padding: "10px 14px",
            background: "var(--red-light)",
            border: "1px solid #FCA5A5",
            borderRadius: "var(--radius-md)",
            fontSize: 12,
            color: "var(--red)",
            marginBottom: 16,
          }}
        >
          {error}
        </div>
      )}

      <div className="grid-2-1">
        <div className="card">
          <div className="card-header">
            <div>
              <div className="card-title">Stadium Overview</div>
              <div className="card-subtitle">Click any zone for details</div>
            </div>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              {["low", "moderate", "high", "critical"].map((l) => (
                <div
                  key={l}
                  style={{ display: "flex", alignItems: "center", gap: 4 }}
                >
                  <div className={`density-dot ${l}`} />
                  <span
                    style={{
                      fontSize: 10,
                      color: "var(--text-muted)",
                      textTransform: "capitalize",
                    }}
                  >
                    {l}
                  </span>
                </div>
              ))}
            </div>
          </div>
          <StadiumMap
            density={density}
            selectedZone={selected}
            onZoneClick={setSelected}
          />
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {/* Zone detail panel */}
          {selectedZone && (
            <div
              className="card"
              style={{
                borderColor: "var(--accent)",
                background: "var(--accent-light)",
              }}
            >
              <div className="card-title" style={{ marginBottom: 10 }}>
                {selectedZone.name}
              </div>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: 10,
                }}
              >
                {[
                  {
                    label: "Occupancy",
                    value: `${pct(selectedZone.density)}%`,
                  },
                  {
                    label: "Current Count",
                    value: selectedZone.currentCount.toLocaleString(),
                  },
                  {
                    label: "Capacity",
                    value: selectedZone.capacity.toLocaleString(),
                  },
                  { label: "Status", value: selectedZone.level?.toUpperCase() },
                ].map(({ label, value }) => (
                  <div key={label}>
                    <div
                      style={{
                        fontSize: 10,
                        color: "var(--text-muted)",
                        fontWeight: 600,
                        textTransform: "uppercase",
                        letterSpacing: "0.05em",
                      }}
                    >
                      {label}
                    </div>
                    <div
                      style={{
                        fontSize: 16,
                        fontWeight: 700,
                        color: "var(--accent)",
                        marginTop: 2,
                      }}
                    >
                      {value}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="card" style={{ flex: 1 }}>
            <div className="card-header">
              <div className="card-title">Zone Status</div>
            </div>
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 8,
                maxHeight: 420,
                overflowY: "auto",
              }}
            >
              {/* FIX: use zone.id as key, not array index */}
              {zones.map((z) => (
                <div
                  key={z.id}
                  onClick={() => setSelected(z.id === selected ? null : z.id)}
                  style={{
                    padding: "10px 12px",
                    borderRadius: "var(--radius-md)",
                    cursor: "pointer",
                    border: `1px solid ${selected === z.id ? "var(--accent)" : "var(--border)"}`,
                    background:
                      selected === z.id
                        ? "var(--accent-light)"
                        : "var(--bg-card)",
                    transition: "all 0.15s",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      marginBottom: 6,
                      alignItems: "center",
                    }}
                  >
                    <div
                      style={{ display: "flex", alignItems: "center", gap: 6 }}
                    >
                      <div className={`density-dot ${z.level}`} />
                      <span
                        style={{
                          fontSize: 12,
                          fontWeight: 600,
                          color: "var(--text-primary)",
                        }}
                      >
                        {z.name}
                      </span>
                    </div>
                    <span
                      style={{
                        fontSize: 12,
                        fontWeight: 700,
                        color: "var(--text-primary)",
                      }}
                    >
                      {pct(z.density)}%
                    </span>
                  </div>
                  <div className="density-bar-wrap">
                    <div
                      className={`density-bar ${z.level}`}
                      style={{ width: `${pct(z.density)}%` }}
                    />
                  </div>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      marginTop: 4,
                    }}
                  >
                    <span style={{ fontSize: 10, color: "var(--text-muted)" }}>
                      {z.currentCount.toLocaleString()} /{" "}
                      {z.capacity.toLocaleString()}
                    </span>
                    <span
                      className={`badge badge-${z.level === "critical" ? "red" : z.level === "high" ? "orange" : z.level === "moderate" ? "yellow" : "green"}`}
                      style={{ fontSize: 10 }}
                    >
                      {z.level}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
