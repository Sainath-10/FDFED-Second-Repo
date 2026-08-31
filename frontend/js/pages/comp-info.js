/* ============================================================
   NEXUS ESPORTS — comp-info.js
   Public-facing competition info page.
   - Loads competition data from NexusData by ?id= param.
   - Register / Create Team buttons: redirect to login if guest.
   ============================================================ */

initSidebar('competitions', '../');
initFooter('../');

// ── Helper: check if user is logged in ──────────────────────
function isLoggedIn() {
  return !!localStorage.getItem('nexus.auth.session');
}

function getSession() {
  try {
    const raw = localStorage.getItem('nexus.auth.session');
    return raw ? JSON.parse(raw) : null;
  } catch (err) {
    return null;
  }
}

function normalize(value) {
  return String(value || '').trim().toLowerCase();
}

function getApprovalStatus(comp) {
  if (window.NexusData && typeof window.NexusData.getApprovalStatus === 'function') {
    return window.NexusData.getApprovalStatus(comp);
  }
  const raw = String((comp && comp.approvalStatus) || '').toLowerCase();
  return raw || 'approved';
}

// ── Tab switching ────────────────────────────────────────────
document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
    btn.classList.add('active');
    const panel = document.getElementById('tab-' + btn.dataset.tab);
    if (panel) panel.classList.add('active');
  });
});

// ── Load & render competition data ───────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  const id = new URLSearchParams(window.location.search).get('id');
  if (!id || !window.NexusData) {
    showNotFound();
    return;
  }

  const comp = window.NexusData.getCompetitionById(id);
  if (!comp) {
    showNotFound();
    return;
  }

  const session = getSession();
  const approvalStatus = getApprovalStatus(comp);
  const userKey = normalize(session && session.username);
  const isCoOrg = Array.isArray(comp.organizers) && comp.organizers.map(normalize).includes(userKey);
  const isOwner = isCoOrg || normalize(comp.organizerId || comp.createdBy) === userKey;
  if (approvalStatus !== 'approved' && !isOwner) {
    showNotFound();
    return;
  }

  if (approvalStatus === 'pending') {
    const bannerHtml = `
      <div style="background:rgba(251,146,60,0.15);border:1px solid #fb923c;border-radius:12px;padding:16px 24px;margin-bottom:24px;display:flex;align-items:center;gap:16px;">
        <span style="font-size:28px;">⏳</span>
        <div>
          <h4 style="margin:0 0 4px;color:#fb923c;font-size:16px;font-weight:700;">Pending Admin Approval</h4>
          <p style="margin:0;color:#cbd5e1;font-size:13px;">This tournament's prize pool (${comp.prizePool || 'High Stakes'}) exceeds ₹50,000. It is currently under review by Platform Admin and will be published publicly once approved.</p>
        </div>
      </div>`;
    const main = document.querySelector('.comp-info-page') || document.querySelector('.main-content');
    if (main) main.insertAdjacentHTML('afterbegin', bannerHtml);
  }

  renderComp(comp);
  setupCTAButtons(comp);
});

function showNotFound() {
  const main = document.querySelector('.comp-info-page');
  if (main) main.innerHTML = `
    <a href="competitions.html" class="back-btn" style="margin-bottom:24px;display:inline-flex;align-items:center;gap:8px;font-size:14px;color:var(--text-muted);text-decoration:none;">← Back to Competitions</a>
    <div style="text-align:center;padding:80px 20px;">
      <div style="font-size:48px;margin-bottom:16px;">🏆</div>
      <h2 style="color:var(--text-white);margin-bottom:8px;">Competition Not Found</h2>
      <p style="color:var(--text-muted);">This competition may have been removed or the link is invalid.</p>
    </div>`;
}

