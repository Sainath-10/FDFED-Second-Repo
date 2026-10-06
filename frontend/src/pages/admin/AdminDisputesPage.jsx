import React, { useState, useEffect } from 'react';
import Shell from '../../components/Layout/Shell';
import NexusData from '../../services/NexusData';
import NexusAuth from '../../services/NexusAuth';
import '../../styles/pages/admin/disputes.css';

export default function AdminDisputesPage() {
  const [session, setSession] = useState(NexusAuth.getSession());
  const [adminDisputes, setAdminDisputes] = useState([]);
  const [activeFilter, setActiveFilter] = useState('all');
  const [notes, setNotes] = useState({});
  const [modalInfo, setModalInfo] = useState(null);

  useEffect(() => {
    refreshQueue();
  }, []);

  function refreshQueue() {
    const all = NexusData.loadDisputes ? NexusData.loadDisputes() : [];
    const isTeamDispute = d => d && (d.targetType === 'team' || d.targetType === 'opponent_team');
    // Admin sees disputes that belong to admin queue
    const filtered = all.filter(d =>
      !isTeamDispute(d) && (
        d.status === 'open_admin' ||
        d.status === 'escalated_to_admin' ||
        d.status === 'resolved'
      )
    );
    setAdminDisputes(filtered);
  }

  const openCount = adminDisputes.filter(d => d.status === 'open_admin').length;
  const escalatedCount = adminDisputes.filter(d => d.status === 'escalated_to_admin').length;
  const resolvedCount = adminDisputes.filter(d => d.status === 'resolved').length;

  function getFiltered() {
    if (activeFilter === 'open') return adminDisputes.filter(d => d.status === 'open_admin');
    if (activeFilter === 'escalated') return adminDisputes.filter(d => d.status === 'escalated_to_admin');
    if (activeFilter === 'resolved') return adminDisputes.filter(d => d.status === 'resolved');
    return adminDisputes;
  }

  function isTeamDispute(dispute) {
    return dispute && (dispute.targetType === 'team' || dispute.targetType === 'opponent_team');
  }

  function getTargetWarningCount(d) {
    if (!d) return 0;
    const target = d.targetUserOrTeam || d.against;
    if (!target) return 0;
    const norm = String(target).trim().toLowerCase();
    const isTeam = isTeamDispute(d);

    if (isTeam) {
      try {
        const comps = JSON.parse(localStorage.getItem('nexus_competitions') || '[]');
        const comp = comps.find(c => !d.competitionId || c.id === d.competitionId);
        if (comp && Array.isArray(comp.teams)) {
          const team = comp.teams.find(t => (t.name || '').trim().toLowerCase() === norm);
          if (team) {
            if (team.status === 'banned') return 3;
            if (typeof team.warningsCount === 'number') {
              return Math.min(team.warningsCount, 3);
            }
          }
        }
      } catch(e) {}

      try {
        const accounts = JSON.parse(localStorage.getItem('nexus.auth.accounts') || '[]');
        let maxTeamWarn = 0;
        accounts.forEach(a => {
          if (Array.isArray(a.warnings)) {
            const count = a.warnings.filter(w => (w.targetType === 'team' || !!w.teamName) && (w.teamName || '').toLowerCase() === norm).length;
            if (count > maxTeamWarn) maxTeamWarn = count;
          }
        });
        return Math.min(maxTeamWarn, 3);
      } catch(e) {}
    } else {
      try {
        const accounts = JSON.parse(localStorage.getItem('nexus.auth.accounts') || '[]');
        const account = accounts.find(a => (a.username || '').toLowerCase() === norm || (a.email || '').toLowerCase() === norm);
        if (account && Array.isArray(account.warnings)) {
          if (account.banned) return 3;
          const playerWarn = account.warnings.filter(w => w.targetType !== 'team').length;
          return Math.min(playerWarn, 3);
        }
      } catch(e) {}
    }
    return 0;
  }

  function pushDisputeNotif(toUsername, title, body, status) {
    if (!toUsername) return;
    try {
      const KEY = 'nexus.notifications.items';
      const items = JSON.parse(localStorage.getItem(KEY) || '[]');
      items.unshift({
        id: 'notif-' + Math.random().toString(36).slice(2, 10),
        toUsername: toUsername,
        type: 'dispute-outcome',
        status: status || 'rejected',
        title: title,
        body: body,
        createdAt: new Date().toISOString(),
        read: false,
        meta: {}
      });
      localStorage.setItem(KEY, JSON.stringify(items));
    } catch(e) {}
  }

  function banUserLocally(usernameOrEmail) {
    const norm = String(usernameOrEmail).trim().toLowerCase();
    ['nexus.accounts', 'nexus.auth.accounts'].forEach(key => {
      try {
        const accounts = JSON.parse(localStorage.getItem(key) || '[]');
        let updated = false;
        accounts.forEach(a => {
          if ((a.username && a.username.toLowerCase() === norm) || (a.email && a.email.toLowerCase() === norm)) {
            a.banned = true;
            updated = true;
          }
        });
        if (updated) localStorage.setItem(key, JSON.stringify(accounts));
      } catch(e) {}
    });

    try {
      const banned = JSON.parse(localStorage.getItem('nexus.banned.users') || '[]');
      if (!banned.includes(usernameOrEmail)) banned.push(usernameOrEmail);
      localStorage.setItem('nexus.banned.users', JSON.stringify(banned));
    } catch(e) {}
  }

  function handleWarning(disputeId) {
    const curNotes = (notes[disputeId] || '').trim();
    if (!curNotes || curNotes.length < 5) {
      alert('Please enter a reason for the warning (min. 5 characters).');
      return;
    }

    const d = adminDisputes.find(x => x.id === disputeId);
    const target = d?.targetUserOrTeam || d?.against;
    if (!target) {
      alert('No target specified for this dispute.');
      return;
    }

    const result = NexusData.issueAdminWarning ? NexusData.issueAdminWarning(disputeId, curNotes, target) : null;
    if (!result) {
      alert('Failed to issue warning.');
      return;
    }

    if (result.autoBanned) {
      setModalInfo({
        message: `🚫 Player "${target}" has reached 3 warnings and has been PERMANENTLY BANNED from the platform.`,
        isBan: true
      });
    } else {
      setModalInfo({
        message: `⚠ Warning #${result.totalWarnings}/3 issued to "${target}". ${result.totalWarnings >= 2 ? 'Next warning will result in a permanent ban!' : ''}`,
        isBan: false
      });
    }

    refreshQueue();
  }

  function handleResolve(disputeId, executeBan) {
    const curNotes = (notes[disputeId] || '').trim();
    if (!curNotes || curNotes.length < 5) {
      alert('Please enter resolution notes (min. 5 characters).');
      return;
    }

    const adminUser = session?.username || session?.displayName || 'admin';
    const d = adminDisputes.find(x => x.id === disputeId);
    if (!d) {
      alert('Dispute not found.');
      return;
    }

    const updates = {
      status: 'resolved',
      adminNotes: curNotes,
      resolvedBy: adminUser,
      banApplied: false,
      teamBanned: false
    };

    if (executeBan) {
      const target = d.targetUserOrTeam;
      if (!target) {
        alert('No target specified for this dispute.');
        return;
      }

      banUserLocally(target);
      updates.banApplied = true;

      pushDisputeNotif(
        target,
        '🚫 Account Banned from Platform',
        `Your account has been suspended following a resolved dispute: "${d.reason || 'Platform violation'}".`,
        'rejected'
      );

      if (d.reportedBy) {
        pushDisputeNotif(
          d.reportedBy,
          'Dispute Resolved — Player Banned',
          `Player "${target}" has been banned following your dispute report.`,
          'approved'
        );
      }

      NexusData.updateDisputeStatus(disputeId, updates);
      alert(`Dispute resolved. Player "${target}" has been permanently banned from the platform.`);
    } else {
      NexusData.updateDisputeStatus(disputeId, updates);

      try {
        if (NexusData && typeof NexusData.logAdminActivity === 'function') {
          const actionLabel = updates.banApplied ? 'Resolved Dispute with Ban' : 'Resolved Dispute';
          const targetStr = d.targetUserOrTeam || d.against || 'target';
          NexusData.logAdminActivity(adminUser, 'DISPUTE_RESOLVED', `${actionLabel} #${disputeId.slice(-8)} regarding ${targetStr}`, {
            disputeId: disputeId,
            target: targetStr,
            banApplied: updates.banApplied,
            notes: curNotes
          });
        }
      } catch(e) {}

      alert('Dispute resolved successfully!');
    }

    refreshQueue();
  }

  const role = String(session?.role || session?.adminType || '').toLowerCase();
  const isSuper = role.includes('super');
  const sidebarVariant = isSuper ? 'super-admin' : 'admin';

  const filteredDisputes = getFiltered();

  return (
    <Shell sidebarVariant={sidebarVariant} activePage="disputes">
      <main className="main-content">
        <div className="admin-header-block">
          <h1 className="admin-title-xl">Platform Disputes</h1>
          <p className="admin-subtitle-muted">Resolve disputes escalated by organizers and direct disputes filed against organizers.</p>
        </div>

        <div className="dash-stats" style={{ marginBottom: '28px' }}>
          <div className="dash-stat-card">
            <div className="dash-stat-icon" style={{ background: 'rgba(231,0,11,0.1)' }}>⚠️</div>
            <div>
              <div className="dash-stat-num" id="stat-open">{openCount}</div>
              <div className="dash-stat-lbl">Direct (vs Organizer)</div>
            </div>
          </div>
          <div className="dash-stat-card">
            <div className="dash-stat-icon" style={{ background: 'rgba(198,255,51,0.1)' }}>🔺</div>
            <div>
              <div className="dash-stat-num" id="stat-escalated">{escalatedCount}</div>
              <div className="dash-stat-lbl">Escalated by Organizer</div>
            </div>
          </div>
          <div className="dash-stat-card">
            <div className="dash-stat-icon" style={{ background: 'rgba(34,197,94,0.1)' }}>✅</div>
            <div>
              <div className="dash-stat-num" id="stat-resolved">{resolvedCount}</div>
              <div className="dash-stat-lbl">Resolved</div>
            </div>
          </div>
        </div>

        <div className="filter-tabs-row" style={{ marginBottom: '20px' }}>
          <button
            className={`filter-tab ${activeFilter === 'all' ? 'active' : ''}`}
            onClick={() => setActiveFilter('all')}
          >
            All
          </button>
          <button
            className={`filter-tab ${activeFilter === 'open' ? 'active' : ''}`}
            onClick={() => setActiveFilter('open')}
          >
            Direct (vs Organizer)
          </button>
          <button
            className={`filter-tab ${activeFilter === 'escalated' ? 'active' : ''}`}
            onClick={() => setActiveFilter('escalated')}
          >
            Escalated
          </button>
          <button
            className={`filter-tab ${activeFilter === 'resolved' ? 'active' : ''}`}
            onClick={() => setActiveFilter('resolved')}
          >
            Resolved
          </button>
        </div>

        <div className="disputes-list" id="disputes-list">
          {filteredDisputes.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '60px', color: '#64748b' }}>
              No disputes in this queue.
            </div>
          ) : (
            filteredDisputes.map(d => {
              const isOpen = d.status === 'open_admin';
              const isEscalated = d.status === 'escalated_to_admin';
              const isResolved = d.status === 'resolved';

              const targetLabel = {
                team: '⚔ Team',
                player: '👤 Player',
                opponent_team: '⚔ Opponent/Team',
                match_rule: '📋 Match Rule',
                organizer: '⚠ Organizer Misconduct'
              }[d.targetType] || d.targetType || '—';

              const targetWarnings = getTargetWarningCount(d);
              const isMaxWarn = targetWarnings >= 3;

              return (
                <div key={d.id} style={{ background: '#0a0a0a', border: '1px solid #262626', borderRadius: '14px', padding: '24px', marginBottom: '16px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '10px', marginBottom: '16px' }}>
                    <div>
                      <div style={{ color: '#737373', fontSize: '11px', marginBottom: '4px', fontWeight: 700 }}>DISPUTE ID</div>
                      <div style={{ color: '#f5f5f5', fontSize: '16px', fontWeight: 700 }}>#{d.id.slice(-12)}</div>
                    </div>
                    {isOpen && (
                      <span style={{ padding: '4px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: 700, background: 'rgba(231,0,11,0.15)', color: '#f87171', border: '1px solid #f87171' }}>
                        DIRECT — VS ORGANIZER
                      </span>
                    )}
                    {isEscalated && (
                      <span style={{ padding: '4px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: 700, background: 'rgba(251,146,60,0.15)', color: '#fb923c', border: '1px solid #fb923c' }}>
                        ESCALATED BY ORGANIZER{d.banRequested ? ' • BAN REQUESTED' : ''}
                      </span>
                    )}
                    {isResolved && (
                      <span style={{ padding: '4px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: 700, background: 'rgba(198,255,51,0.15)', color: '#c6ff33', border: '1px solid #c6ff33' }}>
                        RESOLVED
                      </span>
                    )}
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '10px', marginBottom: '16px' }}>
                    <div style={{ background: '#141414', border: '1px solid #262626', borderRadius: '8px', padding: '10px' }}>
                      <div style={{ color: '#737373', fontSize: '11px', marginBottom: '3px', fontWeight: 700 }}>CATEGORY</div>
                      <div style={{ color: '#c6ff33', fontSize: '13px', fontWeight: 700 }}>{targetLabel}</div>
                    </div>
                    <div style={{ background: '#141414', border: '1px solid #262626', borderRadius: '8px', padding: '10px' }}>
                      <div style={{ color: '#737373', fontSize: '11px', marginBottom: '3px', fontWeight: 700 }}>FILED BY</div>
                      <div style={{ color: '#f5f5f5', fontSize: '13px' }}>{d.reportedBy || d.filedBy || '—'}</div>
                    </div>
                    <div style={{ background: '#141414', border: '1px solid #262626', borderRadius: '8px', padding: '10px' }}>
                      <div style={{ color: '#737373', fontSize: '11px', marginBottom: '3px', fontWeight: 700 }}>AGAINST</div>
                      <div style={{ color: '#f5f5f5', fontSize: '13px' }}>{d.targetUserOrTeam || d.against || '—'}</div>
                    </div>
                    <div style={{ background: '#141414', border: '1px solid #262626', borderRadius: '8px', padding: '10px' }}>
                      <div style={{ color: '#737373', fontSize: '11px', marginBottom: '3px', fontWeight: 700 }}>FILED ON</div>
                      <div style={{ color: '#f5f5f5', fontSize: '13px' }}>{d.createdAt ? new Date(d.createdAt).toLocaleDateString() : (d.filedAt || '—')}</div>
                    </div>
                  </div>

                  <div style={{ background: '#141414', border: '1px solid #262626', borderRadius: '8px', padding: '14px', color: '#d4d4d4', fontSize: '14px', lineHeight: 1.6, marginBottom: '12px' }}>
                    <div style={{ color: '#737373', fontSize: '11px', marginBottom: '6px', fontWeight: 700 }}>DISPUTE REASON</div>
                    {d.reason || d.description || d.desc || 'No reason provided'}
                  </div>

                  <div style={{ background: '#141414', border: '1px solid #262626', borderRadius: '8px', padding: '12px', marginBottom: '4px' }}>
                    <div style={{ color: '#737373', fontSize: '11px', marginBottom: '6px', fontWeight: 700 }}>EVIDENCE</div>
                    {(d.evidenceUrls || []).length > 0 ? (
                      d.evidenceUrls.map((url, uidx) => (
                        <a key={uidx} href={url} target="_blank" rel="noreferrer" style={{ color: '#c6ff33', fontSize: '12px', display: 'block', wordBreak: 'break-all' }}>
                          {url}
                        </a>
                      ))
                    ) : (
                      <span style={{ color: '#737373', fontSize: '12px' }}>No evidence provided</span>
                    )}
                  </div>

                  {d.organizerNotes && (
                    <div style={{ marginTop: '12px', background: '#141414', border: '1px solid #262626', borderLeft: '3px solid #fb923c', borderRadius: '8px', padding: '12px' }}>
                      <div style={{ color: '#fb923c', fontSize: '11px', marginBottom: '4px', fontWeight: 700 }}>ORGANIZER NOTES</div>
                      <div style={{ color: '#e5e5e5', fontSize: '13px' }}>{d.organizerNotes}</div>
                    </div>
                  )}

                  {d.banRequested && (
                    <div style={{ marginTop: '8px', background: 'rgba(248,113,113,0.1)', border: '1px solid #f87171', borderRadius: '8px', padding: '10px', color: '#f87171', fontSize: '13px' }}>
                      🚫 Organizer has requested a platform ban for: <strong>{d.targetUserOrTeam || 'the offending player'}</strong>
                    </div>
                  )}

                  {!isResolved ? (
                    <div style={{ marginTop: '20px', borderTop: '1px solid #262626', paddingTop: '20px' }}>
                      {targetWarnings > 0 && (
                        <div style={{ marginBottom: '12px', background: isMaxWarn ? 'rgba(239,68,68,0.1)' : 'rgba(251,146,60,0.1)', border: `1px solid ${isMaxWarn ? '#ef444444' : '#fb923c44'}`, borderRadius: '8px', padding: '10px' }}>
                          <span style={{ color: isMaxWarn ? '#ef4444' : '#fb923c', fontSize: '13px', fontWeight: 600 }}>
                            ⚠️ Current Warning Level: {targetWarnings}/3 {isMaxWarn ? '• PLAYER BANNED' : ''}
                          </span>
                          {targetWarnings === 2 && (
                            <span style={{ color: '#f87171', fontSize: '12px', marginLeft: '8px' }}>Next warning = Auto-Ban!</span>
                          )}
                        </div>
                      )}
                      <div style={{ fontSize: '13px', color: '#a3a3a3', marginBottom: '8px' }}>Admin Resolution Notes</div>
                      <textarea
                        rows="3"
                        placeholder="Write your resolution notes..."
                        value={notes[d.id] || ''}
                        onChange={e => setNotes({ ...notes, [d.id]: e.target.value })}
                        style={{ width: '100%', background: '#141414', border: '1px solid #262626', color: '#f5f5f5', padding: '10px 12px', borderRadius: '8px', fontSize: '14px', resize: 'vertical', boxSizing: 'border-box', marginBottom: '12px' }}
                      />

                      <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                        <button
                          type="button"
                          onClick={() => handleWarning(d.id)}
                          style={{ flex: 1, minWidth: '140px', padding: '12px', background: '#fb923c', border: 'none', color: '#fff', borderRadius: '8px', cursor: 'pointer', fontSize: '14px', fontWeight: 600 }}
                        >
                          ⚠️ Give Warning ({Math.min(targetWarnings, 3)}/3)
                        </button>
                        <button
                          type="button"
                          onClick={() => handleResolve(d.id, false)}
                          style={{ flex: 1, minWidth: '140px', padding: '12px', background: '#c6ff33', border: 'none', color: '#000', borderRadius: '8px', cursor: 'pointer', fontSize: '14px', fontWeight: 700 }}
                        >
                          ✔ Resolve Dispute
                        </button>
                        <button
                          type="button"
                          onClick={() => handleResolve(d.id, true)}
                          style={{ flex: 1, minWidth: '200px', padding: '12px', background: '#ef4444', border: 'none', color: '#fff', borderRadius: '8px', cursor: 'pointer', fontSize: '14px', fontWeight: 600 }}
                        >
                          🚫 Revoke Access & Ban Player
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div style={{ marginTop: '16px', background: 'rgba(198,255,51,0.08)', border: '1px solid rgba(198,255,51,0.3)', borderRadius: '8px', padding: '12px' }}>
                      <div style={{ color: '#c6ff33', fontSize: '13px', fontWeight: 700 }}>✔ Resolved by {d.resolvedBy || 'Admin'}</div>
                      {d.adminNotes && <div style={{ color: '#a3a3a3', fontSize: '13px', marginTop: '4px' }}>{d.adminNotes}</div>}
                      {d.banApplied && <div style={{ color: '#f87171', fontSize: '13px', marginTop: '4px' }}>🚫 Player access revoked & permanently banned.</div>}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Warning/Ban Modal */}
        {modalInfo && (
          <div style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ background: '#0f172a', border: `1px solid ${modalInfo.isBan ? '#ef4444' : '#fb923c'}`, borderRadius: '16px', width: 'min(90vw, 440px)', padding: '32px', textAlign: 'center', boxShadow: '0 20px 60px #000a' }}>
              <div style={{ fontSize: '48px', marginBottom: '16px' }}>{modalInfo.isBan ? '🚫' : '⚠️'}</div>
              <p style={{ color: '#f1f5f9', fontSize: '16px', lineHeight: 1.6, margin: '0 0 24px' }}>{modalInfo.message}</p>
              <button
                type="button"
                onClick={() => setModalInfo(null)}
                style={{ padding: '12px 32px', background: modalInfo.isBan ? '#ef4444' : '#fb923c', border: 'none', color: '#fff', borderRadius: '8px', cursor: 'pointer', fontSize: '14px', fontWeight: 600 }}
              >
                OK
              </button>
            </div>
          </div>
        )}
      </main>
    </Shell>
  );
}
