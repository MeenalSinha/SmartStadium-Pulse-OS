import React, { useEffect, useState, useRef } from 'react';
import { api } from '../services/api';
import StadiumMap from '../components/shared/StadiumMap';
import AIImpactPanel from '../components/shared/AIImpactPanel';
import { getDensityLevel, pct } from '../utils/helpers';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, BarChart, Bar, Legend, ReferenceLine,
} from '../components/charts';

const ZONE_NAMES = {
  A: 'North Gate', B: 'West Stand', C: 'South Gate', D: 'East Stand',
  E: 'Food Court N', F: 'Concourse W', G: 'Food Court S', H: 'Concourse E',
};
const MODE_LABELS = { normal:'Normal', pre_match:'Pre-Match', halftime:'Half-Time', exit_rush:'Exit Rush' };
const MODE_COLORS = { normal:'#10B981', pre_match:'#F59E0B', halftime:'#EF4444', exit_rush:'#8B5CF6' };
const MODE_ICONS  = { normal:'🟢', pre_match:'🟡', halftime:'🔴', exit_rush:'🟣' };

export default function AdminDashboard({ simData, mode, onModeChange }) {
  const [metrics,    setMetrics]    = useState(null);
  const [history,    setHistory]    = useState([]);
  const [stallData,  setStallData]  = useState([]);
  const [modeEvents, setModeEvents] = useState([]);
  const [aiInsights, setAiInsights] = useState(null);
  const [flashKey,   setFlashKey]   = useState(0);
  const prevModeRef = useRef(mode);

  useEffect(() => {
    api.getMetrics().then(d => setMetrics(d.metrics)).catch(console.error);
    api.getQueue().then(d => setStallData(d.stalls.map(s => ({
      stall: s.name.replace(' ', '\n'), wait: s.waitTime, load: Math.round(s.density*100)
    })))).catch(console.error);
  }, []);

  useEffect(() => {
    if (simData?.metrics) {
      setMetrics(simData.metrics);
      setHistory(prev => [...prev, {
        time:     new Date().toLocaleTimeString([], { hour:'2-digit', minute:'2-digit', second:'2-digit' }),
        density:  Math.round(simData.metrics.avgDensity * 100),
        baseline: Math.round(({ normal:25, pre_match:65, halftime:85, exit_rush:90 }[mode] ?? 50)),
      }].slice(-30));
    }
    if (simData?.density) {
      api.getQueue().then(d => setStallData(d.stalls.map(s => ({
        stall: s.name, wait: s.waitTime, load: Math.round(s.density*100)
      })))).catch(() => {});
    }
  }, [simData, mode]);

  // Poll Vertex AI insights every 15s (backend caches for 30s)
  useEffect(() => {
    const fetchAI = () => {
      api.getAiInsights().then(res => {
        if (res.insights) setAiInsights(res.insights);
      }).catch(console.error);
    };
    fetchAI();
    const iv = setInterval(fetchAI, 15000);
    return () => clearInterval(iv);
  }, [mode]); // refetch on mode change as well

  // Dramatic mode change flash
  useEffect(() => {
    if (mode !== prevModeRef.current) {
      setFlashKey(k => k+1);
      const label = MODE_LABELS[mode];
      setModeEvents(prev => [...prev, {
        time:  new Date().toLocaleTimeString([], { hour:'2-digit', minute:'2-digit', second:'2-digit' }),
        label, color: MODE_COLORS[mode] || '#6B7280',
      }].slice(-5));
      prevModeRef.current = mode;
    }
  }, [mode]);

  const density    = simData?.density || {};
  const alerts     = simData?.alerts  || [];
  const zoneEntries = Object.entries(density)
    .map(([id, d]) => ({ id, name: ZONE_NAMES[id], density: d, level: getDensityLevel(d) }))
    .sort((a, b) => b.density - a.density);

  const criticalCount = zoneEntries.filter(z => z.level === 'critical').length;

  return (
    <div>
      {/* Page header */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
          <div className="section-title">Command Dashboard</div>
          {criticalCount > 0 && (
            <div style={{ display:'flex', alignItems:'center', gap:6, background:'rgba(239,68,68,0.12)', border:'1px solid rgba(239,68,68,0.3)', borderRadius:100, padding:'3px 10px', fontSize:11, fontWeight:700, color:'var(--red)', fontFamily:"'JetBrains Mono', monospace" }}>
              <div className="live-dot" />
              {criticalCount} CRITICAL ZONE{criticalCount>1?'S':''}
            </div>
          )}
        </div>
        <div className="section-desc">Behavioral AI actively redistributing crowd flow — real-time</div>
      </div>

      {/* THE WOW MOMENT — AI Impact Panel */}
      <AIImpactPanel metrics={metrics} mode={mode} density={density} key={flashKey} />

      {/* Google Cloud Vertex AI Insights */}
      {aiInsights && (
        <div className="card mb-4" style={{ borderLeft: '4px solid #8B5CF6', background: 'linear-gradient(90deg, rgba(139,92,246,0.1) 0%, rgba(9,14,26,1) 100%)' }}>
          <div className="card-header" style={{ marginBottom: 12 }}>
            <div>
              <div className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 18 }}>✨</span> Deep Operations Insight (Vertex AI)
              </div>
              <div className="card-subtitle">
                Powered by Google Cloud Gemini 1.5 Flash • {aiInsights.cached ? 'Cached Response' : 'Live GenAI Inference'}
              </div>
            </div>
            <span className="badge" style={{ background: '#8B5CF6', color: '#fff' }}>
              Model: {aiInsights.model}
            </span>
          </div>
          <div style={{ fontSize: 13, lineHeight: 1.6, color: 'var(--text-primary)' }}>
            <div style={{ marginBottom: 12 }}>{aiInsights.summary}</div>
            <div style={{ fontWeight: 600, marginBottom: 8, color: '#A78BFA' }}>Recommended Actions:</div>
            <ul style={{ margin: 0, paddingLeft: 20 }}>
              {aiInsights.actions.map((action, i) => (
                <li key={i} style={{ marginBottom: 4 }}>{action}</li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {/* Simulation Controls */}
      <div className="card glow-blue mb-4">
        <div className="card-header">
          <div>
            <div className="card-title">Scenario Control</div>
            <div className="card-subtitle">Trigger crowd events — watch AI respond in real time</div>
          </div>
          <div style={{ display:'flex', gap:8, alignItems:'center' }}>
            <span style={{ fontSize:11, color:'var(--text-muted)', fontFamily:"'JetBrains Mono',monospace" }}>
              MODE:
            </span>
            <div style={{ background:`${MODE_COLORS[mode]}22`, border:`1px solid ${MODE_COLORS[mode]}55`, color:MODE_COLORS[mode], borderRadius:100, padding:'3px 10px', fontSize:11, fontWeight:700, fontFamily:"'JetBrains Mono',monospace" }}>
              {MODE_ICONS[mode]} {MODE_LABELS[mode]?.toUpperCase()}
            </div>
          </div>
        </div>
        <div className="sim-modes">
          {[
            { key:'normal',    label:'🟢 Normal',          sub:'Low attendance' },
            { key:'pre_match', label:'🟡 Pre-Match Rush',  sub:'Gates open, 65% fill' },
            { key:'halftime',  label:'🔴 Half-Time Surge', sub:'Critical — 85% fill' },
            { key:'exit_rush', label:'🟣 Exit Rush',       sub:'Maximum — 90% fill' },
          ].map(m => (
            <button key={m.key} className={`sim-mode-btn${mode===m.key?' active':''}`} onClick={() => onModeChange(m.key)}>
              <span>{m.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* 4 KPI cards */}
      {metrics && (
        <div className="grid-4 mb-4">
          {[
            { label:'Congestion Reduced', value:`${metrics.congestionReduced}%`, color:'var(--green)',   sub:'vs unoptimized baseline', glow:'glow-green' },
            { label:'Wait Time Reduced',  value:`${metrics.waitTimeReduced}%`,   color:'var(--accent-hover)', sub:'ZeroQueue active', glow:'' },
            { label:'Active Fans',        value:(metrics.activeUsers||0).toLocaleString(), color:'var(--purple)', sub:'using Pulse OS', glow:'' },
            { label:'Satisfaction',       value:`${metrics.satisfactionScore}/5`, color:'var(--yellow)', sub:'real-time NPS', glow:'' },
          ].map(m => (
            <div key={m.label} className={`metric-card ${m.glow}`}>
              <div className="metric-label">{m.label}</div>
              <div className="metric-value" style={{ color: m.color }}>{m.value}</div>
              <div className="metric-change">{m.sub}</div>
            </div>
          ))}
        </div>
      )}

      {/* Heatmap + Alerts */}
      <div className="grid-2-1 mb-4">
        <div className="card">
          <div className="card-header">
            <div>
              <div className="card-title">Live Crowd Heatmap</div>
              <div className="card-subtitle">Real-time zone density — {zoneEntries.length} zones monitored</div>
            </div>
            <div style={{ display:'flex', gap:8, alignItems:'center' }}>
              {['low','moderate','high','critical'].map(l => (
                <div key={l} style={{ display:'flex', alignItems:'center', gap:4 }}>
                  <div className={`density-dot ${l}`} />
                  <span style={{ fontSize:9, color:'var(--text-muted)', textTransform:'capitalize', fontFamily:"'JetBrains Mono',monospace" }}>{l}</span>
                </div>
              ))}
            </div>
          </div>
          <StadiumMap density={density} />
        </div>

        <div className="card">
          <div className="card-header">
            <div className="card-title">Active Alerts</div>
            <div style={{ display:'flex', gap:8, alignItems:'center' }}>
              {alerts.length > 0 && <span className="badge badge-red">{alerts.length}</span>}
              <div className="live-badge"><div className="live-dot" />Live</div>
            </div>
          </div>
          <div style={{ maxHeight:320, overflowY:'auto' }}>
            {alerts.length === 0 ? (
              <div className="empty-state" style={{ padding:'28px 0' }}>
                <div style={{ fontSize:28, marginBottom:8 }}>✅</div>
                <p>All zones nominal</p>
              </div>
            ) : alerts.map(a => (
              <div key={a.id} className={`alert-item ${a.type}`}>
                <div className="alert-icon">
                  <svg width="11" height="11" viewBox="0 0 16 16" fill="none" stroke="white" strokeWidth="2.5">
                    <path d="M8 1l7 14H1L8 1z"/><path d="M8 7v3"/><circle cx="8" cy="12.5" r="0.5" fill="white"/>
                  </svg>
                </div>
                <div className="alert-text">
                  <div className="alert-title">
                    {a.zoneName}
                    {a.source==='staff' && <span style={{ opacity:0.6, fontSize:9, fontWeight:400, marginLeft:6 }}>STAFF</span>}
                  </div>
                  <div className="alert-desc">{a.message}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Charts row */}
      <div className="grid-2 mb-4">
        <div className="card">
          <div className="card-header">
            <div>
              <div className="card-title">Density: AI vs Baseline</div>
              <div className="card-subtitle">Coloured markers = scenario changes</div>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={history}>
              <defs>
                <linearGradient id="densGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#3B82F6" stopOpacity={0.25}/>
                  <stop offset="95%" stopColor="#3B82F6" stopOpacity={0}/>
                </linearGradient>
                <linearGradient id="baseGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#EF4444" stopOpacity={0.15}/>
                  <stop offset="95%" stopColor="#EF4444" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
              <XAxis dataKey="time" tick={{ fontSize:9, fill:'#4B5A72' }} interval="preserveStartEnd" />
              <YAxis tick={{ fontSize:9, fill:'#4B5A72' }} domain={[0,100]} />
              <Tooltip contentStyle={{ fontSize:11, background:'var(--bg-elevated)', border:'1px solid var(--border)', borderRadius:8, color:'var(--text-primary)' }}
                formatter={v => [`${v}%`]} />
              {modeEvents.map((ev,i) => (
                <ReferenceLine key={i} x={ev.time} stroke={ev.color} strokeDasharray="4 2"
                  label={{ value:ev.label, position:'insideTopRight', fontSize:9, fill:ev.color }} />
              ))}
              <Area type="monotone" dataKey="baseline" stroke="#EF4444" fill="url(#baseGrad)" strokeWidth={1.5} strokeDasharray="4 2" name="Baseline" dot={false} />
              <Area type="monotone" dataKey="density"  stroke="#3B82F6" fill="url(#densGrad)"  strokeWidth={2.5} name="AI Optimized %" dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className="card">
          <div className="card-header">
            <div className="card-title">Zone Status</div>
            <div className="card-subtitle">Sorted by congestion level</div>
          </div>
          <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
            {zoneEntries.map(z => (
              <div key={z.id}>
                <div style={{ display:'flex', justifyContent:'space-between', marginBottom:4 }}>
                  <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                    <div className={`density-dot ${z.level}`} />
                    <span style={{ fontSize:11, fontWeight:600, color:'var(--text-primary)' }}>{z.name}</span>
                  </div>
                  <span className={`badge badge-${z.level==='critical'?'red':z.level==='high'?'orange':z.level==='moderate'?'yellow':'green'}`}>
                    {pct(z.density)}%
                  </span>
                </div>
                <div className="density-bar-wrap">
                  <div className={`density-bar ${z.level}`} style={{ width:`${pct(z.density)}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Queue chart */}
      <div className="card">
        <div className="card-header">
          <div className="card-title">ZeroQueue Analytics</div>
          <div className="card-subtitle">Live stall wait times — AI routing fans to shortest queues</div>
        </div>
        {stallData.length === 0 ? (
          <div className="empty-state" style={{ height:160 }}><p>Loading stall data…</p></div>
        ) : (
          <ResponsiveContainer width="100%" height={160}>
            <BarChart data={stallData} margin={{ top:4, right:4, bottom:4, left:-20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
              <XAxis dataKey="stall" tick={{ fontSize:11, fill:'#4B5A72' }} />
              <YAxis tick={{ fontSize:10, fill:'#4B5A72' }} />
              <Tooltip contentStyle={{ fontSize:11, background:'var(--bg-elevated)', border:'1px solid var(--border)', borderRadius:8, color:'var(--text-primary)' }} />
              <Legend wrapperStyle={{ fontSize:10, color:'var(--text-muted)' }} />
              <Bar dataKey="wait" fill="#3B82F6" name="Wait (min)" radius={[6,6,0,0]} />
              <Bar dataKey="load"  fill="rgba(255,255,255,0.06)" name="Load %" radius={[6,6,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
