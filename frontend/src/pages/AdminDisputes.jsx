/**
 * NEXUS ESPORTS — Admin Dispute Console
 *
 *
 * escalated_to_admin / resolved disputes that are NOT team disputes, with warnings
 * (auto-ban at 3), team-tournament bans vs player platform bans, resolution notes,
 * stats, filter tabs and the notification helpers.
 */
import { useMemo, useState } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import NexusData from '../services/data.js';
import { showToast } from '../lib/toast.js';
import '../styles/pages/admin/disputes.css';

const isTeamDispute = (d) => d && (d.targetType === 'team' || d.targetType === 'opponent_team');

const TARGET_LABELS = {
  team: '⚔ Team',
  player: '👤 Player',
  opponent_team: '⚔ Opponent/Team',
  match_rule: '📋 Match Rule',
  organizer: '⚠ Organizer Misconduct',
};

function pushDisputeNotif(toUsername, title, body, status) {
  if (!toUsername) return;
  try {
    const items = JSON.parse(localStorage.getItem('nexus.notifications.items') || '[]');
    items.unshift({ id: `notif-${Math.random().toString(36).slice(2, 10)}`, toUsername, type: 'dispute-outcome', status: status || 'rejected', title, body, createdAt: new Date().toISOString(), read: false, meta: {} });
    localStorage.setItem('nexus.notifications.items', JSON.stringify(items));
  } catch (e) { /* ignore */ }
}

function notifyTeamMembers(teamName, compId, title, body, status) {
  try {
    const comps = JSON.parse(localStorage.getItem('nexus_competitions') || '[]');
    const members = [];
    comps.forEach((comp) => {
      if (!Array.isArray(comp.teams)) return;
      comp.teams.forEach((team) => {
        const nameMatch = String(team.name || '').toLowerCase() === String(teamName || '').toLowerCase();
        const compMatch = !compId || comp.id === compId;
        if (nameMatch && compMatch) {
          const leader = team.createdBy || team.leaderUsername || team.captain;
          if (leader) members.push(leader);
          if (Array.isArray(team.members)) {
            team.members.forEach((m) => {
              const u = typeof m === 'string' ? m : (m && (m.username || m.name));
              if (u && !members.includes(u)) members.push(u);
            });
          }
        }
      });
    });
    [...new Set(members)].forEach((u) => pushDisputeNotif(u, title, body, status));
  } catch (e) { /* ignore */ }
}

function banTeamFromTournament(teamName, compId) {
  try {
    const comps = JSON.parse(localStorage.getItem('nexus_competitions') || '[]');
    let banned = false;
    comps.forEach((comp) => {
      if (!Array.isArray(comp.teams)) return;
      comp.teams.forEach((team) => {
        const nameMatch = String(team.name || '').toLowerCase() === String(teamName || '').toLowerCase();
        const compMatch = !compId || comp.id === compId;
        if (nameMatch && compMatch) {
          team.status = 'banned';
          team.bannedAt = new Date().toISOString();
          team.bannedReason = 'Banned following a resolved dispute.';
          banned = true;
        }
      });
    });
    if (banned) localStorage.setItem('nexus_competitions', JSON.stringify(comps));
    return banned;
  } catch (e) { return false; }
}

function banUserLocally(usernameOrEmail) {
  const norm = String(usernameOrEmail).trim().toLowerCase();
  ['nexus.accounts', 'nexus.auth.accounts'].forEach((key) => {
    try {
      const accounts = JSON.parse(localStorage.getItem(key) || '[]');
      let updated = false;
      accounts.forEach((a) => {
        if ((a.username && a.username.toLowerCase() === norm) || (a.email && a.email.toLowerCase() === norm)) { a.banned = true; updated = true; }
      });
      if (updated) localStorage.setItem(key, JSON.stringify(accounts));
    } catch (e) { /* ignore */ }
  });
  try {
    const banned = JSON.parse(localStorage.getItem('nexus.banned.users') || '[]');
    if (!banned.includes(usernameOrEmail)) banned.push(usernameOrEmail);
    localStorage.setItem('nexus.banned.users', JSON.stringify(banned));
  } catch (e) { /* ignore */ }
}