function renderComp(comp) {
  // ── Hero ─────────────────────────────────────────────────
  document.title = `NEXUS ESPORTS — ${comp.name}`;

  const imgEl = document.getElementById('comp-hero-img');
  if (imgEl) imgEl.src = comp.img || '../assets/b890c61489a080992ad7e99adabb1145e6d59606.png';

  setText('comp-hero-game', comp.game || '—');
  setText('comp-hero-name', comp.name || 'Competition');

  const badgeEl = document.getElementById('comp-hero-badge');
  if (badgeEl) {
    badgeEl.textContent = comp.badge || '';
    badgeEl.className = `comp-badge ${comp.badgeClass || ''}`;
    if (!comp.badge) badgeEl.style.display = 'none';
  }

  // ── Sidebar info ─────────────────────────────────────────
  setText('info-status', formatStatus(comp.status));
  setText('info-game', comp.game || '—');
  setText('info-format', formatType(comp.type));
  const approvedTeams = (comp.teams || []).filter(t => t.status === 'approved');
  setText('info-teams', `${approvedTeams.length} / ${comp.maxTeams || '—'}`);
  setText('info-date', comp.dates || '—');
  setText('info-prize', comp.prizePool || '—');

  // ── Overview tab ─────────────────────────────────────────
  const hasPrize = comp.prizePool && comp.prizePool !== 'No Prize Pool' && comp.prizePool !== '₹0' && comp.prizePool !== '—';
  const prizePhrase = hasPrize ? `the prize pool of ${comp.prizePool}` : 'glory and championship honors';
  setText('comp-description', comp.description || `The ${comp.name} is a ${formatType(comp.type)} competition for ${comp.game}. Join teams from around the world to compete for ${prizePhrase}.`);

  const regDates = comp.registrationDates || {};
  setText('sched-reg-open', regDates.open || '—');
  setText('sched-reg-close', regDates.close || '—');
  setText('sched-dates', comp.dates || '—');

  // Competition Limits in Overview
  setText('overview-max-teams', comp.maxTeams ? String(comp.maxTeams) + ' teams' : '—');
  setText('overview-max-players', comp.maxPlayersPerTeam ? String(comp.maxPlayersPerTeam) + ' players per team' : '—');

  // ── Teams tab ────────────────────────────────────────────
  const teamsHeading = document.getElementById('teams-heading');
  if (teamsHeading) teamsHeading.textContent = `Registered Teams (${approvedTeams.length} / ${comp.maxTeams || '—'})`;

  const teamsGrid = document.getElementById('comp-teams-grid');
  if (teamsGrid) {
    if (approvedTeams.length === 0) {
      teamsGrid.innerHTML = '<p style="color:var(--text-muted);font-size:14px;">No teams have been accepted yet.</p>';
    } else {
      teamsGrid.innerHTML = approvedTeams.map(t => `
        <div class="team-card">
          <div class="name">${t.name || 'Unknown Team'}</div>
          <div class="players">${t.players || '—'} Players</div>
        </div>`).join('');
    }
  }

  // ── Standings tab ──────────────────────────────────────────
  function buildStandings(compData) {
    const teamNames = (compData.teams || []).filter(t => t.status === 'approved').map(t => t.name);
    const table = {};
    teamNames.forEach(name => {
      table[name] = { team: name, mp: 0, w: 0, l: 0, d: 0, points: 0, last5: [] };
    });
    const matches = (compData.matches || []).slice();
    matches.forEach(match => {
      if (match.status !== 'completed') return;
      if (!table[match.team1]) table[match.team1] = { team: match.team1, mp: 0, w: 0, l: 0, d: 0, points: 0, last5: [] };
      if (!table[match.team2]) table[match.team2] = { team: match.team2, mp: 0, w: 0, l: 0, d: 0, points: 0, last5: [] };
      const t1 = table[match.team1];
      const t2 = table[match.team2];
      t1.mp += 1; t2.mp += 1;
      if (match.score1 > match.score2) {
        t1.w += 1; t2.l += 1; t1.points += 3;
        t1.last5.unshift('W'); t2.last5.unshift('L');
      } else if (match.score2 > match.score1) {
        t2.w += 1; t1.l += 1; t2.points += 3;
        t1.last5.unshift('L'); t2.last5.unshift('W');
      } else {
        t1.d += 1; t2.d += 1; t1.points += 1; t2.points += 1;
        t1.last5.unshift('D'); t2.last5.unshift('D');
      }
    });
    return Object.values(table)
      .map(row => {
        const extra = (compData.customPoints || {})[row.team] || 0;
        row.points = Math.max(0, row.points + extra);
        return Object.assign({}, row, { last5: row.last5.slice(0, 5) });
      })
      .sort((a, b) => (b.points - a.points) || (b.w - a.w))
      .map((row, index) => Object.assign({}, row, { rank: index + 1 }));
  }

  const standingsContainer = document.getElementById('standings-rows');
  if (standingsContainer) {
    const rows = buildStandings(comp);
    if (!rows.length) {
      standingsContainer.innerHTML = '<p style="color:var(--text-muted);font-size:14px;padding: 18px;">No standings yet.</p>';
    } else {
      standingsContainer.innerHTML = rows.map(row => {
        const last = row.last5.length ? row.last5 : ['-', '-', '-', '-', '-'];
        const lastHtml = last.map(result => {
          if (result === 'W') return '<span class="last-chip last-win">✔</span>';
          if (result === 'L') return '<span class="last-chip last-loss">X</span>';
          return '<span class="last-chip last-draw">-</span>';
        }).join('');
        return `
          <div class="standings-row">
            <span class="col-rank"><span class="rank-badge ${row.rank === 1 ? 'rank-1' : ''}">${String(row.rank).padStart(2, '0')}</span></span>
            <span class="col-team">${row.team}</span>
            <span class="col-mp">${row.mp}</span>
            <span class="col-w stat-green">${row.w}</span>
            <span class="col-l">${row.l}</span>
            <span class="col-d">${row.d}</span>
            <span class="col-pts stat-green">${row.points}</span>
            <span class="col-last5"><span class="last-five">${lastHtml}</span></span>
          </div>`;
      }).join('');
    }
  }

  // ── Bracket tab ──────────────────────────────────────────
  const formatDesc = document.getElementById('comp-format-desc');
  if (formatDesc) formatDesc.textContent = `${formatType(comp.type)} format. ${comp.entryFee ? `Entry fee: ${comp.entryFee}.` : ''} Up to ${comp.maxTeams || '—'} teams.`;

  const bracketRow = document.getElementById('comp-bracket-row');
  if (bracketRow) {
    const matches = (comp.matches || []).filter(m => m.status === 'completed' || m.status === 'live' || m.status === 'scheduled');
    if (matches.length === 0) {
      bracketRow.innerHTML = '<p style="color:var(--text-muted);font-size:14px;">No matches scheduled yet.</p>';
    } else {
      bracketRow.innerHTML = matches.map(m => {
        const isLive = m.status === 'live';
        const isDone = m.status === 'completed';

        const isT1Banned = window.NexusData && typeof window.NexusData.isTeamBannedInComp === 'function' && window.NexusData.isTeamBannedInComp(m.team1, comp);
        const isT2Banned = window.NexusData && typeof window.NexusData.isTeamBannedInComp === 'function' && window.NexusData.isTeamBannedInComp(m.team2, comp);
        const t1Name = isT1Banned ? `<del style="color:#ef4444;">${m.team1 || 'TBD'}</del> <span style="color:#ef4444;font-size:10px;font-weight:700;">(BANNED)</span>` : (m.team1 || 'TBD');
        const t2Name = isT2Banned ? `<del style="color:#ef4444;">${m.team2 || 'TBD'}</del> <span style="color:#ef4444;font-size:10px;font-weight:700;">(BANNED)</span>` : (m.team2 || 'TBD');

        return `
          <div class="bracket-match">
            <div class="round-label">${m.round || 'Match'} · ${isLive ? '🔴 LIVE' : (isDone ? 'Completed' : 'Scheduled')}</div>
            <div class="bracket-team ${isDone && m.score1 >= m.score2 ? 'winner' : ''}">
              <span>${t1Name}</span>
              <span class="score">${isDone ? m.score1 : '—'}</span>
            </div>
            <div class="bracket-team ${isDone && m.score2 > m.score1 ? 'winner' : ''}">
              <span>${t2Name}</span>
              <span class="score">${isDone ? m.score2 : '—'}</span>
            </div>
          </div>`;
      }).join('');
    }
  }

  // ── Prize Breakdown ──────────────────────────────────────
  const prizeContainer = document.getElementById('comp-prize-breakdown');
  if (prizeContainer) {
    const prizes = comp.prizes || [];
    if (prizes.length === 0) {
      prizeContainer.innerHTML = `<div class="prize-row"><span class="place">🥇 1st Place</span><span class="amount">${comp.prizePool || '—'}</span></div>`;
    } else {
      const icons = ['🥇', '🥈', '🥉'];
      prizeContainer.innerHTML = prizes.map((p, i) => `
        <div class="prize-row">
          <span class="place">${icons[i] || ''} ${p.place}</span>
          <span class="amount">${p.amount || '—'}</span>
        </div>`).join('');
    }
  }

  // ── Rules tab ────────────────────────────────────────────
  const rulesEl = document.getElementById('comp-rules');
  if (rulesEl) {
    if (comp.rules) {
      rulesEl.innerHTML = comp.rules.split('\n').filter(r => r.trim()).map((r, i) => `<p>${i + 1}. ${r}</p>`).join('');
      // Append max players per team rule if not already mentioned
      if (comp.maxPlayersPerTeam && !comp.rules.toLowerCase().includes('player')) {
        const existingCount = rulesEl.querySelectorAll('p').length;
        rulesEl.innerHTML += `<p>${existingCount + 1}. Maximum ${comp.maxPlayersPerTeam} players allowed per team.</p>`;
      }
    } else {
      rulesEl.innerHTML = `
        <p>1. All participating teams must have valid NEXUS accounts.</p>
        <p>2. Format: ${formatType(comp.type)}. Max ${comp.maxTeams || '—'} teams.</p>
        <p>3. Maximum ${comp.maxPlayersPerTeam || 5} players allowed per team.</p>
        <p>4. Teams must be ready to play within 10 minutes of scheduled match time.</p>
        <p>5. All matches must be played on official NEXUS tournament servers.</p>
        <p>6. Entry fee: ${comp.entryFee || 'Free'}.</p>
        <p>7. Prize money will be distributed within 14 business days of tournament conclusion.</p>`;
    }
  }
}

