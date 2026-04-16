import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useRecommendations } from '../hooks/useRecommendations';

const TIERS = [
  { name: 'Bronze',   min: 0,   max: 50,  color: '#92400E', bg: '#FEF3C7' },
  { name: 'Silver',   min: 50,  max: 200, color: '#6B7280', bg: '#F3F4F6' },
  { name: 'Gold',     min: 200, max: 500, color: '#D97706', bg: '#FEF3C7' },
  { name: 'Platinum', min: 500, max: null,color: '#7C3AED', bg: '#EDE9FE' },
];

const PERKS = [
  { id: 'p1', name: '10% Food Discount',   cost: 50,  icon: '🍔', desc: 'Valid at any ZeroQueue stall today' },
  { id: 'p2', name: 'Free Drink',           cost: 100, icon: '🥤', desc: 'Cola, Water or Energy Drink' },
  { id: 'p3', name: 'Priority Entry',       cost: 200, icon: '⚡', desc: 'Skip the gate queue next match' },
  { id: 'p4', name: 'VIP Lounge Access',    cost: 500, icon: '✨', desc: 'Premium area for the rest of today' },
];

const CHALLENGES = [
  { id: 'c1', desc: 'Use Smart Navigate 3 times',         reward: 30, icon: '🗺️' },
  { id: 'c2', desc: 'Order from ZeroQueue during halftime',reward: 25, icon: '🍕' },
  { id: 'c3', desc: 'Help reduce congestion in 2 zones',  reward: 40, icon: '🚶' },
  { id: 'c4', desc: 'Reach Silver tier today',            reward: 20, icon: '🥈' },
];

