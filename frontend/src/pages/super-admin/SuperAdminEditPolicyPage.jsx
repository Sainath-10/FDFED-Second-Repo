import React, { useState, useEffect } from 'react';
import { useSearchParams, Link, useNavigate } from 'react-router-dom';
import Shell from '../../components/Layout/Shell';
import '../../styles/pages/super-admin/super-dashboard.css';
import '../../styles/pages/super-admin/edit-policy.css';

const POLICY_STORE_KEY = 'nexus_policies';

export default function SuperAdminEditPolicyPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const policyId = searchParams.get('id');

  const [policy, setPolicy] = useState(null);
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('');
  const [scope, setScope] = useState('');
  const [summary, setSummary] = useState('');
  const [effectiveDate, setEffectiveDate] = useState('');
  const [reviewDate, setReviewDate] = useState('');
  const [status, setStatus] = useState('active');

  const [clauses, setClauses] = useState([]);
  const [tags, setTags] = useState([]);
  const [tagInput, setTagInput] = useState('');

  useEffect(() => {
    loadPolicy();
  }, [policyId]);

  function loadPolicy() {
    let existing = [];
    try {
      const raw = localStorage.getItem(POLICY_STORE_KEY);
      existing = raw ? JSON.parse(raw) : [];
    } catch (_) {}

    const found = existing.find(p => p.id === policyId) || existing[0];
    if (found) {
      setPolicy(found);
      setTitle(found.title || '');
      setCategory(found.category || 'Conduct');
      setScope(found.scope || 'All Competitions');
      setSummary(found.summary || '');
      setEffectiveDate(found.effectiveDate || '');
      setReviewDate(found.reviewDate || '');
      setStatus(found.status || 'active');
      setClauses(found.clauses && found.clauses.length > 0 ? found.clauses : ['']);
      setTags(found.tags || []);
    }
  }

  function handleAddClause() {
    setClauses([...clauses, '']);
  }

  function handleClauseChange(index, value) {
    const updated = [...clauses];
    updated[index] = value;
    setClauses(updated);
  }

  function handleRemoveClause(index) {
    if (clauses.length <= 1) return;
    setClauses(clauses.filter((_, i) => i !== index));
  }

  function handleTagKeyDown(e) {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      const val = tagInput.trim().replace(/^,|,$/g, '');
      if (val && !tags.includes(val)) {
        setTags([...tags, val]);
        setTagInput('');
      }
    }
  }

  function handleRemoveTag(tagToRemove) {
    setTags(tags.filter(t => t !== tagToRemove));
  }

  function bumpVersion(ver) {
    const match = String(ver || 'v1.0').match(/v?(\d+)\.(\d+)/);
    if (!match) return 'v1.1';
    const major = parseInt(match[1], 10);
    const minor = parseInt(match[2], 10) + 1;
    return `v${major}.${minor}`;
  }

  function handleSubmit(e) {
    e.preventDefault();
    if (!policy) return;

    if (!title.trim() || !summary.trim()) {
      alert('Title and Summary are required.');
      return;
    }

    const validClauses = clauses.filter(c => c.trim().length > 0);
    if (validClauses.length === 0) {
      alert('Please add at least one rule clause.');
      return;
    }

    let existing = [];
    try {
      const raw = localStorage.getItem(POLICY_STORE_KEY);
      existing = raw ? JSON.parse(raw) : [];
    } catch (_) {}

    const newVersion = bumpVersion(policy.version);
    const newChangeEntry = {
      ver: newVersion,
      date: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
      desc: 'Updated policy clauses and metadata.'
    };

    const updated = existing.map(p => {
      if (p.id === policy.id) {
        return {
          ...p,
          title: title.trim(),
          category,
          scope,
          summary: summary.trim(),
          effectiveDate,
          reviewDate,
          status,
          clauses: validClauses,
          tags,
          version: newVersion,
          updatedAt: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
          changelog: [newChangeEntry, ...(p.changelog || [])]
        };
      }
      return p;
    });

    localStorage.setItem(POLICY_STORE_KEY, JSON.stringify(updated));
    alert(`Policy updated successfully to ${newVersion}!`);
    navigate('/super-admin/policy-management');
  }

  function handleDelete() {
    if (window.confirm('Delete this policy? This action cannot be undone.')) {
      let existing = [];
      try {
        const raw = localStorage.getItem(POLICY_STORE_KEY);
        existing = raw ? JSON.parse(raw) : [];
      } catch (_) {}

      const updated = existing.filter(p => p.id !== policy.id);
      localStorage.setItem(POLICY_STORE_KEY, JSON.stringify(updated));
      alert('Policy deleted.');
      navigate('/super-admin/policy-management');
    }
  }

  if (!policy) {
    return (
      <Shell sidebarVariant="super-admin" activePage="policy">
        <main className="sa-main-v2">
          <div style={{ padding: '60px', textAlign: 'center', color: 'var(--text-muted)' }}>Loading policy...</div>
        </main>
      </Shell>
    );
  }

  return (
    <Shell sidebarVariant="super-admin" activePage="policy">
      <main className="sa-main-v2">
        <section className="policy-page-wrap">
          <Link to="/super-admin/policy-management" className="back-link">
            <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
              <path d="M12 8H4M4 8L8 12M4 8L8 4"/>
            </svg>
            Back to Policy Management
          </Link>

          <div className="policy-page-header">
            <div>
              <h1 id="edit-policy-name">{title || 'Edit Policy'}</h1>
              <p id="edit-policy-ver" style={{ fontSize: '14px', color: 'var(--accent, #c6ff33)', fontWeight: 700, marginTop: '4px' }}>
                Current Version: {policy.version || 'v1.0'}
              </p>
            </div>
            <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
              <span className={`status-pill ${status === 'active' ? 'approved' : 'pending'}`}>
                {status === 'active' ? 'Active' : 'Draft'}
              </span>
              <button type="button" className="btn-table-danger" onClick={handleDelete} style={{ padding: '8px 16px' }}>
                Delete Policy
              </button>
            </div>
          </div>

          <div style={{
            background: 'rgba(198,255,51,0.05)',
            border: '1px solid rgba(198,255,51,0.2)',
            borderRadius: '10px',
            padding: '14px 18px',
            marginBottom: '28px',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            fontSize: '13px',
            color: 'var(--text-muted)'
          }}>
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="#c6ff33" strokeWidth="1.6" strokeLinecap="round">
              <circle cx="9" cy="9" r="7.5"/>
              <line x1="9" y1="8" x2="9" y2="12.5"/>
              <circle cx="9" cy="5.5" r="0.8" fill="#c6ff33"/>
            </svg>
            Saving increments the version number automatically. The previous version is preserved in the changelog.
          </div>

          <form id="edit-policy-form" onSubmit={handleSubmit} style={{ maxWidth: '800px', margin: '0 auto' }}>
            <div className="policy-form-card">
              <div className="form-section-label">Basic Details</div>

              <div className="pf-group">
                <label className="pf-label" htmlFor="f-title">Policy Title <span style={{ color: 'var(--red, #ef4444)' }}>*</span></label>
                <input
                  className="pf-input"
                  type="text"
                  id="f-title"
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  required
                />
              </div>

              <div className="pf-row">
                <div className="pf-group">
                  <label className="pf-label" htmlFor="f-category">Category</label>
                  <select className="pf-select" id="f-category" value={category} onChange={e => setCategory(e.target.value)}>
                    <option value="Conduct">Conduct</option>
                    <option value="Registration">Registration</option>
                    <option value="Disputes">Disputes</option>
                    <option value="Finance">Finance</option>
                    <option value="Operations">Operations</option>
                    <option value="Technical">Technical</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
                <div className="pf-group">
                  <label className="pf-label" htmlFor="f-scope">Applies To</label>
                  <select className="pf-select" id="f-scope" value={scope} onChange={e => setScope(e.target.value)}>
                    <option value="All Competitions">All Competitions</option>
                    <option value="Team Competitions">Team Competitions</option>
                    <option value="Solo Competitions">Solo Competitions</option>
                    <option value="Admins Only">Admins Only</option>
                    <option value="Platform-wide">Platform-wide</option>
                  </select>
                </div>
              </div>

              <div className="pf-group">
                <label className="pf-label" htmlFor="f-summary">Policy Summary <span style={{ color: 'var(--red, #ef4444)' }}>*</span></label>
                <textarea
                  className="pf-textarea"
                  id="f-summary"
                  rows="3"
                  value={summary}
                  onChange={e => setSummary(e.target.value)}
                  required
                  style={{ minHeight: '80px' }}
                />
              </div>

              <div className="pf-row">
                <div className="pf-group">
                  <label className="pf-label" htmlFor="f-effective">Effective Date</label>
                  <input className="pf-input" type="date" id="f-effective" value={effectiveDate} onChange={e => setEffectiveDate(e.target.value)} />
                </div>
                <div className="pf-group">
                  <label className="pf-label" htmlFor="f-review">Next Review Date</label>
                  <input className="pf-input" type="date" id="f-review" value={reviewDate} onChange={e => setReviewDate(e.target.value)} />
                </div>
              </div>

              <div className="pf-group">
                <label className="pf-label" htmlFor="f-status">Publish Status</label>
                <select className="pf-select" id="f-status" value={status} onChange={e => setStatus(e.target.value)}>
                  <option value="active">Active (Published)</option>
                  <option value="draft">Draft (Unpublished)</option>
                  <option value="archived">Archived</option>
                </select>
              </div>

              {/* RULE CLAUSES */}
              <div className="form-section-label">Rule Clauses <span style={{ color: 'var(--red, #ef4444)' }}>*</span></div>
              <div className="clause-list" id="clause-list">
                {clauses.map((clause, idx) => (
                  <div key={idx} className="clause-item" style={{ display: 'flex', gap: '10px', alignItems: 'center', marginBottom: '10px' }}>
                    <span style={{ fontWeight: 800, color: '#c6ff33', minWidth: '24px' }}>{idx + 1}.</span>
                    <input
                      className="pf-input"
                      type="text"
                      value={clause}
                      onChange={e => handleClauseChange(idx, e.target.value)}
                      style={{ flex: 1 }}
                    />
                    {clauses.length > 1 && (
                      <button
                        type="button"
                        onClick={() => handleRemoveClause(idx)}
                        style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: '18px' }}
                      >
                        ✕
                      </button>
                    )}
                  </div>
                ))}
              </div>

              <button type="button" className="add-clause-btn" onClick={handleAddClause}>
                + Add Clause
              </button>

              {/* TAGS */}
              <div className="form-section-label" style={{ marginTop: '28px' }}>Tags</div>
              <div className="pf-tags" id="tag-input-wrap" style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center' }}>
                {tags.map((t, idx) => (
                  <span key={idx} className="tag" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '4px 10px', borderRadius: '6px', background: 'rgba(255,255,255,0.08)', fontSize: '12px', color: '#fff' }}>
                    {t}
                    <button type="button" onClick={() => handleRemoveTag(t)} style={{ background: 'none', border: 'none', color: '#9aa4b2', cursor: 'pointer', padding: 0 }}>✕</button>
                  </span>
                ))}
                <input
                  className="pf-tag-input"
                  type="text"
                  placeholder="e.g. anti-cheat, conduct…"
                  value={tagInput}
                  onChange={e => setTagInput(e.target.value)}
                  onKeyDown={handleTagKeyDown}
                  style={{ background: 'transparent', border: 'none', color: '#fff', outline: 'none', minWidth: '160px' }}
                />
              </div>

              {/* ACTIONS */}
              <div className="pf-actions">
                <button type="submit" className="pf-btn-submit">
                  Save Changes ({bumpVersion(policy.version)})
                </button>
                <Link to="/super-admin/policy-management" className="pf-btn-cancel" style={{ textDecoration: 'none', textAlign: 'center' }}>
                  Cancel
                </Link>
              </div>
            </div>
          </form>
        </section>
      </main>
    </Shell>
  );
}
