/* ============================================================
   NEXUS ESPORTS — Edit Competition JS
   Loads competition data by ?id=, populates form,
   saves changes back to NexusData, and handles delete.
   ============================================================ */

let editComp = null;
let currentCompId = null;

document.addEventListener('DOMContentLoaded', () => {
  const id = window.NexusData.getCompIdFromUrl();
  if (!id) { window.location.href = 'my-activity.html'; return; }
  currentCompId = id;

  editComp = window.NexusData.getCompetitionById(id);
  if (!editComp) {
    alert('Competition not found.');
    window.location.href = 'my-activity.html';
    return;
  }

  // Back button
  document.getElementById('btn-back-to-comp').href = `competition-detail.html?id=${id}`;

  populateForm(editComp);
  setupStatusPanel(editComp);
  setupEvents(id);
  setupBannerUpload();
});

/* ── Populate all form fields from competition data ── */
function populateForm(comp) {
  document.title = `NEXUS ESPORTS — Edit: ${comp.name}`;
  document.getElementById('edit-page-subtitle').textContent = comp.name;

  setVal('ef-name',       comp.name             || '');
  setVal('ef-description',comp.description      || '');
  setVal('ef-maxplayers', comp.maxPlayersPerTeam || '');
  setVal('ef-prize',      parsePrize(comp.prizePool));
  setVal('ef-maxteams',   comp.maxTeams          || '');
  setVal('ef-season',     comp.season            || '');

  setSelectVal('ef-game',   comp.game);
  setSelectVal('ef-type',   comp.type);
  setSelectVal('ef-format', comp.format);
  setSelectVal('ef-status', comp.status);

  // Populate Co-Organizers
  const coOrgsContainer = document.getElementById('edit-coorganizers-container');
  if (coOrgsContainer) {
    coOrgsContainer.innerHTML = '';
    const creator = comp.createdBy || comp.organizerId;
    const coOrgs = Array.isArray(comp.organizers)
      ? comp.organizers.filter(u => u !== creator)
      : [];

    if (coOrgs.length > 0) {
      coOrgs.forEach(org => addEditOrganizerRow(org));
    } else {
      addEditOrganizerRow(); // default 1 row
    }
  }

  // Parse dates from "Month DD–DD, YYYY" into ISO for date inputs
  if (comp.startDate) setVal('ef-startdate', comp.startDate);
  else if (comp.dates) {
    const parsed = parseDateRange(comp.dates);
    if (parsed.start) setVal('ef-startdate', parsed.start);
    if (parsed.end)   setVal('ef-enddate',   parsed.end);
  }
  if (comp.endDate) setVal('ef-enddate', comp.endDate);
  if (comp.regDeadline) setVal('ef-regdeadline', comp.regDeadline);
}

function addEditOrganizerRow(initialValue = '') {
  const container = document.getElementById('edit-coorganizers-container');
  if (!container) return;

  const rowId = 'edit-org-row-' + Math.random().toString(36).slice(2, 9);
  const row = document.createElement('div');
  row.id = rowId;
  row.className = 'edit-coorganizer-row';
  row.style.cssText = 'display:flex;gap:8px;align-items:center;animation:fadeIn 0.2s ease-in-out;';

  row.innerHTML = `
    <div style="position:relative;flex:1;">
      <span style="position:absolute;left:12px;top:50%;transform:translateY(-50%);color:var(--text-muted);font-size:13px;font-weight:700;">@</span>
      <input type="text" class="edit-input edit-coorganizer-input" placeholder="e.g. co_organizer_username or ID" value="${initialValue}" style="padding-left:28px;width:100%;" required>
    </div>
    <button type="button" class="btn-table-danger" onclick="document.getElementById('${rowId}').remove()" style="padding:10px 14px;font-size:13px;cursor:pointer;border-radius:6px;background:rgba(239,68,68,0.12);color:#ef4444;border:1px solid rgba(239,68,68,0.3);" title="Remove co-organizer">
      ✕
    </button>
  `;
  container.appendChild(row);
  const input = row.querySelector('input');
  if (input && !initialValue) input.focus();
}
window.addEditOrganizerRow = addEditOrganizerRow;

