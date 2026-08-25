initAdminSidebar('competitions');
initFooter('../../');

const urlParams = new URLSearchParams(window.location.search);
const compId = urlParams.get('id') || 'sum-champ-2026';
let currentComp = null;

function loadCompData() {
  if (!window.NexusData) return;
  const comp = window.NexusData.loadCompetitionById(compId);
  if (!comp) return;
  currentComp = comp;

  // Populate basic info
  document.getElementById('edit-name').value = comp.name || '';
  document.getElementById('edit-game').value = comp.game || 'League of Legends';
  document.getElementById('edit-desc').value = comp.description || '';
  
  // Format select
  const formatSelect = document.getElementById('edit-format');
  const formatLabel = comp.type === 'league' ? 'Round Robin' : 'Single Elimination';
  for (let opt of formatSelect.options) {
    if (opt.text === formatLabel) {
      opt.selected = true;
      break;
    }
  }

  // Banner
  if (comp.img) {
    document.getElementById('banner-preview').src = comp.img;
  }

  // Dates & Capacity
  if (comp.registrationDates) {
    document.getElementById('edit-reg-deadline').value = comp.registrationDates.close || '';
  }
  
  // Parse date strings (expecting YYYY-MM-DD)
  if (comp.dates) {
    const parts = comp.dates.split(' to ');
    if (parts.length === 2) {
      document.getElementById('edit-start-date').value = parts[0];
      document.getElementById('edit-end-date').value = parts[1];
    }
  }

  document.getElementById('edit-max-teams').value = comp.maxTeams || 16;
  document.getElementById('edit-max-players').value = comp.maxPlayersPerTeam || 5;
  document.getElementById('edit-prize-pool').value = (comp.prizePool || '').replace('₹', '').replace(/,/g, '');

  // Update header subtitle
  const subtitle = document.querySelector('.admin-subtitle-accent');
  if (subtitle) subtitle.textContent = comp.name;
}

const editForm = document.getElementById('edit-form');
if (editForm) {
  editForm.addEventListener('submit', e => {
    e.preventDefault();
    if (!currentComp || !window.NexusData) return;

    const updated = {
      ...currentComp,
      name: document.getElementById('edit-name').value.trim(),
      game: document.getElementById('edit-game').value,
      description: document.getElementById('edit-desc').value.trim(),
      img: document.getElementById('banner-preview').src,
      maxTeams: parseInt(document.getElementById('edit-max-teams').value),
      maxPlayersPerTeam: parseInt(document.getElementById('edit-max-players').value),
      prizePool: '₹' + parseInt(document.getElementById('edit-prize-pool').value || 0).toLocaleString('en-IN'),
      dates: document.getElementById('edit-start-date').value + ' to ' + document.getElementById('edit-end-date').value,
      registrationDates: {
        ...currentComp.registrationDates,
        close: document.getElementById('edit-reg-deadline').value
      }
    };

    window.NexusData.updateCompetition(updated);

    if (typeof showToast === 'function') {
      showToast('Competition changes saved successfully!');
    }
    setTimeout(() => {
      window.location.href = 'competition-detail.html?id=' + encodeURIComponent(compId);
    }, 1200);
  });
}

function previewBanner(e) {
  const f = e.target.files[0];
  if (!f) return;
  const r = new FileReader();
  r.onload = ev => {
    const preview = document.getElementById('banner-preview');
    if (preview) {
      preview.src = ev.target.result;
    }
  };
  r.readAsDataURL(f);
}

// Global exposure
window.previewBanner = previewBanner;

// Init
document.addEventListener('DOMContentLoaded', loadCompData);

