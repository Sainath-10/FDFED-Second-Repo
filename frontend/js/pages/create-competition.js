initSidebar('competitions', '../');
initFooter('../');

// ── Summary sidebar updater ──────────────────────────────────
function updateSummary() {
  const name    = document.getElementById('comp-name').value.trim() || '—';
  const game    = document.getElementById('comp-game').value || '—';
  const format  = document.getElementById('comp-format').value || '—';
  const teams   = document.getElementById('max-teams').value || '—';
  const players = document.getElementById('max-players').value || '—';
  const reg     = document.getElementById('reg-open').value || '—';
  
  const sName   = document.getElementById('s-name');
  const sGame   = document.getElementById('s-game');
  const sFormat = document.getElementById('s-format');
  const sTeams  = document.getElementById('s-teams');
  const sReg    = document.getElementById('s-reg');

  if (sName) sName.textContent = name;
  if (sGame) sGame.textContent = game;
  if (sFormat) sFormat.textContent = format;
  if (sTeams) sTeams.textContent = `${teams} Teams / ${players} Players`;
  if (sReg) sReg.textContent = reg;
}

// ── Prize total auto-calculation ─────────────────────────────
function updatePrizeTotal() {
  const p1 = parseInt(document.getElementById('prize-1').value) || 0;
  const p2 = parseInt(document.getElementById('prize-2').value) || 0;
  const p3 = parseInt(document.getElementById('prize-3').value) || 0;
  const total = p1 + p2 + p3;

  const display = document.getElementById('prize-total-display');
  if (display) display.textContent = `₹${total.toLocaleString('en-IN')}`;

  // Clear error once user has prizes set
  const errEl = document.getElementById('prize-total-error');
  if (errEl) errEl.style.display = total > 0 ? 'none' : errEl.style.display;

  // Also update summary
  updateSummary();
}

// ── Date validation ──────────────────────────────────────────
/**
 * Validates all date fields. Returns an error message string or null if valid.
 *
 * Rules:
 *  - reg-open  > today
 *  - reg-open  < reg-close
 *  - start-date >= reg-close
 *  - start-date < end-date
 */
function validateDates(regOpen, regClose, startDate, endDate) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const toDate = (s) => s ? new Date(s) : null;
  const rOpen = toDate(regOpen);
  const rClose = toDate(regClose);
  const sDate = toDate(startDate);
  const eDate = toDate(endDate);

  if (rOpen && rOpen <= today) {
    return 'Registration Open date must be in the future (after today).';
  }
  if (rOpen && rClose && rOpen >= rClose) {
    return 'Registration Opens must be before Registration Closes.';
  }
  if (sDate && rClose && sDate < rClose) {
    return 'Event Start Date must be on or after Registration Closes.';
  }
  if (sDate && eDate && sDate >= eDate) {
    return 'Event Start Date must be before Event End Date.';
  }
  return null;
}

// Wire up date inputs to show inline errors as user types
['reg-open', 'reg-close', 'start-date', 'end-date'].forEach(id => {
  const el = document.getElementById(id);
  if (!el) return;
  el.addEventListener('change', () => {
    const regOpen = document.getElementById('reg-open').value;
    const regClose = document.getElementById('reg-close').value;
    const startDate = document.getElementById('start-date').value;
    const endDate = document.getElementById('end-date').value;

    const err = validateDates(regOpen, regClose, startDate, endDate);

    // Highlight date inputs
    clearDateErrors();
    if (err) showDateError(id, err);

    updateSummary();
  });
});

function clearDateErrors() {
  ['reg-open', 'reg-close', 'start-date', 'end-date'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.style.borderColor = '';
    const errEl = document.getElementById(`err-${id}`);
    if (errEl) errEl.remove();
  });
}