/* ── Status panel ── */
function setupStatusPanel(comp) {
  const dot   = document.getElementById('status-dot');
  const label = document.getElementById('status-label');
  const time  = document.getElementById('status-time');
  const fill  = document.getElementById('status-progress');
  const pLabel= document.getElementById('status-progress-label');

  const statusMap = {
    upcoming:  { label: 'Upcoming',  dot: 'dot-upcoming',  pct: 60 },
    ongoing:   { label: 'Ongoing',   dot: '',               pct: 85 },
    completed: { label: 'Completed', dot: 'dot-completed',  pct: 100 },
  };
  const s = statusMap[comp.status] || statusMap.upcoming;

  dot.className   = `edit-status-dot ${s.dot}`;
  label.textContent = s.label;
  time.textContent  = `Last updated: ${comp.createdDaysAgo != null ? comp.createdDaysAgo + 'd ago' : 'recently'}`;
  fill.style.width  = s.pct + '%';
  pLabel.textContent = `Profile completeness: ${s.pct}%`;
}

function openDeleteModal() {
  if (!editComp) return;
  const nameEl = document.getElementById('delete-comp-name');
  const modal = document.getElementById('delete-modal');
  if (nameEl) nameEl.textContent = editComp.name || 'this competition';
  if (modal) {
    modal.classList.add('active');
    modal.classList.add('open');
  }
}

function closeDeleteModal() {
  const modal = document.getElementById('delete-modal');
  if (modal) {
    modal.classList.remove('active');
    modal.classList.remove('open');
  }
}

function forceDeleteCompetitionById(id) {
  if (!id || !window.NexusData) return false;

  let deleted = false;

  if (typeof window.NexusData.deleteCompetition === 'function') {
    deleted = !!window.NexusData.deleteCompetition(id);
  }

  // Fallback in case deleteCompetition is unavailable or returns false.
  if (!deleted && typeof window.NexusData.loadCompetitions === 'function' && typeof window.NexusData.saveCompetitions === 'function') {
    const all = window.NexusData.loadCompetitions();
    if (Array.isArray(all)) {
      const filtered = all.filter(c => c.id !== id);
      if (filtered.length !== all.length) {
        window.NexusData.saveCompetitions(filtered);
        deleted = true;
      }
    }
  }

  // Ensure seed-merge does not bring back deleted IDs.
  if (deleted) {
    try {
      const key = 'nexus.deleted.competitionIds';
      const raw = localStorage.getItem(key);
      const parsed = raw ? JSON.parse(raw) : [];
      const ids = Array.isArray(parsed) ? parsed : [];
      if (!ids.includes(id)) ids.push(id);
      localStorage.setItem(key, JSON.stringify(ids));
    } catch (e) {}

    try {
      const ctxRaw = localStorage.getItem('nexus.team.activeContext');
      if (ctxRaw) {
        const ctx = JSON.parse(ctxRaw);
        if (ctx && ctx.compId === id) localStorage.removeItem('nexus.team.activeContext');
      }
    } catch (e) {}
  }

  return deleted;
}

function confirmDeleteCompetition() {
  const targetId = (editComp && editComp.id) || currentCompId || (window.NexusData && window.NexusData.getCompIdFromUrl && window.NexusData.getCompIdFromUrl());
  const deleted = forceDeleteCompetitionById(targetId);

  if (!deleted) {
    showEditToast('Unable to delete competition.', 'error');
    return;
  }

  closeDeleteModal();
  showEditToast('Competition deleted.', 'error');
  setTimeout(() => window.location.href = 'my-activity.html', 1200);
}

/* ── Wire all buttons ── */
function setupEvents(id) {
  // Save (top + side)
  ['btn-save-top', 'btn-save-main'].forEach(btnId => {
    const btn = document.getElementById(btnId);
    if (btn) btn.addEventListener('click', () => saveChanges(id));
  });

  // Discard
  ['btn-discard', 'btn-discard-2'].forEach(btnId => {
    const btn = document.getElementById(btnId);
    if (btn) btn.addEventListener('click', () => {
      window.location.href = `competition-detail.html?id=${id}`;
    });
  });

  // Delete
  const deleteBtn = document.getElementById('btn-delete-comp');
  if (deleteBtn) deleteBtn.addEventListener('click', openDeleteModal);

  const confirmBtn = document.getElementById('btn-confirm-delete');
  if (confirmBtn) confirmBtn.addEventListener('click', confirmDeleteCompetition);

  // Update status dot live when dropdown changes
  document.getElementById('ef-status').addEventListener('change', e => {
    setupStatusPanel({ ...editComp, status: e.target.value, createdDaysAgo: editComp.createdDaysAgo });
  });
}

window.openDeleteModal = openDeleteModal;
window.confirmDeleteCompetition = confirmDeleteCompetition;

