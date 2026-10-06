import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import Shell from '../../components/Layout/Shell';
import NexusAuth from '../../services/NexusAuth';
import NexusData from '../../services/NexusData';
import NexusAPI from '../../services/NexusAPI';

export default function AdminActivityPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  
  const [session, setSession] = useState(NexusAuth.getSession());
  const [targetAdmin, setTargetAdmin] = useState('');
  const [adminProfile, setAdminProfile] = useState({
    username: '',
    email: '',
    roleLabel: 'Administrator',
    isSuper: false
  });
  const [logs, setLogs] = useState([]);
  const [stats, setStats] = useState({ config: 0, disputes: 0, approvals: 0 });
  const [loading, setLoading] = useState(true);

  const role = String(session?.role || session?.adminType || '').toLowerCase();
  const isSuper = role.includes('super');
  const sidebarVariant = isSuper ? 'super-admin' : 'admin';
  const activePage = isSuper ? 'admins' : 'activity';

  useEffect(() => {
    const sess = NexusAuth.getSession();
    const curRole = String(sess?.role || sess?.adminType || '').toLowerCase();
    const allowed = ['admin', 'comp_admin', 'dispute_admin', 'revenue_admin', 'super_admin', 'super-admin'];
    
    if (!sess || !allowed.includes(curRole)) {
      alert('Access Denied: Only Administrators can access Admin Activity.');
      navigate('/dashboard');
      return;
    }
    setSession(sess);

    const loggedInUser = sess.username || sess.email || 'admin@nexus.gg';
    const paramAdmin = (searchParams.get('admin') || loggedInUser).trim();
    setTargetAdmin(paramAdmin);

    loadData(paramAdmin);
  }, [searchParams]);

  async function loadData(username) {
    setLoading(true);

    // Profile lookup
    let detectedType = 'Administrator';
    let isSuperAdmin = username.toLowerCase().includes('super');
    try {
      const res = await fetch('http://localhost:3001/auth/users');
      if (res.ok) {
        const users = await res.json();
        const u = users.find(x => String(x.username || x.email).toLowerCase() === username.toLowerCase());
        if (u) {
          const t = String(u.adminType || u.role || '').toLowerCase();
          if (t.includes('dispute')) detectedType = 'Dispute Admin';
          else if (t.includes('revenue')) detectedType = 'Revenue Admin';
          else if (t.includes('comp') || t === 'admin') detectedType = 'Comp Admin';
          else if (t.includes('super')) { detectedType = 'Super Admin'; isSuperAdmin = true; }
        }
      }
    } catch (e) {}

    setAdminProfile({
      username: username,
      email: username.includes('@') ? username : `${username}@nexus.gg`,
      roleLabel: detectedType,
      isSuper: isSuperAdmin
    });

    // Logs lookup
    let allLogs = [];
    if (NexusData && typeof NexusData.getAdminActivityLogs === 'function') {
      allLogs = NexusData.getAdminActivityLogs(username) || [];
    }

    try {
      if (NexusAPI && NexusAPI.Admin && typeof NexusAPI.Admin.getActivity === 'function') {
        const res = await NexusAPI.Admin.getActivity(username);
        if (res && res.ok && Array.isArray(res.data)) {
          const dbLogs = res.data;
          const mergedMap = new Map();
          [...allLogs, ...dbLogs].forEach(item => {
            if (item && item.id) mergedMap.set(item.id, item);
          });
          allLogs = Array.from(mergedMap.values());
        }
      }
    } catch (e) {}

    const targetNorm = String(username || '').trim().toLowerCase();
    const adminLogs = allLogs.filter(l => {
      if (!l) return false;
      const author = String(l.adminUsername || l.username || '').trim().toLowerCase();
      return author === targetNorm || (!author && targetNorm === 'admin');
    });

    adminLogs.sort((a, b) => new Date(b.timestamp || Date.now()) - new Date(a.timestamp || Date.now()));

    const configCount = adminLogs.filter(l => l.actionType === 'REVENUE_CONFIG_CHANGE').length;
    const disputesCount = adminLogs.filter(l => l.actionType === 'DISPUTE_RESOLVED').length;
    const approvalsCount = adminLogs.filter(l => l.actionType === 'COMPETITION_APPROVAL' || l.actionType === 'COMPETITION_APPROVED').length;

    setStats({ config: configCount, disputes: disputesCount, approvals: approvalsCount });
    setLogs(adminLogs);
    setLoading(false);
  }

  return (
    <Shell sidebarVariant={sidebarVariant} activePage={activePage}>
      <main className="admin-main">
        <header className="admin-header" style={{ marginBottom: '24px' }}>
          <div>
            <h1 className="admin-title">Admin <span style={{ color: 'var(--accent, #c6ff33)' }}>Activity Logs</span></h1>
            <p className="admin-desc">
              Detailed audit timeline of administrative actions including revenue configuration changes, dispute resolutions, and tournament approvals.
            </p>
          </div>
        </header>

        {/* Admin Profile & Activity Summary Header Card */}
        <div id="admin-info-card" style={{
          background: '#0a0a0a',
          border: '1px solid #262626',
          borderRadius: '16px',
          padding: '24px',
          marginBottom: '28px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '20px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div id="admin-avatar" style={{
              width: '56px',
              height: '56px',
              borderRadius: '50%',
              background: adminProfile.isSuper ? 'rgba(231,0,11,0.15)' : 'rgba(198,255,51,0.15)',
              border: `2px solid ${adminProfile.isSuper ? 'rgba(231,0,11,0.4)' : 'rgba(198,255,51,0.4)'}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '22px',
              fontWeight: 900,
              color: adminProfile.isSuper ? '#e7000b' : '#c6ff33'
            }}>
              {adminProfile.username ? adminProfile.username.charAt(0).toUpperCase() : 'A'}
            </div>
            <div>
              <h2 id="admin-username-title" style={{ margin: '0 0 4px', color: '#ffffff', fontSize: '20px', fontWeight: 800 }}>
                {adminProfile.username}
              </h2>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span id="admin-role-badge" style={{
                  padding: '4px 10px',
                  borderRadius: '20px',
                  fontSize: '12px',
                  fontWeight: 700,
                  background: adminProfile.isSuper ? 'rgba(231,0,11,0.15)' : 'rgba(198,255,51,0.15)',
                  color: adminProfile.isSuper ? '#e7000b' : '#c6ff33',
                  border: `1px solid ${adminProfile.isSuper ? 'rgba(231,0,11,0.3)' : 'rgba(198,255,51,0.3)'}`
                }}>
                  {adminProfile.roleLabel}
                </span>
                <span id="admin-email-text" style={{ color: 'var(--text-muted)', fontSize: '13px' }}>
                  {adminProfile.email}
                </span>
              </div>
            </div>
          </div>

          {/* Activity Stats Pills */}
          <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
            <div style={{ background: '#141414', border: '1px solid #262626', borderRadius: '12px', padding: '12px 18px', textAlign: 'center', minWidth: '110px' }}>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', marginBottom: '4px' }}>Revenue Config</div>
              <div id="stat-config-count" style={{ fontSize: '20px', fontWeight: 900, color: '#fb923c' }}>{stats.config}</div>
            </div>
            <div style={{ background: '#141414', border: '1px solid #262626', borderRadius: '12px', padding: '12px 18px', textAlign: 'center', minWidth: '110px' }}>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', marginBottom: '4px' }}>Disputes Resolved</div>
              <div id="stat-disputes-count" style={{ fontSize: '20px', fontWeight: 900, color: '#60a5fa' }}>{stats.disputes}</div>
            </div>
            <div style={{ background: '#141414', border: '1px solid #262626', borderRadius: '12px', padding: '12px 18px', textAlign: 'center', minWidth: '110px' }}>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', marginBottom: '4px' }}>Approvals</div>
              <div id="stat-approvals-count" style={{ fontSize: '20px', fontWeight: 900, color: '#c6ff33' }}>{stats.approvals}</div>
            </div>
          </div>
        </div>

        {/* Activity Timeline Container */}
        <section style={{ background: '#0a0a0a', border: '1px solid #262626', borderRadius: '16px', padding: '28px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '12px' }}>
            <h3 style={{ margin: 0, fontSize: '17px', fontWeight: 800, color: '#ffffff', display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span>⚡ Audit Trail Timeline</span>
            </h3>
            <div id="log-count-text" style={{ color: 'var(--text-muted)', fontSize: '13px', fontWeight: 600 }}>
              Showing {logs.length} activity log{logs.length === 1 ? '' : 's'} for {targetAdmin}
            </div>
          </div>

          {loading ? (
            <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>Loading activity logs...</div>
          ) : logs.length === 0 ? (
            <div id="activity-empty-state" style={{ padding: '60px 20px', textAlign: 'center', background: '#141414', border: '1px dashed #262626', borderRadius: '12px' }}>
              <div style={{ fontSize: '36px', marginBottom: '12px' }}>📋</div>
              <h4 style={{ margin: '0 0 6px', color: '#ffffff', fontSize: '16px', fontWeight: 700 }}>No Activity Logs Found</h4>
              <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '13px' }}>
                This administrator has not performed any revenue configuration changes or dispute resolutions yet.
              </p>
            </div>
          ) : (
            <div id="activity-timeline-list" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {logs.map((item, idx) => {
                let badgeLabel = 'ADMIN ACTION';
                let badgeBg = 'rgba(255,255,255,0.1)';
                let badgeColor = '#ffffff';
                let icon = '⚡';

                if (item.actionType === 'REVENUE_CONFIG_CHANGE') {
                  badgeLabel = 'REVENUE CONFIGURATION UPDATE';
                  badgeBg = 'rgba(251,146,60,0.15)';
                  badgeColor = '#fb923c';
                  icon = '⚙️';
                } else if (item.actionType === 'DISPUTE_RESOLVED') {
                  badgeLabel = 'DISPUTE RESOLUTION';
                  badgeBg = 'rgba(96,165,250,0.15)';
                  badgeColor = '#60a5fa';
                  icon = '⚖️';
                } else if (item.actionType === 'COMPETITION_APPROVAL' || item.actionType === 'COMPETITION_APPROVED') {
                  badgeLabel = 'TOURNAMENT APPROVAL';
                  badgeBg = 'rgba(198,255,51,0.15)';
                  badgeColor = '#c6ff33';
                  icon = '🏆';
                }

                const dateStr = item.timestamp ? new Date(item.timestamp).toLocaleString() : 'Recently';

                return (
                  <div key={item.id || idx} style={{
                    background: '#141414',
                    border: '1px solid #262626',
                    borderRadius: '12px',
                    padding: '20px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '12px',
                    position: 'relative'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '10px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <span style={{ fontSize: '20px' }}>{icon}</span>
                        <span style={{
                          padding: '4px 10px',
                          borderRadius: '20px',
                          fontSize: '11px',
                          fontWeight: 800,
                          background: badgeBg,
                          color: badgeColor,
                          border: `1px solid ${badgeColor}33`,
                          letterSpacing: '0.5px'
                        }}>
                          ${badgeLabel}
                        </span>
                      </div>
                      <span style={{ color: 'var(--text-muted)', fontSize: '12px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}>
                        🕒 {dateStr}
                      </span>
                    </div>

                    <div style={{ color: '#ffffff', fontSize: '14px', fontWeight: 600, lineHeight: 1.5 }}>
                      {item.details}
                    </div>

                    {item.metadata && Object.keys(item.metadata).length > 0 && (
                      <div style={{
                        background: '#0a0a0a',
                        border: '1px solid #262626',
                        borderRadius: '8px',
                        padding: '10px 14px',
                        fontSize: '12px',
                        color: 'var(--text-muted)',
                        display: 'flex',
                        gap: '16px',
                        flexWrap: 'wrap'
                      }}>
                        {item.metadata.prevPercentage !== undefined && (
                          <div>Prize Fee: <strong style={{ color: '#ffffff' }}>{item.metadata.prevPercentage}% → {item.metadata.newPercentage}%</strong></div>
                        )}
                        {item.metadata.prevMinCost !== undefined && (
                          <div>Min Cost: <strong style={{ color: '#ffffff' }}>₹{item.metadata.prevMinCost} → ₹{item.metadata.newMinCost}</strong></div>
                        )}
                        {item.metadata.target && (
                          <div>Target: <strong style={{ color: '#ffffff' }}>{item.metadata.target}</strong></div>
                        )}
                        {item.metadata.disputeId && (
                          <div>Dispute ID: <strong style={{ color: '#ffffff' }}>#{String(item.metadata.disputeId).slice(-8)}</strong></div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </main>
    </Shell>
  );
}
