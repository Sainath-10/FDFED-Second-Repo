/* ============================================================
   NEXUS ESPORTS — Admin Competition Overview
   ============================================================ */

document.addEventListener('DOMContentLoaded', () => {
  if (typeof initAdminSidebar === 'function') {
    initAdminSidebar('competitions');
  }
  if (typeof initFooter === 'function') {
    initFooter('../../');
  }

  loadAdminCompetitionOverview();
});

function formatPrizePool(prize) {
  if (!prize || prize === '—' || prize === '-' || prize === '₹0' || String(prize).toLowerCase().includes('no prize')) {
    return 'No Prize Pool';
  }
  const str = String(prize).trim();
  return str.toLowerCase().includes('prize pool') ? str : `${str} Prize Pool`;
}

function getStatusLabel(comp) {
  if (!comp) return 'Upcoming';
  if (comp.ended || comp.status === 'completed') return 'Completed';
  if (comp.status === 'ongoing' || comp.status === 'active') return 'Active & Live';
  return 'Registration Open';
}

function setText(id, val) {
  const el = document.getElementById(id);
  if (el) el.textContent = val || '—';
}

function loadAdminCompetitionOverview() {
  const params = new URLSearchParams(window.location.search);
  let compId = params.get('id');

  const allComps = window.NexusData ? window.NexusData.loadCompetitions() : [];

  // Fallback to sessionStorage or first competition if not in query params
  if (!compId) {
    compId = sessionStorage.getItem('last_admin_comp_id');
  }

  let comp = null;
  if (compId && allComps.length > 0) {
    comp = allComps.find(c => String(c.id) === String(compId));
  }

  // If still not found, fallback to the first available competition
  if (!comp && allComps.length > 0) {
    comp = allComps[0];
    compId = comp.id;
  }

  if (!comp) {
    const loadingEl = document.getElementById('cd-loading');
    if (loadingEl) loadingEl.textContent = 'Competition not found.';
    return;
  }

  // Persist the current compId in session for smooth tab switches
  sessionStorage.setItem('last_admin_comp_id', comp.id);

  // Update document title
  document.title = `NEXUS ESPORTS — ${comp.name || 'Competition'}`;

  // Update all tab and action URLs with current comp ID
  const suffix = `?id=${encodeURIComponent(comp.id)}`;
  ['tab-overview', 'tab-teams', 'tab-matches', 'tab-results', 'tab-standings'].forEach(tabId => {
    const a = document.getElementById(tabId);
    if (a) {
      const baseHref = a.getAttribute('href').split('?')[0];
      a.href = baseHref + suffix;
    }
  });

  const topManage = document.getElementById('cd-top-manage-btn');
  if (topManage) topManage.href = `manage-teams.html${suffix}`;

  // Bind Main Details
  const status = getStatusLabel(comp);
  setText('cd-title', comp.name);
  setText('cd-subtitle', `${comp.game || 'Game'} • ${status} • ${comp.dates || 'TBD'}`);

  // About & Schedule
  const hasPrize = comp.prizePool && comp.prizePool !== 'No Prize Pool' && comp.prizePool !== '₹0' && comp.prizePool !== '—';
  const prizePhrase = hasPrize ? `the prize pool of ${comp.prizePool}` : 'glory and championship honors';
  setText('cd-description', comp.description || `The ${comp.name} is a competitive ${comp.format || 'Single Elimination'} tournament for ${comp.game}. Join teams from across the region to battle for ${prizePhrase}.`);

  const regDates = comp.registrationDates || {};
  setText('sched-reg-open', regDates.open || 'Jul 1, 2026');
  setText('sched-reg-close', regDates.close || 'Aug 10, 2026');
  setText('sched-dates', comp.dates || 'TBD');

  // Competition Limits
  setText('overview-max-teams', comp.maxTeams ? `${comp.maxTeams} teams` : '32 teams');
  setText('overview-max-players', comp.maxPlayersPerTeam ? `${comp.maxPlayersPerTeam} players per team` : '5 players per team');
  setText('overview-entry-fee', comp.entryFee || 'Free');
  setText('overview-location', comp.location || 'Online');

  // Sidebar Info
  setText('info-status', status);
  setText('info-game', comp.game || '—');
  setText('info-format', comp.format || (comp.type === 'league' ? 'Round Robin' : 'Single Elimination'));
  
  const teamList = Array.isArray(comp.teams) ? comp.teams : [];
  const approvedTeams = teamList.filter(t => !t.status || t.status === 'approved');
  setText('info-teams', `${approvedTeams.length} / ${comp.maxTeams || 32}`);
  setText('info-date', comp.dates || 'TBD');
  setText('info-prize', formatPrizePool(comp.prizePool || comp.prize));

  // Prize Breakdown
  const breakdownContainer = document.getElementById('comp-prize-breakdown');
  if (breakdownContainer) {
    if (Array.isArray(comp.prizes) && comp.prizes.length > 0) {
      breakdownContainer.innerHTML = comp.prizes.map((p, idx) => {
        const medal = idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : '🎖️';
        return `
          <div class="prize-row">
            <span class="place">${medal} ${p.place || `${idx + 1}th Place`}</span>
            <span class="amount">${p.amount || '—'}</span>
          </div>
        `;
      }).join('');
    } else if (hasPrize) {
      breakdownContainer.innerHTML = `
        <div class="prize-row">
          <span class="place">🥇 1st Place</span>
          <span class="amount">${comp.prizePool || '—'}</span>
        </div>
      `;
    } else {
      breakdownContainer.innerHTML = '<p style="color:var(--text-muted, #9aa4b2);font-size:14px;margin:0;">No prize breakdown available.</p>';
    }
  }

  // Reveal Content
  const loadingEl = document.getElementById('cd-loading');
  if (loadingEl) loadingEl.style.display = 'none';

  const contentEl = document.getElementById('cd-content');
  if (contentEl) contentEl.style.display = 'block';
}

function copyShareLink() {
  const url = window.location.href;
  navigator.clipboard.writeText(url).then(() => {
    alert('Tournament link copied to clipboard!');
  }).catch(() => {
    alert('Link: ' + url);
  });
}