function setupCTAButtons(comp) {
  const registerBtn = document.getElementById('btn-register-team');
  const createBtn = document.getElementById('btn-create-team');
  const shareBtn = document.getElementById('btn-share-comp');
  const disputeBtn = document.getElementById('btn-dispute');
  const manageBtn = document.getElementById('btn-manage-comp');
  const session = getSession();
  const userKey = normalize(session && session.username);

  // Organizer detection
  const isCoOrg = Array.isArray(comp.organizers) && comp.organizers.map(normalize).includes(userKey);
  const isOwner = !!(userKey && (isCoOrg || normalize(comp.organizerId) === userKey || normalize(comp.createdBy) === userKey));

  if (isOwner) {
    if (registerBtn) registerBtn.style.display = 'none';
    if (createBtn) createBtn.style.display = 'none';
    if (manageBtn) { manageBtn.href = 'competition-detail.html?id=' + comp.id; manageBtn.style.display = 'block'; }
    if (disputeBtn) { disputeBtn.style.display = 'block'; }
    if (shareBtn) { shareBtn.addEventListener('click', function() { var url = window.location.href; if (navigator.clipboard) { navigator.clipboard.writeText(url).then(function() { if (typeof showToast === 'function') showToast('Link copied!'); }); } else { prompt('Copy:', url); } }); }
    return;
  }

  if (manageBtn) manageBtn.style.display = 'none';

  const myTeam = (window.NexusTeamWorkflow && typeof window.NexusTeamWorkflow.findUserTeamInCompetition === 'function')
    ? window.NexusTeamWorkflow.findUserTeamInCompetition(comp.id)
    : null;
  const isTeamLeader = !!(myTeam && myTeam.team && normalize(myTeam.team.createdBy) === userKey);
  const teamStatus = myTeam && myTeam.team ? String(myTeam.team.status || '').toLowerCase() : '';

  // Share link button
  if (shareBtn) {
    shareBtn.addEventListener('click', () => {
      const url = window.location.href;
      if (navigator.clipboard) {
        navigator.clipboard.writeText(url).then(() => {
          if (typeof showToast === 'function') showToast('Competition link copied to clipboard!');
        }).catch(() => {
          prompt('Copy this link:', url);
        });
      } else {
        prompt('Copy this link:', url);
      }
    });
  }

  // Dispute button ensures modal is invoked
  if (disputeBtn) {
    disputeBtn.onclick = function(e) {
      e.preventDefault();
      if (typeof openDisputeModal === 'function') openDisputeModal();
    };
  }

  if (registerBtn) {
    registerBtn.addEventListener('click', () => {
      if (getApprovalStatus(comp) !== 'approved') {
        if (typeof showToast === 'function') showToast('Registration opens only after admin approval.', 'error');
        return;
      }

      if (!isLoggedIn()) {
        window.location.href = 'login.html';
        return;
      }

      if (myTeam && myTeam.context && teamStatus !== 'rejected') {
        window.location.href = 'comp-participant.html?id=' + encodeURIComponent(myTeam.context.compId);
        return;
      }

      window.location.href = `join-teams.html?id=${comp.id}`;
    });
  }

  if (createBtn) {
    createBtn.addEventListener('click', () => {
      if (getApprovalStatus(comp) !== 'approved') {
        if (typeof showToast === 'function') showToast('Team creation opens only after admin approval.', 'error');
        return;
      }

      if (!isLoggedIn()) {
        window.location.href = 'login.html';
        return;
      }

      if (myTeam && myTeam.context && teamStatus !== 'rejected') {
        if (isTeamLeader) {
          window.location.href = 'team/team-roster.html?compId=' + encodeURIComponent(myTeam.context.compId) + '&teamId=' + encodeURIComponent(myTeam.context.teamId);
        } else {
          window.location.href = 'comp-participant.html?id=' + encodeURIComponent(myTeam.context.compId);
        }
        return;
      }

      window.location.href = `create-team.html?id=${comp.id}`;
    });
  }

  if (myTeam && teamStatus !== 'rejected') {
    if (teamStatus === 'banned') {
      if (registerBtn) {
        registerBtn.textContent = '🚫 Team Banned from Tournament';
        registerBtn.disabled = true;
        registerBtn.style.background = '#1a1015';
        registerBtn.style.color = '#ef4444';
        registerBtn.style.border = '1px solid #ef4444';
        registerBtn.style.cursor = 'not-allowed';
      }
      if (createBtn) {
        createBtn.style.display = 'none';
      }
      if (disputeBtn) {
        disputeBtn.style.display = 'none';
      }
      return;
    }

    if (teamStatus === 'pending') {
      if (registerBtn) {
        registerBtn.textContent = 'Pending Approval';
        registerBtn.disabled = true;
      }
      if (createBtn) {
        createBtn.textContent = 'Pending Approval';
        createBtn.disabled = true;
      }
      return;
    }

    if (registerBtn) {
      registerBtn.textContent = 'View My Team';
      registerBtn.disabled = false;
    }
    if (createBtn) {
      if (isTeamLeader) {
        createBtn.textContent = 'Manage My Team';
        createBtn.style.display = '';
        createBtn.disabled = false;
      } else {
        createBtn.style.display = 'none';
      }
    }
    // Show dispute button for team members/leaders
    if (disputeBtn) {
      disputeBtn.style.display = 'block';
    }
  } else {
    // No team or team was rejected — show join/create options
    if (registerBtn) { registerBtn.textContent = 'Join a Team'; registerBtn.disabled = false; }
    if (createBtn) { createBtn.style.display = ''; createBtn.textContent = 'Create a New Team'; createBtn.disabled = false; }

    // Check if organizer (even if not on a team)
    const sessionRaw = localStorage.getItem('nexus.auth.session');
    let isOwner = false;
    if (sessionRaw) {
      try {
        const session = JSON.parse(sessionRaw);
        const u = normalize(session.username);
        const coOrgs = Array.isArray(comp.organizers) ? comp.organizers.map(normalize) : [];
        isOwner = coOrgs.includes(u) || normalize(comp.organizerId) === u || normalize(comp.createdBy) === u;
      } catch (e) { }
    }

    if (isOwner && disputeBtn) {
      disputeBtn.style.display = 'block';
    } else if (disputeBtn) {
      disputeBtn.style.display = 'none';
    }

    // Show rejection notice if team was rejected
    if (teamStatus === 'rejected') {
      const ctaBlock = document.getElementById('comp-cta-block');
      if (ctaBlock) {
        const notice = document.createElement('p');
        notice.style.cssText = 'font-size:12px;color:#f87171;margin-top:4px;';
        notice.textContent = '⚠ Your previous team registration was rejected. You may join or create a new team.';
        ctaBlock.appendChild(notice);
      }
    }
  }
}

// ── Utility helpers ──────────────────────────────────────────
function setText(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = value;
}

function formatStatus(status) {
  const map = {
    ongoing: 'Ongoing',
    upcoming: 'Registration Open',
    completed: 'Completed',
    live: 'LIVE',
  };
  return map[status] || status || '—';
}

function formatType(type) {
  const map = {
    tournament: 'Single Elimination',
    league: 'Round Robin',
  };
  return map[type] || type || '—';
}
