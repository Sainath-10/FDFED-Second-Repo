import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Shell from '../../components/Layout/Shell';
import '../../styles/pages/super-admin/super-dashboard.css';
import '../../styles/pages/super-admin/create-policy.css';

const POLICY_STORE_KEY = 'nexus_policies';

export default function SuperAdminCreatePolicyPage() {
  const navigate = useNavigate();

  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('');
  const [scope, setScope] = useState('');
  const [summary, setSummary] = useState('');
  const [effectiveDate, setEffectiveDate] = useState('');
  const [reviewDate, setReviewDate] = useState('');
  const [status, setStatus] = useState('active');

  const [clauses, setClauses] = useState(['']);
  const [tags, setTags] = useState(['anti-cheat', 'fair-play']);
  const [tagInput, setTagInput] = useState('');

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

  function savePolicy(saveStatus) {
    if (!title.trim()) {
      alert('Policy title is required.');
      return;
    }
    if (!summary.trim()) {
      alert('Policy summary is required.');
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

    const newId = `pol-${Date.now().toString(36)}`;
    const newPolicy = {
      id: newId,
      title: title.trim(),
      version: 'v1.0',
      status: saveStatus || status,
      scope: scope || 'All Competitions',
      category: category || 'Conduct',
      effectiveDate: effectiveDate || new Date().toISOString().split('T')[0],
      reviewDate: reviewDate || '',
      updatedBy: 'Super Admin',
      updatedAt: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
      compliance: '100%',
      summary: summary.trim(),
      clauses: validClauses,
      tags: tags,
      changelog: [
        { ver: 'v1.0', date: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }), desc: 'Initial policy creation.' }
      ]
    };

    existing.unshift(newPolicy);
    localStorage.setItem(POLICY_STORE_KEY, JSON.stringify(existing));

    alert(saveStatus === 'draft' ? 'Policy saved as draft.' : 'Policy published successfully!');
    navigate('/super-admin/policy-management');
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
              <h1>Create New Policy</h1>
              <p>Define a new platform rule or competition policy for NEXUS Esports.</p>
            </div>
            <span className={`status-pill ${status === 'active' ? 'approved' : 'pending'}`}>
              {status === 'active' ? 'Active' : 'Draft'}
            </span>
          </div>

          <form id="policy-form" onSubmit={e => { e.preventDefault(); savePolicy(status); }} style={{ maxWidth: '800px', margin: '0 auto' }}>
            <div className="policy-form-card">
              <div className="form-section-label">Basic Details</div>

              <div className="pf-group">
                <label className="pf-label" htmlFor="f-title">
                  Policy Title <span style={{ color: 'var(--red, #ef4444)' }}>*</span>
                </label>
                <input
                  className="pf-input"
                  type="text"
                  id="f-title"
                  placeholder="e.g. Player Conduct & Sportsmanship Policy"
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  required
                />
              </div>

              <div className="pf-row">
                <div className="pf-group">
                  <label className="pf-label" htmlFor="f-category">Category</label>
                  <select className="pf-select" id="f-category" value={category} onChange={e => setCategory(e.target.value)}>
                    <option value="">Select category…</option>
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
                    <option value="">Select scope…</option>
                    <option value="All Competitions">All Competitions</option>
                    <option value="Team Competitions">Team Competitions</option>
                    <option value="Solo Competitions">Solo Competitions</option>
                    <option value="Admins Only">Admins Only</option>
                    <option value="Platform-wide">Platform-wide</option>
                  </select>
                </div>
              </div>

              <div className="pf-group">
                <label className="pf-label" htmlFor="f-summary">
                  Policy Summary <span style={{ color: 'var(--red, #ef4444)' }}>*</span>
                </label>
                <p className="pf-hint">A one or two sentence overview shown on the policy list page.</p>
                <textarea
                  className="pf-textarea"
                  id="f-summary"
                  rows="3"
                  placeholder="Brief description of what this policy covers and who it applies to…"
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
                  <option value="active">Active (Publish Immediately)</option>
                  <option value="draft">Draft (Save for Later)</option>
                </select>
              </div>

              {/* RULE CLAUSES */}
              <div className="form-section-label">Rule Clauses <span style={{ color: 'var(--red, #ef4444)' }}>*</span></div>
              <p className="pf-hint" style={{ marginBottom: '14px' }}>Each clause is a numbered rule. Add at least one clause before publishing.</p>

              <div className="clause-list" id="clause-list">
                {clauses.map((clause, idx) => (
                  <div key={idx} className="clause-item" style={{ display: 'flex', gap: '10px', alignItems: 'center', marginBottom: '10px' }}>
                    <span style={{ fontWeight: 800, color: '#c6ff33', minWidth: '24px' }}>{idx + 1}.</span>
                    <input
                      className="pf-input"
                      type="text"
                      placeholder={`Rule clause ${idx + 1}...`}
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
                <svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <line x1="6.5" y1="1" x2="6.5" y2="12"/><line x1="1" y1="6.5" x2="12" y2="6.5"/>
                </svg>
                Add Clause
              </button>

              {/* TAGS */}
              <div className="form-section-label" style={{ marginTop: '28px' }}>Tags</div>
              <p className="pf-hint" style={{ marginBottom: '12px' }}>Press <kbd style={{ background: 'rgba(255,255,255,0.08)', padding: '1px 5px', borderRadius: '3px', fontSize: '11px' }}>Enter</kbd> or <kbd style={{ background: 'rgba(255,255,255,0.08)', padding: '1px 5px', borderRadius: '3px', fontSize: '11px' }}>,</kbd> to add a tag.</p>

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

              {/* FORM ACTIONS */}
              <div className="pf-actions">
                <button type="submit" className="pf-btn-submit">
                  Publish Policy
                </button>
                <button type="button" className="pf-btn-draft" id="btn-draft" onClick={() => savePolicy('draft')}>
                  Save as Draft
                </button>
                <button
                  type="button"
                  className="pf-btn-cancel"
                  onClick={() => {
                    if (window.confirm('Discard changes and go back?')) {
                      navigate('/super-admin/policy-management');
                    }
                  }}
                >
                  Cancel
                </button>
              </div>
            </div>
          </form>
        </section>
      </main>
    </Shell>
  );
}