function showDateError(inputId, message) {
  const el = document.getElementById(inputId);
  if (!el) return;
  el.style.borderColor = '#f87171';
  // Insert small error message below input if not already there
  const existingErr = document.getElementById(`err-${inputId}`);
  if (!existingErr) {
    const errEl = document.createElement('p');
    errEl.id = `err-${inputId}`;
    errEl.style.cssText = 'color:#f87171;font-size:11px;margin-top:4px;';
    errEl.textContent = `⚠ ${message}`;
    el.parentNode.insertBefore(errEl, el.nextSibling);
  }
}

// ── Misc helpers ─────────────────────────────────────────────
function toggleCheck(el) {
  el.classList.toggle('checked');
}

function previewBanner(e) {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = ev => {
    const img = document.getElementById('banner-preview');
    if (img) {
      img.src = ev.target.result;
      img.style.display = 'block';
    }
  };
  reader.readAsDataURL(file);
}

// ── Form submit ──────────────────────────────────────────────
const createCompForm = document.getElementById('create-comp-form');
if (createCompForm) {
  createCompForm.addEventListener('submit', function (e) {
    e.preventDefault();
    
    const sessionRaw = localStorage.getItem('nexus.auth.session');
    let session = null;
    try { if (sessionRaw) session = JSON.parse(sessionRaw); } catch(e) {}
    if (!session) {
      if (typeof showToast === 'function') showToast('Session expired. Please login again.', 'error');
      return;
    }

    const name = document.getElementById('comp-name').value.trim();
    const game = document.getElementById('comp-game').value;
    const formatLabel = document.getElementById('comp-format').value;
    const description = document.getElementById('comp-desc').value.trim();
    const regOpen      = document.getElementById('reg-open').value;
    const regClose     = document.getElementById('reg-close').value;
    const startDate    = document.getElementById('start-date').value;
    const endDate      = document.getElementById('end-date').value;
    const maxTeams    = document.getElementById('max-teams').value;
    const maxPlayers  = document.getElementById('max-players').value;
    const entryFee    = document.getElementById('entry-fee').value;

    const p1 = parseInt(document.getElementById('prize-1').value) || 0;
    const p2 = parseInt(document.getElementById('prize-2').value) || 0;
    const p3 = parseInt(document.getElementById('prize-3').value) || 0;
    const totalPrize = p1 + p2 + p3;

    // Collect all dynamic co-organizer inputs
    const coOrganizers = Array.from(document.querySelectorAll('.co-organizer-input'))
      .map(input => input.value.trim().replace(/^@/, ''))
      .filter(Boolean);

    // ── Validation: Basic fields ──
    if (!name || !game || !formatLabel) {
      if (typeof showToast === 'function') showToast('Please fill in all basic information!', 'error');
      return;
    }

    // ── Validation: Dates ──
    clearDateErrors();
    const dateErr = validateDates(regOpen, regClose, startDate, endDate);
    if (dateErr) {
      if (typeof showToast === 'function') showToast(dateErr, 'error');
      return;
    }

    // Map format label to internal type
    const type = formatLabel.toLowerCase().includes('robin') ? 'league' : 'tournament';

    // Get banner (if any)
    const bannerPreview = document.getElementById('banner-preview');
    const bannerImg = bannerPreview && bannerPreview.src && !bannerPreview.src.includes('window.location')
      ? bannerPreview.src
      : getDefaultBanner(game);

    const prizePoolStr = `₹${totalPrize.toLocaleString('en-IN')}`;

    // Combine primary creator and co-organizers without duplicates
    const organizersList = Array.from(new Set([session.username, ...coOrganizers]));

    const newComp = {
      id: window.NexusData.generateId(name),
      name: name,
      game: game,
      type: type,
      description: description,
      dates: startDate ? `${startDate} to ${endDate}` : 'TBD',
      registrationDates: {
        open: regOpen,
        close: regClose
      },
      maxTeams: parseInt(maxTeams) || 16,
      maxPlayersPerTeam: parseInt(maxPlayers) || 5,
      prizePool: totalPrize > 0 ? prizePoolStr : 'No Prize Pool',
      prize: totalPrize,
      prizes: [
        { place: '1st Place', amount: `₹${p1.toLocaleString('en-IN')}` },
        { place: '2nd Place', amount: `₹${p2.toLocaleString('en-IN')}` },
        { place: '3rd Place', amount: `₹${p3.toLocaleString('en-IN')}` },
      ],
      entryFee: entryFee ? `₹${entryFee}` : 'Free',
      status: 'upcoming',
      img: bannerImg,
      participants: 0,
      teams: [],
      matches: [],
      standings: [],
      disputes: [],
      organizerId: session.username,
      createdBy: session.username,
      organizers: organizersList,
      approvalStatus: 'approved', // Auto-approved immediately
      badge: 'New',
      badgeClass: 'hot',
      season: 'Season 1',
      totalMatches: 0,
      matchesCompleted: 0
    };

    if (window.NexusData) {
      window.NexusData.addCompetition(newComp);
    }

    if (typeof showToast === 'function') {
      showToast(`Tournament "${name}" created with ${organizersList.length} organizer(s) (Live)!`);
    }
    setTimeout(() => window.location.href = 'my-activity.html', 1200);
  });
}

