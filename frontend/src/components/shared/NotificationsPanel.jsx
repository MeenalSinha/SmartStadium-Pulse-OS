import React, { useEffect, useState, useRef } from "react";
import PropTypes from "prop-types";

// FIX: cap the seen-IDs set so it doesn't grow unbounded on long sessions
const MAX_SEEN = 200;

export default function NotificationsPanel({ alerts = [] }) {
  const [toasts, setToasts] = useState([]);
  // FIX: use a ref for the seen set — mutations don't need to trigger re-renders
  const seenRef = useRef(new Set());

  useEffect(() => {
    alerts.forEach((alert) => {
      if (seenRef.current.has(alert.id)) return;

      // Add to seen set; trim oldest entries if over cap
      seenRef.current.add(alert.id);
      if (seenRef.current.size > MAX_SEEN) {
        const iter = seenRef.current.values();
        seenRef.current.delete(iter.next().value); // drop oldest
      }

      const toast = { ...alert, key: alert.id };
      setToasts((prev) => [toast, ...prev].slice(0, 4));

      const timer = setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.key !== toast.key));
      }, 5000);

      // Cleanup timer if component unmounts before toast expires
      return () => clearTimeout(timer);
    });
  }, [alerts]);

  if (toasts.length === 0) return null;

  return (
    <div className="notifications-panel">
      {toasts.map((toast) => (
        <div key={toast.key} className={`toast toast-${toast.type}`}>
          <div
            style={{
              width: 28,
              height: 28,
              borderRadius: "50%",
              flexShrink: 0,
              background:
                toast.type === "critical"
                  ? "var(--red-light)"
                  : "var(--yellow-light)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            {toast.type === "critical" ? (
              <svg
                width="13"
                height="13"
                viewBox="0 0 16 16"
                fill="none"
                stroke="var(--red)"
                strokeWidth="2"
              >
                <path d="M8 1l7 14H1L8 1z" />
                <path d="M8 7v4" />
                <circle cx="8" cy="13" r="0.5" fill="var(--red)" />
              </svg>
            ) : (
              <svg
                width="13"
                height="13"
                viewBox="0 0 16 16"
                fill="none"
                stroke="var(--yellow)"
                strokeWidth="2"
              >
                <circle cx="8" cy="8" r="7" />
                <path d="M8 5v4" />
                <circle cx="8" cy="12" r="0.5" fill="var(--yellow)" />
              </svg>
            )}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              style={{
                fontSize: 12,
                fontWeight: 600,
                color: "var(--text-primary)",
              }}
            >
              {toast.zoneName}
            </div>
            <div
              style={{
                fontSize: 11,
                color: "var(--text-secondary)",
                marginTop: 1,
              }}
            >
              {toast.message}
            </div>
          </div>
          <button
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              color: "var(--text-muted)",
              padding: 2,
            }}
            onClick={() =>
              setToasts((prev) => prev.filter((t) => t.key !== toast.key))
            }
            aria-label="Dismiss notification"
          >
            <svg
              width="12"
              height="12"
              viewBox="0 0 16 16"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M2 2l12 12M14 2L2 14" />
            </svg>
          </button>
        </div>
      ))}
    </div>
  );
}

NotificationsPanel.propTypes = {
  /** Array of live alert objects from the simulation engine. */
  alerts: PropTypes.arrayOf(
    PropTypes.shape({
      id: PropTypes.string.isRequired,
      zone: PropTypes.string,
      zoneName: PropTypes.string,
      type: PropTypes.oneOf(["warning", "critical", "info"]),
      message: PropTypes.string.isRequired,
      timestamp: PropTypes.number,
    }),
  ),
};
