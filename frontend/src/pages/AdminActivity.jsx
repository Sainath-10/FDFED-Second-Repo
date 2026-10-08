/**
 * NEXUS ESPORTS — Admin Activity Logs
 *
 * resolves the target
 * admin (?admin= or the session user), their role badge (via /auth/users), merges
 * local admin activity logs with the backend Admin.getActivity log, and renders
 * the audit timeline + stat counters.
 */
import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import NexusData from '../services/data.js';
import NexusAPI from '../services/api.js';
import '../styles/pages/admin/dashboard.css';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

const escapeHtml = (str) => String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');

function activityMeta(item) {
  if (item.actionType === 'REVENUE_CONFIG_CHANGE') return { badge: 'REVENUE CONFIGURATION UPDATE', bg: 'rgba(251,146,60,0.15)', color: '#fb923c', icon: '⚙️' };
  if (item.actionType === 'DISPUTE_RESOLVED') return { badge: 'DISPUTE RESOLUTION', bg: 'rgba(96,165,250,0.15)', color: '#60a5fa', icon: '⚖️' };
  if (item.actionType === 'COMPETITION_APPROVAL' || item.actionType === 'COMPETITION_APPROVED') return { badge: 'TOURNAMENT APPROVAL', bg: 'rgba(198,255,51,0.15)', color: '#c6ff33', icon: '🏆' };
  return { badge: 'ADMIN ACTION', bg: 'rgba(255,255,255,0.1)', color: '#ffffff', icon: '⚡' };
}

