import React, { useState, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import Shell from '../../components/Layout/Shell';
import '../../styles/pages/super-admin/super-dashboard.css';
import '../../styles/pages/super-admin/view-policy.css';

const POLICY_STORE_KEY = 'nexus_policies';

export default function SuperAdminViewPolicyPage() {
  const [searchParams] = useSearchParams();
  const policyId = searchParams.get('id');
  const [policy, setPolicy] = useState(null);

  useEffect(() => {
    let existing = [];
    try {
      const raw = localStorage.getItem(POLICY_STORE_KEY);
      existing = raw ? JSON.parse(raw) : [];
    } catch (_) {}

    const found = existing.find(p => p.id === policyId) || existing[0];
    if (found) setPolicy(found);
  }, [policyId]);

  if (!policy) {
    return (
      <Shell sidebarVariant="super-admin" activePage="policy">
        <main className="sa-main-v2">
          <div style={{ padding: '60px', textAlign: 'center', color: 'var(--text-muted)' }}>Loading policy details...</div>
        </main>
      </Shell>
    );
  }

  const clauses = policy.clauses || [];
  const changelog = policy.changelog || [];
  const tags = policy.tags || [];

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
              <h1>{policy.title}</h1>
              <p style={{ fontSize: '14px', color: 'var(--accent, #c6ff33)', fontWeight: 700, marginTop: '4px' }}>
                Version: {policy.version || 'v1.0'} · Category: {policy.category || 'General'}
              </p>
            </div>
            <div className="header-actions" style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
              <button type="button" className="btn-table-secondary" onClick={() => window.print()} style={{ padding: '8px 16px' }}>
                🖨️ Print Policy
              </button>
              <Link to={`/super-admin/edit-policy?id=${encodeURIComponent(policy.id)}`} className="btn-table-primary" style={{ padding: '8px 16px', textDecoration: 'none' }}>
                ✏️ Edit Policy
              </Link>
            </div>
          </div>

          <div className="policy-two-col" style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 300px', gap: '24px', alignItems: 'start' }}>
            {/* Left: Content */}
            <div className="policy-main-content">
              {/* Hero Overview */}
              <div className="policy-view-hero" style={{ background: '#0a0a0a', border: '1px solid #262626', borderRadius: '14px', padding: '24px', marginBottom: '24px' }}>
                <h3 style={{ margin: '0 0 12px', fontSize: '16px', fontWeight: 800, color: '#fff' }}>Policy Purpose & Scope</h3>
                <p style={{ margin: 0, color: '#d4d4d4', fontSize: '14px', lineHeight: 1.6 }}>{policy.summary}</p>
              </div>

              {/* Numbered Clauses */}
              <div className="policy-clauses-card" style={{ background: '#0a0a0a', border: '1px solid #262626', borderRadius: '14px', padding: '28px', marginBottom: '24px' }}>
                <h2 style={{ margin: '0 0 20px', fontSize: '18px', fontWeight: 800, color: '#fff' }}>Rule Clauses</h2>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
                  {clauses.map((clause, idx) => (
                    <div key={idx} className="policy-clause" style={{ display: 'flex', gap: '14px', alignItems: 'flex-start' }}>
                      <span style={{ fontSize: '14px', fontWeight: 900, color: 'var(--accent, #c6ff33)', minWidth: '24px' }}>{idx + 1}.</span>
                      <div className="clause-body" style={{ color: '#e5e5e5', fontSize: '14px', lineHeight: 1.6 }}>{clause}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Changelog */}
              {changelog.length > 0 && (
                <div style={{ background: '#0a0a0a', border: '1px solid #262626', borderRadius: '14px', padding: '24px' }}>
                  <h3 style={{ margin: '0 0 16px', fontSize: '16px', fontWeight: 800, color: '#fff' }}>Version Changelog</h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {changelog.map((entry, idx) => (
                      <div key={idx} style={{ display: 'flex', gap: '16px', alignItems: 'center', fontSize: '13px', color: 'var(--text-muted)' }}>
                        <span style={{ fontWeight: 800, color: '#c6ff33' }}>{entry.ver}</span>
                        <span>{entry.date}</span>
                        <span style={{ color: '#fff' }}>— {entry.desc}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Right: Sidebar Metadata */}
            <aside className="policy-sidebar" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div style={{ background: '#0a0a0a', border: '1px solid #262626', borderRadius: '14px', padding: '22px' }}>
                <h3 style={{ margin: '0 0 16px', fontSize: '15px', fontWeight: 800, color: '#fff' }}>Metadata & Status</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', fontSize: '13px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-muted)' }}>Status:</span>
                    <span className={`status-pill ${policy.status === 'active' ? 'approved' : 'pending'}`}>{policy.status}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-muted)' }}>Applies To:</span>
                    <span style={{ color: '#fff', fontWeight: 600 }}>{policy.scope || 'Platform-wide'}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-muted)' }}>Effective:</span>
                    <span style={{ color: '#fff' }}>{policy.effectiveDate || 'Immediate'}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-muted)' }}>Next Review:</span>
                    <span style={{ color: '#fff' }}>{policy.reviewDate || 'Annual'}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-muted)' }}>Last Updated:</span>
                    <span style={{ color: '#fff' }}>{policy.updatedAt}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-muted)' }}>Updated By:</span>
                    <span style={{ color: '#c6ff33', fontWeight: 600 }}>{policy.updatedBy}</span>
                  </div>
                </div>
              </div>

              {tags.length > 0 && (
                <div style={{ background: '#0a0a0a', border: '1px solid #262626', borderRadius: '14px', padding: '22px' }}>
                  <h3 style={{ margin: '0 0 12px', fontSize: '15px', fontWeight: 800, color: '#fff' }}>Tags</h3>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                    {tags.map((t, idx) => (
                      <span key={idx} style={{ padding: '4px 10px', borderRadius: '6px', background: 'rgba(255,255,255,0.06)', color: 'var(--text-muted)', fontSize: '12px' }}>
                        #{t}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </aside>
          </div>
        </section>
      </main>
    </Shell>
  );
}
