/* =============================================================
   NEXUS ESPORTS — comp-reports.js  (Page 3)
   Reports & Disputes: submit form + existing reports list
   ============================================================= */
(function () {
  'use strict';

  const params = new URLSearchParams(window.location.search);
  const compId = params.get('id');

  /* back button */
  const backBtn = document.getElementById('btn-back');
  if (backBtn) backBtn.href = `comp-info.html?id=${compId || ''}`;

  const comp  = window.NexusData?.getCompetitionById(compId) || {};

  /* ── PREFILL COMPETITION NAME ────────────────────────────── */
  function prefillCompetitionName() {
    const el = document.getElementById('report-match');
    if (!el) return;
    el.value = comp.name || 'Competition';
  }

  /* ── SUBMIT HANDLER ─────────────────────────────────────── */
  function initSubmit() {
    const btn = document.getElementById('btn-submit-report');
    if (!btn) return;

    btn.addEventListener('click', () => {
      const type  = document.getElementById('report-type').value;
      const desc  = document.getElementById('report-desc').value.trim();
      const usernameAgainst = document.getElementById('report-userid').value.trim();

      if (!type || !desc || !usernameAgainst) {
        showToast('Please fill in all mandatory fields (Type, Description, UserName).', 'error');
        return;
      }

      // Get reporter from session
      let reporterName = 'Guest User';
      try {
        const session = JSON.parse(localStorage.getItem('nexus.auth.session') || '{}');
        reporterName = session.displayName || session.username || 'Anonymous';
      } catch(e){}

      const compName = comp.name || 'Competition';
      const timestamp = new Date().toLocaleString('en-IN', { 
        month: 'short', day: 'numeric', year: 'numeric', 
        hour: '2-digit', minute: '2-digit', hour12: false 
      }) + ' IST';

      const newDispute = {
        id: 'DISP-' + Date.now(),
        cardId: 'disp-' + Date.now(),
        disputeId: '#DISP-' + (new Date().getFullYear()) + '-' + Math.floor(1000 + Math.random() * 9000),
        competition: compName,
        title: type.charAt(0).toUpperCase() + type.slice(1) + ' Dispute — ' + compName,
        description: desc,
        filedBy: reporterName,
        against: usernameAgainst,
        filedAt: timestamp,
        status: 'open',
        escalated: false,
        compId: compId,
        type: type,
        updatedAt: new Date().toISOString()
      };

      // Persist to central admin store
      try {
        const adminStoreKey = 'nexus_admin_disputes';
        const existing = JSON.parse(localStorage.getItem(adminStoreKey) || '[]');
        existing.unshift(newDispute);
        localStorage.setItem(adminStoreKey, JSON.stringify(existing));
      } catch(e) {
        console.error('Failed to save to admin store:', e);
      }

      showToast('Dispute submitted successfully. Redirecting...', 'success');
      setTimeout(() => {
        location.href = `comp-info.html?id=${compId || ''}`;
      }, 1500);
    });
  }

  /* ── INIT ───────────────────────────────────────────────── */
  prefillCompetitionName();
  initSubmit();

})();
