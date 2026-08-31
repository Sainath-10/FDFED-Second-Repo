initSidebar('competitions', '../');
initFooter('../');

function hasActiveSession() {
  if (window.NexusAuth && typeof window.NexusAuth.getSession === 'function') {
    return !!window.NexusAuth.getSession();
  }
  try {
    const raw = localStorage.getItem('nexus.auth.session');
    if (!raw) return false;
    const parsed = JSON.parse(raw);
    return !!(parsed && parsed.username && parsed.role);
  } catch (err) {
    return false;
  }
}

/**
 * Fetches active competitions from the backend API and maps them
 * to the NexusData shape expected by compCard().
 */
async function fetchActiveCompetitionsFromAPI() {
  if (!window.NexusAPI || !window.NexusAPI.Competitions) return null;
  try {
    const res = await window.NexusAPI.Competitions.getActive();
    if (!res.ok || !Array.isArray(res.data) || res.data.length === 0) return null;

    // Map backend shape → NexusData shape for compCard()
    return res.data.map(c => ({
      id: c.id,
      name: c.name,
      description: c.description,
      status: c.status === 'active' ? 'ongoing' : c.status,
      startDate: c.startDate,
      endDate: c.endDate,
      createdBy: c.createdBy,
      organizers: c.organizers || [],
      game: c.game || 'Esports',
      type: c.type || 'tournament',
      prizePool: c.prizePool || '—',
      entryFee: c.entryFee || 'Free',
      participants: c.participants || 0,
      badge: 'New',
      badgeClass: 'hot',
      img: c.img || '../assets/b890c61489a080992ad7e99adabb1145e6d59606.png',
      dates: c.startDate
        ? `${new Date(c.startDate).toLocaleDateString('en-IN')} to ${new Date(c.endDate).toLocaleDateString('en-IN')}`
        : 'TBD',
    }));
  } catch (err) {
    console.warn('[NexusAPI] Could not fetch active competitions:', err.message);
    return null;
  }
}

// Fetch and render competitions
(async () => {
  const grid = document.getElementById('comps-grid');
  if (!grid) return;

  // Load local data FIRST for instant render, exclude ended competitions
  let comps = window.NexusData
    ? (typeof window.NexusData.getCompetitionsForPublic === 'function'
      ? window.NexusData.getCompetitionsForPublic()
      : window.NexusData.loadCompetitions())
    : [];

  // Hide competitions that have been formally ended
  comps = comps.filter(c => !c.ended && c.status !== 'completed');

  function renderGrid(data) {
    grid.innerHTML = data.map(c => `
      <div class="comp-card-wrapper"
           data-badge="${(c.badge || '').toLowerCase()}"
           data-type="${(c.type || '').toLowerCase()}"
           data-isnew="${(c.badge || '').toLowerCase() === 'new' ? 'true' : 'false'}">
        ${compCard(c)}
      </div>
    `).join('');
  }

  renderGrid(comps);

  // Try API in background — if it responds within 2s, re-render with API data merged with local
  try {
    const apiComps = await Promise.race([
      fetchActiveCompetitionsFromAPI(),
      new Promise(resolve => setTimeout(() => resolve(null), 2000))
    ]);
    if (apiComps && apiComps.length > 0) {
      // Merge: API comps first, then local comps not already in API (by name match)
      const apiNames = new Set(apiComps.map(c => c.name.toLowerCase()));
      const localOnly = comps.filter(c => !apiNames.has((c.name || '').toLowerCase()));
      const merged = [...apiComps, ...localOnly];
      renderGrid(merged);
    }
  } catch(e) { /* keep local data */ }

  // Guard register action for guests only; keep existing behavior for logged-in users.
  grid.addEventListener('click', event => {
    const registerBtn = event.target.closest('.comp-card-footer .btn-primary');
    if (!registerBtn) return;
    if (hasActiveSession()) return;

    event.preventDefault();
    event.stopPropagation();
    if (typeof event.stopImmediatePropagation === 'function') {
      event.stopImmediatePropagation();
    }
    window.location.href = 'login.html';
  }, true);
})();

initFilterTabs();
initSearch();
