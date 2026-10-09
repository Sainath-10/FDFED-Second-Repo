/**
 * NEXUS ESPORTS — Admin Activity Logs
 *
 * resolves the target
 * admin (?admin= or the session user), their role badge (via /auth/users), merges
 * local admin activity logs with the backend Admin.getActivity log, and renders
 * the audit timeline + stat counters.
 */
import { useEffect, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
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

const formatPrizePool = (prize) => {
  if (!prize || prize === '—' || prize === '-' || prize === '₹0' || String(prize).toLowerCase().includes('no prize')) return 'No Prize Pool';
  const str = String(prize).trim();
  return str.toLowerCase().includes('prize pool') ? str : `${str} Prize Pool`;
};

const prizeAmount = (c) => c?.prize || (c?.prizePool ? parseInt(String(c.prizePool).replace(/[^0-9]/g, ''), 10) || 0 : 0);

const feeFor = (c) => {
  if (!c) return 0;
  if (typeof c.platformFee === 'number') return c.platformFee;
  if (NexusData && typeof NexusData.calculatePlatformFee === 'function') {
    return NexusData.calculatePlatformFee(prizeAmount(c));
  }
  return Math.round(prizeAmount(c) * 0.1);
};

function getCompStatusBadge(comp) {
  const app = String((comp && comp.approvalStatus) || 'approved').toLowerCase();
  if (app === 'pending') {
    return (
      <span style={{ padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700, background: 'rgba(251,146,60,0.15)', color: '#fb923c', border: '1px solid rgba(251,146,60,0.3)', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
        ⏳ Pending Approval
      </span>
    );
  }
  if (app === 'rejected') {
    return (
      <span style={{ padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700, background: 'rgba(239,68,68,0.15)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.3)', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
        ✖ Rejected
      </span>
    );
  }
  return (
    <span style={{ padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700, background: 'rgba(198,255,51,0.15)', color: '#c6ff33', border: '1px solid rgba(198,255,51,0.3)', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
      ✔ Active &amp; Live
    </span>
  );
}

function isCompetitionActivity(item) {
  if (!item) return false;
  const actionType = String(item.actionType || '').toUpperCase();
  if (actionType.includes('COMPETITION') || actionType.includes('TOURNAMENT')) return true;
  const md = item.metadata || {};
  if (md.compId || md.competitionId || md.competitionName) return true;
  if (/competition|tournament/i.test(item.details || '')) return true;
  return false;
}

function findCompetitionForLog(item) {
  if (!item) return null;
  const md = item.metadata || {};
  let comp = null;
  const compId = md.compId || md.competitionId || md.id;

  if (compId && NexusData && typeof NexusData.getCompetitionById === 'function') {
    comp = NexusData.getCompetitionById(compId);
  }

  let allComps = [];
  if (NexusData && typeof NexusData.loadCompetitions === 'function') {
    allComps = NexusData.loadCompetitions() || [];
  } else {
    try {
      allComps = JSON.parse(localStorage.getItem('nexus_competitions') || '[]');
    } catch (e) { allComps = []; }
  }

  if (!comp && compId) {
    comp = allComps.find((c) => c && c.id === compId);
  }

  const nameMatch = md.competitionName || (() => {
    const match = String(item.details || '').match(/competition\s+["']([^"']+)["']/i);
    return match ? match[1] : null;
  })();

  if (!comp && nameMatch) {
    const norm = nameMatch.trim().toLowerCase();
    comp = allComps.find((c) => c && c.name && c.name.trim().toLowerCase() === norm);
  }

  if (!comp && isCompetitionActivity(item)) {
    const fallbackName = nameMatch || 'Tournament';
    comp = {
      id: compId || 'comp-fallback',
      name: fallbackName,
      game: md.game || 'Competitive Esports',
      prizePool: md.prizePool || 50000,
      approvalStatus: md.decision || 'approved',
      status: 'active',
      location: md.location || 'Online',
      dates: md.dates || 'Ongoing / Scheduled',
      format: md.format || 'Tournament',
      type: md.type || 'Single Elimination',
      createdBy: md.createdBy || item.adminUsername || 'Organizer',
      organizers: [md.createdBy || item.adminUsername || 'Organizer'],
      description: md.description || `Competition "${fallbackName}" reviewed and approved by administrator.`
    };
  }

  return comp;
}

export default function AdminActivity() {
  const [params] = useSearchParams();
  const { session } = useAuth();
  const loggedInUser = (session && (session.username || session.email)) || 'admin@nexus.gg';

  const [role, setRole] = useState({ label: 'Administrator', isSuper: false });
  const [logs, setLogs] = useState([]);
  const [expandedLogIds, setExpandedLogIds] = useState(new Set());

  const toggleExpand = (logId) => {
    setExpandedLogIds((prev) => {
      const next = new Set(prev);
      if (next.has(logId)) next.delete(logId);
      else next.add(logId);
      return next;
    });
  };

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
          {session && (session.role === 'super-admin' || session.role === 'super_admin') && (
            <Link
              to="/pages/super-admin/admins.html"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                color: 'var(--accent, #c6ff33)',
                textDecoration: 'none',
                fontSize: 13,
                fontWeight: 700,
                marginBottom: 14,
              }}
            >
              ← Back to Administrator Directory
            </Link>
          )}
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
            const isComp = isCompetitionActivity(item);
            const comp = isComp ? findCompetitionForLog(item) : null;
            const logKey = item.id || `log-${i}`;
            const isExpanded = expandedLogIds.has(logKey);
            const hasAuditFields = md.prevPercentage !== undefined || md.prevMinCost !== undefined || md.target || md.disputeId;

            return (
              <div key={logKey} style={{ background: '#141414', border: '1px solid #262626', borderRadius: 12, padding: 20, display: 'flex', flexDirection: 'column', gap: 12, position: 'relative' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 10 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ fontSize: 20 }}>{m.icon}</span>
                    <span style={{ padding: '4px 10px', borderRadius: 20, fontSize: 11, fontWeight: 800, background: m.bg, color: m.color, border: `1px solid ${m.color}33`, letterSpacing: '0.5px' }}>{m.badge}</span>
                  </div>
                  <span style={{ color: 'var(--text-muted)', fontSize: 12, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}>🕒 {item.timestamp ? new Date(item.timestamp).toLocaleString() : 'Recently'}</span>
                </div>
                <div style={{ color: '#ffffff', fontSize: 14, fontWeight: 600, lineHeight: 1.5 }} dangerouslySetInnerHTML={{ __html: escapeHtml(item.details) }} />

                {/* Competition Details button & inline expandable card */}
                {isComp && comp && (
                  <div style={{ marginTop: 2 }}>
                    <button
                      id={`btn-details-${logKey}`}
                      className="btn-table-secondary"
                      onClick={() => toggleExpand(logKey)}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 6,
                        padding: '6px 14px',
                        fontSize: 12,
                        fontWeight: 700,
                        borderRadius: 6,
                        border: isExpanded ? '1px solid rgba(198,255,51,0.5)' : '1px solid rgba(255,255,255,0.15)',
                        color: isExpanded ? '#c6ff33' : '#e5e5e5',
                        background: isExpanded ? 'rgba(198,255,51,0.08)' : 'rgba(255,255,255,0.04)',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease',
                      }}
                    >
                      <span style={{ fontSize: 11 }}>{isExpanded ? '▲' : '▼'}</span>
                      <span>{isExpanded ? 'Hide Details' : 'Details'}</span>
                    </button>

                    {isExpanded && (
                      <div
                        id={`comp-card-${logKey}`}
                        className="activity-comp-card"
                        style={{
                          marginTop: 12,
                          background: '#0d0f14',
                          border: '1px solid rgba(198,255,51,0.25)',
                          boxShadow: '0 8px 24px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.05)',
                          borderRadius: 12,
                          padding: '18px 20px',
                          animation: 'fadeIn 0.2s ease-in-out',
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, marginBottom: 14 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <span style={{ fontSize: 22 }}>🏆</span>
                            <div>
                              <h4 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: '#ffffff', letterSpacing: '-0.3px' }}>
                                {comp.name || 'Tournament'}
                              </h4>
                              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                                Game: <strong style={{ color: '#fff' }}>{comp.game || 'Esports'}</strong>
                              </span>
                            </div>
                          </div>
                          <div>
                            {getCompStatusBadge(comp)}
                          </div>
                        </div>

                        <div
                          style={{
                            display: 'grid',
                            gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                            gap: '12px 18px',
                            background: '#07080a',
                            border: '1px solid #1f242d',
                            borderRadius: 8,
                            padding: '14px 16px',
                            fontSize: 12,
                            color: 'var(--text-muted)',
                          }}
                        >
                          <div>
                            <div style={{ fontSize: 11, textTransform: 'uppercase', color: '#64748b', fontWeight: 700, marginBottom: 2 }}>Prize Pool</div>
                            <div style={{ color: '#fb923c', fontSize: 15, fontWeight: 800 }}>{formatPrizePool(comp.prizePool)}</div>
                          </div>
                          <div>
                            <div style={{ fontSize: 11, textTransform: 'uppercase', color: '#64748b', fontWeight: 700, marginBottom: 2 }}>Platform Fee (Revenue)</div>
                            <div style={{ color: '#c6ff33', fontSize: 15, fontWeight: 800 }}>₹{feeFor(comp).toLocaleString('en-IN')}</div>
                          </div>
                          <div>
                            <div style={{ fontSize: 11, textTransform: 'uppercase', color: '#64748b', fontWeight: 700, marginBottom: 2 }}>Organizer / Creator</div>
                            <div style={{ color: '#ffffff', fontWeight: 600 }}>{comp.createdBy || comp.organizerId || 'System'}</div>
                          </div>
                          <div>
                            <div style={{ fontSize: 11, textTransform: 'uppercase', color: '#64748b', fontWeight: 700, marginBottom: 2 }}>Format &amp; Type</div>
                            <div style={{ color: '#ffffff', fontWeight: 600 }}>{comp.format || 'Tournament'}{comp.type ? ` • ${comp.type}` : ''}</div>
                          </div>
                          <div>
                            <div style={{ fontSize: 11, textTransform: 'uppercase', color: '#64748b', fontWeight: 700, marginBottom: 2 }}>Tournament Dates</div>
                            <div style={{ color: '#ffffff', fontWeight: 600 }}>📅 {comp.dates || 'TBD'}</div>
                          </div>
                          <div>
                            <div style={{ fontSize: 11, textTransform: 'uppercase', color: '#64748b', fontWeight: 700, marginBottom: 2 }}>Location</div>
                            <div style={{ color: '#ffffff', fontWeight: 600 }}>📍 {comp.location || 'Online'}</div>
                          </div>
                          <div>
                            <div style={{ fontSize: 11, textTransform: 'uppercase', color: '#64748b', fontWeight: 700, marginBottom: 2 }}>Teams &amp; Entry</div>
                            <div style={{ color: '#ffffff', fontWeight: 600 }}>
                              🛡️ {comp.teams ? comp.teams.length : 0} {comp.maxTeams ? `/ ${comp.maxTeams}` : ''} teams • {comp.entryFee || 'Free'}
                            </div>
                          </div>
                          <div>
                            <div style={{ fontSize: 11, textTransform: 'uppercase', color: '#64748b', fontWeight: 700, marginBottom: 2 }}>Registration Window</div>
                            <div style={{ color: '#ffffff', fontWeight: 600 }}>
                              {(comp.registrationDates && comp.registrationDates.open) ? `${comp.registrationDates.open} – ${comp.registrationDates.close || 'Closing'}` : 'Open'}
                            </div>
                          </div>
                        </div>

                        {comp.description && (
                          <div style={{ marginTop: 12, padding: '10px 14px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 8, fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.5 }}>
                            <strong style={{ color: '#ffffff', display: 'block', marginBottom: 2 }}>Description:</strong>
                            {comp.description}
                          </div>
                        )}

                        <div style={{ marginTop: 14, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10, borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: 12 }}>
                          {comp.id && comp.id !== 'comp-fallback' ? (
                            <Link
                              to={`/pages/admin/competition-detail.html?id=${comp.id}`}
                              className="btn-table-primary"
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 6,
                                padding: '7px 16px',
                                fontSize: 12,
                                fontWeight: 800,
                                borderRadius: 6,
                                background: '#c6ff33',
                                color: '#000',
                                textDecoration: 'none',
                                boxShadow: '0 0 10px rgba(198,255,51,0.25)',
                              }}
                            >
                              <span>Manage / Overview</span> ↗
                            </Link>
                          ) : (
                            <span style={{ fontSize: 11, color: '#64748b' }}>Archived snapshot</span>
                          )}
                          <button
                            onClick={() => toggleExpand(logKey)}
                            className="btn-table-secondary"
                            style={{ padding: '6px 14px', fontSize: 12 }}
                          >
                            Close ✕
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Audit meta for non-competition logs (only rendered if fields actually exist) */}
                {!isComp && hasAuditFields && (
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


