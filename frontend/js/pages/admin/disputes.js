/* ============================================================
   NEXUS ESPORTS — Admin Dispute Console JS
   Shows open_admin and escalated_to_admin disputes.
   Admin can:
     - Give Warning (auto-ban at 3 warnings)
     - Revoke Access & Ban Player (player disputes)
     - Resolve
   ============================================================ */

initAdminSidebar('disputes');
initFooter('../../');

let adminDisputes = [];
let activeFilter = 'all';

document.addEventListener('DOMContentLoaded', () => {
  refreshQueue();
  setupFilterTabs();
});

function refreshQueue() {
  if (!window.NexusData) return;
  const all = window.NexusData.loadDisputes();
  const isTeamDispute = d => d && (d.targetType === 'team' || d.targetType === 'opponent_team');
  // Admin sees only disputes that belong to the admin queue. Team disputes stay with organizers.
  adminDisputes = all.filter(d =>
    !isTeamDispute(d) && (
      d.status === 'open_admin' ||
      d.status === 'escalated_to_admin' ||
      d.status === 'resolved'
    )
  );
  renderStats();
  renderDisputes();
}

function renderStats() {
  const open = adminDisputes.filter(d => d.status === 'open_admin').length;
  const escalated = adminDisputes.filter(d => d.status === 'escalated_to_admin').length;
  const resolved = adminDisputes.filter(d => d.status === 'resolved').length;

  const el = id => document.getElementById(id);
  if (el('stat-open')) el('stat-open').textContent = open;
  if (el('stat-escalated')) el('stat-escalated').textContent = escalated;
  if (el('stat-resolved')) el('stat-resolved').textContent = resolved;
}

function getFiltered() {
  if (activeFilter === 'all') return adminDisputes;
  if (activeFilter === 'open') return adminDisputes.filter(d => d.status === 'open_admin');
  if (activeFilter === 'escalated') return adminDisputes.filter(d => d.status === 'escalated_to_admin');
  if (activeFilter === 'resolved') return adminDisputes.filter(d => d.status === 'resolved');
  return adminDisputes;
}

