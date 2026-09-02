/**
 * NEXUS ESPORTS — edit-policy.js
 */

const PolicyPage = (() => {

  const normalizePolicyStatus = (status) => (status === 'active' ? 'active' : 'draft');

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

  /* ── CLAUSE EDITOR ── */
  const buildClauseEditor = (containerId, initialClauses = []) => {
    const container = document.getElementById(containerId);
    if (!container) return;

    const addClause = (text = '') => {
      const item = document.createElement('div');
      item.className = 'clause-item';
      item.innerHTML = `
        <div class="clause-num">${container.querySelectorAll('.clause-item').length + 1}</div>
        <textarea class="clause-text" rows="2" placeholder="Enter rule clause…">${text}</textarea>
        <button class="clause-del" title="Remove clause" onclick="this.closest('.clause-item').remove();PolicyPage._renumber('${containerId}')">×</button>`;
      container.appendChild(item);
      item.querySelector('.clause-text').focus();
    };

    initialClauses.forEach(c => addClause(c));
    container._addClause = addClause;

    return { addClause, getClauses: () =>
      [...container.querySelectorAll('.clause-text')].map(t => t.value.trim()).filter(Boolean)
    };
  };

  const _renumber = (containerId) => {
    document.querySelectorAll(`#${containerId} .clause-num`)
      .forEach((el, i) => el.textContent = i + 1);
  };

  /* ── TAG INPUT ── */
  const buildTagInput = (wrapperId, initialTags = []) => {
    const wrapper = document.getElementById(wrapperId);
    if (!wrapper) return { getTags: () => [] };

    const input = wrapper.querySelector('.pf-tag-input');
    let tags = [...initialTags];

    const renderTags = () => {
      wrapper.querySelectorAll('.pf-tag').forEach(t => t.remove());
      tags.forEach(tag => {
        const el = document.createElement('span');
        el.className = 'pf-tag';
        el.innerHTML = `${tag}<button onclick="this.parentElement.remove();PolicyPage._removeTag('${wrapperId}','${tag}')">×</button>`;
        wrapper.insertBefore(el, input);
      });
    };

    const addTag = (val) => {
      const clean = val.toLowerCase().replace(/[^a-z0-9\-]/g, '').trim();
      if (!clean || tags.includes(clean)) return;
      tags.push(clean);
      renderTags();
    };

    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ',') {
        e.preventDefault();
        addTag(input.value);
        input.value = '';
      }
      if (e.key === 'Backspace' && !input.value && tags.length) {
        tags.pop();
        renderTags();
      }
    });

    wrapper.addEventListener('click', () => input.focus());
    renderTags();
    wrapper._tags = tags;

    return { getTags: () => [...tags], addTag };
  };

  const _removeTag = (wrapperId, tag) => {
    const wrapper = document.getElementById(wrapperId);
    if (!wrapper || !wrapper._tags) return;
    wrapper._tags = wrapper._tags.filter(t => t !== tag);
  };

  /* ── FORM HELPERS ── */
  const collectForm = (clauseEditor, tagInput) => ({
    title:         document.getElementById('f-title')?.value.trim() || '',
    status:        normalizePolicyStatus(document.getElementById('f-status')?.value || 'draft'),
    scope:         document.getElementById('f-scope')?.value.trim() || '',
    category:      document.getElementById('f-category')?.value.trim() || '',
    effectiveDate: document.getElementById('f-effective')?.value || '',
    reviewDate:    document.getElementById('f-review')?.value || '',
    summary:       document.getElementById('f-summary')?.value.trim() || '',
    clauses:       clauseEditor ? clauseEditor.getClauses() : [],
    tags:          tagInput ? tagInput.getTags() : [],
  });

  const validateForm = (data) => {
    if (!data.title) { toast('Please enter a policy title.', 'error'); return false; }
    if (data.clauses.length === 0) { toast('Please add at least one rule clause.', 'error'); return false; }
    if (!data.effectiveDate) { toast('Please choose an effective date.', 'error'); return false; }
    if (!data.reviewDate) { toast('Please choose a next review date.', 'error'); return false; }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const effective = new Date(data.effectiveDate);
    const review = new Date(data.reviewDate);
    effective.setHours(0, 0, 0, 0);
    review.setHours(0, 0, 0, 0);

    if (effective < today) {
      toast('Effective date cannot be earlier than today.', 'error');
      return false;
    }

    const minReview = new Date(effective);
    minReview.setDate(minReview.getDate() + 1);
    if (review < minReview) {
      toast('Next review date must be at least one day after effective date.', 'error');
      return false;
    }

    return true;
  };

  const setupDateValidation = () => {
    const effectiveEl = document.getElementById('f-effective');
    const reviewEl = document.getElementById('f-review');
    if (!effectiveEl || !reviewEl) return;

    const toISO = (date) => {
      const y = date.getFullYear();
      const m = String(date.getMonth() + 1).padStart(2, '0');
      const d = String(date.getDate()).padStart(2, '0');
      return y + '-' + m + '-' + d;
    };

    const addDays = (isoDate, days) => {
      const base = new Date(isoDate + 'T00:00:00');
      base.setDate(base.getDate() + days);
      return toISO(base);
    };

    const todayIso = toISO(new Date());
    effectiveEl.min = todayIso;

    const syncReviewMin = () => {
      const effectiveValue = effectiveEl.value || todayIso;
      const minReview = addDays(effectiveValue, 1);
      reviewEl.min = minReview;
      if (!reviewEl.value || reviewEl.value < minReview) {
        reviewEl.value = minReview;
      }
    };

    if (!effectiveEl.value || effectiveEl.value < todayIso) {
      effectiveEl.value = todayIso;
    }

    syncReviewMin();
    effectiveEl.addEventListener('change', syncReviewMin);
    effectiveEl.addEventListener('input', syncReviewMin);
  };

  /* ── INIT EDIT ── */
  const initEdit = () => {
    ensureShellConsistency();

    let id = getUrlId();
    // Fallback to first policy if no ID is provided
    if (!id && policies.length > 0) id = policies[0].id;

    const policy = getById(id);

    if (!policy) {
      document.body.innerHTML = '<div style="padding:60px;color:#fff;font-family:Lato,sans-serif;">Policy not found. <a href="policy-management.html" style="color:#c6ff33;">Back to list</a></div>';
      return;
    }

    const set = (elId, val) => { const el = document.getElementById(elId); if (el) el.value = val; };
    set('f-title', policy.title);
    set('f-status', normalizePolicyStatus(policy.status));
    set('f-scope', policy.scope);
    set('f-category', policy.category);
    set('f-effective', policy.effectiveDate);
    set('f-review', policy.reviewDate);
    set('f-summary', policy.summary);

    const headEl = document.getElementById('edit-policy-name');
    if (headEl) headEl.textContent = policy.title;
    const verEl = document.getElementById('edit-policy-ver');
    if (verEl) {
      const status = normalizePolicyStatus(policy.status);
      verEl.textContent = policy.version + ' · ' + status.charAt(0).toUpperCase() + status.slice(1);
    }

    const clauseEditor = buildClauseEditor('clause-list', policy.clauses);
    const tagInput     = buildTagInput('tag-input-wrap', policy.tags || []);
    window.__addClause = () => clauseEditor.addClause();
    setupDateValidation();

    document.getElementById('btn-delete')?.addEventListener('click', () => {
      if (!confirm(`Permanently delete "${policy.title}"? This cannot be undone.`)) return;
      policies = policies.filter(p => p.id !== id);
      save();
      toast('Policy deleted.', 'error');
      setTimeout(() => { window.location.href = 'policy-management.html'; }, 1400);
    });

    document.getElementById('btn-draft')?.addEventListener('click', () => {
      const data = collectForm(clauseEditor, tagInput);
      if (!data.title) { toast('Title cannot be empty.', 'error'); return; }
      const idx = policies.findIndex(p => p.id === id);
      if (idx !== -1) {
        const [maj, min] = (policy.version.replace('v','').split('.').map(Number));
        const newVer = `v${maj}.${min + 1}`;
        policies[idx] = { ...policy, ...data, status: 'draft', version: newVer, updatedAt: new Date().toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric'}), changelog: [{ ver: newVer, date: new Date().toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric'}), desc: 'Saved as draft.' }, ...policy.changelog] };
        save();
      }
      toast('Changes saved as draft!');
    });

    document.getElementById('policy-form')?.addEventListener('submit', (e) => {
      e.preventDefault();
      const data = collectForm(clauseEditor, tagInput);
      if (!validateForm(data)) return;
      const idx = policies.findIndex(p => p.id === id);
      if (idx !== -1) {
        const [maj, min] = (policy.version.replace('v','').split('.').map(Number));
        const newVer = `v${maj}.${min + 1}`;
        policies[idx] = { ...policy, ...data, version: newVer, updatedAt: new Date().toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric'}), changelog: [{ ver: newVer, date: new Date().toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric'}), desc: 'Policy updated and published.' }, ...policy.changelog] };
        save();
      }
      toast('Policy updated successfully!');
      setTimeout(() => { window.location.href = `view-policy.html?id=${id}`; }, 1400);
    });
  };

  return {
    init(page) {
      if (page === 'edit')   initEdit();
    },
    _renumber,
    _removeTag
  };

})();
