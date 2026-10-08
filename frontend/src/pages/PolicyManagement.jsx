/**
 * NEXUS ESPORTS — Super Admin · Policy Management
 *
 * the
 * nexus_policies store (localStorage + sessionStorage), seeded from the five
 * built-in policies when empty, with active/draft/archived tabs, counts and
 * archive/restore. The page embedded its own sidebar + footer; AppLayout
 * supplies both here.
 */
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { showToast } from '../lib/toast.js';
import '../styles/pages/super-admin/super-dashboard.css';
import '../styles/pages/super-admin/policy-management.css';

const POLICY_STORE_KEY = 'nexus_policies';

const SEED = [
  ['Anti-Cheating and Fair Play Policy', 'Security', 'v4.2', 'Rules against cheating, match-fixing, and procedures for handling violations.', 'February 28, 2026', 'Emma Thompson', '97%'],
  ['Tournament Organizer Code of Conduct', 'Conduct', 'v3.0', 'Expected behavior and professional standards for all tournament organizers on the platform.', 'February 15, 2026', 'Sarah Chen', '95%'],
  ['Player Eligibility Requirements', 'Eligibility', 'v1.5', 'Age restrictions, regional requirements, and verification procedures for tournament participants.', 'January 20, 2026', 'Marcus Rivera', '100%'],
  ['Prize Pool Distribution Guidelines', 'Financial', 'v2.1', 'Rules and regulations for prize pool allocation, payment schedules, and distribution methods.', 'March 1, 2026', 'You', '98%'],
  ['Data Privacy and Protection Standards', 'Privacy', 'v2.0', 'Guidelines for handling player data, GDPR compliance, and privacy protection measures.', 'March 5, 2026', 'You', '100%'],
];

const normalizePolicyStatus = (status) => {
  const s = String(status || '').trim().toLowerCase();
  return s === 'active' || s === 'draft' || s === 'archived' ? s : 'draft';
};
const safeParse = (json, fallback) => { try { const p = JSON.parse(json); return p ?? fallback; } catch (e) { return fallback; } };
const makePolicyId = (title, index) => {
  const clean = (title || `policy-${index + 1}`).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
  return `pol-${clean || index + 1}`;
};
function seedPolicies() {
  return SEED.map(([title, category, version, summary, updatedAt, updatedBy, compliance], index) => ({
    id: makePolicyId(title, index), title, category, version, status: 'active', summary,
    scope: 'Platform-wide', updatedBy, updatedAt, compliance, clauses: [], tags: [], changelog: [],
  }));
}
function readPolicies() {
  const local = safeParse(localStorage.getItem(POLICY_STORE_KEY), null);
  if (Array.isArray(local) && local.length) return local;
  const session = safeParse(sessionStorage.getItem(POLICY_STORE_KEY), null);
  if (Array.isArray(session) && session.length) {
    localStorage.setItem(POLICY_STORE_KEY, JSON.stringify(session));
    return session;
  }
  return [];
}
function savePolicies(policies) {
  const serialized = JSON.stringify(policies);
  localStorage.setItem(POLICY_STORE_KEY, serialized);
  sessionStorage.setItem(POLICY_STORE_KEY, serialized);
}
function ensurePolicyData() {
  const stored = readPolicies();
  if (stored.length) {
    const normalized = stored.map((p) => ({ ...p, status: normalizePolicyStatus(p && p.status) }));
    savePolicies(normalized);
    return normalized;
  }
  const seeded = seedPolicies();
  savePolicies(seeded);
  return seeded;
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

const DocIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /><polyline points="10 9 9 9 8 9" /></svg>
);
const ViewIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /><polyline points="10 9 9 9 8 9" /></svg>
);
const EditIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>
);