export default function RewardsPage({ points = 0, recentActivity = [] }) {
  const navigate = useNavigate();
  const { recommendations } = useRecommendations(5000);
  const [redeemedPerks, setRedeemedPerks] = useState(new Set());

  const tier = TIERS.slice().reverse().find(t => points >= t.min) || TIERS[0];
  const nextTier = TIERS.find(t => t.min > points);
  const progress = nextTier
    ? Math.min(100, ((points - tier.min) / (nextTier.min - tier.min)) * 100)
    : 100;

  const todaysEarnings = recentActivity.reduce((s, a) => s + (a.points || 0), 0);
  const routeCount     = recentActivity.filter(a => a.action?.toLowerCase().includes('route')).length;
  const orderCount     = recentActivity.filter(a => a.action?.toLowerCase().includes('order')).length;

  const handleRedeem = (perk) => {
    if (points < perk.cost || redeemedPerks.has(perk.id)) return;
    setRedeemedPerks(prev => new Set([...prev, perk.id]));
    // In production: POST /api/redeem { perkId, userId }
  };

  return (
    <div>
      <div className="section-title">Pulse Rewards</div>
      <div className="section-desc">Every smart move earns you points — routes, orders, and behaviour all count</div>

      {/* Points + Tier card */}
      <div className="grid-3 mb-4">
        <div className="card" style={{ gridColumn: 'span 2', background: `linear-gradient(135deg, ${tier.bg} 0%, #fff 100%)` }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div className="metric-label">Total Points</div>
              <div className="metric-value" style={{ fontSize: 48, color: tier.color }}>{points}</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6 }}>
                <span style={{ background: tier.color, color: '#fff', fontSize: 12, fontWeight: 700, padding: '4px 14px', borderRadius: 100 }}>
                  {tier.name} Member
                </span>
                {nextTier && (
                  <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                    {nextTier.min - points} pts to {nextTier.name}
                  </span>
                )}
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>Today</div>
              <div style={{ fontSize: 28, fontWeight: 700, color: 'var(--green)' }}>+{todaysEarnings}</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>pts earned</div>
            </div>
          </div>
          <div style={{ marginTop: 18 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--text-muted)', marginBottom: 6 }}>
              <span>Progress to {nextTier ? nextTier.name : 'Max tier'}</span>
              <span>{Math.round(progress)}%</span>
            </div>
            <div className="density-bar-wrap" style={{ height: 8 }}>
              <div style={{ height: '100%', width: `${progress}%`, borderRadius: 4, background: tier.color, transition: 'width 0.8s ease' }} />
            </div>
          </div>
        </div>

        {/* Today's impact stats */}
        <div className="card">
          <div className="metric-label" style={{ marginBottom: 14 }}>Today's Impact</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>🗺️ Routes taken</span>
              <span style={{ fontSize: 16, fontWeight: 700, color: 'var(--accent)' }}>{routeCount}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>🛍️ ZeroQueue orders</span>
              <span style={{ fontSize: 16, fontWeight: 700, color: 'var(--green)' }}>{orderCount}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>⭐ Session pts</span>
              <span style={{ fontSize: 16, fontWeight: 700, color: tier.color }}>{todaysEarnings}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="grid-2 mb-4">
        {/* Live earn-now nudges */}
        <div className="card">
          <div className="card-header">
            <div className="card-title">Earn Points Now</div>
            <div className="live-badge"><div className="live-dot" />Live</div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {recommendations.map(rec => (
              <div
                key={`${rec.type}-${rec.zone}`}
                className="reward-row"
                style={{ cursor: 'pointer' }}
                onClick={() => navigate(rec.type === 'routing' ? '/app/navigate' : '/app/order')}
              >
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{rec.title}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2 }}>{rec.description}</div>
                </div>
                <div className="points-chip">+{rec.points}</div>
              </div>
            ))}
            <div className="reward-row" style={{ cursor: 'pointer' }} onClick={() => navigate('/app/navigate')}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>Take an AI-suggested route</div>
                <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2 }}>Follow the crowd-avoiding path to earn bonus points</div>
              </div>
              <div className="points-chip">+8–15</div>
            </div>
          </div>
        </div>

        {/* Challenges */}
        <div className="card">
          <div className="card-header">
            <div className="card-title">Today's Challenges</div>
            <div className="card-subtitle">Bonus point opportunities</div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {CHALLENGES.map(ch => (
              <div key={ch.id} className="reward-row">
                <span style={{ fontSize: 18, marginRight: 4 }}>{ch.icon}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>{ch.desc}</div>
                </div>
                <div className="points-chip">+{ch.reward}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Redeem perks */}
      <div className="card mb-4">
        <div className="card-header">
          <div className="card-title">Redeem Perks</div>
          <div className="card-subtitle">{points} points available</div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
          {PERKS.map(perk => {
            const canRedeem = points >= perk.cost;
            const redeemed  = redeemedPerks.has(perk.id);
            return (
              <div
                key={perk.id}
                onClick={() => handleRedeem(perk)}
                style={{
                  padding: '16px 14px', textAlign: 'center',
                  border: `2px solid ${redeemed ? 'var(--green)' : canRedeem ? 'var(--accent)' : 'var(--border)'}`,
                  borderRadius: 'var(--radius-md)',
                  background: redeemed ? 'var(--green-light)' : canRedeem ? 'var(--accent-light)' : 'var(--bg-surface)',
                  opacity: canRedeem || redeemed ? 1 : 0.5,
                  cursor: canRedeem && !redeemed ? 'pointer' : 'default',
                  transition: 'all 0.15s',
                }}
              >
                <div style={{ fontSize: 28, marginBottom: 8 }}>{redeemed ? '✅' : perk.icon}</div>
                <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 4 }}>{perk.name}</div>
                <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 8 }}>{perk.desc}</div>
                <div style={{
                  display: 'inline-block', padding: '3px 10px', borderRadius: 100, fontSize: 11, fontWeight: 700,
                  background: redeemed ? 'var(--green)' : canRedeem ? 'var(--accent)' : 'var(--border)',
                  color: redeemed || canRedeem ? '#fff' : 'var(--text-muted)',
                }}>
                  {redeemed ? 'Redeemed!' : `${perk.cost} pts`}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Activity feed */}
      <div className="card">
        <div className="card-title" style={{ marginBottom: 14 }}>Activity Feed</div>
        {recentActivity.length === 0 ? (
          <div className="empty-state">
            <p>No activity yet — start navigating to earn points</p>
          </div>
        ) : (
          <table className="data-table">
            <thead><tr><th>Action</th><th>Points</th><th>Time</th></tr></thead>
            <tbody>
              {recentActivity.slice(-10).reverse().map((a, i) => (
                <tr key={`${a.time}-${i}`}>
                  <td style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{a.action}</td>
                  <td><span className="points-chip">+{a.points}</span></td>
                  <td style={{ color: 'var(--text-muted)' }}>{a.time}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
