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

  // Try API in background — if it responds within 2s, re-render with API data
  if (typeof fetchActiveCompetitionsFromAPI === 'function') {
    try {
      const apiComps = await Promise.race([
        fetchActiveCompetitionsFromAPI(),
        new Promise(resolve => setTimeout(() => resolve(null), 2000))
      ]);
      if (apiComps && apiComps.length > 0) {
        comps = apiComps;
        renderGrid(comps);
      }
    } catch(e) { /* keep local data */ }
  }

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