/* ── End Competition Modal ── */
function openEndModal() {
  if (!editComp) return;
  if (editComp.ended || editComp.status === 'completed') {
    showEditToast('This competition has already been ended.', 'error');
    return;
  }
  const nameEl = document.getElementById('end-comp-name');
  const modal  = document.getElementById('end-comp-modal');
  if (nameEl) nameEl.textContent = editComp.name || 'this competition';
  if (modal)  { modal.classList.add('active'); modal.classList.add('open'); }
}
window.openEndModal = openEndModal;

function closeEndModal() {
  const modal = document.getElementById('end-comp-modal');
  if (modal) { modal.classList.remove('active'); modal.classList.remove('open'); }
}
window.closeEndModal = closeEndModal;

function confirmEndCompetition() {
  if (!editComp || !currentCompId) return;

  // Mark as ended
  const ended = Object.assign({}, editComp, {
    status:  'completed',
    ended:   true,
    endedAt: new Date().toISOString()
  });

  window.NexusData.updateCompetition(ended);
  editComp = ended;

  closeEndModal();
  setupStatusPanel(ended);

  // Lock the edit UI — organiser can only view
  lockEditUI();

  showEditToast('Competition ended. All actions are now locked.', 'success');
}
window.confirmEndCompetition = confirmEndCompetition;

function lockEditUI() {
  // Disable all form inputs and buttons except back / view
  const toDisable = document.querySelectorAll(
    '#ef-name,#ef-description,#ef-maxplayers,#ef-prize,#ef-maxteams,#ef-season,' +
    '#ef-game,#ef-type,#ef-format,#ef-status,#ef-startdate,#ef-enddate,#ef-regdeadline,' +
    '#btn-save-top,#btn-save-main,#btn-discard,#btn-discard-2,' +
    '#btn-end-comp,#btn-delete-comp,#banner-upload,#btn-remove-banner'
  );
  toDisable.forEach(el => {
    el.disabled = true;
    el.style.opacity = '0.4';
    el.style.cursor  = 'not-allowed';
    el.style.pointerEvents = 'none';
  });

  // Show ended banner
  const banner = document.createElement('div');
  banner.style.cssText = 'background:rgba(251,146,60,0.12);border:1px solid rgba(251,146,60,0.35);color:#fb923c;padding:12px 16px;border-radius:10px;font-size:13px;font-weight:700;text-align:center;margin-bottom:16px;letter-spacing:0.5px;';
  banner.textContent = '🏁 This competition has ended. All editing and actions are locked.';
  const header = document.querySelector('.edit-page-header');
  if (header) header.insertAdjacentElement('afterend', banner);
}

/* ── On load: lock if already ended ── */
document.addEventListener('DOMContentLoaded', () => {
  // re-check after competition loads (runs after the main DOMContentLoaded above)
  setTimeout(() => {
    if (editComp && (editComp.ended || editComp.status === 'completed')) {
      lockEditUI();
    }
  }, 100);
});

/* ── Save ── */
function saveChanges(id) {
  const name = document.getElementById('ef-name').value.trim();
  if (!name) { showEditToast('Competition name is required.', 'error'); return; }

  const startDate = document.getElementById('ef-startdate').value;
  const endDate   = document.getElementById('ef-enddate').value;
  if (startDate && endDate && startDate > endDate) {
    showEditToast('End date must be after start date.', 'error');
    return;
  }

  const prizeRaw  = document.getElementById('ef-prize').value.trim();
  const prizePool = prizeRaw ? (prizeRaw.startsWith('₹') ? prizeRaw : `₹${prizeRaw}`) : editComp.prizePool;

  // Build date display string
  let dates = editComp.dates;
  if (startDate || endDate) {
    dates = formatDateDisplay(startDate, endDate) || dates;
  }

  // Collect dynamic co-organizers
  const coOrganizers = Array.from(document.querySelectorAll('.edit-coorganizer-input'))
    .map(input => input.value.trim().replace(/^@/, ''))
    .filter(Boolean);

  const creator = editComp.createdBy || editComp.organizerId || 'organizer';
  const organizersList = Array.from(new Set([creator, ...coOrganizers]));

  const updated = {
    ...editComp,
    name,
    game:              document.getElementById('ef-game').value    || editComp.game,
    type:              document.getElementById('ef-type').value    || editComp.type,
    format:            document.getElementById('ef-format').value  || editComp.format,
    status:            document.getElementById('ef-status').value  || editComp.status,
    description:       document.getElementById('ef-description').value.trim(),
    maxPlayersPerTeam: parseInt(document.getElementById('ef-maxplayers').value) || editComp.maxPlayersPerTeam,
    prizePool,
    maxTeams:          parseInt(document.getElementById('ef-maxteams').value)   || editComp.maxTeams,
    season:            document.getElementById('ef-season').value.trim()        || editComp.season,
    dates,
    startDate:         startDate   || editComp.startDate,
    endDate:           endDate     || editComp.endDate,
    regDeadline:       document.getElementById('ef-regdeadline').value || editComp.regDeadline,
    organizers:        organizersList
  };

  window.NexusData.updateCompetition(updated);
  editComp = updated;

  // Refresh subtitle + status panel
  document.getElementById('edit-page-subtitle').textContent = updated.name;
  setupStatusPanel(updated);

  showEditToast('Changes saved successfully!', 'success');
}

