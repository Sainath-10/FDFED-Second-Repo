import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Shell from '../../components/Layout/Shell';
import '../../styles/pages/super-admin/super-dashboard.css';
import '../../styles/pages/super-admin/policy-management.css';

const POLICY_STORE_KEY = 'nexus_policies';

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
    compliance: '99%',
    summary: 'Defines fair play standards, prohibited software, and enforcement procedures for all NEXUS Esports competitions.',
    clauses: [
      'All participants must compete using only officially sanctioned game clients and peripherals.',
      'Use of third-party software that modifies game behaviour, provides unfair advantages, or circumvents anti-cheat systems is strictly prohibited.',
      'Anti-cheat software (VAC, FACEIT AC, or NEXUS AC) must be active throughout all matches. Failure to comply results in immediate forfeit.',
      'Exploiting known bugs or glitches intentionally is prohibited. Players must report bugs to admins immediately upon discovery.',
      'Match-fixing, collusion, or deliberate underperformance is a permanent ban offence.',
      'Impersonating another player, team, or official constitutes fraud and results in account termination.',
      'Violations are reviewed by admins within 48 hours. Penalties range from match forfeit to permanent platform ban depending on severity.'
    ],
    tags: ['anti-cheat', 'fair-play', 'conduct', 'all-competitions'],
    changelog: [
      { ver: 'v2.1', date: 'Mar 1, 2026', desc: 'Added clause 3 regarding NEXUS AC mandatory compliance.' },
      { ver: 'v2.0', date: 'Jan 15, 2026', desc: 'Revised exploitation clause; added match-fixing penalties.' },
      { ver: 'v1.2', date: 'Sep 10, 2025', desc: 'Minor wording clarifications in clauses 1–2.' }
    ]
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
    compliance: '97%',
    summary: 'Outlines eligibility criteria, roster rules, and registration deadlines for all team-based competitions.',
    clauses: [
      'Teams must consist of exactly 5 registered players with verified NEXUS accounts in good standing.',
      'All players must be 16 years of age or older at the time of registration.',
      'Each team may register a maximum of 1 substitute player who must also hold a verified NEXUS account.',
      'Team registration must be completed at least 72 hours before competition start. Late registrations are not accepted.',
      'A player may only be registered to one team per competition. Dual-registration is grounds for disqualification of both teams.',
      'Teams must designate a captain who acts as the official point of contact with administrators.',
      'Roster changes after registration deadline are prohibited unless approved by a platform admin in writing.'
    ],
    tags: ['registration', 'roster', 'eligibility', 'teams'],
    changelog: [
      { ver: 'v1.4', date: 'Feb 15, 2026', desc: 'Added clause 5 prohibiting dual-registration.' },
      { ver: 'v1.3', date: 'Nov 5, 2025', desc: 'Minimum age raised from 14 to 16 years.' }
    ]
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
    compliance: '95%',
    summary: 'Governs the process for filing, reviewing, and resolving match disputes and escalations.',
    clauses: [
      'Disputes must be filed within 24 hours of the relevant match\'s conclusion. Late submissions will not be reviewed.',
      'The disputing team must submit supporting evidence (screenshots, video, demo files) at the time of filing.',
      'Admins will acknowledge all disputes within 6 hours and complete initial review within 48 hours.',
      'Admin decisions are final at the competition level unless formally escalated to a Super Admin.',
      'Escalations to Super Admin must be filed within 48 hours of the admin decision and require new evidence or a documented procedural error.',
      'Super Admin decisions are binding, non-appealable, and will be issued within 72 hours of escalation.',
      'Filing a false or malicious dispute may result in warnings, score penalties, or account suspension.'
    ],
    tags: ['disputes', 'escalation', 'super-admin', 'resolution'],
    changelog: [
      { ver: 'v3.0', date: 'Jan 10, 2026', desc: 'Complete rewrite; added Super Admin escalation pathway and timelines.' },
      { ver: 'v2.1', date: 'Aug 22, 2025', desc: 'Reduced admin review window from 72h to 48h.' }
    ]
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
    updatedBy: 'AlexM_Super',
    updatedAt: 'Mar 12, 2026',
    compliance: '—',
    summary: 'Standards and payout schedules for tournament prize pool distribution.',
    clauses: [
      'Prizes are disbursed within 14 business days of tournament conclusion.',
      'Identity verification is required for all prize recipients prior to disbursement.'
    ],
    tags: ['finance', 'prizes', 'distribution'],
    changelog: []
  }
];

