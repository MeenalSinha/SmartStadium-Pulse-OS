import React, { useState, useCallback } from 'react';
import { timeAgo } from '../utils/helpers';
import { api } from '../services/api';

export default function AlertsPage({ simData }) {
  const alerts  = simData?.alerts || [];
  const density = simData?.density || {};
  const [dismissed, setDismissed]     = useState(new Set());
  const [dispatched, setDispatched]   = useState(new Set());   // zones where team dispatched
  const [dispatchStatus, setDispatchStatus] = useState({});

  const dismiss = useCallback((id) => {
    setDismissed(prev => new Set([...prev, id]));
  }, []);

  // Dispatch team: send a real staff alert to the backend
  const dispatchTeam = useCallback(async (zoneId, urgency) => {
    if (dispatched.has(zoneId)) return;
    setDispatchStatus(prev => ({ ...prev, [zoneId]: 'sending' }));
    try {
      await api.sendStaffAlert(
        zoneId,
        urgency === 'critical'
          ? `DISPATCH: Crowd control team deployed to ${zoneId} — immediate action required`
          : `DISPATCH: Stewards en route to ${zoneId} — monitor and guide`,
        urgency === 'critical' ? 'critical' : 'warning'
      );
      setDispatched(prev => new Set([...prev, zoneId]));
      setDispatchStatus(prev => ({ ...prev, [zoneId]: 'sent' }));
    } catch (err) {
      console.error('dispatch failed:', err.message);
      setDispatchStatus(prev => ({ ...prev, [zoneId]: 'error' }));
      setTimeout(() => setDispatchStatus(prev => {
        const next = { ...prev }; delete next[zoneId]; return next;
      }), 3000);
    }
  }, [dispatched]);

  const visibleAlerts = alerts.filter(a => !dismissed.has(a.id));
  const critical      = visibleAlerts.filter(a => a.type === 'critical');
  const warnings      = visibleAlerts.filter(a => a.type === 'warning');

  const staffSuggestions = Object.entries(density)
    .filter(([, d]) => d > 0.6)
    .map(([id, d]) => ({
      zone: id,
      action: d > 0.8 ? 'Deploy crowd control immediately' : 'Send 2 stewards to manage flow',
      urgency: d > 0.8 ? 'critical' : 'moderate',
      density: d,
    }))
    .sort((a, b) => b.density - a.density);

  return (
    <div>
      <div className="section-title">Alerts &amp; Dispatch</div>
      <div className="section-desc">Real-time AI-generated alerts and staff dispatch</div>

      <div className="grid-3 mb-4">
        <div className="metric-card">
          <div className="metric-label">Critical Alerts</div>
          <div className="metric-value" style={{ color: 'var(--red)' }}>{critical.length}</div>
          <div className="metric-change negative">Requires immediate action</div>
        </div>
        <div className="metric-card">
          <div className="metric-label">Warnings</div>
          <div className="metric-value" style={{ color: 'var(--yellow)' }}>{warnings.length}</div>
          <div className="metric-change" style={{ color: '#C27803' }}>Monitor closely</div>
        </div>
        <div className="metric-card">
          <div className="metric-label">Staff Dispatched</div>
          <div className="metric-value" style={{ color: 'var(--green)' }}>{dispatched.size}</div>
          <div className="metric-change">teams deployed this session</div>
        </div>
      </div>

      <div className="grid-2">
        {/* Live alert feed */}
        <div className="card">
          <div className="card-header">
            <div className="card-title">Live Alert Feed</div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              {dismissed.size > 0 && (
                <button className="btn btn-ghost btn-sm" onClick={() => setDismissed(new Set())} style={{ fontSize: 11 }}>
                  Restore {dismissed.size}
                </button>
              )}
              <div className="live-badge"><div className="live-dot" />Live</div>
            </div>
          </div>
          {visibleAlerts.length === 0 ? (
            <div className="empty-state">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M12 2l9 18H3L12 2z"/></svg>
              <p>No active alerts — stadium operating normally</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {visibleAlerts.map(a => (
                <div key={a.id} className={`alert-item ${a.type}`} style={{ position: 'relative' }}>
                  <div className="alert-icon">
                    {a.type === 'critical' ? (
                      <svg width="11" height="11" viewBox="0 0 16 16" fill="none" stroke="white" strokeWidth="2.5">
                        <path d="M8 1l7 14H1L8 1z"/><path d="M8 7v3"/><circle cx="8" cy="12.5" r="0.5" fill="white"/>
                      </svg>
                    ) : (
                      <svg width="11" height="11" viewBox="0 0 16 16" fill="none" stroke="white" strokeWidth="2.5">
                        <circle cx="8" cy="8" r="7"/><path d="M8 5v4"/><circle cx="8" cy="12" r="0.5" fill="white"/>
                      </svg>
                    )}
                  </div>
                  <div className="alert-text" style={{ flex: 1 }}>
                    <div className="alert-title">
                      {a.zoneName}
                      {a.source === 'staff' && (
                        <span style={{ fontSize: 9, marginLeft: 6, opacity: 0.7, fontWeight: 400 }}>staff</span>
                      )}
                    </div>
                    <div className="alert-desc">{a.message}</div>
                    <div className="alert-time">{timeAgo(a.timestamp)}</div>
                  </div>
                  <button
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.7)', padding: '2px 4px', flexShrink: 0 }}
                    onClick={() => dismiss(a.id)} title="Dismiss"
                  >
                    <svg width="10" height="10" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <path d="M2 2l12 12M14 2L2 14"/>
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* AI Staff Dispatch — wired to real backend */}
        <div className="card">
          <div className="card-header">
            <div className="card-title">AI Staff Dispatch</div>
            <div className="card-subtitle">Actions POST to backend → broadcast to all dashboards</div>
          </div>
          {staffSuggestions.length === 0 ? (
            <div className="empty-state">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <circle cx="9" cy="7" r="4"/><path d="M3 21a6 6 0 0112 0"/></svg>
              <p>All zones within safe limits</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {staffSuggestions.map(s => {
                const state      = dispatchStatus[s.zone];
                const isDispatched = dispatched.has(s.zone);
                return (
                  <div key={s.zone} style={{
                    padding: '12px 14px',
                    border: `1px solid ${s.urgency === 'critical' ? '#FCA5A5' : 'var(--border)'}`,
                    borderRadius: 'var(--radius-md)',
                    background: s.urgency === 'critical' ? 'var(--red-light)' : 'var(--bg-surface)',
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                      <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)' }}>Zone {s.zone}</span>
                      <span className={`badge badge-${s.urgency === 'critical' ? 'red' : 'yellow'}`}>{s.urgency}</span>
                    </div>
                    <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 8 }}>{s.action}</p>
                    <button
                      className={`btn btn-sm ${isDispatched ? 'btn-ghost' : 'btn-primary'}`}
                      onClick={() => dispatchTeam(s.zone, s.urgency)}
                      disabled={isDispatched || state === 'sending'}
                      style={{ minWidth: 110 }}
                    >
                      {state === 'sending' ? '…Dispatching'
                        : isDispatched ? '✓ Team Deployed'
                        : state === 'error' ? '⚠ Retry'
                        : 'Dispatch Team'}
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