function getTargetWarningCount(d) {
  if (!d) return 0;
  const target = d.targetUserOrTeam || d.against;
  if (!target) return 0;
  const norm = String(target).trim().toLowerCase();
  if (isTeamDispute(d)) {
    try {
      const comps = JSON.parse(localStorage.getItem('nexus_competitions') || '[]');
      const comp = comps.find((c) => !d.competitionId || c.id === d.competitionId);
      if (comp && Array.isArray(comp.teams)) {
        const team = comp.teams.find((t) => String(t.name || '').trim().toLowerCase() === norm);
        if (team) {
          if (team.status === 'banned') return 3;
          if (typeof team.warningsCount === 'number') return Math.min(team.warningsCount, 3);
        }
      }
    } catch (e) { /* ignore */ }
    try {
      const accounts = JSON.parse(localStorage.getItem('nexus.auth.accounts') || '[]');
      let maxTeamWarn = 0;
      accounts.forEach((a) => {
        if (Array.isArray(a.warnings)) {
          const count = a.warnings.filter((w) => (w.targetType === 'team' || !!w.teamName) && String(w.teamName || '').toLowerCase() === norm).length;
          if (count > maxTeamWarn) maxTeamWarn = count;
        }
      });
      return Math.min(maxTeamWarn, 3);
    } catch (e) { /* ignore */ }
  } else {
    try {
      const accounts = JSON.parse(localStorage.getItem('nexus.auth.accounts') || '[]');
      const account = accounts.find((a) => String(a.username || '').toLowerCase() === norm || String(a.email || '').toLowerCase() === norm);
      if (account && Array.isArray(account.warnings)) {
        if (account.banned) return 3;
        return Math.min(account.warnings.filter((w) => w.targetType !== 'team').length, 3);
      }
    } catch (e) { /* ignore */ }
  }
  return 0;
}

