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

// ── Field-level error UI helpers ─────────────────────────────
function showFieldError(inputId, message) {
  const el = document.getElementById(inputId);
  if (!el) return;
  el.style.borderColor = '#ef4444';
  el.style.boxShadow = '0 0 0 1px rgba(239, 68, 68, 0.4)';

  const existingErr = document.getElementById(`err-${inputId}`);
  if (!existingErr) {
    const errEl = document.createElement('p');
    errEl.id = `err-${inputId}`;
    errEl.className = 'field-error-msg';
    errEl.style.cssText = 'color:#ef4444;font-size:12px;font-weight:600;margin-top:5px;display:flex;align-items:center;gap:4px;';
    errEl.innerHTML = `<span>⚠</span> <span>${message}</span>`;
    if (el.parentNode) el.parentNode.appendChild(errEl);
  } else {
    existingErr.innerHTML = `<span>⚠</span> <span>${message}</span>`;
  }
}

function clearFieldErrors() {
  document.querySelectorAll('.field-error-msg').forEach(el => el.remove());
  document.querySelectorAll('.form-input, .form-select, .form-textarea, .prize-input').forEach(el => {
    el.style.borderColor = '';
    el.style.boxShadow = '';
  });
}

// ── Date validation ──────────────────────────────────────────
/**
 * Validates all date fields. Returns an object of errors or null if valid.
 */
function validateDates(regOpen, regClose, startDate, endDate) {
  const errors = {};
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const toDate = (s) => s ? new Date(s + 'T00:00:00') : null;
  const rOpen = toDate(regOpen);
  const rClose = toDate(regClose);
  const sDate = toDate(startDate);
  const eDate = toDate(endDate);

  if (!regOpen) {
    errors['reg-open'] = 'Registration Open date is required.';
  } else if (rOpen < today) {
    errors['reg-open'] = 'Registration Open date cannot be in the past.';
  }

  if (!regClose) {
    errors['reg-close'] = 'Registration Close date is required.';
  } else if (rOpen && rClose && rClose <= rOpen) {
    errors['reg-close'] = 'Registration Closes must be strictly after Registration Opens.';
  }

  if (!startDate) {
    errors['start-date'] = 'Tournament Start Date is required.';
  } else if (rClose && sDate && sDate < rClose) {
    errors['start-date'] = 'Tournament Start Date must be on or after Registration Closes.';
  }

  if (!endDate) {
    errors['end-date'] = 'Tournament End Date is required.';
  } else if (sDate && eDate && eDate <= sDate) {
    errors['end-date'] = 'Tournament End Date must be strictly after Tournament Start Date.';
  }

  return Object.keys(errors).length > 0 ? errors : null;
}

// Real-time date input checks
['reg-open', 'reg-close', 'start-date', 'end-date'].forEach(id => {
  const el = document.getElementById(id);
  if (!el) return;
  el.addEventListener('change', () => {
    const regOpen = document.getElementById('reg-open').value;
    const regClose = document.getElementById('reg-close').value;
    const startDate = document.getElementById('start-date').value;
    const endDate = document.getElementById('end-date').value;

    const dateErrors = validateDates(regOpen, regClose, startDate, endDate);
    // Clear only date errors
    ['reg-open', 'reg-close', 'start-date', 'end-date'].forEach(dId => {
      const inputEl = document.getElementById(dId);
      if (inputEl) {
        inputEl.style.borderColor = '';
        inputEl.style.boxShadow = '';
      }
      const errEl = document.getElementById(`err-${dId}`);
      if (errEl) errEl.remove();
    });

    if (dateErrors && dateErrors[id]) {
      showFieldError(id, dateErrors[id]);
    }
    updateSummary();
  });
});

// Real-time general field input clear
['comp-name', 'comp-game', 'comp-format', 'comp-desc', 'max-teams', 'max-players', 'entry-fee', 'prize-1', 'prize-2', 'prize-3'].forEach(id => {
  const el = document.getElementById(id);
  if (!el) return;
  const clearFn = () => {
    el.style.borderColor = '';
    el.style.boxShadow = '';
    const errEl = document.getElementById(`err-${id}`);
    if (errEl) errEl.remove();
  };
  el.addEventListener('input', clearFn);
  el.addEventListener('change', clearFn);
});

// ── Misc helpers ─────────────────────────────────────────────
function toggleCheck(el) {
  el.classList.toggle('checked');
}

let userUploadedBanner = false;

function previewBanner(e) {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = ev => {
    const img = document.getElementById('banner-preview');
    if (img) {
      img.src = ev.target.result;
      img.style.display = 'block';
      userUploadedBanner = true;
    }
  };
  reader.readAsDataURL(file);
}

function updateDefaultBannerPreview() {
  if (userUploadedBanner) return;
  const gameSelect = document.getElementById('comp-game');
  const game = gameSelect ? gameSelect.value : 'Valorant';
  const img = document.getElementById('banner-preview');
  if (img) {
    img.src = getDefaultBanner(game);
    img.style.display = 'block';
  }
}