export default function AdminActivity() {
  const [params] = useSearchParams();
  const { session } = useAuth();
  const loggedInUser = (session && (session.username || session.email)) || 'admin@nexus.gg';

  const [role, setRole] = useState({ label: 'Administrator', isSuper: false });
  const [logs, setLogs] = useState([]);

  const username = (params.get('admin') || loggedInUser).trim();

  useEffect(() => {
    let alive = true;
    (async () => {
      let detectedType = 'Administrator';
      let isSuper = username.toLowerCase().includes('super');
      try {
        const res = await fetch(`${API_URL}/auth/users`);
        if (res.ok) {
          const users = await res.json();
          const u = users.find((x) => String(x.username || x.email).toLowerCase() === username.toLowerCase());
          if (u) {
            const t = String(u.adminType || u.role || '').toLowerCase();
            if (t.includes('dispute')) detectedType = 'Dispute Admin';
            else if (t.includes('revenue')) detectedType = 'Revenue Admin';
            else if (t.includes('comp') || t === 'admin') detectedType = 'Comp Admin';
            else if (t.includes('super')) { detectedType = 'Super Admin'; isSuper = true; }
          }
        }
      } catch (e) { /* ignore */ }
      if (alive) setRole({ label: detectedType, isSuper });
    })();
    return () => { alive = false; };
  }, [username]);

  useEffect(() => {
    let alive = true;
    (async () => {
      let all = [];
      if (NexusData && typeof NexusData.getAdminActivityLogs === 'function') all = NexusData.getAdminActivityLogs(username) || [];
      else if (typeof window.getAdminActivityLogs === 'function') all = window.getAdminActivityLogs(username) || [];

      try {
        if (NexusAPI && NexusAPI.Admin && typeof NexusAPI.Admin.getActivity === 'function') {
          const res = await NexusAPI.Admin.getActivity(username);
          if (res && res.ok && Array.isArray(res.data)) {
            const merged = new Map();
            [...all, ...res.data].forEach((item) => { if (item && item.id) merged.set(item.id, item); });
            all = Array.from(merged.values());
          }
        }
      } catch (e) { /* ignore */ }

      const targetNorm = String(username || '').trim().toLowerCase();
      const filtered = all.filter((l) => {
        if (!l) return false;
        const author = String(l.adminUsername || l.username || '').trim().toLowerCase();
        return author === targetNorm || (!author && targetNorm === 'admin');
      });
      filtered.sort((a, b) => new Date(b.timestamp || Date.now()) - new Date(a.timestamp || Date.now()));
      if (alive) setLogs(filtered);
    })();
    return () => { alive = false; };
  }, [username]);

  const configCount = logs.filter((l) => l.actionType === 'REVENUE_CONFIG_CHANGE').length;
  const disputesCount = logs.filter((l) => l.actionType === 'DISPUTE_RESOLVED').length;
  const approvalsCount = logs.filter((l) => l.actionType === 'COMPETITION_APPROVAL' || l.actionType === 'COMPETITION_APPROVED').length;

  const badgeStyle = role.isSuper
    ? { background: 'rgba(231,0,11,0.15)', color: '#e7000b', border: '1px solid rgba(231,0,11,0.3)' }
    : { background: 'rgba(198,255,51,0.15)', color: '#c6ff33', border: '1px solid rgba(198,255,51,0.3)' };

  return (
    <main className="admin-main">
      <header className="admin-header" style={{ marginBottom: 24 }}>
        <div>
          <h1 className="admin-title">Admin <span style={{ color: 'var(--accent,#c6ff33)' }}>Activity Logs</span></h1>
          <p className="admin-desc">Detailed audit timeline of administrative actions including revenue configuration changes, dispute resolutions, and tournament approvals.</p>
        </div>
      </header>

      <div id="admin-info-card" style={{ background: '#0a0a0a', border: '1px solid #262626', borderRadius: 16, padding: 24, marginBottom: 28, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div id="admin-avatar" style={{ width: 56, height: 56, borderRadius: '50%', background: 'rgba(198,255,51,0.15)', border: '2px solid rgba(198,255,51,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, fontWeight: 900, color: '#c6ff33' }}>
            {String(username || 'A').charAt(0).toUpperCase()}
          </div>
          <div>
            <h2 id="admin-username-title" style={{ margin: '0 0 4px', color: '#ffffff', fontSize: 20, fontWeight: 800 }}>{username}</h2>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span id="admin-role-badge" style={{ padding: '4px 10px', borderRadius: 20, fontSize: 12, fontWeight: 700, ...badgeStyle }}>{role.label}</span>
              <span id="admin-email-text" style={{ color: 'var(--text-muted)', fontSize: 13 }}>{username.includes('@') ? username : `${username}@nexus.gg`}</span>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
          <div style={{ background: '#141414', border: '1px solid #262626', borderRadius: 12, padding: '12px 18px', textAlign: 'center', minWidth: 110 }}>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', marginBottom: 4 }}>Revenue Config</div>
            <div id="stat-config-count" style={{ fontSize: 20, fontWeight: 900, color: '#fb923c' }}>{configCount}</div>
          </div>
          <div style={{ background: '#141414', border: '1px solid #262626', borderRadius: 12, padding: '12px 18px', textAlign: 'center', minWidth: 110 }}>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', marginBottom: 4 }}>Disputes Resolved</div>
            <div id="stat-disputes-count" style={{ fontSize: 20, fontWeight: 900, color: '#60a5fa' }}>{disputesCount}</div>
          </div>
          <div style={{ background: '#141414', border: '1px solid #262626', borderRadius: 12, padding: '12px 18px', textAlign: 'center', minWidth: 110 }}>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', marginBottom: 4 }}>Approvals</div>
            <div id="stat-approvals-count" style={{ fontSize: 20, fontWeight: 900, color: '#c6ff33' }}>{approvalsCount}</div>
          </div>
        </div>
      </div>

      <section style={{ background: '#0a0a0a', border: '1px solid #262626', borderRadius: 16, padding: 28 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
          <h3 style={{ margin: 0, fontSize: 17, fontWeight: 800, color: '#ffffff', display: 'flex', alignItems: 'center', gap: 10 }}><span>⚡ Audit Trail Timeline</span></h3>
          <div id="log-count-text" style={{ color: 'var(--text-muted)', fontSize: 13, fontWeight: 600 }}>Showing {logs.length} activity log{logs.length === 1 ? '' : 's'} for {username}</div>
        </div>

        <div id="activity-timeline-list" style={{ display: logs.length ? 'flex' : 'none', flexDirection: 'column', gap: 16 }}>
          {logs.map((item, i) => {
            const m = activityMeta(item);
            const md = item.metadata || {};
            const hasMeta = Object.keys(md).length > 0;
            return (
              <div key={item.id || i} style={{ background: '#141414', border: '1px solid #262626', borderRadius: 12, padding: 20, display: 'flex', flexDirection: 'column', gap: 12, position: 'relative' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 10 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ fontSize: 20 }}>{m.icon}</span>
                    <span style={{ padding: '4px 10px', borderRadius: 20, fontSize: 11, fontWeight: 800, background: m.bg, color: m.color, border: `1px solid ${m.color}33`, letterSpacing: '0.5px' }}>{m.badge}</span>
                  </div>
                  <span style={{ color: 'var(--text-muted)', fontSize: 12, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}>🕒 {item.timestamp ? new Date(item.timestamp).toLocaleString() : 'Recently'}</span>
                </div>
                <div style={{ color: '#ffffff', fontSize: 14, fontWeight: 600, lineHeight: 1.5 }} dangerouslySetInnerHTML={{ __html: escapeHtml(item.details) }} />
                {hasMeta && (
                  <div style={{ background: '#0a0a0a', border: '1px solid #262626', borderRadius: 8, padding: '10px 14px', fontSize: 12, color: 'var(--text-muted)', display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                    {md.prevPercentage !== undefined && <div>Prize Fee: <strong style={{ color: '#ffffff' }}>{md.prevPercentage}% → {md.newPercentage}%</strong></div>}
                    {md.prevMinCost !== undefined && <div>Min Cost: <strong style={{ color: '#ffffff' }}>₹{md.prevMinCost} → ₹{md.newMinCost}</strong></div>}
                    {md.target && <div>Target: <strong style={{ color: '#ffffff' }}>{escapeHtml(md.target)}</strong></div>}
                    {md.disputeId && <div>Dispute ID: <strong style={{ color: '#ffffff' }}>#{escapeHtml(String(md.disputeId).slice(-8))}</strong></div>}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {logs.length === 0 && (
          <div id="activity-empty-state" style={{ padding: '60px 20px', textAlign: 'center', background: '#141414', border: '1px dashed #262626', borderRadius: 12 }}>
            <div style={{ fontSize: 36, marginBottom: 12 }}>📋</div>
            <h4 style={{ margin: '0 0 6px', color: '#ffffff', fontSize: 16, fontWeight: 700 }}>No Activity Logs Found</h4>
            <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: 13 }}>This administrator has not performed any revenue configuration changes or dispute resolutions yet.</p>
          </div>
        )}
      </section>
    </main>
  );
}


