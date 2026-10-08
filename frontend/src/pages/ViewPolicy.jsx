/**
 * NEXUS ESPORTS — Super Admin · View Policy
 *
 * hero, summary, clauses,
 * tags, policy info sidebar, version history, related policies, print/copy-link and
 * the archive/restore toggle.
 */
import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { showToast } from '../lib/toast.js';
import { readPolicies, savePolicies, normalizePolicyStatus } from '../lib/policies.js';
import '../styles/pages/super-admin/super-dashboard.css';
import '../styles/pages/super-admin/view-policy.css';

const PRINT_CSS = `@media print {
  .page-with-sidebar, .sidebar, #sidebar-mount, #footer-mount, .back-link,
  .policy-page-header .header-actions, .policy-sidebar { display: none !important; }
  .policy-two-col { display: block !important; }
  body, .policy-view-hero { background: #fff !important; color: #000 !important; }
  .policy-view-hero { border: 1px solid #ccc !important; border-radius: 8px !important; }
  .policy-clause .clause-body { color: #222 !important; }
}`;

const EnforcementIcon = () => <span className="section-icon">⚖️</span>;

export default function ViewPolicy() {
  const [params] = useSearchParams();
  const [version, setVersion] = useState(0);

  const policy = useMemo(() => {
    const policies = readPolicies();
    const id = params.get('id') || (policies[0] && policies[0].id);
    return policies.find((p) => p.id === id) || null;
  }, [params, version]);

  if (!policy) {
    return (
      <main className="sa-main-v2">
        <section className="policy-page-wrap">
          <p style={{ padding: 60, color: '#fff' }}>Policy not found. <Link to="/pages/super-admin/policy-management.html" style={{ color: '#c6ff33' }}>Back to list</Link></p>
        </section>
      </main>
    );
  }

  const slug = normalizePolicyStatus(policy.status);
  const statusClass = slug === 'active' ? 'approved' : slug === 'draft' ? 'pending' : slug === 'archived' ? 'rejected' : 'upcoming';

  function toggleArchive() {
    const policies = readPolicies();
    const idx = policies.findIndex((p) => p.id === policy.id);
    if (idx === -1) return;
    policies[idx].status = policies[idx].status === 'archived' ? 'active' : 'archived';
    savePolicies(policies);
    showToast(policies[idx].status === 'archived' ? 'Policy archived.' : 'Policy restored to active.', policies[idx].status === 'archived' ? 'error' : 'success');
    setVersion((v) => v + 1);
  }

  function copyLink() {
    navigator.clipboard.writeText(window.location.href).then(() => showToast('Link copied to clipboard!'));
  }

  return (
    <main className="sa-main-v2">
      <style>{PRINT_CSS}</style>
      <section className="policy-page-wrap">
        <Link to="/pages/super-admin/policy-management.html" className="back-link">
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M12 8H4M4 8L8 12M4 8L8 4" /></svg>
          Back to Policy Management
        </Link>

        <div className="policy-view-hero">
          <div className="version-badge" id="v-badge">{`${policy.version} · ${policy.category}`}</div>
          <h1 id="v-title">{policy.title}</h1>
          <div className="meta">
            <span id="v-scope">Applies to: <strong>{policy.scope}</strong></span>
            <span id="v-effective">Effective: <strong>{policy.effectiveDate || 'TBD'}</strong></span>
            <span id="v-review">Next review: <strong>{policy.reviewDate || 'TBD'}</strong></span>
            <span id="v-updated">Last updated: <strong>{policy.updatedAt}</strong></span>
            <span id="v-status" className={`status-pill ${statusClass}`} style={{ fontSize: 11 }}>{slug.charAt(0).toUpperCase() + slug.slice(1)}</span>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 10, marginBottom: 28, flexWrap: 'wrap', alignItems: 'center' }}>
          <Link to={`/pages/super-admin/edit-policy.html?id=${policy.id}`} className="btn-primary" id="btn-edit-policy" style={{ fontSize: 13, padding: '9px 18px', textDecoration: 'none' }}>Edit Policy</Link>
          <button className="btn-export" id="btn-archive" onClick={toggleArchive} style={{ marginLeft: 'auto' }}>
            <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M2 4h12v1.5a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V4z" /><path d="M3 6.5V13a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1V6.5" /><line x1="6" y1="9.5" x2="10" y2="9.5" /></svg>
            {slug === 'archived' ? 'Restore Policy' : 'Archive Policy'}
          </button>
        </div>

        <div className="policy-two-col">
          <div>
            <div className="policy-content-block">
              <h2><span className="section-icon">📋</span>Overview</h2>
              <p id="v-summary" style={{ fontSize: 15, color: '#c8ccd4', lineHeight: 1.7 }}>{policy.summary}</p>
              <div style={{ marginTop: 18 }} id="v-tags">
                {(policy.tags || []).map((t) => (
                  <span key={t} style={{ display: 'inline-flex', alignItems: 'center', background: 'rgba(198,255,51,0.1)', border: '1px solid rgba(198,255,51,0.2)', color: 'var(--accent)', fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 4, margin: 3 }}>{t}</span>
                ))}
              </div>
            </div>

            <div className="policy-content-block">
              <h2><span className="section-icon">📜</span>Policy Rules &amp; Clauses</h2>
              <div className="policy-highlight">
                <strong>Important:</strong> All clauses below are enforceable rules. Violations are reviewed by platform administrators and may result in warnings, match forfeiture, or permanent account bans depending on severity.
              </div>
              <div id="v-clauses">
                {(policy.clauses || []).map((c, i) => (
                  <div className="policy-clause" key={i}>
                    <div className="clause-index">{i + 1}</div>
                    <div className="clause-body">{c}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="policy-content-block">
              <h2><EnforcementIcon />Enforcement &amp; Penalties</h2>
              <div className="policy-clause"><div className="clause-index">→</div><div className="clause-body"><strong>First offence:</strong> Formal warning issued to player or team captain. Recorded in account history.</div></div>
              <div className="policy-clause"><div className="clause-index">→</div><div className="clause-body"><strong>Second offence:</strong> Match forfeit or competition disqualification depending on severity.</div></div>
              <div className="policy-clause"><div className="clause-index">→</div><div className="clause-body"><strong>Severe or repeated violations:</strong> Temporary or permanent platform ban. All affected results are voided.</div></div>
              <div className="policy-clause">
                <div className="clause-index">→</div>
                <div className="clause-body">
                  Penalty decisions are made by platform admins and may be appealed once through the <Link to="/pages/disputes.html" style={{ color: 'var(--accent)', textDecoration: 'underline' }}>Dispute Resolution Policy</Link>.
                </div>
              </div>
              <div className="policy-warning" style={{ marginTop: 16 }}>
                <strong>Super Admin authority:</strong> Super Admins may override any penalty decision. Their rulings are final and binding.
              </div>
            </div>

            <div className="policy-content-block">
              <h2><span className="section-icon">📝</span>Amendments &amp; Review</h2>
              <div className="policy-clause"><div className="clause-index">→</div><div className="clause-body">This policy is reviewed and updated periodically. The review date is shown in the policy header above.</div></div>
              <div className="policy-clause"><div className="clause-index">→</div><div className="clause-body">All registered users and teams are notified via platform notification of any material policy changes at least 7 days before they take effect.</div></div>
              <div className="policy-clause"><div className="clause-index">→</div><div className="clause-body">Continued participation in NEXUS Esports competitions after a policy update constitutes acceptance of the revised terms.</div></div>
            </div>
          </div>

          <aside className="policy-sidebar">
            <div className="policy-sidebar-block">
              <h3>Policy Information</h3>
              <div className="sidebar-info-row"><span className="k">Version</span><span className="v" id="si-version">{policy.version}</span></div>
              <div className="sidebar-info-row"><span className="k">Status</span><span className="v" id="si-status">{slug.charAt(0).toUpperCase() + slug.slice(1)}</span></div>
              <div className="sidebar-info-row"><span className="k">Category</span><span className="v" id="si-category">{policy.category}</span></div>
              <div className="sidebar-info-row"><span className="k">Scope</span><span className="v" id="si-scope">{policy.scope}</span></div>
              <div className="sidebar-info-row"><span className="k">Effective</span><span className="v" id="si-effective">{policy.effectiveDate || 'TBD'}</span></div>
              <div className="sidebar-info-row"><span className="k">Review</span><span className="v" id="si-review">{policy.reviewDate || 'TBD'}</span></div>
              <div className="sidebar-info-row"><span className="k">Updated by</span><span className="v" id="si-author">{policy.updatedBy}</span></div>
              <div className="sidebar-info-row"><span className="k">Updated at</span><span className="v" id="si-updated">{policy.updatedAt}</span></div>
            </div>

            <div className="policy-sidebar-block">
              <h3>Version History</h3>
              <div className="changelog-list" id="v-changelog">
                {(policy.changelog || []).map((c, i) => (
                  <div className="changelog-item" key={i}>
                    <div className={`changelog-dot ${i > 0 ? 'old' : ''}`}></div>
                    <div className="changelog-info">
                      <div className="cl-ver">{c.ver}</div>
                      <div className="cl-date">{c.date}</div>
                      <div className="cl-desc">{c.desc}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="policy-sidebar-block">
              <h3>Related Policies</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <Link to="/pages/super-admin/view-policy.html?id=pol-001" style={{ fontSize: 13, color: 'var(--accent)', textDecoration: 'none', padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>Fair Play &amp; Anti-Cheat →</Link>
                <Link to="/pages/super-admin/view-policy.html?id=pol-002" style={{ fontSize: 13, color: 'var(--accent)', textDecoration: 'none', padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>Team Registration Requirements →</Link>
                <Link to="/pages/super-admin/view-policy.html?id=pol-003" style={{ fontSize: 13, color: 'var(--accent)', textDecoration: 'none', padding: '8px 0' }}>Dispute Resolution Policy →</Link>
              </div>
            </div>

            <div className="policy-sidebar-block">
              <h3>Admin Actions</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <Link to={`/pages/super-admin/edit-policy.html?id=${policy.id}`} id="btn-edit-sidebar" className="btn-table-primary" style={{ justifyContent: 'center', padding: 10 }}>Edit This Policy</Link>
                <button className="btn-table-secondary" style={{ justifyContent: 'center', padding: 10 }} onClick={toggleArchive}>Archive Policy</button>
                <button className="btn-table-secondary" style={{ justifyContent: 'center', padding: 10 }} onClick={() => window.print()}>Print / Export</button>
                <button className="btn-table-secondary" style={{ justifyContent: 'center', padding: 10 }} onClick={copyLink}>Copy Link</button>
              </div>
            </div>
          </aside>
        </div>
      </section>
    </main>
  );
}


