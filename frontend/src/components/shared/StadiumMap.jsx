import React from "react";
import {
  getDensityColor,
  getDensityBg,
  pct,
  clampDensity,
} from "../../utils/helpers";

const ZONES = {
  A: { id: "A", name: "North Gate", x: 200, y: 50, r: 32 },
  B: { id: "B", name: "West Stand", x: 80, y: 200, r: 38 },
  C: { id: "C", name: "South Gate", x: 200, y: 350, r: 32 },
  D: { id: "D", name: "East Stand", x: 320, y: 200, r: 38 },
  E: { id: "E", name: "Food Court N", x: 200, y: 145, r: 28 },
  F: { id: "F", name: "Concourse W", x: 115, y: 268, r: 28 },
  G: { id: "G", name: "Food Court S", x: 200, y: 290, r: 28 },
  H: { id: "H", name: "Concourse E", x: 285, y: 268, r: 28 },
};

const EDGES = [
  ["A", "B"],
  ["A", "D"],
  ["A", "E"],
  ["B", "C"],
  ["B", "F"],
  ["C", "D"],
  ["C", "G"],
  ["D", "H"],
  ["E", "F"],
  ["E", "H"],
  ["F", "G"],
  ["G", "H"],
];

// Dark theme zone colors
const getDarkColor = (density) => {
  if (density > 0.75) return "#EF4444";
  if (density > 0.5) return "#F97316";
  if (density > 0.25) return "#F59E0B";
  return "#10B981";
};

const getDarkBg = (density) => {
  if (density > 0.75) return "rgba(239,68,68,0.15)";
  if (density > 0.5) return "rgba(249,115,22,0.12)";
  if (density > 0.25) return "rgba(245,158,11,0.12)";
  return "rgba(16,185,129,0.12)";
};

