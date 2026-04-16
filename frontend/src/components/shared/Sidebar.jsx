import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { formatModeLabel } from '../../utils/helpers';

const NAV = [
  {
    section: 'Command Center',
    items: [
      { path: '/admin',           label: 'Dashboard',      icon: GridIcon },
      { path: '/admin/heatmap',   label: 'Live Heatmap',   icon: MapIcon },
      { path: '/admin/alerts',    label: 'Alerts',         icon: BellIcon },
      { path: '/admin/analytics', label: 'Analytics',      icon: ChartIcon },
      { path: '/admin/staff',     label: 'Staff Dispatch', icon: UsersIcon },
    ],
  },
  {
    section: 'Fan Experience',
    items: [
      { path: '/app',            label: 'Fan App',         icon: PhoneIcon },
      { path: '/app/navigate',   label: 'Navigation',      icon: NavIcon },
      { path: '/app/order',      label: 'ZeroQueue Order', icon: BagIcon },
      { path: '/app/rewards',    label: 'Pulse Rewards',   icon: StarIcon },
    ],
  },
];

export default function Sidebar({ connected, mode }) {
  const navigate = useNavigate();
  const { pathname } = useLocation();

  return (
    <aside className="sidebar">
      <div className="sidebar-logo">
        <h1>SmartStadium</h1>
        <span>Pulse OS v1.1</span>
      </div>

      <div style={{ padding: '10px 20px', borderBottom: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <div style={{
            width: 7, height: 7, borderRadius: '50%',
            background: connected ? 'var(--green)' : 'var(--red)',
          }} />
          <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 500 }}>
            {connected ? 'Live feed active' : 'Connecting...'}
          </span>
        </div>
        <div style={{ marginTop: 6 }}>
          {/* FIX: use formatModeLabel — 'exit_rush' → 'Exit Rush', not 'exit rush' */}
          <span className="badge badge-blue">{formatModeLabel(mode)}</span>
        </div>
      </div>

      <nav className="sidebar-nav">
        {NAV.map(group => (
          <div key={group.section}>
            <div className="nav-section-label">{group.section}</div>
            {group.items.map(item => {
              const Icon = item.icon;
              const active = pathname === item.path ||
                (item.path !== '/admin' && item.path !== '/app' && pathname.startsWith(item.path));
              return (
                <button
                  key={item.path}
                  className={`nav-item${active ? ' active' : ''}`}
                  onClick={() => navigate(item.path)}
                >
                  <Icon size={15} />
                  {item.label}
                </button>
              );
            })}
          </div>
        ))}
      </nav>

      <div style={{ padding: '12px 20px', borderTop: '1px solid var(--border)' }}>
        <div style={{ fontSize: 10, color: 'var(--text-muted)', lineHeight: 1.6 }}>
          Stadium Arena — Sector 4<br />
          Match Day Operations
        </div>
      </div>
    </aside>
  );
}

function GridIcon({ size = 16 }) {
  return <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
    <rect x="1" y="1" width="6" height="6" rx="1" /><rect x="9" y="1" width="6" height="6" rx="1" />
    <rect x="1" y="9" width="6" height="6" rx="1" /><rect x="9" y="9" width="6" height="6" rx="1" />
  </svg>;
}
function MapIcon({ size = 16 }) {
  return <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
    <path d="M1 3l4-2 6 3 4-2v11l-4 2-6-3-4 2V3z"/><path d="M5 1v11M11 4v11"/>
  </svg>;
}
function BellIcon({ size = 16 }) {
  return <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
    <path d="M8 1a5 5 0 015 5v3l1.5 2H1.5L3 9V6a5 5 0 015-5z"/><path d="M6.5 13.5a1.5 1.5 0 003 0"/>
  </svg>;
}
function ChartIcon({ size = 16 }) {
  return <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
    <path d="M1 12l4-5 3 2 4-6 3 3"/><path d="M1 15h14"/>
  </svg>;
}
function UsersIcon({ size = 16 }) {
  return <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
    <circle cx="6" cy="5" r="3"/><path d="M1 15a5 5 0 0110 0"/><circle cx="12" cy="5" r="2.5"/>
    <path d="M12 10.5a4 4 0 013 4"/>
  </svg>;
}
function PhoneIcon({ size = 16 }) {
  return <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
    <rect x="4" y="1" width="8" height="14" rx="2"/><circle cx="8" cy="12.5" r="0.8" fill="currentColor" stroke="none"/>
  </svg>;
}
function NavIcon({ size = 16 }) {
  return <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
    <path d="M8 1l6 14-6-3-6 3z"/>
  </svg>;
}
function BagIcon({ size = 16 }) {
  return <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
    <path d="M5 5V4a3 3 0 016 0v1"/><rect x="1" y="5" width="14" height="10" rx="2"/>
  </svg>;
}
function StarIcon({ size = 16 }) {
  return <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
    <path d="M8 1l2 5h5l-4 3 1.5 5L8 11l-4.5 3L5 9 1 6h5z"/>
  </svg>;
}
