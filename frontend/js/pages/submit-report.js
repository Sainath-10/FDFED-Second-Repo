initSidebar('activity', '../');
initFooter('../');

// Block reports on ended competitions
(function checkReportCompEnded() {
  const compId = new URLSearchParams(window.location.search).get('compId');
  if (!compId || !window.NexusData) return;
  const comp = window.NexusData.getCompetitionById(compId);
  if (comp && window.NexusData.isCompEnded && window.NexusData.isCompEnded(comp)) {
    window.NexusData.enforceNotEnded(comp, '#report-form button[type="submit"],.btn-primary,.btn-submit');
    document.querySelectorAll('input,select,textarea').forEach(el => {
      el.disabled = true; el.style.opacity = '0.4';
    });
  }
})();

const reportForm = document.getElementById('report-form');
if (reportForm) {
  reportForm.addEventListener('submit', e => {
    e.preventDefault();
    const evidenceInput = document.getElementById('evidence-files');
    const files = evidenceInput && evidenceInput.files ? Array.from(evidenceInput.files) : [];
    const disputeId = 'DISP-' + Date.now().toString().slice(-8);

    const reportType = document.querySelector('#report-form select.form-select')?.value || 'Match Result Dispute';
    const compSelect = document.querySelectorAll('#report-form select.form-select')[1]?.value || 'Competition';
    const matchRound = document.querySelector('#report-form input[placeholder*="Match"]')?.value || 'Match';
    const against = document.querySelector('#report-form input[placeholder*="Team"]')?.value || 'Opponent';
    const description = document.querySelector('#report-form textarea')?.value || '';

    // Get current user session
    let reporter = 'Player';
    try {
      const sess = JSON.parse(localStorage.getItem('nexus.auth.session') || '{}');
      if (sess.username) reporter = sess.username;
    } catch(e) {}

    // Find competition if available
    let compId = new URLSearchParams(window.location.search).get('compId');
    let comp = compId && window.NexusData ? window.NexusData.getCompetitionById(compId) : null;
    if (!comp && window.NexusData) {
      const all = window.NexusData.loadCompetitions();
      comp = all.find(c => c.name.toLowerCase().includes(compSelect.toLowerCase())) || all[0];
      if (comp) compId = comp.id;
    }

    const organizers = comp && Array.isArray(comp.organizers) && comp.organizers.length > 0
      ? comp.organizers
      : (comp && comp.createdBy ? [comp.createdBy] : ['organizer']);

    const newDisputeObj = {
      id: disputeId,
      title: `${reportType} — ${against}`,
      desc: description,
      detail: description,
      reason: reportType,
      round: matchRound,
      submitter: reporter,
      reporter: reporter,
      organizers: organizers,
      time: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
      matchName: comp ? comp.name : compSelect,
      competitionId: compId || '1',
      status: 'awaiting',
      evidence: files.length
    };

    // Store evidence metadata in localStorage for the disputes page
    const evidence = files.map(f => ({
      name: f.name,
      size: f.size,
      type: f.type,
      isImage: f.type.startsWith('image/'),
      dataUrl: null // populated below if image
    }));

    // Read image files as data URLs for preview
    const imagePromises = evidence.map((ev, i) => {
      if (!ev.isImage) return Promise.resolve();
      return new Promise(resolve => {
        const reader = new FileReader();
        reader.onload = e => { evidence[i].dataUrl = e.target.result; resolve(); };
        reader.readAsDataURL(files[i]);
      });
    });

    Promise.all(imagePromises).then(() => {
      try {
        const existing = JSON.parse(localStorage.getItem('nexus.disputes.evidence') || '{}');
        existing[disputeId] = { files: evidence, submittedAt: new Date().toISOString() };
        localStorage.setItem('nexus.disputes.evidence', JSON.stringify(existing));

        // Add to competition disputes array
        if (comp && window.NexusData) {
          if (!Array.isArray(comp.disputes)) comp.disputes = [];
          comp.disputes.unshift(newDisputeObj);
          window.NexusData.updateCompetition(comp);
        }

        // Add to general disputes store
        const adminDisputes = JSON.parse(localStorage.getItem('nexus_admin_disputes') || '[]');
        adminDisputes.unshift(newDisputeObj);
        localStorage.setItem('nexus_admin_disputes', JSON.stringify(adminDisputes));
      } catch (err) {}

      // Try sending to backend API in background
      try {
        fetch('http://localhost:3000/disputes', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-user-role': 'participant'
          },
          body: JSON.stringify({
            competitionId: compId || '1',
            teamId: against || 'team-1',
            description: `${reportType} (${matchRound}): ${description}`
          })
        }).catch(() => {});
      } catch(e) {}

      if (typeof showToast === 'function') {
        showToast('Report submitted! Sent directly to tournament organizers for review.');
      }
      setTimeout(() => { location.href = 'my-activity.html'; }, 1500);
    });
  });
}

function showFiles(input) {
  const list = document.getElementById('file-list');
  if (!list) return;
  list.innerHTML = '';

  if (!input.files || !input.files.length) return;

  Array.from(input.files).forEach(f => {
    const isImage = f.type.startsWith('image/');
    const el = document.createElement('div');
    el.className = 'file-item';
    el.style.cssText = 'display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid rgba(255,255,255,0.06);';

    if (isImage) {
      // Show a real image thumbnail
      const reader = new FileReader();
      reader.onload = ev => {
        el.innerHTML = `
          <img src="${ev.target.result}" alt="${f.name}" style="width:48px;height:36px;object-fit:cover;border-radius:4px;flex-shrink:0;">
          <div style="flex:1;min-width:0;">
            <div style="font-size:13px;color:var(--text-white);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${f.name}</div>
            <div style="font-size:11px;color:var(--text-muted);">${(f.size / 1024).toFixed(0)} KB · Image</div>
          </div>`;
      };
      reader.readAsDataURL(f);
    } else {
      // Non-image: show icon + filename + size
      const ext = f.name.split('.').pop().toUpperCase();
      el.innerHTML = `
        <div style="width:48px;height:36px;background:rgba(198,255,51,0.08);border-radius:4px;display:flex;align-items:center;justify-content:center;font-size:11px;color:var(--accent);font-weight:700;flex-shrink:0;">${ext}</div>
        <div style="flex:1;min-width:0;">
          <div style="font-size:13px;color:var(--text-white);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${f.name}</div>
          <div style="font-size:11px;color:var(--text-muted);">${(f.size / 1024).toFixed(0)} KB</div>
        </div>`;
    }

    list.appendChild(el);
  });
}

// Global exposure
window.showFiles = showFiles;
