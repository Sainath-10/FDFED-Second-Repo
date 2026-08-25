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

    // Store evidence metadata in localStorage for the disputes page
    const disputeId = 'DISP-' + Date.now().toString().slice(-8);
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
      } catch (err) {}

      if (typeof showToast === 'function') {
        showToast('Report submitted successfully! Admins will review within 24–48 hours.');
      }
      setTimeout(() => { location.href = 'my-activity.html'; }, 1600);
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