function getDefaultBanner(gameName) {
  const g = String(gameName || '').toLowerCase();
  if (g.includes('valorant')) {
    return '../assets/8764f3a5ce7a0eb0275743600c60fb0c727893c8.png';
  }
  if (g.includes('counter-strike') || g.includes('cs2') || g.includes('cs:go') || g.includes('csgo')) {
    return '../assets/c4f97eccde97e10ac89b61ec5fb36fdce0ab2477.png';
  }
  if (g.includes('league of legends') || g.includes('lol')) {
    return '../assets/95bc0921c86340a2cee9e0a2d7ecd20b15a26143.png';
  }
  if (g.includes('apex')) {
    return '../assets/f03e2b11537e425d8544ee3ca732bf73af5137c0.png';
  }
  return '../assets/b890c61489a080992ad7e99adabb1145e6d59606.png';
}

// ── Co-Organizer Dynamic Inputs ─────────────────────────────
function addOrganizerInputRow(initialValue = '', shouldFocus = false) {
  const container = document.getElementById('co-organizers-container');
  if (!container) return;

  const rowId = 'org-row-' + Math.random().toString(36).slice(2, 9);
  const row = document.createElement('div');
  row.id = rowId;
  row.className = 'co-organizer-row';
  row.style.cssText = 'display:flex;gap:8px;align-items:center;';

  row.innerHTML = `
    <div style="position:relative;flex:1;">
      <span style="position:absolute;left:12px;top:50%;transform:translateY(-50%);color:var(--text-muted);font-size:13px;font-weight:700;">@</span>
      <input type="text" class="form-input co-organizer-input" placeholder="e.g. co_organizer_username or ID" value="${initialValue}" style="padding-left:28px;width:100%;">
    </div>
    <button type="button" class="btn-table-danger" onclick="document.getElementById('${rowId}').remove()" style="padding:10px 14px;font-size:13px;cursor:pointer;border-radius:6px;background:rgba(239,68,68,0.12);color:#ef4444;border:1px solid rgba(239,68,68,0.3);" title="Remove co-organizer">
      ✕
    </button>
  `;
  container.appendChild(row);
  if (shouldFocus) {
    const input = row.querySelector('input');
    if (input) input.focus();
  }
}

document.addEventListener('DOMContentLoaded', () => {
  // Spawn 1 empty co-organizer row by default without auto-focusing
  const container = document.getElementById('co-organizers-container');
  if (container && container.children.length === 0) {
    addOrganizerInputRow('', false);
  }
});

// Global exposure for inline onclicks
window.addOrganizerInputRow = addOrganizerInputRow;
window.getDefaultBanner = getDefaultBanner;
window.updateSummary = updateSummary;
window.updatePrizeTotal = updatePrizeTotal;
window.toggleCheck = toggleCheck;
window.previewBanner = previewBanner;
