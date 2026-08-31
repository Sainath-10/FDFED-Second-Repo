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

      // Get reporter from session & check if organizer
      let reporterName = 'Guest User';
      let userRole = 'participant';
      let isOrg = false;
      try {
        const session = JSON.parse(localStorage.getItem('nexus.auth.session') || '{}');
        reporterName = session.displayName || session.username || 'Anonymous';
        userRole = String(session.role || '').toLowerCase();
        if (userRole === 'organizer' || userRole === 'admin' || userRole === 'super-admin' || (comp && comp.createdBy === session.username)) {
          isOrg = true;
        }
      } catch(e){}

      const compName = comp.name || 'Competition';
      const normalizedAgainst = usernameAgainst.toLowerCase();
      const isTeamTarget = Array.isArray(comp.teams) && comp.teams.some(team => {
        const teamName = String(team.name || '').toLowerCase();
        const teamId = String(team.id || '').toLowerCase();
        return teamName === normalizedAgainst || teamId === normalizedAgainst;
      });
      const targetType = isTeamTarget ? 'opponent_team' : 'player';
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
        reason: type.charAt(0).toUpperCase() + type.slice(1),
        description: desc,
        reportedBy: reporterName,
        filedBy: reporterName,
        against: usernameAgainst,
        targetType,
        targetUserOrTeam: usernameAgainst,
        filedAt: timestamp,
        createdAt: new Date().toISOString(),
        status: isTeamTarget ? 'open_organizer' : (isOrg ? 'escalated_to_admin' : 'open_organizer'),
        escalated: !isTeamTarget && isOrg,
        superAdminState: !isTeamTarget && isOrg ? 'pending' : '',
        escalationReason: '',
        organizerWarnings: 0,
        compId: compId,
        competitionId: compId,
        type: type,
        updatedAt: new Date().toISOString()
      };

      // Persist to the shared dispute store used by organizer/admin review pages.
      try {
        if (window.NexusData && typeof window.NexusData.addDispute === 'function') {
          const result = window.NexusData.addDispute(newDispute);
          if (result && result.ok === false) {
            showToast(result.error || 'Dispute blocked.', 'error');
            return;
          }
        } else {
          const existing = JSON.parse(localStorage.getItem('nexus.disputes') || '[]');
          existing.unshift(newDispute);
          localStorage.setItem('nexus.disputes', JSON.stringify(existing));
        }
      } catch(e) {
        console.error('Failed to save dispute:', e);
      }

      showToast('Dispute submitted', 'success');
      setTimeout(() => {
        location.href = `comp-info.html?id=${compId || ''}`;
      }, 1500);
    });
  }

  /* ── INIT ───────────────────────────────────────────────── */
  prefillCompetitionName();
  initSubmit();

})();