export default function AdminDisputes() {
  const { session } = useAuth();
  const [version, setVersion] = useState(0);
  const [filter, setFilter] = useState('all');
  const [notes, setNotes] = useState({});
  const [modal, setModal] = useState(null);

  const adminDisputes = useMemo(() => {
    if (!NexusData) return [];
    return NexusData.loadDisputes().filter((d) => !isTeamDispute(d) && (d.status === 'open_admin' || d.status === 'escalated_to_admin' || d.status === 'resolved'));
  }, [version]);

  const stats = {
    open: adminDisputes.filter((d) => d.status === 'open_admin').length,
    escalated: adminDisputes.filter((d) => d.status === 'escalated_to_admin').length,
    resolved: adminDisputes.filter((d) => d.status === 'resolved').length,
  };

  const filtered = adminDisputes.filter((d) => {
    if (filter === 'all') return true;
    if (filter === 'open') return d.status === 'open_admin';
    if (filter === 'escalated') return d.status === 'escalated_to_admin';
    if (filter === 'resolved') return d.status === 'resolved';
    return true;
  });

  function adminWarning(disputeId) {
    const note = (notes[disputeId] || '').trim();
    if (!note || note.length < 5) { showToast('Please enter a reason for the warning (min. 5 characters).', 'error'); return; }
    const d = adminDisputes.find((x) => x.id === disputeId);
    const target = (d && (d.targetUserOrTeam || d.against)) || null;
    if (!target) { showToast('No target specified for this dispute.', 'error'); return; }

    const isTeam = isTeamDispute(d);
    const result = NexusData.issueAdminWarning(disputeId, note, target);
    if (!result) { showToast('Failed to issue warning.', 'error'); return; }

    if (isTeam) {
      if (result.autoBanned) {
        setModal({ message: `🚫 Team "${target}" has reached 3 warnings and has been BANNED from the tournament. Player accounts remain active on the platform.`, isBan: true });
        showToast(`Team "${target}" has been banned from the tournament (3/3 warnings).`, 'error');
      } else {
        setModal({ message: `⚠ Warning issued to team "${target}". Note: Repeated team warnings may result in team disqualification from the tournament.`, isBan: false });
        showToast(`⚠ Team Warning issued to "${target}".`);
      }
    } else if (result.autoBanned) {
      setModal({ message: `🚫 Player "${target}" has reached 3 warnings and has been PERMANENTLY BANNED from the platform.`, isBan: true });
      showToast(`Player "${target}" has been permanently banned (3/3 warnings).`, 'error');
    } else {
      setModal({ message: `⚠ Warning #${result.totalWarnings}/3 issued to "${target}". ${result.totalWarnings >= 2 ? 'Next warning will result in a permanent ban!' : ''}`, isBan: false });
      showToast(`⚠ Warning #${result.totalWarnings}/3 issued to "${target}".`);
    }
    setVersion((v) => v + 1);
  }

  function adminResolve(disputeId, executeBan) {
    const note = (notes[disputeId] || '').trim();
    if (!note || note.length < 5) { showToast('Please enter resolution notes (min. 5 characters).', 'error'); return; }

    const adminUser = (session && (session.username || session.displayName)) || 'admin';
    const d = adminDisputes.find((x) => x.id === disputeId);
    if (!d) { showToast('Dispute not found.', 'error'); return; }

    const updates = { status: 'resolved', adminNotes: note, resolvedBy: adminUser, banApplied: false, teamBanned: false };

    if (executeBan) {
      const target = d.targetUserOrTeam;
      if (!target) { showToast('No target specified for this dispute.', 'error'); return; }
      if (isTeamDispute(d)) {
        banTeamFromTournament(target, d.competitionId || null);
        notifyTeamMembers(target, d.competitionId || null, '🚫 Team Banned from Tournament', `Your team "${target}" has been banned from the tournament following a resolved dispute. Your player accounts are unaffected.`, 'rejected');
        if (d.reportedBy) pushDisputeNotif(d.reportedBy, 'Dispute Resolved — Team Banned', `Team "${target}" has been banned from the tournament following your dispute report.`, 'approved');
        updates.banApplied = true;
        updates.teamBanned = true;
        NexusData.updateDisputeStatus(disputeId, updates);
        showToast(`Team "${target}" has been banned from the tournament. Player accounts are unaffected.`, 'error');
      } else {
        banUserLocally(target);
        updates.banApplied = true;
        pushDisputeNotif(target, '🚫 Account Banned from Platform', `Your account has been suspended following a resolved dispute: "${d.reason || 'Platform violation'}".`, 'rejected');
        if (d.reportedBy) pushDisputeNotif(d.reportedBy, 'Dispute Resolved — Player Banned', `Player "${target}" has been banned following your dispute report.`, 'approved');
        NexusData.updateDisputeStatus(disputeId, updates);
        showToast(`Dispute resolved. Player "${target}" has been permanently banned from the platform.`, 'error');
      }
    } else {
      if (isTeamDispute(d) && d.targetUserOrTeam) {
        notifyTeamMembers(d.targetUserOrTeam, d.competitionId || null, '⚠️ Dispute Resolved Against Your Team', `A dispute against your team "${d.targetUserOrTeam}" has been resolved by an admin. No ban was applied at this time.`, 'pending');
      }
      NexusData.updateDisputeStatus(disputeId, updates);
      try {
        if (NexusData && typeof NexusData.logAdminActivity === 'function') {
          const targetStr = d.targetUserOrTeam || d.against || 'target';
          NexusData.logAdminActivity(adminUser, 'DISPUTE_RESOLVED', `Resolved Dispute #${disputeId.slice(-8)} regarding ${targetStr}`, { disputeId, target: targetStr, banApplied: false, notes: note });
        }
      } catch (e) { /* ignore */ }
      showToast('Dispute resolved successfully!');
    }
    setVersion((v) => v + 1);
  }

  return (
    <main className="main-content">
      <div className="admin-header-block">
        <h1 className="admin-title-xl">Platform Disputes</h1>
        <p className="admin-subtitle-muted">Resolve disputes escalated by organizers and direct disputes filed against organizers.</p>
      </div>

      <div className="dash-stats" style={{ marginBottom: 28 }}>
        <div className="dash-stat-card"><div className="dash-stat-icon" style={{ background: 'rgba(231,0,11,0.1)' }}>⚠️</div><div><div className="dash-stat-num" id="stat-open">{stats.open}</div><div className="dash-stat-lbl">Direct (vs Organizer)</div></div></div>
        <div className="dash-stat-card"><div className="dash-stat-icon" style={{ background: 'rgba(198,255,51,0.1)' }}>🔺</div><div><div className="dash-stat-num" id="stat-escalated">{stats.escalated}</div><div className="dash-stat-lbl">Escalated by Organizer</div></div></div>
        <div className="dash-stat-card"><div className="dash-stat-icon" style={{ background: 'rgba(34,197,94,0.1)' }}>✅</div><div><div className="dash-stat-num" id="stat-resolved">{stats.resolved}</div><div className="dash-stat-lbl">Resolved</div></div></div>
      </div>

      <div className="filter-tabs-row" style={{ marginBottom: 20 }}>
        {[['all', 'All'], ['open', 'Direct (vs Organizer)'], ['escalated', 'Escalated'], ['resolved', 'Resolved']].map(([k, l]) => (
          <button key={k} className={`filter-tab ${filter === k ? 'active' : ''}`} data-filter={k} onClick={() => setFilter(k)}>{l}</button>
        ))}
      </div>

      <div className="disputes-list" id="disputes-list">
        {filtered.length === 0 && <div style={{ textAlign: 'center', padding: 60, color: '#64748b' }}>No disputes in this queue.</div>}
        {filtered.map((d) => {
          const isOpen = d.status === 'open_admin';
          const isEscalated = d.status === 'escalated_to_admin';
          const isResolved = d.status === 'resolved';

          let badge;
          if (isOpen) badge = <span style={{ padding: '4px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700, background: 'rgba(231,0,11,0.15)', color: '#f87171', border: '1px solid #f87171' }}>DIRECT — VS ORGANIZER</span>;
          else if (isEscalated) badge = <span style={{ padding: '4px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700, background: 'rgba(251,146,60,0.15)', color: '#fb923c', border: '1px solid #fb923c' }}>ESCALATED BY ORGANIZER{d.banRequested ? ' • BAN REQUESTED' : ''}</span>;
          else badge = <span style={{ padding: '4px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700, background: 'rgba(198,255,51,0.15)', color: '#c6ff33', border: '1px solid #c6ff33' }}>RESOLVED</span>;

          const isTeamTarget = d.targetType === 'team' || d.targetType === 'opponent_team';
          const targetWarnings = getTargetWarningCount(d);
          const isMaxWarn = targetWarnings >= 3;
          const banBtnLabel = isTeamTarget ? '🚫 Ban Team from Tournament' : '🚫 Revoke Access & Ban Player';
          const evidence = d.evidenceUrls || [];

          return (
            <div key={d.id} style={{ background: '#0a0a0a', border: '1px solid #262626', borderRadius: 14, padding: 24, marginBottom: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 10, marginBottom: 16 }}>
                <div>
                  <div style={{ color: '#737373', fontSize: 11, marginBottom: 4, fontWeight: 700 }}>DISPUTE ID</div>
                  <div style={{ color: '#f5f5f5', fontSize: 16, fontWeight: 700 }}>#{String(d.id).slice(-12)}</div>
                </div>
                {badge}
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))', gap: 10, marginBottom: 16 }}>
                <div style={{ background: '#141414', border: '1px solid #262626', borderRadius: 8, padding: 10 }}><div style={{ color: '#737373', fontSize: 11, marginBottom: 3, fontWeight: 700 }}>CATEGORY</div><div style={{ color: '#c6ff33', fontSize: 13, fontWeight: 700 }}>{TARGET_LABELS[d.targetType] || d.targetType || '—'}</div></div>
                <div style={{ background: '#141414', border: '1px solid #262626', borderRadius: 8, padding: 10 }}><div style={{ color: '#737373', fontSize: 11, marginBottom: 3, fontWeight: 700 }}>FILED BY</div><div style={{ color: '#f5f5f5', fontSize: 13 }}>{d.reportedBy || d.filedBy || '—'}</div></div>
                <div style={{ background: '#141414', border: '1px solid #262626', borderRadius: 8, padding: 10 }}><div style={{ color: '#737373', fontSize: 11, marginBottom: 3, fontWeight: 700 }}>AGAINST</div><div style={{ color: '#f5f5f5', fontSize: 13 }}>{d.targetUserOrTeam || d.against || '—'}</div></div>
                <div style={{ background: '#141414', border: '1px solid #262626', borderRadius: 8, padding: 10 }}><div style={{ color: '#737373', fontSize: 11, marginBottom: 3, fontWeight: 700 }}>FILED ON</div><div style={{ color: '#f5f5f5', fontSize: 13 }}>{d.createdAt ? new Date(d.createdAt).toLocaleDateString() : (d.filedAt || '—')}</div></div>
              </div>

              <div style={{ background: '#141414', border: '1px solid #262626', borderRadius: 8, padding: 14, color: '#d4d4d4', fontSize: 14, lineHeight: 1.6, marginBottom: 12 }}>
                <div style={{ color: '#737373', fontSize: 11, marginBottom: 6, fontWeight: 700 }}>DISPUTE REASON</div>
                {d.reason || d.description || d.desc || 'No reason provided'}
              </div>

              <div style={{ background: '#141414', border: '1px solid #262626', borderRadius: 8, padding: 12, marginBottom: 4 }}>
                <div style={{ color: '#737373', fontSize: 11, marginBottom: 6, fontWeight: 700 }}>EVIDENCE</div>
                {evidence.length
                  ? evidence.map((url) => <a key={url} href={url} target="_blank" rel="noreferrer" style={{ color: '#c6ff33', fontSize: 12, display: 'block', wordBreak: 'break-all' }}>{url}</a>)
                  : <span style={{ color: '#737373', fontSize: 12 }}>No evidence provided</span>}
              </div>

              {d.organizerNotes && (
                <div style={{ marginTop: 12, background: '#141414', border: '1px solid #262626', borderLeft: '3px solid #fb923c', borderRadius: 8, padding: 12 }}>
                  <div style={{ color: '#fb923c', fontSize: 11, marginBottom: 4, fontWeight: 700 }}>ORGANIZER NOTES</div>
                  <div style={{ color: '#e5e5e5', fontSize: 13 }}>{d.organizerNotes}</div>
                </div>
              )}

              {d.banRequested && (
                <div style={{ marginTop: 8, background: 'rgba(248,113,113,0.1)', border: '1px solid #f87171', borderRadius: 8, padding: 10, color: '#f87171', fontSize: 13 }}>
                  🚫 Organizer has requested a platform ban for: <strong>{d.targetUserOrTeam || 'the offending player'}</strong>
                </div>
              )}

              {!isResolved ? (
                <div style={{ marginTop: 20, borderTop: '1px solid #262626', paddingTop: 20 }}>
                  {targetWarnings > 0 && (
                    <div style={{ marginBottom: 12, background: isMaxWarn ? 'rgba(239,68,68,0.1)' : 'rgba(251,146,60,0.1)', border: `1px solid ${isMaxWarn ? '#ef444444' : '#fb923c44'}`, borderRadius: 8, padding: 10 }}>
                      <span style={{ color: isMaxWarn ? '#ef4444' : '#fb923c', fontSize: 13, fontWeight: 600 }}>⚠️ Current Warning Level: {targetWarnings}/3 {isMaxWarn ? (isTeamTarget ? '• TEAM BANNED FROM TOURNAMENT' : '• PLAYER BANNED') : ''}</span>
                      {targetWarnings === 2 && <span style={{ color: '#f87171', fontSize: 12, marginLeft: 8 }}>{isTeamTarget ? 'Next warning = Team Ban from Tournament!' : 'Next warning = Auto-Ban!'}</span>}
                    </div>
                  )}
                  <div style={{ fontSize: 13, color: '#a3a3a3', marginBottom: 8 }}>Admin Resolution Notes</div>
                  <textarea id={`admin-notes-${d.id}`} rows="3" placeholder="Write your resolution notes..." value={notes[d.id] || ''} onChange={(e) => setNotes((n) => ({ ...n, [d.id]: e.target.value }))} style={{ width: '100%', background: '#141414', border: '1px solid #262626', color: '#f5f5f5', padding: '10px 12px', borderRadius: 8, fontSize: 14, resize: 'vertical', boxSizing: 'border-box', marginBottom: 12 }} />
                  <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                    <button onClick={() => adminWarning(d.id)} style={{ flex: 1, minWidth: 140, padding: 12, background: '#fb923c', border: 'none', color: '#fff', borderRadius: 8, cursor: 'pointer', fontSize: 14, fontWeight: 600 }}>⚠️ Give Warning ({Math.min(targetWarnings, 3)}/3)</button>
                    <button onClick={() => adminResolve(d.id, false)} style={{ flex: 1, minWidth: 140, padding: 12, background: '#c6ff33', border: 'none', color: '#000', borderRadius: 8, cursor: 'pointer', fontSize: 14, fontWeight: 700 }}>✔ Resolve Dispute</button>
                    <button onClick={() => adminResolve(d.id, true)} style={{ flex: 1, minWidth: 200, padding: 12, background: '#ef4444', border: 'none', color: '#fff', borderRadius: 8, cursor: 'pointer', fontSize: 14, fontWeight: 600 }}>{banBtnLabel}</button>
                  </div>
                </div>
              ) : (
                <div style={{ marginTop: 16, background: 'rgba(198,255,51,0.08)', border: '1px solid rgba(198,255,51,0.3)', borderRadius: 8, padding: 12 }}>
                  <div style={{ color: '#c6ff33', fontSize: 13, fontWeight: 700 }}>✔ Resolved by {d.resolvedBy || 'Admin'}</div>
                  {d.adminNotes && <div style={{ color: '#a3a3a3', fontSize: 13, marginTop: 4 }}>{d.adminNotes}</div>}
                  {d.banApplied && <div style={{ color: '#f87171', fontSize: 13, marginTop: 4 }}>{d.teamBanned ? '🚫 Team banned from tournament.' : '🚫 Player access revoked & permanently banned.'}</div>}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {modal && (
        <div id="warning-result-modal" style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: '#0f172a', border: `1px solid ${modal.isBan ? '#ef4444' : '#fb923c'}`, borderRadius: 16, width: 'min(90vw,440px)', padding: 32, textAlign: 'center', boxShadow: '0 20px 60px #000a' }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>{modal.isBan ? '🚫' : '⚠️'}</div>
            <p style={{ color: '#f1f5f9', fontSize: 16, lineHeight: 1.6, margin: '0 0 24px' }}>{modal.message}</p>
            <button onClick={() => setModal(null)} style={{ padding: '12px 32px', background: modal.isBan ? '#ef4444' : '#fb923c', border: 'none', color: '#fff', borderRadius: 8, cursor: 'pointer', fontSize: 14, fontWeight: 600 }}>OK</button>
          </div>
        </div>
      )}
    </main>
  );
}