export default function StadiumMap({
  density = {},
  path = [],
  selectedZone,
  onZoneClick,
  compact = false,
}) {
  const scale = compact ? 0.72 : 1;
  const W = 400 * scale;
  const H = 420 * scale;

  const pathSet = new Set();
  for (let i = 0; i < path.length - 1; i++) {
    pathSet.add(`${path[i]}-${path[i + 1]}`);
    pathSet.add(`${path[i + 1]}-${path[i]}`);
  }

  return (
    <svg
      viewBox="0 0 400 420"
      width={W}
      height={H}
      style={{ display: "block", margin: "0 auto" }}
    >
      <defs>
        <filter id="glow-red">
          <feGaussianBlur stdDeviation="4" result="coloredBlur" />
          <feMerge>
            <feMergeNode in="coloredBlur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <filter id="glow-green">
          <feGaussianBlur stdDeviation="3" result="coloredBlur" />
          <feMerge>
            <feMergeNode in="coloredBlur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <filter id="glow-blue">
          <feGaussianBlur stdDeviation="4" result="coloredBlur" />
          <feMerge>
            <feMergeNode in="coloredBlur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* Pitch */}
      <ellipse
        cx="200"
        cy="210"
        rx="96"
        ry="88"
        fill="rgba(16,185,129,0.06)"
        stroke="rgba(16,185,129,0.15)"
        strokeWidth="1.5"
      />
      <ellipse
        cx="200"
        cy="210"
        rx="56"
        ry="50"
        fill="none"
        stroke="rgba(16,185,129,0.10)"
        strokeWidth="1"
        strokeDasharray="4,3"
      />
      <line
        x1="200"
        y1="122"
        x2="200"
        y2="298"
        stroke="rgba(16,185,129,0.10)"
        strokeWidth="1"
      />
      <text
        x="200"
        y="214"
        textAnchor="middle"
        fontSize="8"
        fill="rgba(16,185,129,0.35)"
        fontFamily="'JetBrains Mono',monospace"
        fontWeight="700"
        letterSpacing="0.1em"
      >
        PITCH
      </text>

      {/* Edges */}
      {EDGES.map(([a, b]) => {
        const za = ZONES[a],
          zb = ZONES[b];
        const isPath = pathSet.has(`${a}-${b}`);
        return (
          <line
            key={`edge-${a}-${b}`}
            x1={za.x}
            y1={za.y}
            x2={zb.x}
            y2={zb.y}
            stroke={isPath ? "#3B82F6" : "rgba(255,255,255,0.07)"}
            strokeWidth={isPath ? 3 : 1.5}
            filter={isPath ? "url(#glow-blue)" : undefined}
          />
        );
      })}

      {/* Path midpoint dots */}
      {path.length > 1 &&
        path.slice(0, -1).map((id, i) => {
          const from = ZONES[id],
            to = ZONES[path[i + 1]];
          if (!from || !to) return null;
          return (
            <circle
              key={`mid-${id}-${path[i + 1]}`}
              cx={(from.x + to.x) / 2}
              cy={(from.y + to.y) / 2}
              r={4}
              fill="#3B82F6"
              opacity={0.8}
              filter="url(#glow-blue)"
            />
          );
        })}

      {/* Zone circles */}
      {Object.values(ZONES).map((zone) => {
        const d = clampDensity(density[zone.id]);
        const color = getDarkColor(d);
        const bg = getDarkBg(d);
        const isCritical = d > 0.75;
        const isSelected = selectedZone === zone.id;
        const inPath = path.includes(zone.id);
        const glowFilter = isCritical
          ? "url(#glow-red)"
          : inPath
            ? "url(#glow-blue)"
            : d < 0.25
              ? "url(#glow-green)"
              : undefined;

        return (
          <g
            key={zone.id}
            onClick={() => onZoneClick && onZoneClick(zone.id)}
            style={{ cursor: onZoneClick ? "pointer" : "default" }}
            role={onZoneClick ? "button" : undefined}
            aria-label={onZoneClick ? `Select ${zone.name}` : undefined}
          >
            {/* Outer pulse ring for critical zones */}
            {isCritical && (
              <circle
                cx={zone.x}
                cy={zone.y}
                r={zone.r + 10}
                fill="none"
                stroke="#EF4444"
                strokeWidth="1.5"
                opacity="0.3"
              >
                <animate
                  attributeName="r"
                  values={`${zone.r + 6};${zone.r + 14};${zone.r + 6}`}
                  dur="1.8s"
                  repeatCount="indefinite"
                />
                <animate
                  attributeName="opacity"
                  values="0.4;0.05;0.4"
                  dur="1.8s"
                  repeatCount="indefinite"
                />
              </circle>
            )}

            {/* Zone fill */}
            <circle
              cx={zone.x}
              cy={zone.y}
              r={zone.r}
              fill={inPath ? "rgba(59,130,246,0.15)" : bg}
              stroke={isSelected ? "#60A5FA" : inPath ? "#3B82F6" : color}
              strokeWidth={isSelected || inPath ? 2.5 : 1.5}
              filter={glowFilter}
            />

            {/* Zone ID */}
            <text
              x={zone.x}
              y={zone.y - 2}
              textAnchor="middle"
              fontSize="10"
              fontWeight="700"
              fill={color}
              fontFamily="'JetBrains Mono',monospace"
            >
              {zone.id}
            </text>

            {/* Density % */}
            <text
              x={zone.x}
              y={zone.y + 10}
              textAnchor="middle"
              fontSize="8"
              fill="rgba(255,255,255,0.45)"
              fontFamily="'JetBrains Mono',monospace"
            >
              {pct(d)}%
            </text>
          </g>
        );
      })}

      {/* Zone labels */}
      {Object.values(ZONES).map((zone) => {
        const offsets = {
          A: { dx: 0, dy: -zone.r - 8, anchor: "middle" },
          B: { dx: -zone.r - 8, dy: 0, anchor: "end" },
          C: { dx: 0, dy: zone.r + 12, anchor: "middle" },
          D: { dx: zone.r + 8, dy: 0, anchor: "start" },
          E: { dx: 12, dy: -zone.r - 4, anchor: "start" },
          F: { dx: -zone.r - 4, dy: 0, anchor: "end" },
          G: { dx: 12, dy: zone.r + 10, anchor: "start" },
          H: { dx: zone.r + 4, dy: 0, anchor: "start" },
        };
        const off = offsets[zone.id] || {
          dx: 0,
          dy: -zone.r - 6,
          anchor: "middle",
        };
        return (
          <text
            key={`label-${zone.id}`}
            x={zone.x + off.dx}
            y={zone.y + off.dy}
            textAnchor={off.anchor}
            fontSize="7.5"
            fill="rgba(255,255,255,0.3)"
            fontFamily="'Space Grotesk',sans-serif"
          >
            {zone.name}
          </text>
        );
      })}
    </svg>
  );
}
