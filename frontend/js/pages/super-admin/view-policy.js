/**
 * NEXUS ESPORTS — view-policy.js
 */

const PolicyPage = (() => {

  /* ── SHARED DATA ── */
  const DEFAULT_POLICIES = [
    {
      id: 'pol-001',
      title: 'Fair Play & Anti-Cheat Policy',
      version: 'v2.1',
      status: 'active',
      scope: 'All Competitions',
      category: 'Conduct',
      effectiveDate: '2026-03-01',
      reviewDate: '2027-03-01',
      updatedBy: 'RohanDev',
      updatedAt: 'Mar 1, 2026',
      summary: 'Defines fair play standards, prohibited software, and enforcement procedures for all NEXUS Esports competitions.',
      clauses: [
        'All participants must compete using only officially sanctioned game clients and peripherals.',
        'Use of third-party software that modifies game behaviour, provides unfair advantages, or circumvents anti-cheat systems is strictly prohibited.',
        'Anti-cheat software (VAC, FACEIT AC, or NEXUS AC) must be active throughout all matches. Failure to comply results in immediate forfeit.',
        'Exploiting known bugs or glitches intentionally is prohibited. Players must report bugs to admins immediately upon discovery.',
        'Match-fixing, collusion, or deliberate underperformance is a permanent ban offence.',
        'Impersonating another player, team, or official constitutes fraud and results in account termination.',
        'Violations are reviewed by admins within 48 hours. Penalties range from match forfeit to permanent platform ban depending on severity.',
      ],
      tags: ['anti-cheat', 'fair-play', 'conduct', 'all-competitions'],
      changelog: [
        { ver: 'v2.1', date: 'Mar 1, 2026',  desc: 'Added clause 3 regarding NEXUS AC mandatory compliance.' },
        { ver: 'v2.0', date: 'Jan 15, 2026', desc: 'Revised exploitation clause; added match-fixing penalties.' },
        { ver: 'v1.2', date: 'Sep 10, 2025', desc: 'Minor wording clarifications in clauses 1–2.' },
      ],
    },
    {
      id: 'pol-002',
      title: 'Team Registration Requirements',
      version: 'v1.4',
      status: 'active',
      scope: 'Team Competitions',
      category: 'Registration',
      effectiveDate: '2026-02-15',
      reviewDate: '2027-02-15',
      updatedBy: 'PriyaS_Admin',
      updatedAt: 'Feb 15, 2026',
      summary: 'Outlines eligibility criteria, roster rules, and registration deadlines for all team-based competitions.',
      clauses: [
        'Teams must consist of exactly 5 registered players with verified NEXUS accounts in good standing.',
        'All players must be 16 years of age or older at the time of registration.',
        'Each team may register a maximum of 1 substitute player who must also hold a verified NEXUS account.',
        'Team registration must be completed at least 72 hours before competition start. Late registrations are not accepted.',
        'A player may only be registered to one team per competition. Dual-registration is grounds for disqualification of both teams.',
        'Teams must designate a captain who acts as the official point of contact with administrators.',
        'Roster changes after registration deadline are prohibited unless approved by a platform admin in writing.',
      ],
      tags: ['registration', 'roster', 'eligibility', 'teams'],
      changelog: [
        { ver: 'v1.4', date: 'Feb 15, 2026', desc: 'Added clause 5 prohibiting dual-registration.' },
        { ver: 'v1.3', date: 'Nov 5, 2025',  desc: 'Minimum age raised from 14 to 16 years.' },
      ],
    },
    {
      id: 'pol-003',
      title: 'Dispute Resolution Policy',
      version: 'v3.0',
      status: 'active',
      scope: 'All Competitions',
      category: 'Disputes',
      effectiveDate: '2026-01-10',
      reviewDate: '2027-01-10',
      updatedBy: 'RohanDev',
      updatedAt: 'Jan 10, 2026',
      summary: 'Governs the process for filing, reviewing, and resolving match disputes and escalations.',
      clauses: [
        'Disputes must be filed within 24 hours of the relevant match\'s conclusion. Late submissions will not be reviewed.',
        'The disputing team must submit supporting evidence (screenshots, video, demo files) at the time of filing.',
        'Admins will acknowledge all disputes within 6 hours and complete initial review within 48 hours.',
        'Admin decisions are final at the competition level unless formally escalated to a Super Admin.',
        'Escalations to Super Admin must be filed within 48 hours of the admin decision and require new evidence or a documented procedural error.',
        'Super Admin decisions are binding, non-appealable, and will be issued within 72 hours of escalation.',
        'Filing a false or malicious dispute may result in warnings, score penalties, or account suspension.',
      ],
      tags: ['disputes', 'escalation', 'super-admin', 'resolution'],
      changelog: [
        { ver: 'v3.0', date: 'Jan 10, 2026', desc: 'Complete rewrite; added Super Admin escalation pathway and timelines.' },
        { ver: 'v2.1', date: 'Aug 22, 2025', desc: 'Reduced admin review window from 72h to 48h.' },
      ],
    },
    {
      id: 'pol-004',
      title: 'Prize Distribution Policy',
      version: 'v1.1',
      status: 'draft',
      scope: 'All Competitions',
      category: 'Finance',
      effectiveDate: '',
      reviewDate: '',
      updatedBy: 'AryanX99',
      updatedAt: 'Mar 20, 2026',
      summary: 'Describes how prize money is calculated, verified, and distributed to winning teams and players.',
      clauses: [
        'Prize money will be distributed to team captains within 14 business days of tournament conclusion.',
        'All prize recipients must have valid bank account details or a registered UPI ID on file before the tournament ends.',
        'Prizes may be withheld indefinitely if the recipient\'s account is under investigation for Fair Play violations.',
        'Tax liabilities arising from prize winnings are the sole responsibility of the recipient.',
        'In cases of team disputes regarding prize splits, NEXUS Esports follows the captain\'s declared split on file at registration.',
      ],
      tags: ['prizes', 'finance', 'payment', 'distribution'],
      changelog: [
        { ver: 'v1.1', date: 'Mar 20, 2026', desc: 'Added clause 5 covering internal team prize disputes.' },
        { ver: 'v1.0', date: 'Feb 1, 2026',  desc: 'Initial draft created.' },
      ],
    },
  ];

  let policies = JSON.parse(localStorage.getItem('nexus_policies') || sessionStorage.getItem('nexus_policies') || 'null') || DEFAULT_POLICIES;
  const save = () => {
    const serialized = JSON.stringify(policies);
    localStorage.setItem('nexus_policies', serialized);
    sessionStorage.setItem('nexus_policies', serialized);
  };
  const getById = (id) => policies.find(p => p.id === id);

  const ensureShellConsistency = () => {
    if (typeof initSuperAdminSidebar === 'function') {
      initSuperAdminSidebar('policy', '../../');
    }

    if (typeof initFooter === 'function') {
      if (document.getElementById('footer-mount')) {
        initFooter('../../');
      } else if (typeof getFooter === 'function') {
        const footer = document.querySelector('.site-footer');
        if (footer) footer.outerHTML = getFooter('../../');
      }
    }
  };

  /* ── UTILITIES ── */
  const toast = (msg, type = 'success') => {
    if (typeof showToast === 'function') { showToast(msg, type); return; }
    const el = document.createElement('div');
    el.textContent = msg;
    el.style.cssText = `position:fixed;bottom:24px;right:24px;z-index:9999;
      background:${type==='success'?'#c6ff33':'#e7000b'};
      color:${type==='success'?'#000':'#fff'};
      font-family:'Lato',sans-serif;font-weight:700;
      padding:12px 24px;border-radius:8px;font-size:14px;
      box-shadow:0 8px 24px rgba(0,0,0,0.4);
      transform:translateY(20px);opacity:0;transition:all 0.3s;`;
    document.body.appendChild(el);
    requestAnimationFrame(() => { el.style.transform='translateY(0)'; el.style.opacity='1'; });
    setTimeout(() => {
      el.style.transform='translateY(20px)'; el.style.opacity='0';
      setTimeout(() => el.remove(), 300);
    }, 3200);
  };

  const getUrlId = () => new URLSearchParams(window.location.search).get('id');

  /* ── PAGE: VIEW FULL POLICY ── */
  const initView = () => {
    ensureShellConsistency();

    let id = getUrlId();
    // Fallback to first policy if no ID is provided
    if (!id && policies.length > 0) id = policies[0].id;

    const policy = getById(id);

    if (!policy) {
      document.body.innerHTML = '<div style="padding:60px;color:#fff;font-family:Lato,sans-serif;">Policy not found. <a href="policy-management.html" style="color:#c6ff33;">Back to list</a></div>';
      return;
    }

    // ── Hero ──
    document.getElementById('v-badge').textContent     = `${policy.version} · ${policy.category}`;
    document.getElementById('v-title').textContent     = policy.title;
    document.getElementById('v-scope').innerHTML       = `Applies to: <strong>${policy.scope}</strong>`;
    document.getElementById('v-effective').innerHTML   = `Effective: <strong>${policy.effectiveDate || 'TBD'}</strong>`;
    document.getElementById('v-review').innerHTML      = `Next review: <strong>${policy.reviewDate || 'TBD'}</strong>`;
    document.getElementById('v-updated').innerHTML     = `Last updated: <strong>${policy.updatedAt}</strong>`;
    const statusEl = document.getElementById('v-status');
    statusEl.textContent = policy.status.charAt(0).toUpperCase() + policy.status.slice(1);
    statusEl.className   = `status-pill ${policy.status === 'active' ? 'approved' : policy.status === 'draft' ? 'pending' : 'upcoming'}`;

    // ── Edit link ──
    const editBtn = document.getElementById('btn-edit-policy');
    if (editBtn) editBtn.href = `edit-policy.html?id=${id}`;

    // ── Summary ──
    document.getElementById('v-summary').textContent = policy.summary;

    // ── Clauses ──
    const clauseContainer = document.getElementById('v-clauses');
    if (clauseContainer) {
      clauseContainer.innerHTML = policy.clauses.map((c, i) => `
        <div class="policy-clause">
          <div class="clause-index">${i + 1}</div>
          <div class="clause-body">${c}</div>
        </div>`).join('');
    }

    // ── Tags ──
    const tagContainer = document.getElementById('v-tags');
    if (tagContainer && policy.tags) {
      tagContainer.innerHTML = policy.tags.map(t =>
        `<span style="display:inline-flex;align-items:center;background:rgba(198,255,51,0.1);border:1px solid rgba(198,255,51,0.2);color:var(--accent);font-size:11px;font-weight:700;padding:3px 10px;border-radius:4px;margin:3px;">${t}</span>`
      ).join('');
    }

    // ── Sidebar info ──
    const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
    set('si-version',   policy.version);
    set('si-status',    policy.status.charAt(0).toUpperCase() + policy.status.slice(1));
    set('si-category',  policy.category);
    set('si-scope',     policy.scope);
    set('si-effective', policy.effectiveDate || 'TBD');
    set('si-review',    policy.reviewDate || 'TBD');
    set('si-author',    policy.updatedBy);
    set('si-updated',   policy.updatedAt);

    // ── Changelog ──
    const clContainer = document.getElementById('v-changelog');
    if (clContainer && policy.changelog) {
      clContainer.innerHTML = policy.changelog.map((c, i) => `
        <div class="changelog-item">
          <div class="changelog-dot ${i > 0 ? 'old' : ''}"></div>
          <div class="changelog-info">
            <div class="cl-ver">${c.ver}</div>
            <div class="cl-date">${c.date}</div>
            <div class="cl-desc">${c.desc}</div>
          </div>
        </div>`).join('');
    }

    // ── Print / Export ──
    document.getElementById('btn-print')?.addEventListener('click', () => window.print());
    document.getElementById('btn-copy-link')?.addEventListener('click', () => {
      navigator.clipboard.writeText(window.location.href).then(() => toast('Link copied to clipboard!'));
    });

    // ── Archive (status toggle) ──
    document.getElementById('btn-archive')?.addEventListener('click', () => {
      const idx = policies.findIndex(p => p.id === id);
      if (idx !== -1) {
        policies[idx].status = policies[idx].status === 'archived' ? 'active' : 'archived';
        save();
        toast(policies[idx].status === 'archived' ? 'Policy archived.' : 'Policy restored to active.', policies[idx].status === 'archived' ? 'error' : 'success');
        setTimeout(() => location.reload(), 1200);
      }
    });
  };

  return {
    init(page) {
      if (page === 'view')   initView();
    }
  };

})();