/* ── Banner upload ── */
function setupBannerUpload() {
  const input   = document.getElementById('banner-upload');
  const preview = document.getElementById('edit-banner-preview');
  const removBtn= document.getElementById('btn-remove-banner');

  input.addEventListener('change', e => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      showEditToast('File too large. Max 5MB.', 'error');
      return;
    }
    const reader = new FileReader();
    reader.onload = ev => {
      preview.innerHTML = `<img src="${ev.target.result}" alt="Banner preview" style="width:100%;height:180px;object-fit:cover;display:block;border-radius:10px">`;
      showEditToast('Banner updated (preview only).', 'success');
    };
    reader.readAsDataURL(file);
  });

  removBtn.addEventListener('click', () => {
    preview.innerHTML = `
      <div class="edit-banner-placeholder">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#2a3a4a" stroke-width="1.5" stroke-linecap="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
        <p>No banner uploaded</p>
        <span>Recommended: 1920×1080px · Max 5MB (JPG, PNG)</span>
      </div>`;
    input.value = '';
  });
}

/* ── Helpers ── */
function setVal(id, val) {
  const el = document.getElementById(id);
  if (el) el.value = val;
}

function setSelectVal(id, val) {
  const el = document.getElementById(id);
  if (!el) return;
  for (let i = 0; i < el.options.length; i++) {
    if (el.options[i].value.toLowerCase() === (val || '').toLowerCase() ||
        el.options[i].text.toLowerCase()  === (val || '').toLowerCase()) {
      el.selectedIndex = i;
      break;
    }
  }
}

function parsePrize(str) {
  if (!str) return '';
  return String(str).replace(/[₹,\s]/g, '');
}

function parseDateRange(str) {
  // Very lightweight: tries to detect a year and return rough ISO dates
  if (!str) return {};
  const year = (str.match(/\d{4}/) || [])[0];
  if (!year) return {};
  return { start: '', end: '' }; // Return empty — date inputs already handle this
}

function formatDateDisplay(start, end) {
  if (!start) return '';
  const s = new Date(start);
  const e = end ? new Date(end) : null;
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  if (!e) return `${months[s.getMonth()]} ${s.getDate()}, ${s.getFullYear()}`;
  if (s.getMonth() === e.getMonth() && s.getFullYear() === e.getFullYear()) {
    return `${months[s.getMonth()]} ${s.getDate()}–${e.getDate()}, ${s.getFullYear()}`;
  }
  return `${months[s.getMonth()]} ${s.getDate()} – ${months[e.getMonth()]} ${e.getDate()}, ${s.getFullYear()}`;
}

function showEditToast(msg, type = 'success') {
  const existing = document.getElementById('__edit_toast');
  if (existing) existing.remove();

  const toast = document.createElement('div');
  toast.id = '__edit_toast';
  toast.textContent = msg;
  toast.style.cssText = `
    position:fixed; bottom:24px; right:24px; z-index:9999;
    background:${type === 'success' ? '#c6ff33' : '#ef4444'};
    color:${type === 'success' ? '#000' : '#fff'};
    font-family:'Lato',sans-serif; font-weight:700;
    padding:12px 24px; border-radius:8px;
    box-shadow:0 8px 24px rgba(0,0,0,0.4);
    font-size:14px; letter-spacing:0.3px;
    transform:translateY(20px); opacity:0;
    transition:all 0.3s;
  `;
  document.body.appendChild(toast);
  requestAnimationFrame(() => { toast.style.transform = 'translateY(0)'; toast.style.opacity = '1'; });
  setTimeout(() => {
    toast.style.transform = 'translateY(20px)';
    toast.style.opacity = '0';
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}
