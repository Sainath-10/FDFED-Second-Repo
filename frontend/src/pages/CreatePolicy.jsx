/**
 * NEXUS ESPORTS — Super Admin · Create Policy
 *
 * the policy form
 * with the clause editor, tag input, effective/review date validation, draft save
 * and publish (writes the shared nexus_policies store).
 */
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { showToast } from '../lib/toast.js';
import PolicyEditor from '../components/PolicyEditor.jsx';
import { readPolicies, savePolicies, validatePolicyForm, todayISO, addDays, todayLabel, normalizePolicyStatus } from '../lib/policies.js';
import '../styles/pages/super-admin/super-dashboard.css';
import '../styles/pages/super-admin/create-policy.css';

const CATEGORIES = ['Conduct', 'Registration', 'Disputes', 'Finance', 'Operations', 'Technical', 'Other'];
const SCOPES = ['All Competitions', 'Team Competitions', 'Solo Competitions', 'Admins Only', 'Platform-wide'];

export default function CreatePolicy() {
  const navigate = useNavigate();
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('');
  const [scope, setScope] = useState('');
  const [summary, setSummary] = useState('');
  const [effectiveDate, setEffectiveDate] = useState('');
  const [reviewDate, setReviewDate] = useState('');
  const [status, setStatus] = useState('active');
  const [clauses, setClauses] = useState([]);
  const [tags, setTags] = useState([]);

  const today = todayISO();
  const minReview = addDays(effectiveDate || today, 1);

  function collect() {
    return {
      title: title.trim(),
      status: normalizePolicyStatus(status),
      scope: scope.trim(),
      category: category.trim(),
      effectiveDate,
      reviewDate,
      summary: summary.trim(),
      clauses: clauses.map((c) => c.trim()).filter(Boolean),
      tags,
    };
  }

  function saveDraft() {
    const data = collect();
    if (!data.title) { showToast('Enter a title before saving draft.', 'error'); return; }
    const policies = readPolicies();
    policies.push({ id: `pol-${Date.now()}`, version: 'v1.0', updatedBy: 'Admin', updatedAt: todayLabel(), changelog: [{ ver: 'v1.0', date: todayLabel(), desc: 'Initial draft created.' }], ...data, status: 'draft' });
    savePolicies(policies);
    showToast('Policy saved as draft!');
  }

  function submit(e) {
    e.preventDefault();
    const data = collect();
    const err = validatePolicyForm(data);
    if (err) { showToast(err, 'error'); return; }
    const policies = readPolicies();
    policies.push({ id: `pol-${Date.now()}`, version: 'v1.0', updatedBy: 'Admin', updatedAt: todayLabel(), changelog: [{ ver: 'v1.0', date: todayLabel(), desc: 'Policy published.' }], ...data, status: 'active' });
    savePolicies(policies);
    showToast('Policy published successfully!');
    setTimeout(() => navigate('/pages/super-admin/policy-management.html'), 1400);
  }

  return (
    <main className="sa-main-v2">
      <section className="policy-page-wrap">
        <Link to="/pages/super-admin/policy-management.html" className="back-link">
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M12 8H4M4 8L8 12M4 8L8 4" /></svg>
          Back to Policy Management
        </Link>

        <div className="policy-page-header">
          <div>
            <h1>Create New Policy</h1>
            <p>Define a new platform rule or competition policy for NEXUS Esports.</p>
          </div>
          <span className="status-pill pending" id="pv-status">Draft</span>
        </div>

        <form id="policy-form" noValidate style={{ maxWidth: 800, margin: '0 auto' }} onSubmit={submit}>
          <div className="policy-form-card">
            <div className="form-section-label">Basic Details</div>

            <div className="pf-group">
              <label className="pf-label" htmlFor="f-title">Policy Title <span style={{ color: 'var(--red)' }}>*</span></label>
              <input className="pf-input" type="text" id="f-title" placeholder="e.g. Player Conduct & Sportsmanship Policy" autoComplete="off" required value={title} onChange={(e) => setTitle(e.target.value)} />
            </div>

            <div className="pf-row">
              <div className="pf-group">
                <label className="pf-label" htmlFor="f-category">Category</label>
                <select className="pf-select" id="f-category" value={category} onChange={(e) => setCategory(e.target.value)}>
                  <option value="">Select category…</option>
                  {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div className="pf-group">
                <label className="pf-label" htmlFor="f-scope">Applies To</label>
                <select className="pf-select" id="f-scope" value={scope} onChange={(e) => setScope(e.target.value)}>
                  <option value="">Select scope…</option>
                  {SCOPES.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
            </div>

            <div className="pf-group">
              <label className="pf-label" htmlFor="f-summary">Policy Summary <span style={{ color: 'var(--red)' }}>*</span></label>
              <p className="pf-hint">A one or two sentence overview shown on the policy list page.</p>
              <textarea className="pf-textarea" id="f-summary" rows="3" placeholder="Brief description of what this policy covers and who it applies to…" required style={{ minHeight: 80 }} value={summary} onChange={(e) => setSummary(e.target.value)} />
            </div>

            <div className="pf-row">
              <div className="pf-group">
                <label className="pf-label" htmlFor="f-effective">Effective Date</label>
                <input className="pf-input" type="date" id="f-effective" min={today} value={effectiveDate} onChange={(e) => setEffectiveDate(e.target.value)} />
              </div>
              <div className="pf-group">
                <label className="pf-label" htmlFor="f-review">Next Review Date</label>
                <input className="pf-input" type="date" id="f-review" min={minReview} value={reviewDate} onChange={(e) => setReviewDate(e.target.value)} />
              </div>
            </div>

            <div className="pf-group">
              <label className="pf-label" htmlFor="f-status">Publish Status</label>
              <select className="pf-select" id="f-status" value={status} onChange={(e) => setStatus(e.target.value)}>
                <option value="active">Active (Publish Immediately)</option>
                <option value="draft">Draft (Save for Later)</option>
              </select>
            </div>

            <div className="form-section-label">Rule Clauses <span style={{ color: 'var(--red)' }}>*</span></div>
            <p className="pf-hint" style={{ marginBottom: 14 }}>Each clause is a numbered rule. Add at least one clause before publishing.</p>

            <PolicyEditor clauses={clauses} tags={tags} onClausesChange={setClauses} onTagsChange={setTags} />

            <div className="pf-actions">
              <button type="submit" className="pf-btn-submit">Publish Policy</button>
              <button type="button" className="pf-btn-draft" id="btn-draft" onClick={saveDraft}>Save as Draft</button>
              <button type="button" className="pf-btn-cancel" onClick={() => { if (window.confirm('Discard changes and go back?')) navigate('/pages/super-admin/policy-management.html'); }}>Cancel</button>
            </div>
          </div>
        </form>
      </section>
    </main>
  );
}


