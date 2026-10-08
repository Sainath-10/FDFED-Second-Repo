/**
 * NEXUS ESPORTS — Super Admin · Edit Policy
 *
 * loads a policy by
 * ?id= (falling back to the first), versioned save (minor bump) as draft or publish,
 * and delete.
 */
import { useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { showToast } from '../lib/toast.js';
import PolicyEditor from '../components/PolicyEditor.jsx';
import { readPolicies, savePolicies, validatePolicyForm, todayISO, addDays, todayLabel, bumpMinorVersion, normalizePolicyStatus } from '../lib/policies.js';
import '../styles/pages/super-admin/super-dashboard.css';
import '../styles/pages/super-admin/edit-policy.css';

const CATEGORIES = ['Conduct', 'Registration', 'Disputes', 'Finance', 'Operations', 'Technical', 'Other'];
const SCOPES = ['All Competitions', 'Team Competitions', 'Solo Competitions', 'Admins Only', 'Platform-wide'];

export default function EditPolicy() {
  const [params] = useSearchParams();
  const navigate = useNavigate();

  const policy = useMemo(() => {
    const policies = readPolicies();
    const id = params.get('id') || (policies[0] && policies[0].id);
    return policies.find((p) => p.id === id) || null;
  }, [params]);

  const [title, setTitle] = useState(policy ? policy.title : '');
  const [category, setCategory] = useState(policy ? policy.category || '' : '');
  const [scope, setScope] = useState(policy ? policy.scope || '' : '');
  const [summary, setSummary] = useState(policy ? policy.summary || '' : '');
  const [effectiveDate, setEffectiveDate] = useState(policy ? policy.effectiveDate || '' : '');
  const [reviewDate, setReviewDate] = useState(policy ? policy.reviewDate || '' : '');
  const [status, setStatus] = useState(policy ? normalizePolicyStatus(policy.status) : 'active');
  const [clauses, setClauses] = useState(policy ? [...(policy.clauses || [])] : []);
  const [tags, setTags] = useState(policy ? [...(policy.tags || [])] : []);

  if (!policy) {
    return (
      <main className="sa-main-v2">
        <section className="policy-page-wrap">
          <p style={{ padding: 60, color: '#fff' }}>Policy not found. <Link to="/pages/super-admin/policy-management.html" style={{ color: '#c6ff33' }}>Back to list</Link></p>
        </section>
      </main>
    );
  }

  const today = todayISO();
  const minReview = addDays(effectiveDate || today, 1);
  const statusLabel = normalizePolicyStatus(policy.status);

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
    if (!data.title) { showToast('Title cannot be empty.', 'error'); return; }
    const policies = readPolicies();
    const idx = policies.findIndex((p) => p.id === policy.id);
    if (idx !== -1) {
      const newVer = bumpMinorVersion(policy.version);
      policies[idx] = { ...policy, ...data, status: 'draft', version: newVer, updatedAt: todayLabel(), changelog: [{ ver: newVer, date: todayLabel(), desc: 'Saved as draft.' }, ...(policy.changelog || [])] };
      savePolicies(policies);
    }
    showToast('Changes saved as draft!');
  }

  function submit(e) {
    e.preventDefault();
    const data = collect();
    const err = validatePolicyForm(data);
    if (err) { showToast(err, 'error'); return; }
    const policies = readPolicies();
    const idx = policies.findIndex((p) => p.id === policy.id);
    if (idx !== -1) {
      const statusToSave = data.status === 'draft' ? 'active' : data.status;
      const newVer = bumpMinorVersion(policy.version);
      policies[idx] = { ...policy, ...data, status: statusToSave, version: newVer, updatedAt: todayLabel(), changelog: [{ ver: newVer, date: todayLabel(), desc: 'Policy updated and published.' }, ...(policy.changelog || [])] };
      savePolicies(policies);
    }
    showToast('Policy updated successfully!');
    setTimeout(() => navigate(`/pages/super-admin/view-policy.html?id=${policy.id}`), 1400);
  }

  function deletePolicy() {
    if (!window.confirm(`Permanently delete "${policy.title}"? This cannot be undone.`)) return;
    savePolicies(readPolicies().filter((p) => p.id !== policy.id));
    showToast('Policy deleted.', 'error');
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
            <h1 id="edit-policy-name">{policy.title}</h1>
            <p id="edit-policy-ver" style={{ fontSize: 14, color: 'var(--accent)', fontWeight: 700, marginTop: 4 }}>{`${policy.version} · ${statusLabel.charAt(0).toUpperCase()}${statusLabel.slice(1)}`}</p>
          </div>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <span className="status-pill pending" id="pv-status">Draft</span>
            <button id="btn-delete" type="button" className="btn-table-danger" style={{ padding: '8px 16px' }} onClick={deletePolicy}>Delete Policy</button>
          </div>
        </div>

        <div style={{ background: 'rgba(198,255,51,0.05)', border: '1px solid rgba(198,255,51,0.2)', borderRadius: 10, padding: '14px 18px', marginBottom: 28, display: 'flex', alignItems: 'center', gap: 12, fontSize: 13, color: 'var(--text-muted)' }}>
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="#c6ff33" strokeWidth="1.6" strokeLinecap="round"><circle cx="9" cy="9" r="7.5" /><line x1="9" y1="8" x2="9" y2="12.5" /><circle cx="9" cy="5.5" r="0.8" fill="#c6ff33" /></svg>
          Saving increments the version number automatically. The previous version is preserved in the changelog.
        </div>

        <div className="policy-two-col">
          <form id="policy-form" noValidate onSubmit={submit}>
            <div className="policy-form-card">
              <div className="form-section-label">Basic Details</div>

              <div className="pf-group">
                <label className="pf-label" htmlFor="f-title">Policy Title <span style={{ color: 'var(--red)' }}>*</span></label>
                <input className="pf-input" type="text" id="f-title" placeholder="Policy title…" autoComplete="off" required value={title} onChange={(e) => setTitle(e.target.value)} />
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
                <textarea className="pf-textarea" id="f-summary" rows="3" placeholder="Brief description…" required style={{ minHeight: 80 }} value={summary} onChange={(e) => setSummary(e.target.value)} />
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
                <label className="pf-label" htmlFor="f-status">Status</label>
                <select className="pf-select" id="f-status" value={status} onChange={(e) => setStatus(e.target.value)}>
                  <option value="active">Active</option>
                  <option value="draft">Draft</option>
                  <option value="archived">Archived</option>
                </select>
              </div>

              <div className="form-section-label">Rule Clauses <span style={{ color: 'var(--red)' }}>*</span></div>
              <p className="pf-hint" style={{ marginBottom: 14 }}>Edit, reorder, or remove existing clauses. Changes are versioned automatically on save.</p>

              <PolicyEditor clauses={clauses} tags={tags} onClausesChange={setClauses} onTagsChange={setTags} />

              <div className="pf-actions">
                <button type="submit" className="pf-btn-submit">Save &amp; Publish Changes</button>
                <button type="button" className="pf-btn-draft" id="btn-draft" onClick={saveDraft}>Save as Draft</button>
                <button type="button" className="pf-btn-cancel" onClick={() => navigate(-1)}>Cancel</button>
              </div>
            </div>
          </form>

          <aside className="policy-sidebar">
            <div className="policy-sidebar-block">
              <h3>Version Control</h3>
              <div style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: '20px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                <p>Every save increments the minor version (e.g. v2.1 → v2.2).</p>
                <p>The previous version and all changes are preserved in the changelog.</p>
                <p>Major version bumps (e.g. v2.x → v3.0) must be done manually by updating the version field.</p>
              </div>
            </div>

            <div className="policy-sidebar-block" style={{ borderColor: 'rgba(231,0,11,0.2)' }}>
              <h3 style={{ color: 'var(--red)' }}>Danger Zone</h3>
              <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 12 }}>Deleting a policy is permanent and cannot be undone. Consider saving as draft instead.</div>
              <button id="btn-delete-sidebar" type="button" className="btn-table-danger" style={{ width: '100%', justifyContent: 'center', padding: 10 }} onClick={deletePolicy}>Delete This Policy</button>
            </div>
          </aside>
        </div>
      </section>
    </main>
  );
}


