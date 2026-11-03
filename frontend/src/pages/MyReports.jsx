/**
 * NEXUS ESPORTS — Reports
 *
 * Player view: reports I filed or that were filed against me, the case
 * discussions I participate in, and (for organisers) the reputation / prize-pool
 * exception tools.
 */
import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { LocalReportsAPI as ReportsAPI, LocalReputationAPI as ReputationAPI } from '../services/local/reporting.js';
import useReportSync from '../hooks/useReportSync.js';
import { useAuth } from '../context/AuthContext.jsx';
import ReportCard from '../components/ReportCard.jsx';
import ReputationBadge from '../components/ReputationBadge.jsx';
import { STATUS_TABS, formatDate, formatINR, capitalise } from '../lib/reporting.js';
import { showToast } from '../lib/toast.js';
import '../styles/pages/reports.css';

export default function MyReports() {
  const { session } = useAuth();
  const [tab, setTab] = useState('all');
  const [reports, setReports] = useState([]);
  const [discussions, setDiscussions] = useState([]);
  const [reputation, setReputation] = useState(null);
  const [exceptions, setExceptions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const [requesting, setRequesting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [mine, threads, profile, myExceptions] = await Promise.all([
        ReportsAPI.mine(),
        ReportsAPI.myDiscussions(),
        ReputationAPI.me(),
        ReputationAPI.myExceptions(),
      ]);
      if (mine.ok && Array.isArray(mine.data)) setReports(mine.data);
      else if (!mine.ok) setError(mine.error || 'Unable to load your reports.');
      if (threads.ok && Array.isArray(threads.data)) setDiscussions(threads.data);
      if (profile.ok && profile.data) setReputation(profile.data);
      if (myExceptions.ok && Array.isArray(myExceptions.data)) setExceptions(myExceptions.data);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);
  useReportSync(load);

  async function requestException() {
    const value = Number(String(amount).replace(/[^0-9.]/g, ''));
    if (!value || value <= 0) { showToast('Enter the prize-pool amount you need.', 'error'); return; }
    if (reason.trim().length < 10) { showToast('Explain why the exception is needed (10+ characters).', 'error'); return; }
    setRequesting(true);
    const res = await ReputationAPI.requestException(value, reason.trim());
    setRequesting(false);
    if (!res.ok) { showToast(res.error || 'Unable to request an exception.', 'error'); return; }
    showToast('Exception request submitted for administrative review.', 'success');
    setAmount('');
    setReason('');
    load();
  }

  const filtered = tab === 'all' ? reports : reports.filter((report) => report.status === tab);

  return (
    <main className="main-content reports-page">
      <div className="reports-head">
        <div>
          <h1 className="reports-title">Reports</h1>
          <p className="reports-subtitle">
            Track what you filed and what was filed about you. Case discussions appear here as soon as a
            reviewer opens one.
          </p>
        </div>
      </div>

      {error && <div className="report-inline-error">{error}</div>}

      {reputation && (
        <section style={{ marginBottom: 24 }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center', marginBottom: 8 }}>
            <ReputationBadge level={reputation.level} limit={reputation.limit} />
            <span style={{ color: '#94a3b8', fontSize: 12.5 }}>
              Platform maximum {formatINR(reputation.globalMax)} · level limit {formatINR(reputation.levelLimit)}
            </span>
          </div>
          <div className="reputation-note">
            {reputation.level === 'blue'
              ? 'Blue means there is not enough history to establish reliability yet — not that you are untrusted.'
              : reputation.level === 'green'
                ? 'Green reflects a reliable record. The platform ceiling still applies.'
                : `Your current level limits a competition's prize pool to ${formatINR(reputation.limit)}.`}
            {reputation.bannedUntil && ` · Organising ban until ${formatDate(reputation.bannedUntil)}`}
            {reputation.lifetimeBan && ' · Lifetime organising ban'}
          </div>

          <div className="info-card" style={{ marginTop: 12 }}>
            <h3>Prize-pool exception</h3>
            <p style={{ color: '#94a3b8', fontSize: 12.5, marginTop: 0 }}>
              Exceptions are single-use, approved by an administrator, never exceed {formatINR(reputation.globalMax)},
              and never change your reputation or permanent limit. They are handled outside the report system.
            </p>
            <div className="report-form-grid">
              <div className="report-field">
                <label htmlFor="exception-amount">Prize pool needed (₹)</label>
                <input
                  id="exception-amount"
                  inputMode="numeric"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="300000"
                />
              </div>
              <div className="report-field">
                <label htmlFor="exception-reason">Reason</label>
                <input
                  id="exception-reason"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Sponsor-backed community event"
                />
              </div>
            </div>
            <button className="report-btn primary" disabled={requesting} onClick={requestException}>
              {requesting ? 'Submitting…' : 'Request exception'}
            </button>

            {exceptions.length > 0 && (
              <ul style={{ listStyle: 'none', margin: '14px 0 0', padding: 0, display: 'grid', gap: 7 }}>
                {exceptions.map((row) => (
                  <li key={row.id} style={{ fontSize: 12.5, color: '#cbd5e1' }}>
                    {formatINR(row.requestedAmount)} · <strong>{capitalise(row.status)}</strong> · {formatDate(row.createdAt)}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      )}

      <h2 style={{ fontSize: 16, color: '#e2e8f0', marginBottom: 10 }}>Case discussions</h2>
      {discussions.length === 0 ? (
        <div className="report-empty" style={{ marginBottom: 22 }}>No case discussions involve you yet.</div>
      ) : (
        <div className="reports-list" style={{ marginBottom: 22 }}>
          {discussions.map((thread) => (
            <div className="report-card" key={thread.discussionId}>
              <div className="report-card-top">
                <span className="report-code">{thread.code}</span>
                <span className="report-pill" style={{ color: thread.status === 'open' ? '#c6ff33' : '#94a3b8', border: '1px solid #334155' }}>
                  {thread.status === 'open' ? 'Open' : 'Read-only'}
                </span>
                <span className="report-pill" style={{ color: '#94a3b8', border: '1px solid #334155' }}>
                  You are the {capitalise(thread.as)}
                </span>
              </div>
              <div className="report-meta">
                <span>{capitalise(thread.reasonCode)}</span>
                <span>Opened {formatDate(thread.createdAt)}</span>
              </div>
              <div className="report-actions">
                <Link className="report-btn primary" to={`/pages/case-discussion.html?discussionId=${thread.discussionId}`}>
                  Enter discussion
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}

      <h2 style={{ fontSize: 16, color: '#e2e8f0', marginBottom: 10 }}>Reports</h2>
      <div className="reports-tabs">
        <button className={`reports-tab ${tab === 'all' ? 'active' : ''}`} onClick={() => setTab('all')}>
          All <span className="count">{reports.length}</span>
        </button>
        {STATUS_TABS.map((status) => (
          <button
            key={status.key}
            className={`reports-tab ${tab === status.key ? 'active' : ''}`}
            onClick={() => setTab(status.key)}
          >
            {status.label}
            <span className="count">{reports.filter((report) => report.status === status.key).length}</span>
          </button>
        ))}
      </div>

      {loading ? (
        <div className="report-empty">Loading your reports…</div>
      ) : filtered.length === 0 ? (
        <div className="report-empty">No reports in this view.</div>
      ) : (
        <div className="reports-list">
          {filtered.map((report) => (
            <ReportCard
              key={report.id}
              report={report}
              actions={(
                report.status !== 'discarded' && report.status !== 'resolved' && report.queue === 'organiser' ? (
                  <Link className="report-btn" to={`/pages/comp-info.html?id=${report.competitionId}`}>Competition</Link>
                ) : null
              )}
            />
          ))}
        </div>
      )}
      <p style={{ color: '#64748b', fontSize: 11.5, marginTop: 18 }}>
        Signed in as @{session?.username}. A report count is never proof of misconduct.
      </p>
    </main>
  );
}
