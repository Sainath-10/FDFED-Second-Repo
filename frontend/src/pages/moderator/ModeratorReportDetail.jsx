/**
 * NEXUS ESPORTS — Community Moderator report investigation
 *
 * Four tabs: Organiser info, Competition info, Communication & evidence, and an
 * Activity timeline generated from real audit/status records (never fabricated).
 */
import { useCallback, useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { LocalReportsAPI as ReportsAPI } from '../../services/local/reporting.js';
import useReportSync from '../../hooks/useReportSync.js';
import ReputationBadge from '../../components/ReputationBadge.jsx';
import EvidenceGallery from '../../components/EvidenceGallery.jsx';
import { DiscardModal, ModeratorDecisionModal } from '../../components/ReportActionModals.jsx';
import { PRIORITY_META, capitalise, formatDate, formatINR, reportCode } from '../../lib/reporting.js';
import { showToast } from '../../lib/toast.js';
import '../../styles/pages/admin/dashboard.css';
import '../../styles/pages/reports.css';
import '../../styles/pages/reports.css';

const TABS = [
  { key: 'organiser', label: 'Organiser' },
  { key: 'competition', label: 'Competition' },
  { key: 'communication', label: 'Communication & Evidence' },
  { key: 'timeline', label: 'Activity Timeline' },
];

export default function ModeratorReportDetail() {
  const [params] = useSearchParams();
  const id = params.get('id') || '';
  const [tab, setTab] = useState('organiser');
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [modal, setModal] = useState(null);

  const load = useCallback(async () => {
    if (!id) { setError('No report selected.'); return; }
    const res = await ReportsAPI.investigation(id);
    if (!res.ok) { setError(res.error || 'Unable to load this investigation.'); return; }
    setData(res.data);
  }, [id]);

  useEffect(() => { load(); }, [load]);
  useReportSync(load);

  if (error) {
    return (
      <main className="admin-page reports-page">
        <div className="report-inline-error">{error}</div>
        <Link className="report-btn" to="/pages/moderator/reports.html">Back to reports</Link>
      </main>
    );
  }
  if (!data) return <main className="admin-page reports-page"><div className="report-empty">Loading investigation…</div></main>;

  const { report, organiser, competition, teams, matches, chat, financial, relatedReports, timeline, evidence } = data;
  const priority = PRIORITY_META[report.priority] || PRIORITY_META.medium;
  const open = ['new', 'under_review', 'awaiting_response'].includes(report.status);

  return (
    <main className="admin-page reports-page">
      <div className="reports-head">
        <div>
          <h1 className="reports-title">{reportCode(report)} · Investigation</h1>
          <p className="reports-subtitle">
            @{report.reporterUsername} reported organiser @{report.reportedUsername} · {capitalise(report.reasonCode)}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <Link className="report-btn" to="/pages/moderator/reports.html">Back to reports</Link>
          {open && (
            <>
              <button className="report-btn primary" onClick={() => setModal('act')}>Record decision</button>
              <button className="report-btn danger" onClick={() => setModal('discard')}>Discard</button>
            </>
          )}
        </div>
      </div>

      <div className="report-card">
        <div className="report-card-top">
          <span className="report-pill" style={{ color: priority.color, background: priority.bg, border: `1px solid ${priority.border}` }}>
            {priority.label}
          </span>
          <span className="report-pill" style={{ color: '#cbd5e1', border: '1px solid #334155' }}>{capitalise(report.status)}</span>
          <ReputationBadge level={organiser.profile.level} limit={organiser.profile.limit} />
        </div>
        <div className="report-meta">
          <span>🏆 {report.competitionName}</span>
          <span>🕒 {formatDate(report.createdAt)}</span>
          <span>Organiser history: {organiser.substantiatedReports} substantiated</span>
          <span>Warnings: {organiser.warnings}</span>
        </div>
        <p className="report-desc">{report.description}</p>

        {report.originalReport && (
          <div className="report-context-card" style={{ marginTop: 14 }}>
            <div className="report-context-head">Original report being complained about</div>
            <div className="report-context-row"><span>Report</span><strong>{report.originalReport.code}</strong></div>
            <div className="report-context-row"><span>Original finding</span><strong>{capitalise(report.originalReport.finding)}</strong></div>
            <div className="report-context-row"><span>Original action</span><strong>{capitalise(report.originalReport.action)}</strong></div>
            <div className="report-context-row"><span>Recorded by</span><strong>@{report.originalReport.resolvedBy}</strong></div>
            {report.originalReport.conclusion && (
              <p className="report-context-note">{report.originalReport.conclusion}</p>
            )}
            <p className="report-context-note">Original report: {report.originalReport.description}</p>
          </div>
        )}
      </div>

      <div className="investigation-tabs" style={{ marginTop: 18 }}>
        {TABS.map((entry) => (
          <button
            key={entry.key}
            className={`investigation-tab ${tab === entry.key ? 'active' : ''}`}
            onClick={() => setTab(entry.key)}
          >
            {entry.label}
          </button>
        ))}
      </div>

      {tab === 'organiser' && (
        <div className="investigation-grid">
          <div className="info-card">
            <h3>Account</h3>
            <dl>
              <dt>Username</dt><dd>@{organiser.username}</dd>
              <dt>Reputation level</dt><dd>{capitalise(organiser.profile.level)} · max {formatINR(organiser.profile.limit)}</dd>
              <dt>Platform ceiling</dt><dd>{formatINR(organiser.profile.globalMax)}</dd>
              <dt>Outstanding obligations</dt><dd>{formatINR(organiser.profile.counters.outstandingObligations)}</dd>
              <dt>Ban status</dt>
              <dd>
                {organiser.profile.lifetimeBan
                  ? 'Lifetime organising ban'
                  : organiser.profile.bannedUntil
                    ? `Banned until ${formatDate(organiser.profile.bannedUntil)}`
                    : 'None'}
              </dd>
            </dl>
          </div>
          <div className="info-card">
            <h3>Counters</h3>
            <dl>
              <dt>Qualifying ₹50k+ tournaments</dt><dd>{organiser.profile.counters.qualifyingAbove50k}</dd>
              <dt>Qualifying ₹7k+ (orange recovery)</dt><dd>{organiser.profile.counters.qualifyingAbove7k}</dd>
              <dt>Qualifying ₹5k+ (red recovery)</dt><dd>{organiser.profile.counters.qualifyingAbove5k}</dd>
              <dt>Overdue payments</dt><dd>{organiser.profile.counters.overduePaymentCount}</dd>
              <dt>Substantiated violations</dt><dd>{organiser.profile.counters.mediumViolationCount}</dd>
            </dl>
          </div>
          <div className="info-card">
            <h3>Active restrictions</h3>
            {organiser.activeRestrictions.length === 0 ? (
              <p style={{ color: '#86efac', fontSize: 12.5 }}>No active restrictions.</p>
            ) : (
              <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: 8 }}>
                {organiser.activeRestrictions.map((sanction) => (
                  <li key={sanction.id} style={{ fontSize: 12.5, color: '#fca5a5' }}>
                    <strong>{capitalise(sanction.type)}</strong> · {sanction.reason}
                    <span style={{ display: 'block', color: '#94a3b8', fontSize: 11 }}>
                      {formatDate(sanction.startsAt)} → {sanction.endsAt ? formatDate(sanction.endsAt) : 'open-ended'}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="info-card">
            <h3>Reputation history</h3>
            {organiser.reputationHistory.length === 0 ? (
              <p style={{ color: '#94a3b8', fontSize: 12.5 }}>No transitions recorded yet.</p>
            ) : (
              <ul className="timeline">
                {organiser.reputationHistory.map((entry) => (
                  <li key={entry.id}>
                    {capitalise(entry.fromLevel)} → <strong>{capitalise(entry.toLevel)}</strong>
                    <span className="t">{formatDate(entry.createdAt)} · @{entry.reviewer} · {entry.reason}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}

      {tab === 'competition' && (
        <div className="investigation-grid">
          <div className="info-card">
            <h3>Competition</h3>
            <dl>
              <dt>Name</dt><dd>{competition?.name || '—'}</dd>
              <dt>Game</dt><dd>{competition?.game || '—'}</dd>
              <dt>Prize pool</dt><dd>{competition?.prizePool || formatINR(competition?.prize)}</dd>
              <dt>Status</dt><dd>{capitalise(competition?.status)}</dd>
              <dt>Approval</dt><dd>{capitalise(competition?.approvalStatus)}</dd>
              <dt>Dates</dt>
              <dd>{formatDate(competition?.startDate)} → {formatDate(competition?.endDate)}</dd>
              <dt>Entry fee</dt><dd>{competition?.entryFee || 'Free'}</dd>
            </dl>
          </div>
          <div className="info-card">
            <h3>Registration</h3>
            <dl>
              <dt>Registrations open</dt><dd>{formatDate(competition?.registrationOpenAt)}</dd>
              <dt>Registrations close</dt><dd>{formatDate(competition?.registrationCloseAt)}</dd>
              <dt>Max teams</dt><dd>{competition?.maxTeams ?? '—'}</dd>
              <dt>Players per team</dt><dd>{competition?.maxPlayersPerTeam ?? '—'}</dd>
              <dt>Visibility</dt><dd>{capitalise(competition?.visibility)}</dd>
            </dl>
          </div>
          <div className="info-card">
            <h3>Teams ({teams.length})</h3>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: 6 }}>
              {teams.slice(0, 12).map((team) => (
                <li key={team.id} style={{ fontSize: 12.5, color: '#cbd5e1' }}>
                  {team.name} · leader @{team.leaderUsername || team.leaderId} · {capitalise(team.status)}
                </li>
              ))}
              {teams.length === 0 && <li style={{ color: '#94a3b8', fontSize: 12.5 }}>No teams registered.</li>}
            </ul>
          </div>
          <div className="info-card">
            <h3>Matches ({matches.length})</h3>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: 6 }}>
              {matches.slice(0, 10).map((match) => (
                <li key={match.id} style={{ fontSize: 12.5, color: '#cbd5e1' }}>
                  {match.team1Name || '—'} vs {match.team2Name || '—'} · {capitalise(match.status)} · {formatDate(match.scheduledAt)}
                </li>
              ))}
              {matches.length === 0 && <li style={{ color: '#94a3b8', fontSize: 12.5 }}>No matches scheduled.</li>}
            </ul>
          </div>
        </div>
      )}

      {tab === 'communication' && (
        <div className="investigation-grid">
          <div className="info-card">
            <h3>Evidence on the report</h3>
            {evidence.length === 0 ? (
              <p style={{ color: '#94a3b8', fontSize: 12.5 }}>No files attached.</p>
            ) : (
              <EvidenceGallery files={evidence} />
            )}
          </div>
          <div className="info-card">
            <h3>Related reports</h3>
            {relatedReports.length === 0 ? (
              <p style={{ color: '#94a3b8', fontSize: 12.5 }}>No related reports.</p>
            ) : (
              <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: 8 }}>
                {relatedReports.map((related) => (
                  <li key={related.id} style={{ fontSize: 12.5, color: '#cbd5e1' }}>
                    <Link to={`/pages/moderator/report-detail.html?id=${related.id}`} style={{ color: '#c6ff33' }}>
                      {reportCode(related)}
                    </Link>{' '}
                    · {capitalise(related.reasonCode)} · {capitalise(related.status)}
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="info-card">
            <h3>Competition chat (latest)</h3>
            {chat.length === 0 ? (
              <p style={{ color: '#94a3b8', fontSize: 12.5 }}>No messages recorded.</p>
            ) : (
              <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: 7, maxHeight: 260, overflowY: 'auto' }}>
                {chat.slice(-30).map((message) => (
                  <li key={message.id} style={{ fontSize: 12, color: '#cbd5e1' }}>
                    <strong style={{ color: '#c6ff33' }}>@{message.authorUsername}</strong> · {message.body}
                    <span style={{ display: 'block', color: '#64748b', fontSize: 10.5 }}>{formatDate(message.createdAt)}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="info-card">
            <h3>Financial records</h3>
            {financial.length === 0 ? (
              <p style={{ color: '#94a3b8', fontSize: 12.5 }}>No financial records for this competition.</p>
            ) : (
              <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: 7 }}>
                {financial.map((row) => (
                  <li key={row.id} style={{ fontSize: 12.5, color: '#cbd5e1' }}>
                    {formatINR(row.grossAmount)} · {capitalise(row.status)} · {formatDate(row.createdAt)}
                  </li>
                ))}
              </ul>
            )}
            <p style={{ color: '#64748b', fontSize: 11, marginBottom: 0 }}>
              Evidence only — financial records never create a separate finance queue.
            </p>
          </div>
        </div>
      )}

      {tab === 'timeline' && (
        <div className="info-card">
          <h3>Chronological activity (from recorded audit events)</h3>
          {timeline.length === 0 ? (
            <p style={{ color: '#94a3b8', fontSize: 12.5 }}>No audit events recorded for this case yet.</p>
          ) : (
            <ul className="timeline">
              {timeline.map((event, index) => (
                <li key={`${event.type}-${index}`}>
                  <strong>{capitalise(event.type)}</strong>{event.details ? ` — ${event.details}` : ''}
                  <span className="t">{formatDate(event.at)} · @{event.actor || 'system'}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {modal === 'discard' && (
        <DiscardModal
          report={report}
          onClose={() => setModal(null)}
          onDone={() => { setModal(null); showToast('Report discarded.', 'success'); load(); }}
        />
      )}
      {modal === 'act' && (
        <ModeratorDecisionModal
          report={report}
          onClose={() => setModal(null)}
          onDone={() => { setModal(null); showToast('Decision recorded and the organiser notified.', 'success'); load(); }}
        />
      )}
    </main>
  );
}
