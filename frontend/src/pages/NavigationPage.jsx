import React, { useState, useRef, useCallback, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import StadiumMap from '../components/shared/StadiumMap';
import { api } from '../services/api';
import { getDensityLevel, pct } from '../utils/helpers';

const ZONES = [
  { id: 'A', name: 'North Gate' },
  { id: 'B', name: 'West Stand' },
  { id: 'C', name: 'South Gate' },
  { id: 'D', name: 'East Stand' },
  { id: 'E', name: 'Food Court North' },
  { id: 'F', name: 'Concourse West' },
  { id: 'G', name: 'Food Court South' },
  { id: 'H', name: 'Concourse East' },
];

export default function NavigationPage({ simData, onPointsEarned }) {
  const location = useLocation();
  const [from, setFrom] = useState('A');
  const [to, setTo] = useState('G');
  const [route, setRoute] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [autoMode, setAutoMode] = useState(false);
  const inflightRef = useRef(false);

  const density = simData?.density || {};

  // Pre-fill from/to when arriving from a proactive nudge (App.jsx passes state)
  useEffect(() => {
    if (location.state?.autoFrom && location.state?.autoTo) {
      setFrom(location.state.autoFrom);
      setTo(location.state.autoTo);
      setAutoMode(true);
    }
  }, [location.state]);

  // Auto-trigger route calculation when pre-filled from nudge
  useEffect(() => {
    if (autoMode && from && to && from !== to) {
      setAutoMode(false);
      handleRoute();
    }
  // eslint-disable-next-line
  }, [autoMode, from, to]);

  const handleRoute = useCallback(async () => {
    if (inflightRef.current || loading) return;
    inflightRef.current = true;
    setLoading(true);
    setError(null);
    try {
      const result = await api.getRoute(from, to);
      setRoute(result);
      if (result.pointsEarned && onPointsEarned) {
        onPointsEarned(result.pointsEarned, result.recommendation);
      }
    } catch (e) {
      setError(e.message || 'Failed to calculate route. Please try again.');
    } finally {
      setLoading(false);
      inflightRef.current = false;
    }
  }, [from, to, loading, onPointsEarned]);

  // Smart auto-route: find the best escape from current zone
  const handleSmartRoute = useCallback(async () => {
    if (inflightRef.current || loading) return;
    inflightRef.current = true;
    setLoading(true);
    setError(null);
    try {
      const result = await api.getBestRoute(from);
      // Snap destination to the auto-calculated best zone
      setTo(result.to);
      setRoute({
        path:             result.path,
        estimatedMinutes: result.estimatedMinutes,
        cost:             result.cost,
        pointsEarned:     result.pointsEarned,
        recommendation:   result.reason,
      });
      if (result.pointsEarned && onPointsEarned) {
        onPointsEarned(result.pointsEarned, `Smart reroute to ${result.toName}`);
      }
    } catch (e) {
      setError(e.message || 'Could not find a better route right now.');
    } finally {
      setLoading(false);
      inflightRef.current = false;
    }
  }, [from, loading, onPointsEarned]);

  const path = route?.path?.map(p => p.zone) || [];
  const currentDensity = density[from] || 0;

  return (
    <div>
      <div className="section-title">Smart Navigation</div>
      <div className="section-desc">AI-powered crowd-avoiding route planner</div>

      <div className="grid-1-2">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div className="card">
            <div className="card-title" style={{ marginBottom: 14 }}>Plan Your Route</div>

            <div style={{ marginBottom: 12 }}>
              <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: 6 }}>
                Current Zone
              </label>
              <select className="input-field" value={from} onChange={e => { setFrom(e.target.value); setRoute(null); }}>
                {ZONES.map(z => <option key={z.id} value={z.id}>{z.name}</option>)}
              </select>
              {/* Show current zone density as context */}
              {currentDensity > 0 && (
                <div style={{ marginTop: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <div className={`density-dot ${getDensityLevel(currentDensity)}`} />
                  <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                    Your zone is <strong>{pct(currentDensity)}% full</strong>
                    {currentDensity > 0.6 ? ' — crowded, rerouting recommended' : currentDensity > 0.35 ? ' — moderate' : ' — comfortable'}
                  </span>
                </div>
              )}
            </div>

            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: 6 }}>
                Destination
              </label>
              <select className="input-field" value={to} onChange={e => { setTo(e.target.value); setRoute(null); }}>
                {ZONES.filter(z => z.id !== from).map(z => {
                  const d = density[z.id] || 0;
                  return (
                    <option key={z.id} value={z.id}>
                      {z.name} — {pct(d)}% full
                    </option>
                  );
                })}
              </select>
            </div>

            {error && (
              <div style={{ fontSize: 12, color: 'var(--red)', marginBottom: 10, padding: '8px 10px', background: 'var(--red-light)', borderRadius: 'var(--radius-sm)' }}>
                {error}
              </div>
            )}

            {/* Smart auto-route button — AI picks the best destination */}
            <button
              className="btn btn-primary w-full"
              onClick={handleSmartRoute}
              disabled={loading}
              style={{ marginBottom: 8 }}
            >
              {loading ? 'Computing…' : '🤖 AI: Find Best Escape Route'}
            </button>

            <button
              className="btn btn-secondary w-full"
              onClick={handleRoute}
              disabled={loading || from === to}
            >
              {loading ? 'Computing…' : from === to ? 'Select different zones' : 'Route to Selected Zone'}
            </button>
          </div>

          {route && (
            <div className="card" style={{ borderColor: route.pointsEarned === 15 ? 'var(--green)' : 'var(--border)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                <div className="card-title">Recommended Route</div>
                <div className="points-chip">+{route.pointsEarned} pts</div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'var(--accent-light)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="var(--accent)" strokeWidth="2">
                    <circle cx="8" cy="8" r="7"/><path d="M8 5v3l2 2"/>
                  </svg>
                </div>
                <div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>
                    {route.estimatedMinutes} min
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>estimated travel time</div>
                </div>
              </div>

              <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 12, padding: '8px 10px', background: 'var(--bg-surface)', borderRadius: 'var(--radius-sm)' }}>
                {route.recommendation}
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                {route.path.map((step, i) => (
                  <div key={step.zone} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                      <div style={{
                        width: 28, height: 28, borderRadius: '50%',
                        background: i === 0 ? 'var(--accent)' : i === route.path.length - 1 ? 'var(--green)' : 'var(--bg-surface)',
                        border: `2px solid ${i === 0 ? 'var(--accent)' : i === route.path.length - 1 ? 'var(--green)' : 'var(--border)'}`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 11, fontWeight: 700, flexShrink: 0,
                        color: (i === 0 || i === route.path.length - 1) ? '#fff' : 'var(--text-muted)',
                      }}>
                        {step.zone}
                      </div>
                      {i < route.path.length - 1 && (
                        <div style={{ width: 2, height: 20, background: 'var(--border)', margin: '2px 0' }} />
                      )}
                    </div>
                    <div style={{ paddingBottom: i < route.path.length - 1 ? 22 : 0 }}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>{step.name}</div>
                      <div className={`badge badge-${getDensityLevel(step.density) === 'critical' ? 'red' : getDensityLevel(step.density) === 'high' ? 'orange' : getDensityLevel(step.density) === 'moderate' ? 'yellow' : 'green'}`}
                        style={{ fontSize: 10 }}>
                        {Math.round(step.density * 100)}% full
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="card">
          <div className="card-header">
            <div className="card-title">Stadium Map</div>
            {route && <div className="live-badge"><div className="live-dot" />Route Active</div>}
          </div>
          <StadiumMap density={density} path={path} />

          {/* Zone density legend directly on map card */}
          <div style={{ marginTop: 12, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
            {Object.entries(density).map(([id, d]) => (
              <div key={id} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 8px', borderRadius: 6, background: 'var(--bg-surface)' }}>
                <div className={`density-dot ${getDensityLevel(d)}`} />
                <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-primary)' }}>Zone {id}</span>
                <span style={{ fontSize: 10, color: 'var(--text-muted)', marginLeft: 'auto' }}>{pct(d)}%</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
