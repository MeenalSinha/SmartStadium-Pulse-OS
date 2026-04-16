import React, { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import StadiumMap from '../components/shared/StadiumMap';
import { api } from '../services/api';
import { useRecommendations } from '../hooks/useRecommendations';
import { getDensityLevel, pct } from '../utils/helpers';

const LEVEL_CONFIG = {
  critical: { color:'#EF4444', bg:'rgba(239,68,68,0.08)', border:'rgba(239,68,68,0.25)', label:'CRITICAL', emoji:'🚨' },
  high:     { color:'#F97316', bg:'rgba(249,115,22,0.08)', border:'rgba(249,115,22,0.25)', label:'HIGH',     emoji:'🔴' },
  moderate: { color:'#F59E0B', bg:'rgba(245,158,11,0.08)', border:'rgba(245,158,11,0.25)', label:'MODERATE', emoji:'🟡' },
  calm:     { color:'#10B981', bg:'rgba(16,185,129,0.08)', border:'rgba(16,185,129,0.25)', label:'CALM',     emoji:'🟢' },
};

export default function FanApp({ simData, points }) {
  const navigate = useNavigate();
  const { recommendations } = useRecommendations();
  const [queue,       setQueue]       = useState(null);
  const [crowdStatus, setCrowdStatus] = useState(null);
  const prevLevelRef = useRef(null);
  const [statusAnimKey, setStatusAnimKey] = useState(0);

  useEffect(() => {
    const fetchData = () => {
      api.getQueue().then(d => setQueue(d)).catch(() => {});
      api.getCrowdStatus().then(d => {
        setCrowdStatus(d);
        if (d.level !== prevLevelRef.current) {
          setStatusAnimKey(k => k+1);
          prevLevelRef.current = d.level;
        }
      }).catch(() => {});
    };
    fetchData();
    const iv = setInterval(fetchData, 4000);
    return () => clearInterval(iv);
  }, []);

  const density       = simData?.density || {};
  const alerts        = simData?.alerts  || [];
  const criticalZones = Object.entries(density).filter(([,d]) => d > 0.75);
  const quietZones    = Object.entries(density).filter(([,d]) => d < 0.35);
  const cfg           = LEVEL_CONFIG[crowdStatus?.level ?? 'calm'];

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom:20 }}>
        <div className="section-title">Fan Experience</div>
        <div className="section-desc">Pulse OS — your behavioral AI stadium companion</div>
      </div>

      {/* Live crowd status — cinematic banner */}
      {crowdStatus && (
        <div key={statusAnimKey} style={{
          padding:'20px 24px',
          borderRadius:'var(--radius-xl)',
          marginBottom:16,
          background:`linear-gradient(135deg, ${cfg.bg}, rgba(0,0,0,0.2))`,
          border:`1px solid ${cfg.border}`,
          display:'flex', alignItems:'center', gap:16,
          animation:'alertEntrance 0.4s ease',
          position:'relative', overflow:'hidden',
        }}>
          <div className="scan-line" style={{ opacity:0.4 }} />
          <div style={{
            width:52, height:52, borderRadius:'50%', flexShrink:0,
            background:cfg.bg, border:`2px solid ${cfg.border}`,
            display:'flex', alignItems:'center', justifyContent:'center',
            fontSize:24,
          }}>
            {cfg.emoji}
          </div>
          <div style={{ flex:1 }}>
            <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:4 }}>
              <span style={{ fontSize:10, fontWeight:700, letterSpacing:'0.12em', color:cfg.color, fontFamily:"'JetBrains Mono',monospace" }}>
                STADIUM STATUS: {cfg.label}
              </span>
              <span style={{ fontSize:10, color:'var(--text-muted)', fontFamily:"'JetBrains Mono',monospace" }}>
                {Math.round((crowdStatus.avgDensity||0)*100)}% avg occupancy
              </span>
            </div>
            <div style={{ fontSize:14, fontWeight:600, color:'var(--text-primary)', marginBottom:2 }}>
              {crowdStatus.message}
            </div>
            {quietZones.length > 0 && (
              <div style={{ fontSize:11, color:cfg.color, marginTop:4 }}>
                {quietZones.length} quiet zone{quietZones.length>1?'s':''} available → move now for bonus points
              </div>
            )}
          </div>
          {(crowdStatus.level==='high'||crowdStatus.level==='critical') && (
            <button
              className="btn btn-primary"
              onClick={() => navigate('/app/navigate')}
              style={{ flexShrink:0 }}
            >
              🤖 AI Reroute
            </button>
          )}
        </div>
      )}

      {/* Critical zone alert */}
      {alerts.length > 0 && (
        <div style={{
          padding:'12px 18px', borderRadius:'var(--radius-md)', marginBottom:16,
          background:'rgba(239,68,68,0.08)', border:'1px solid rgba(239,68,68,0.25)',
          display:'flex', alignItems:'center', gap:12,
          animation:'alertEntrance 0.3s ease',
        }}>
          <div style={{ fontSize:18, flexShrink:0 }}>⚠️</div>
          <div style={{ flex:1 }}>
            <span style={{ fontSize:12, fontWeight:700, color:'var(--red)' }}>{alerts[0]?.zoneName}: </span>
            <span style={{ fontSize:12, color:'var(--text-secondary)' }}>{alerts[0]?.message}</span>
          </div>
          <button className="btn btn-sm btn-secondary" onClick={() => navigate('/app/navigate', { state:{ autoFrom:alerts[0]?.zone } })}>
            Reroute Me
          </button>
        </div>
      )}

      {/* Quick action cards */}
      <div className="grid-3 mb-4">
        {[
          {
            key:'navigate',
            icon:'🧭',
            title:'Smart Navigate',
            desc: criticalZones.length > 0
              ? `⚠️ ${criticalZones.length} congested zone${criticalZones.length>1?'s':''} — AI routing active`
              : quietZones.length > 0
              ? `${quietZones.length} quiet zone${quietZones.length>1?'s':''} — earn up to 15 pts`
              : 'AI crowd-avoiding routes',
            path:'/app/navigate',
            accent:'var(--accent)',
            glow:'glow-blue',
          },
          {
            key:'order',
            icon:'⚡',
            title:'ZeroQueue',
            desc: queue?.recommended
              ? `Best now: ${queue.recommended.name} · ${queue.recommended.waitTime} min`
              : 'Order without queuing',
            path:'/app/order',
            accent:'var(--green)',
            glow:'glow-green',
          },
          {
            key:'rewards',
            icon:'⭐',
            title:'Pulse Rewards',
            desc: points > 0 ? `${points} pts earned this session` : 'Earn points for smart moves',
            path:'/app/rewards',
            accent:'var(--yellow)',
            glow:'',
          },
        ].map(item => (
          <div key={item.key} className={`card ${item.glow}`} style={{ cursor:'pointer', transition:'all 0.2s' }}
            onClick={() => navigate(item.path)}
          >
            <div style={{ fontSize:28, marginBottom:12 }}>{item.icon}</div>
            <div style={{ fontWeight:700, fontSize:15, color:'var(--text-primary)', marginBottom:6, fontFamily:"'Bricolage Grotesque',sans-serif", letterSpacing:'-0.02em' }}>
              {item.title}
            </div>
            <div style={{ fontSize:12, color:'var(--text-muted)', lineHeight:1.4 }}>{item.desc}</div>
          </div>
        ))}
      </div>

      <div className="grid-2-1">
        {/* Map */}
        <div className="card">
          <div className="card-header">
            <div className="card-title">Stadium Now</div>
            <div className="live-badge"><div className="live-dot" />Live</div>
          </div>
          <StadiumMap density={density} compact />
          <div style={{ marginTop:12, display:'flex', gap:16 }}>
            {criticalZones.length > 0 && (
              <span style={{ fontSize:11, color:'var(--red)', fontWeight:600, display:'flex', alignItems:'center', gap:4 }}>
                <div className="density-dot critical" />
                {criticalZones.length} critical
              </span>
            )}
            {quietZones.length > 0 && (
              <span style={{ fontSize:11, color:'var(--green)', fontWeight:600, display:'flex', alignItems:'center', gap:4 }}>
                <div className="density-dot low" />
                {quietZones.length} quiet
              </span>
            )}
          </div>
        </div>

        {/* AI nudges */}
        <div className="card">
          <div className="card-header">
            <div>
              <div className="card-title">AI Nudges</div>
              <div className="card-subtitle">Move smart, earn points</div>
            </div>
          </div>
          <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
            {recommendations.map(rec => (
              <div key={`${rec.type}-${rec.zone}`} className="reward-row"
                onClick={() => navigate(rec.type==='routing' ? '/app/navigate' : '/app/order')}
              >
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:12, fontWeight:600, color:'var(--text-primary)' }}>{rec.title}</div>
                  <div style={{ fontSize:11, color:'var(--text-muted)', marginTop:2 }}>{rec.description}</div>
                </div>
                <div className="points-chip">+{rec.points}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