document.addEventListener('DOMContentLoaded', () => {
  const gameSelect = document.getElementById('comp-game');
  if (gameSelect) {
    gameSelect.addEventListener('change', updateDefaultBannerPreview);
    updateDefaultBannerPreview();
  }
});

// ── Form submit with Full Strict QA Validation ──────────────
const createCompForm = document.getElementById('create-comp-form');
if (createCompForm) {
  createCompForm.addEventListener('submit', function (e) {
    e.preventDefault();
    clearFieldErrors();
    
    const sessionRaw = localStorage.getItem('nexus.auth.session');
    let session = null;
    try { if (sessionRaw) session = JSON.parse(sessionRaw); } catch(e) {}
    if (!session) {
      if (typeof showToast === 'function') showToast('Session expired. Please login again.', 'error');
      return;
    }

    const nameEl       = document.getElementById('comp-name');
    const gameEl       = document.getElementById('comp-game');
    const formatEl     = document.getElementById('comp-format');
    const descEl       = document.getElementById('comp-desc');
    const regOpenEl    = document.getElementById('reg-open');
    const regCloseEl   = document.getElementById('reg-close');
    const startDateEl  = document.getElementById('start-date');
    const endDateEl    = document.getElementById('end-date');
    const maxTeamsEl   = document.getElementById('max-teams');
    const maxPlayersEl = document.getElementById('max-players');
    const entryFeeEl   = document.getElementById('entry-fee');

    const name        = (nameEl?.value || '').trim();
    const game        = gameEl?.value || '';
    const formatLabel = formatEl?.value || '';
    const description = (descEl?.value || '').trim();
    const regOpen     = regOpenEl?.value || '';
    const regClose    = regCloseEl?.value || '';
    const startDate   = startDateEl?.value || '';
    const endDate     = endDateEl?.value || '';
    const maxTeams    = parseInt(maxTeamsEl?.value);
    const maxPlayers  = parseInt(maxPlayersEl?.value);
    const entryFeeRaw = (entryFeeEl?.value || '').trim();
    const entryFee    = entryFeeRaw !== '' ? parseFloat(entryFeeRaw) : 0;

    const p1 = parseInt(document.getElementById('prize-1')?.value) || 0;
    const p2 = parseInt(document.getElementById('prize-2')?.value) || 0;
    const p3 = parseInt(document.getElementById('prize-3')?.value) || 0;
    const totalPrize = p1 + p2 + p3;

    // ── QA Rule 1: Competition Name ──
    let firstErrorField = null;

    if (!name) {
      showFieldError('comp-name', 'Please enter the valid name');
      if (!firstErrorField) firstErrorField = nameEl;
    } else if (name.length < 3) {
      showFieldError('comp-name', 'Please enter the valid name (at least 3 characters)');
      if (!firstErrorField) firstErrorField = nameEl;
    } else if (name.length > 100) {
      showFieldError('comp-name', 'Tournament name cannot exceed 100 characters.');
      if (!firstErrorField) firstErrorField = nameEl;
    }

    // ── QA Rule 2: Game Selection ──
    if (!game) {
      showFieldError('comp-game', 'Please select a game.');
      if (!firstErrorField) firstErrorField = gameEl;
    }

    // ── QA Rule 3: Format Selection ──
    if (!formatLabel) {
      showFieldError('comp-format', 'Please select a tournament format.');
      if (!firstErrorField) firstErrorField = formatEl;
    }

    // ── QA Rule 4: Description ──
    if (!description) {
      showFieldError('comp-desc', 'Tournament description is required.');
      if (!firstErrorField) firstErrorField = descEl;
    } else if (description.length < 10) {
      showFieldError('comp-desc', 'Description must be at least 10 characters long.');
      if (!firstErrorField) firstErrorField = descEl;
    }

    // ── QA Rule 5: Dates & Schedule Integrity ──
    const dateErrors = validateDates(regOpen, regClose, startDate, endDate);
    if (dateErrors) {
      Object.keys(dateErrors).forEach(fieldId => {
        showFieldError(fieldId, dateErrors[fieldId]);
        if (!firstErrorField) firstErrorField = document.getElementById(fieldId);
      });
    }

    // ── QA Rule 6: Max Teams ──
    if (isNaN(maxTeams) || maxTeams < 2) {
      showFieldError('max-teams', 'Max Teams must be at least 2 teams.');
      if (!firstErrorField) firstErrorField = maxTeamsEl;
    } else if (maxTeams > 256) {
      showFieldError('max-teams', 'Max Teams cannot exceed 256 teams.');
      if (!firstErrorField) firstErrorField = maxTeamsEl;
    }

    // ── QA Rule 7: Max Players per Team ──
    if (isNaN(maxPlayers) || maxPlayers < 1) {
      showFieldError('max-players', 'Max Players per Team must be at least 1 player.');
      if (!firstErrorField) firstErrorField = maxPlayersEl;
    } else if (maxPlayers > 20) {
      showFieldError('max-players', 'Max Players per Team cannot exceed 20 players.');
      if (!firstErrorField) firstErrorField = maxPlayersEl;
    }

    // ── QA Rule 8: Entry Fee (Optional, cannot be negative) ──
    if (entryFeeRaw !== '' && (isNaN(entryFee) || entryFee < 0)) {
      showFieldError('entry-fee', 'Entry fee cannot be negative.');
      if (!firstErrorField) firstErrorField = entryFeeEl;
    }

    // ── QA Rule 9: Prize Pool Distribution ──
    if (p1 < 0) showFieldError('prize-1', 'Prize cannot be negative.');
    if (p2 < 0) showFieldError('prize-2', 'Prize cannot be negative.');
    if (p3 < 0) showFieldError('prize-3', 'Prize cannot be negative.');
    if (p2 > 0 && p2 > p1) {
      showFieldError('prize-2', '1st place prize must be ≥ 2nd place prize.');
      if (!firstErrorField) firstErrorField = document.getElementById('prize-2');
    }
    if (p3 > 0 && p3 > p2 && p2 > 0) {
      showFieldError('prize-3', '2nd place prize must be ≥ 3rd place prize.');
      if (!firstErrorField) firstErrorField = document.getElementById('prize-3');
    }

    // ── QA Rule 10: Co-Organizers Validation ──
    const coOrganizers = [];
    const coInputs = document.querySelectorAll('.co-organizer-input');
    coInputs.forEach(input => {
      const val = input.value.trim().replace(/^@/, '');
      if (val) {
        if (val.toLowerCase() === (session.username || '').toLowerCase()) {
          input.style.borderColor = '#ef4444';
          if (typeof showToast === 'function') showToast(`You (@${session.username}) are already the primary creator/owner.`, 'error');
          if (!firstErrorField) firstErrorField = input;
        } else if (coOrganizers.map(s => s.toLowerCase()).includes(val.toLowerCase())) {
          input.style.borderColor = '#ef4444';
          if (typeof showToast === 'function') showToast(`Co-organizer @${val} is added multiple times.`, 'error');
          if (!firstErrorField) firstErrorField = input;
        } else {
          coOrganizers.push(val);
        }
      }
    });

    // ── If any validation failed, halt submission & scroll to first error ──
    if (firstErrorField) {
      firstErrorField.scrollIntoView({ behavior: 'smooth', block: 'center' });
      firstErrorField.focus();
      if (typeof showToast === 'function') {
        showToast('Please fix all highlighted errors to auto-approve tournament.', 'error');
      }
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
      entryFee: entryFee > 0 ? `₹${entryFee.toLocaleString('en-IN')}` : 'Free',
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

    // Save locally for offline/fast access
    if (window.NexusData) {
      window.NexusData.addCompetition(newComp);
    }

    // ── Wire to Backend API ──────────────────────────────────────
    // Call backend in background (don't block the UI on API success)
    (async () => {
      if (window.NexusAPI && window.NexusAPI.Competitions) {
        try {
          // startDate/endDate need ISO format for the backend
          const isoStart = startDate ? new Date(startDate).toISOString() : new Date().toISOString();
          const isoEnd = endDate ? new Date(endDate).toISOString() : new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString();

          const apiRes = await window.NexusAPI.Competitions.create(
            name,
            description,
            isoStart,
            isoEnd,
            coOrganizers
          );

          if (apiRes.ok && apiRes.data && apiRes.data.id) {
            const backendId = apiRes.data.id;
            // Store the backend-assigned ID alongside local ID for cross-reference
            newComp._backendId = backendId;
            if (window.NexusData) {
              window.NexusData.addCompetition(newComp); // update with backend ID
            }

            // Set revenue fee if prize pool or entry fee specified
            if ((totalPrize > 0 || entryFee > 0) && window.NexusAPI.Revenue) {
              await window.NexusAPI.Revenue.setCompetitionFee(backendId, entryFee, totalPrize).catch(() => {});
            }
            console.log('[NexusAPI] Competition created in backend:', backendId);
          } else {
            console.warn('[NexusAPI] Backend competition create failed:', apiRes.error);
          }
        } catch (err) {
          console.warn('[NexusAPI] Backend unreachable, saved locally only:', err.message);
        }
      }
    })();

    if (typeof showToast === 'function') {
      showToast('Tournament Created!');
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

// Global exposure for inline onclicks
window.addOrganizerInputRow = addOrganizerInputRow;
window.getDefaultBanner = getDefaultBanner;
window.updateSummary = updateSummary;
window.updatePrizeTotal = updatePrizeTotal;
window.toggleCheck = toggleCheck;
window.previewBanner = previewBanner;