function renderDisputes() {
  const container = document.getElementById('disputes-list');
  if (!container) return;
  const filtered = getFiltered();

  if (!filtered.length) {
    container.innerHTML = '<div style="text-align:center;padding:60px;color:#64748b;">No disputes in this queue.</div>';
    return;
  }

  container.innerHTML = filtered.map(d => {
    const isOpen = d.status === 'open_admin';
    const isEscalated = d.status === 'escalated_to_admin';
    const isResolved = d.status === 'resolved';

    let badge = '';
    if (isOpen) badge = `<span style="padding:4px 10px;border-radius:20px;font-size:11px;font-weight:700;background:rgba(231,0,11,0.15);color:#f87171;border:1px solid #f87171;">DIRECT — VS ORGANIZER</span>`;
    else if (isEscalated) badge = `<span style="padding:4px 10px;border-radius:20px;font-size:11px;font-weight:700;background:rgba(251,146,60,0.15);color:#fb923c;border:1px solid #fb923c;">ESCALATED BY ORGANIZER${d.banRequested ? ' • BAN REQUESTED' : ''}</span>`;
    else badge = `<span style="padding:4px 10px;border-radius:20px;font-size:11px;font-weight:700;background:rgba(198,255,51,0.15);color:#c6ff33;border:1px solid #c6ff33;">RESOLVED</span>`;

    const targetLabel = {
      team: '⚔ Team',
      player: '👤 Player',
      opponent_team: '⚔ Opponent/Team',
      match_rule: '📋 Match Rule',
      organizer: '⚠ Organizer Misconduct'
    }[d.targetType] || d.targetType || '—';

    const evidenceHtml = (d.evidenceUrls || []).length
      ? d.evidenceUrls.map(url => `<a href="${url}" target="_blank" style="color:#c6ff33;font-size:12px;display:block;word-break:break-all;">${url}</a>`).join('')
      : '<span style="color:#737373;font-size:12px;">No evidence provided</span>';

    const orgNotesHtml = d.organizerNotes
      ? `<div style="margin-top:12px;background:#141414;border:1px solid #262626;border-left:3px solid #fb923c;border-radius:8px;padding:12px;">
           <div style="color:#fb923c;font-size:11px;margin-bottom:4px;font-weight:700;">ORGANIZER NOTES</div>
           <div style="color:#e5e5e5;font-size:13px;">${d.organizerNotes}</div>
         </div>` : '';

    const banReqHtml = d.banRequested
      ? `<div style="margin-top:8px;background:rgba(248,113,113,0.1);border:1px solid #f87171;border-radius:8px;padding:10px;color:#f87171;font-size:13px;">
           🚫 Organizer has requested a platform ban for: <strong>${d.targetUserOrTeam || 'the offending player'}</strong>
         </div>` : '';

    // Get existing warning count for target (team or player)
    const isTeamTarget = (d.targetType === 'team' || d.targetType === 'opponent_team');
    const targetWarnings = getTargetWarningCount(d);
    const isMaxWarn = targetWarnings >= 3;
    const banBtnLabel = isTeamTarget ? '🚫 Ban Team from Tournament' : '🚫 Revoke Access & Ban Player';

    const adminActionsHtml = (!isResolved) ? `
      <div style="margin-top:20px;border-top:1px solid #262626;padding-top:20px;">
        ${targetWarnings > 0 ? `<div style="margin-bottom:12px;background:${isMaxWarn ? 'rgba(239,68,68,0.1)' : 'rgba(251,146,60,0.1)'};border:1px solid ${isMaxWarn ? '#ef444444' : '#fb923c44'};border-radius:8px;padding:10px;">
          <span style="color:${isMaxWarn ? '#ef4444' : '#fb923c'};font-size:13px;font-weight:600;">⚠️ Current Warning Level: ${targetWarnings}/3 ${isMaxWarn ? (isTeamTarget ? '• TEAM BANNED FROM TOURNAMENT' : '• PLAYER BANNED') : ''}</span>
          ${targetWarnings === 2 ? `<span style="color:#f87171;font-size:12px;margin-left:8px;">${isTeamTarget ? 'Next warning = Team Ban from Tournament!' : 'Next warning = Auto-Ban!'}</span>` : ''}
        </div>` : ''}
        <div style="font-size:13px;color:#a3a3a3;margin-bottom:8px;">Admin Resolution Notes</div>
        <textarea id="admin-notes-${d.id}" rows="3" placeholder="Write your resolution notes..."
          style="width:100%;background:#141414;border:1px solid #262626;color:#f5f5f5;padding:10px 12px;border-radius:8px;font-size:14px;resize:vertical;box-sizing:border-box;margin-bottom:12px;"></textarea>

        <div style="display:flex;gap:12px;flex-wrap:wrap;">
          <button onclick="adminWarning('${d.id}')"
            style="flex:1;min-width:140px;padding:12px;background:#fb923c;border:none;color:#fff;border-radius:8px;cursor:pointer;font-size:14px;font-weight:600;">
            ⚠️ Give Warning (${Math.min(targetWarnings, 3)}/3)
          </button>
          <button onclick="adminResolve('${d.id}', false)"
            style="flex:1;min-width:140px;padding:12px;background:#c6ff33;border:none;color:#000;border-radius:8px;cursor:pointer;font-size:14px;font-weight:700;">
            ✔ Resolve Dispute
          </button>
          <button onclick="adminResolve('${d.id}', true)"
            style="flex:1;min-width:200px;padding:12px;background:#ef4444;border:none;color:#fff;border-radius:8px;cursor:pointer;font-size:14px;font-weight:600;">
            ${banBtnLabel}
          </button>
        </div>
      </div>` : `
      <div style="margin-top:16px;background:rgba(198,255,51,0.08);border:1px solid rgba(198,255,51,0.3);border-radius:8px;padding:12px;">
        <div style="color:#c6ff33;font-size:13px;font-weight:700;">✔ Resolved by ${d.resolvedBy || 'Admin'}</div>
        ${d.adminNotes ? `<div style="color:#a3a3a3;font-size:13px;margin-top:4px;">${d.adminNotes}</div>` : ''}
        ${d.banApplied ? `<div style="color:#f87171;font-size:13px;margin-top:4px;">${d.teamBanned ? '🚫 Team banned from tournament.' : '🚫 Player access revoked & permanently banned.'}</div>` : ''}
      </div>`;

    return `
      <div style="background:#0a0a0a;border:1px solid #262626;border-radius:14px;padding:24px;margin-bottom:16px;">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:10px;margin-bottom:16px;">
          <div>
            <div style="color:#737373;font-size:11px;margin-bottom:4px;font-weight:700;">DISPUTE ID</div>
            <div style="color:#f5f5f5;font-size:16px;font-weight:700;">#${d.id.slice(-12)}</div>
          </div>
          ${badge}
        </div>

        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:10px;margin-bottom:16px;">
          <div style="background:#141414;border:1px solid #262626;border-radius:8px;padding:10px;">
            <div style="color:#737373;font-size:11px;margin-bottom:3px;font-weight:700;">CATEGORY</div>
            <div style="color:#c6ff33;font-size:13px;font-weight:700;">${targetLabel}</div>
          </div>
          <div style="background:#141414;border:1px solid #262626;border-radius:8px;padding:10px;">
            <div style="color:#737373;font-size:11px;margin-bottom:3px;font-weight:700;">FILED BY</div>
            <div style="color:#f5f5f5;font-size:13px;">${d.reportedBy || d.filedBy || '—'}</div>
          </div>
          <div style="background:#141414;border:1px solid #262626;border-radius:8px;padding:10px;">
            <div style="color:#737373;font-size:11px;margin-bottom:3px;font-weight:700;">AGAINST</div>
            <div style="color:#f5f5f5;font-size:13px;">${d.targetUserOrTeam || d.against || '—'}</div>
          </div>
          <div style="background:#141414;border:1px solid #262626;border-radius:8px;padding:10px;">
            <div style="color:#737373;font-size:11px;margin-bottom:3px;font-weight:700;">FILED ON</div>
            <div style="color:#f5f5f5;font-size:13px;">${d.createdAt ? new Date(d.createdAt).toLocaleDateString() : (d.filedAt || '—')}</div>
          </div>
        </div>

        <div style="background:#141414;border:1px solid #262626;border-radius:8px;padding:14px;color:#d4d4d4;font-size:14px;line-height:1.6;margin-bottom:12px;">
          <div style="color:#737373;font-size:11px;margin-bottom:6px;font-weight:700;">DISPUTE REASON</div>
          ${d.reason || d.description || d.desc || 'No reason provided'}
        </div>

        <div style="background:#141414;border:1px solid #262626;border-radius:8px;padding:12px;margin-bottom:4px;">
          <div style="color:#737373;font-size:11px;margin-bottom:6px;font-weight:700;">EVIDENCE</div>
          ${evidenceHtml}
        </div>

        ${orgNotesHtml}
        ${banReqHtml}
        ${adminActionsHtml}
      </div>`;
  }).join('');
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

    // Fallback: check warnings on accounts filtered by teamName
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

function adminWarning(disputeId) {
  const notesEl = document.getElementById(`admin-notes-${disputeId}`);
  const notes = notesEl?.value?.trim() || '';
  if (!notes || notes.length < 5) {
    if (typeof showToast === 'function') showToast('Please enter a reason for the warning (min. 5 characters).', 'error');
    return;
  }

  const d = adminDisputes.find(x => x.id === disputeId);
  const target = d?.targetUserOrTeam || d?.against;
  if (!target) {
    if (typeof showToast === 'function') showToast('No target specified for this dispute.', 'error');
    return;
  }

  const isTeam = isTeamDispute(d);
  const result = window.NexusData.issueAdminWarning(disputeId, notes, target);
  if (!result) {
    if (typeof showToast === 'function') showToast('Failed to issue warning.', 'error');
    return;
  }

  if (isTeam) {
    if (result.autoBanned) {
      showWarningModal(`🚫 Team "${target}" has reached 3 warnings and has been BANNED from the tournament. Player accounts remain active on the platform.`, true);
      if (typeof showToast === 'function') showToast(`Team "${target}" has been banned from the tournament (3/3 warnings).`, 'error');
    } else {
      showWarningModal(`⚠ Warning issued to team "${target}". Note: Repeated team warnings may result in team disqualification from the tournament.`, false);
      if (typeof showToast === 'function') showToast(`⚠ Team Warning issued to "${target}".`);
    }
  } else {
    if (result.autoBanned) {
      showWarningModal(`🚫 Player "${target}" has reached 3 warnings and has been PERMANENTLY BANNED from the platform.`, true);
      if (typeof showToast === 'function') showToast(`Player "${target}" has been permanently banned (3/3 warnings).`, 'error');
    } else {
      showWarningModal(`⚠ Warning #${result.totalWarnings}/3 issued to "${target}". ${result.totalWarnings >= 2 ? 'Next warning will result in a permanent ban!' : ''}`, false);
      if (typeof showToast === 'function') showToast(`⚠ Warning #${result.totalWarnings}/3 issued to "${target}".`);
    }
  }

  refreshQueue();
}

function showWarningModal(message, isBan) {
  // Remove existing modal if any
  const existing = document.getElementById('warning-result-modal');
  if (existing) existing.remove();

  const color = isBan ? '#ef4444' : '#fb923c';
  const icon = isBan ? '🚫' : '⚠️';
  const modal = document.createElement('div');
  modal.id = 'warning-result-modal';
  modal.style.cssText = 'position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,0.7);backdrop-filter:blur(4px);display:flex;align-items:center;justify-content:center;';
  modal.innerHTML = `
    <div style="background:#0f172a;border:1px solid ${color};border-radius:16px;width:min(90vw,440px);padding:32px;text-align:center;box-shadow:0 20px 60px #000a;">
      <div style="font-size:48px;margin-bottom:16px;">${icon}</div>
      <p style="color:#f1f5f9;font-size:16px;line-height:1.6;margin:0 0 24px;">${message}</p>
      <button onclick="document.getElementById('warning-result-modal').remove()"
        style="padding:12px 32px;background:${color};border:none;color:#fff;border-radius:8px;cursor:pointer;font-size:14px;font-weight:600;">
        OK
      </button>
    </div>`;
  document.body.appendChild(modal);
}

/* ── Helpers ─────────────────────────────────────────────────── */

/**
 * Returns true when the dispute target type is a team (not an individual player).
 */
function isTeamDispute(dispute) {
  return dispute && (dispute.targetType === 'team' || dispute.targetType === 'opponent_team');
}

/**
 * Push a notification into nexus.notifications.items directly.
 */
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

/**
 * Notify every member of the matched team (leader + all players).
 */
function notifyTeamMembers(teamName, compId, title, body, status) {
  try {
    const comps = JSON.parse(localStorage.getItem('nexus_competitions') || '[]');
    let members = [];
    comps.forEach(function(comp) {
      if (!Array.isArray(comp.teams)) return;
      comp.teams.forEach(function(team) {
        const nameMatch = (team.name || '').toLowerCase() === (teamName || '').toLowerCase();
        const compMatch = !compId || comp.id === compId;
        if (nameMatch && compMatch) {
          // Add leader
          const leader = team.createdBy || team.leaderUsername || team.captain;
          if (leader) members.push(leader);
          // Add all members
          if (Array.isArray(team.members)) {
            team.members.forEach(function(m) {
              const u = typeof m === 'string' ? m : (m && (m.username || m.name));
              if (u && !members.includes(u)) members.push(u);
            });
          }
        }
      });
    });
    // Deduplicate and notify each
    [...new Set(members)].forEach(function(u) {
      pushDisputeNotif(u, title, body, status);
    });
  } catch(e) {}
}

/**
 * Ban a TEAM from their tournament (sets team.status = 'banned' in nexus_competitions).
 * Does NOT touch user accounts — users remain on the platform.
 */
function banTeamFromTournament(teamName, compId) {
  try {
    const COMP_KEY = 'nexus_competitions';
    const comps = JSON.parse(localStorage.getItem(COMP_KEY) || '[]');
    let banned = false;
    comps.forEach(function(comp) {
      if (!Array.isArray(comp.teams)) return;
      comp.teams.forEach(function(team) {
        const nameMatch = (team.name || '').toLowerCase() === (teamName || '').toLowerCase();
        const compMatch = !compId || comp.id === compId;
        if (nameMatch && compMatch) {
          team.status = 'banned';
          team.bannedAt = new Date().toISOString();
          team.bannedReason = 'Banned following a resolved dispute.';
          banned = true;
        }
      });
    });
    if (banned) localStorage.setItem(COMP_KEY, JSON.stringify(comps));
    return banned;
  } catch(e) {
    return false;
  }
}

/* ── Main resolve action ─────────────────────────────────────── */

function adminResolve(disputeId, executeBan) {
  const notesEl = document.getElementById(`admin-notes-${disputeId}`);
  const notes = notesEl?.value?.trim() || '';
  if (!notes || notes.length < 5) {
    if (typeof showToast === 'function') showToast('Please enter resolution notes (min. 5 characters).', 'error');
    return;
  }

  const sessionRaw = localStorage.getItem('nexus.auth.session');
  let adminUser = 'admin';
  try { const s = JSON.parse(sessionRaw); adminUser = s?.username || s?.displayName || 'admin'; } catch(e) {}

  const d = adminDisputes.find(x => x.id === disputeId);
  if (!d) {
    if (typeof showToast === 'function') showToast('Dispute not found.', 'error');
    return;
  }

  const updates = {
    status: 'resolved',
    adminNotes: notes,
    resolvedBy: adminUser,
    banApplied: false,
    teamBanned: false
  };

  if (executeBan) {
    const target = d.targetUserOrTeam;
    if (!target) {
      if (typeof showToast === 'function') showToast('No target specified for this dispute.', 'error');
      return;
    }

    if (isTeamDispute(d)) {
      // ── TEAM DISPUTE: ban the team from the tournament, NOT the user account ──
      const banned = banTeamFromTournament(target, d.competitionId || null);

      // Notify team leader + every member
      notifyTeamMembers(
        target,
        d.competitionId || null,
        '🚫 Team Banned from Tournament',
        `Your team "${target}" has been banned from the tournament following a resolved dispute. Your player accounts are unaffected.`,
        'rejected'
      );

      // Also notify the reporter
      if (d.reportedBy) {
        pushDisputeNotif(
          d.reportedBy,
          'Dispute Resolved — Team Banned',
          `Team "${target}" has been banned from the tournament following your dispute report.`,
          'approved'
        );
      }

      updates.banApplied = true;
      updates.teamBanned = true;

      window.NexusData.updateDisputeStatus(disputeId, updates);
      refreshQueue();
      if (typeof showToast === 'function') {
        showToast(`Team "${target}" has been banned from the tournament. Player accounts are unaffected.`, 'error');
      }
    } else {
      // ── PLAYER DISPUTE: ban the individual user account from the platform ──
      banUserLocally(target);
      updates.banApplied = true;

      // Notify the player
      pushDisputeNotif(
        target,
        '🚫 Account Banned from Platform',
        `Your account has been suspended following a resolved dispute: "${d.reason || 'Platform violation'}".`,
        'rejected'
      );

      // Notify reporter
      if (d.reportedBy) {
        pushDisputeNotif(
          d.reportedBy,
          'Dispute Resolved — Player Banned',
          `Player "${target}" has been banned following your dispute report.`,
          'approved'
        );
      }

      window.NexusData.updateDisputeStatus(disputeId, updates);
      refreshQueue();
      if (typeof showToast === 'function') {
        showToast(`Dispute resolved. Player "${target}" has been permanently banned from the platform.`, 'error');
      }
    }
  } else {
    // ── Simple resolve without ban ──
    // For team disputes, still notify all team members of the outcome
    if (isTeamDispute(d) && d.targetUserOrTeam) {
      notifyTeamMembers(
        d.targetUserOrTeam,
        d.competitionId || null,
        '⚠️ Dispute Resolved Against Your Team',
        `A dispute against your team "${d.targetUserOrTeam}" has been resolved by an admin. No ban was applied at this time.`,
        'pending'
      );
    }

    window.NexusData.updateDisputeStatus(disputeId, updates);

    try {
      if (window.NexusData && typeof window.NexusData.logAdminActivity === 'function') {
        const actionLabel = updates.banApplied ? 'Resolved Dispute with Ban' : 'Resolved Dispute';
        const targetStr = d.targetUserOrTeam || d.against || 'target';
        window.NexusData.logAdminActivity(adminUser, 'DISPUTE_RESOLVED', `${actionLabel} #${disputeId.slice(-8)} regarding ${targetStr}`, {
          disputeId: disputeId,
          target: targetStr,
          banApplied: updates.banApplied,
          notes: notes
        });
      }
    } catch(e) {}

    refreshQueue();
    if (typeof showToast === 'function') {
      showToast('Dispute resolved successfully!');
    }
  }
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

  // Also record in banned list
  try {
    const banned = JSON.parse(localStorage.getItem('nexus.banned.users') || '[]');
    if (!banned.includes(usernameOrEmail)) banned.push(usernameOrEmail);
    localStorage.setItem('nexus.banned.users', JSON.stringify(banned));
  } catch(e) {}
}

function setupFilterTabs() {
  document.querySelectorAll('.filter-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.filter-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      activeFilter = tab.dataset.filter || 'all';
      renderDisputes();
    });
  });
}

window.adminResolve = adminResolve;
window.adminWarning = adminWarning;
