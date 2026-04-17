import React from "react";

/**
 * ErrorBoundary — catches uncaught render/lifecycle errors in the component tree.
 *
 * Without this, any unexpected JS error during rendering (e.g. a null deref when
 * simData arrives in an unexpected shape) crashes the entire React tree to a
 * blank white screen with no recovery path.
 *
 * Usage: wrap <App /> in index.js and optionally individual pages.
 */
export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    // In production this is where you'd send to Sentry / Datadog / etc.
    console.error(
      "[ErrorBoundary] Caught render error:",
      error,
      info.componentStack,
    );
  }

  handleReset() {
    this.setState({ hasError: false, error: null });
  }

  render() {
    if (!this.state.hasError) return this.props.children;

    const { fallback } = this.props;
    if (fallback) return fallback;

    return (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          height: "100vh",
          gap: 16,
          padding: 32,
          fontFamily: "DM Sans, sans-serif",
          background: "var(--bg-primary, #F9FAFB)",
        }}
      >
        <svg
          width="48"
          height="48"
          viewBox="0 0 24 24"
          fill="none"
          stroke="#E02424"
          strokeWidth="1.5"
        >
          <path d="M12 2l9 18H3L12 2z" />
          <path d="M12 9v4" />
          <circle cx="12" cy="17" r="0.5" fill="#E02424" />
        </svg>
        <div style={{ textAlign: "center" }}>
          <div
            style={{
              fontSize: 18,
              fontWeight: 700,
              color: "#111827",
              marginBottom: 8,
            }}
          >
            Something went wrong
          </div>
          <div
            style={{
              fontSize: 13,
              color: "#6B7280",
              maxWidth: 400,
              marginBottom: 20,
            }}
          >
            {this.state.error?.message ||
              "An unexpected error occurred in this part of the app."}
          </div>
          <button
            onClick={() => this.handleReset()}
            style={{
              padding: "8px 20px",
              borderRadius: 8,
              border: "none",
              background: "#1A56DB",
              color: "#fff",
              fontSize: 13,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Try again
          </button>
        </div>
      </div>
    );
  }
}