export default function PolicyManagement() {
  const [policies, setPolicies] = useState([]);
  const [tab, setTab] = useState('active');

  useEffect(() => { setPolicies(ensurePolicyData()); }, []);

  function persist(next) { savePolicies(next); setPolicies(next); }
  function archive(id) {
    persist(policies.map((p) => (p.id === id ? { ...p, status: 'archived' } : p)));
    showToast('Policy archived.');
  }
  function restore(id) {
    persist(policies.map((p) => (p.id === id ? { ...p, status: 'active' } : p)));
    showToast('Policy restored to active.');
  }

  const counts = {
    active: policies.filter((p) => normalizePolicyStatus(p.status) === 'active').length,
    draft: policies.filter((p) => normalizePolicyStatus(p.status) === 'draft').length,
    archived: policies.filter((p) => normalizePolicyStatus(p.status) === 'archived').length,
  };
  const filtered = policies.filter((p) => normalizePolicyStatus(p.status) === tab);

  return (
    <main className="sa-main-v2">
      <header className="pm-header">
        <div className="pm-header-left">
          <Link className="btn-back" to="/pages/super-admin/super-dashboard.html">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 18 9 12 15 6" /></svg>
            BACK
          </Link>
          <div className="pm-title-group">
            <h1 className="pm-title">Policy Management</h1>
            <p className="pm-desc">Create and manage platform policies and guidelines</p>
          </div>
        </div>
        <div className="pm-header-actions">
          <Link className="btn-new-policy neon" to="/pages/super-admin/create-policy.html">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
            Create New Policy
          </Link>
        </div>
      </header>

      <div className="pm-stats-grid">
        <div className="pm-stat-card">
          <div className="pm-stat-icon green"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" /></svg></div>
          <div className="pm-stat-info"><div className="pm-stat-label">Active Policies</div><div className="pm-stat-value">{counts.active}</div></div>
        </div>
        <div className="pm-stat-card">
          <div className="pm-stat-icon orange"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg></div>
          <div className="pm-stat-info"><div className="pm-stat-label">Draft Policies</div><div className="pm-stat-value">{counts.draft}</div></div>
        </div>
        <div className="pm-stat-card">
          <div className="pm-stat-icon blue"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></svg></div>
          <div className="pm-stat-info"><div className="pm-stat-label">Avg. Compliance</div><div className="pm-stat-value">98%</div></div>
        </div>
      </div>

      <div className="pm-tabs-bar">
        <button className={`pm-tab-btn ${tab === 'active' ? 'active' : ''}`} onClick={() => setTab('active')}>Active Policies ({counts.active})</button>
        <button className={`pm-tab-btn ${tab === 'draft' ? 'active' : ''}`} onClick={() => setTab('draft')}>Drafts ({counts.draft})</button>
        <button className={`pm-tab-btn ${tab === 'archived' ? 'active' : ''}`} onClick={() => setTab('archived')}>Archived ({counts.archived})</button>
      </div>

      <div className="pm-policy-list">
        {filtered.length === 0 && (
          <div className="pm-empty-msg" style={{ padding: 60, textAlign: 'center', color: 'rgba(255,255,255,0.35)', border: '1px dashed rgba(255,255,255,0.08)', borderRadius: 12, fontSize: 14 }}>No {tab} policies found.</div>
        )}
        {filtered.map((policy) => {
          const category = policy.category || 'General';
          const iconClass = iconClassForCategory(category);
          const status = normalizePolicyStatus(policy.status);
          return (
            <div className="policy-card" data-status={status} key={policy.id}>
              <div className={`policy-icon-box ${iconClass}`}><DocIcon /></div>
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
                    <Link className="btn-policy outline" to={`/pages/super-admin/view-policy.html?id=${encodeURIComponent(policy.id)}`}><ViewIcon />View Full Policy</Link>
                    {status === 'archived' ? (
                      <button className="btn-policy restore" onClick={() => restore(policy.id)} style={{ border: '1px solid #c6ff33', color: '#c6ff33', background: 'transparent', padding: '6px 12px', borderRadius: 6, display: 'inline-flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 13, fontFamily: 'inherit' }}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="23 4 23 10 17 10" /><polyline points="1 20 1 14 7 14" /><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" /></svg>
                        Restore
                      </button>
                    ) : (
                      <>
                        <Link className="btn-policy edit" to={`/pages/super-admin/edit-policy.html?id=${encodeURIComponent(policy.id)}`}><EditIcon />Edit</Link>
                        <button className="btn-policy archive" onClick={() => archive(policy.id)} style={{ border: '1px solid rgba(255,255,255,0.15)', color: '#9aa4b2', background: 'transparent', padding: '6px 12px', borderRadius: 6, display: 'inline-flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 13, fontFamily: 'inherit' }}>
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="21 8 21 21 3 21 3 8" /><rect x="1" y="3" width="22" height="5" /><line x1="10" y1="12" x2="14" y2="12" /></svg>
                          Archive
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </main>
  );
}