function normalizeStatus(status) {
  const s = String(status || '').trim().toLowerCase();
  if (s === 'active' || s === 'draft' || s === 'archived') return s;
  return 'draft';
}

function iconClassForCategory(category) {
  const lower = (category || '').toLowerCase();
  if (lower.includes('security') || lower.includes('cheat')) return 'security';
  if (lower.includes('conduct')) return 'conduct';
  if (lower.includes('eligibility') || lower.includes('registration')) return 'eligibility';
  if (lower.includes('finance') || lower.includes('financial') || lower.includes('prize')) return 'financial';
  if (lower.includes('privacy') || lower.includes('data')) return 'privacy';
  return 'conduct';
}

export default function SuperAdminPolicyManagementPage() {
  const navigate = useNavigate();
  const [policies, setPolicies] = useState([]);
  const [currentTab, setCurrentTab] = useState('active');

  useEffect(() => {
    loadPolicies();
  }, []);

  function loadPolicies() {
    let stored = [];
    try {
      const raw = localStorage.getItem(POLICY_STORE_KEY);
      stored = raw ? JSON.parse(raw) : [];
    } catch (_) {}

    if (!Array.isArray(stored) || stored.length === 0) {
      stored = DEFAULT_POLICIES;
      localStorage.setItem(POLICY_STORE_KEY, JSON.stringify(stored));
    }
    setPolicies(stored);
  }

  function savePolicies(updated) {
    setPolicies(updated);
    localStorage.setItem(POLICY_STORE_KEY, JSON.stringify(updated));
  }

  function handleArchive(id) {
    const updated = policies.map(p => p.id === id ? { ...p, status: 'archived' } : p);
    savePolicies(updated);
    alert('Policy archived.');
  }

  function handleRestore(id) {
    const updated = policies.map(p => p.id === id ? { ...p, status: 'active' } : p);
    savePolicies(updated);
    alert('Policy restored to active.');
  }

  const activeCount = policies.filter(p => normalizeStatus(p.status) === 'active').length;
  const draftCount = policies.filter(p => normalizeStatus(p.status) === 'draft').length;
  const archivedCount = policies.filter(p => normalizeStatus(p.status) === 'archived').length;

  const filtered = policies.filter(p => normalizeStatus(p.status) === currentTab);

  return (
    <Shell sidebarVariant="super-admin" activePage="policy">
      <main className="sa-main-v2">
        <header className="pm-header">
          <div className="pm-header-left">
            <button type="button" className="btn-back" onClick={() => navigate('/super-dashboard')}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="15 18 9 12 15 6"></polyline>
              </svg>
              BACK
            </button>
            <div className="pm-title-group">
              <h1 className="pm-title">Policy Management</h1>
              <p className="pm-desc">Create and manage platform policies and guidelines</p>
            </div>
          </div>
          <div className="pm-header-actions">
            <Link to="/super-admin/create-policy" className="btn-new-policy neon">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                <line x1="12" y1="5" x2="12" y2="19"></line>
                <line x1="5" y1="12" x2="19" y2="12"></line>
              </svg>
              Create New Policy
            </Link>
          </div>
        </header>

        {/* Summary Stats */}
        <div className="pm-stats-grid">
          <div className="pm-stat-card">
            <div className="pm-stat-icon green">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                <polyline points="22 4 12 14.01 9 11.01"></polyline>
              </svg>
            </div>
            <div className="pm-stat-info">
              <div className="pm-stat-label">Active Policies</div>
              <div className="pm-stat-value">{activeCount}</div>
            </div>
          </div>
          <div className="pm-stat-card">
            <div className="pm-stat-icon orange">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10"></circle>
                <line x1="12" y1="8" x2="12" y2="12"></line>
                <line x1="12" y1="16" x2="12.01" y2="16"></line>
              </svg>
            </div>
            <div className="pm-stat-info">
              <div className="pm-stat-label">Draft Policies</div>
              <div className="pm-stat-value">{draftCount}</div>
            </div>
          </div>
        </div>

        {/* Tabs Bar */}
        <div className="pm-tabs-bar" style={{ display: 'flex', gap: '8px', marginBottom: '24px' }}>
          <button
            type="button"
            className={`pm-tab-btn ${currentTab === 'active' ? 'active' : ''}`}
            onClick={() => setCurrentTab('active')}
          >
            Active Policies ({activeCount})
          </button>
          <button
            type="button"
            className={`pm-tab-btn ${currentTab === 'draft' ? 'active' : ''}`}
            onClick={() => setCurrentTab('draft')}
          >
            Drafts ({draftCount})
          </button>
          <button
            type="button"
            className={`pm-tab-btn ${currentTab === 'archived' ? 'active' : ''}`}
            onClick={() => setCurrentTab('archived')}
          >
            Archived ({archivedCount})
          </button>
        </div>

        <div className="pm-policy-list">
          {filtered.length === 0 ? (
            <div className="pm-empty-msg" style={{ padding: '60px', textAlign: 'center', color: 'rgba(255,255,255,0.35)', border: '1px dashed rgba(255,255,255,0.08)', borderRadius: '12px', fontSize: '14px' }}>
              No {currentTab} policies found.
            </div>
          ) : (
            filtered.map(policy => {
              const category = policy.category || 'General';
              const iconClass = iconClassForCategory(category);
              const status = normalizeStatus(policy.status);

              return (
                <div key={policy.id} className="policy-card" data-status={status}>
                  <div className={`policy-icon-box ${iconClass}`}>
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                      <polyline points="14 2 14 8 20 8"></polyline>
                      <line x1="16" y1="13" x2="8" y2="13"></line>
                      <line x1="16" y1="17" x2="8" y2="17"></line>
                      <polyline points="10 9 9 9 8 9"></polyline>
                    </svg>
                  </div>
                  <div className="policy-details">
                    <div className="policy-header-row">
                      <div className="policy-title-group">
                        <h3 className="policy-name">{policy.title}</h3>
                        <div className="policy-tags">
                          <span className={`tag ${iconClass}`}>{category}</span>
                          <span className="tag version">{policy.version || 'v1.0'}</span>
                        </div>
                      </div>
                    </div>
                    <p className="policy-description">{policy.summary || 'No summary provided yet.'}</p>
                    <div className="policy-meta-row">
                      <div className="policy-meta">
                        <span className="meta-item">Last Updated: <strong>{policy.updatedAt || 'N/A'}</strong></span>
                        <span className="meta-item">By: <strong>{policy.updatedBy || 'Admin'}</strong></span>
                        <span className="meta-item">Compliance: <span className="compliance-text">{policy.compliance || '98%'}</span></span>
                      </div>
                      <div className="policy-actions">
                        {status === 'archived' ? (
                          <>
                            <Link to={`/super-admin/view-policy?id=${encodeURIComponent(policy.id)}`} className="btn-policy outline">
                              View Full Policy
                            </Link>
                            <button
                              type="button"
                              className="btn-policy restore"
                              onClick={() => handleRestore(policy.id)}
                              style={{ border: '1px solid #c6ff33', color: '#c6ff33', background: 'transparent', padding: '6px 12px', borderRadius: '6px', display: 'inline-flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: '13px' }}
                            >
                              Restore
                            </button>
                          </>
                        ) : (
                          <>
                            <Link to={`/super-admin/view-policy?id=${encodeURIComponent(policy.id)}`} className="btn-policy outline">
                              View Full Policy
                            </Link>
                            <Link to={`/super-admin/edit-policy?id=${encodeURIComponent(policy.id)}`} className="btn-policy edit">
                              Edit
                            </Link>
                            <button
                              type="button"
                              className="btn-policy archive"
                              onClick={() => handleArchive(policy.id)}
                              style={{ border: '1px solid rgba(255,255,255,0.15)', color: '#9aa4b2', background: 'transparent', padding: '6px 12px', borderRadius: '6px', display: 'inline-flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: '13px' }}
                            >
                              Archive
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </main>
    </Shell>
  );
}
