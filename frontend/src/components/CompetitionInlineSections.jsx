import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { CompetitionsAPI, MatchesAPI } from '../services/api.js';
import { ReportsAPI } from '../services/api.js';
import useReportSync from '../hooks/useReportSync.js';
import EvidenceGallery from './EvidenceGallery.jsx';
import { DiscardModal, PlayerDecisionModal } from './ReportActionModals.jsx';
import { showToast } from '../lib/toast.js';
import CompetitionOutcome from './CompetitionOutcome.jsx';
import '../styles/pages/reports.css';
import '../styles/pages/report-workspace.css';
import UsernameSearch from './UsernameSearch.jsx';
import ReportCard from './ReportCard.jsx';

function Initial({ name }) {
  return <span className="cd-inline-avatar">{String(name || '?').replace(/^@/, '').slice(0, 1).toUpperCase()}</span>;
}

export function StandingsSection({ competitionId, teams, matches, outcome }) {
  const [rows, setRows] = useState([]);
  const [error, setError] = useState('');
  useEffect(() => {
    let cancelled = false;
    MatchesAPI.getStandings(competitionId).then((response) => {
      if (cancelled) return;
      if (response.ok) setRows(response.data || []);
      else setError(response.error || 'Could not load standings.');
    });
    return () => { cancelled = true; };
  }, [competitionId, matches]);
  const byName = useMemo(() => new Map(teams.map((team) => [team.name, team])), [teams]);
  return <section className="cd-content-panel"><div className="cd-section-heading"><div><h2>Standings</h2><p>Ranked by points, then wins, then team name. Playoff results do not change league standings.</p></div></div>
    <CompetitionOutcome outcome={outcome} />
    {error && <p className="cd-editor-error" role="alert">{error}</p>}
    <div className="cd-inline-table cd-standings-table"><div className="cd-inline-table-head"><span>#</span><span>Team</span><span>Played</span><span>Won</span><span>Drawn</span><span>Lost</span><span>Points</span></div>
      {rows.map((row, index) => <div className="cd-inline-table-row" key={row.team}><span className="cd-rank">{index + 1}</span><span className="cd-table-team"><Initial name={row.team} /><strong>{row.team}{outcome?.winner === row.team && <em className="cd-outcome-tag">Winner</em>}{outcome?.runnerUp === row.team && <em className="cd-outcome-tag is-runner">Runner-up</em>}</strong><small>{byName.get(row.team)?.status || 'Registered'}</small></span><span>{row.mp}</span><span>{row.w}</span><span>{row.d}</span><span>{row.l}</span><strong>{row.pts}</strong></div>)}
    </div>{!rows.length && !error && <div className="cd-inline-empty">Standings will appear after the first confirmed result.</div>}</section>;
}

export function OrganizersSection({ competition, onChanged }) {
  const primary = competition.createdBy || competition.organizerId;
  const organizers = [...new Set([primary, ...(competition.organizers || [])].filter(Boolean))];
  const coOrganizers = organizers.filter((name) => name !== primary);
  const pending = (competition.pendingOrganizers || []).filter(Boolean);
  const [username, setUsername] = useState('');
  const [busy, setBusy] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  async function mutate(kind, name) {
    setBusy(name); setError(''); setMessage('');
    const response = kind === 'add' ? await CompetitionsAPI.addCoOrganizer(competition.id, name) : await CompetitionsAPI.removeCoOrganizer(competition.id, name);
    setBusy('');
    if (!response.ok) return setError(response.error || `Could not ${kind} organizer.`);
    setUsername(''); setMessage(kind === 'add' ? `Invitation sent to @${name}. They become a co-organizer once they accept.` : `@${name} was removed.`); onChanged();
  }
  return <section className="cd-content-panel"><div className="cd-section-heading"><div><h2>Organizers</h2><p>People who can operate this competition and review its disputes.</p></div></div>
    <div className="cd-organizer-list"><article className="cd-organizer-card is-primary"><Initial name={primary} /><div><strong>@{primary}</strong><small>Primary organizer</small></div><span>Owner</span></article>
      {coOrganizers.map((name) => <article className="cd-organizer-card" key={name}><Initial name={name} /><div><strong>@{name}</strong><small>Co-organizer</small></div><button className="cd-text-danger" disabled={!!busy} onClick={() => mutate('remove', name)}>{busy === name ? 'Removing…' : 'Remove'}</button></article>)}
      {pending.map((name) => <article className="cd-organizer-card" key={`pending-${name}`}><Initial name={name} /><div><strong>@{name}</strong><small>Invitation pending</small></div><button className="cd-text-danger" disabled={!!busy} onClick={() => mutate('remove', name)}>{busy === name ? 'Cancelling…' : 'Cancel invite'}</button></article>)}
    </div>
    <form className="cd-inline-form" onSubmit={(event) => { event.preventDefault(); const clean = username.trim().replace(/^@/, ''); if (clean) mutate('add', clean); }}><div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}><label htmlFor="co-org-search" style={{ flex: 'none' }}>Invite a co-organizer</label><UsernameSearch id="co-org-search" value={username} onChange={setUsername} onPick={(name) => mutate('add', name)} exclude={[...organizers, ...pending]} placeholder="Search players by username…" disabled={!!busy} /></div><button className="cd-button cd-primary" disabled={!!busy || !username.trim()}>{busy ? 'Sending…' : 'Send invitation'}</button></form>
    {error && <p className="cd-editor-error" role="alert">{error}</p>}{message && <p className="cd-editor-success" role="status">{message}</p>}
  </section>;
}

const OPEN_REPORT_STATUSES = ['new', 'under_review', 'awaiting_response'];
const DISPUTE_FILTERS = [
  { value: 'all', label: 'All disputes' },
  { value: 'new', label: 'New' },
  { value: 'under_review', label: 'Under Review' },
  { value: 'awaiting_response', label: 'Awaiting Response' },
  { value: 'resolved', label: 'Resolved' },
  { value: 'discarded', label: 'Discarded' },
];

/**
 * One participant report rendered as a bounded card: identity, facts and
 * evidence are grouped, and the actions sit in a footer so nothing overlaps.
 */
function DisputeReportCard({ report, onDiscuss, onAct, onDiscard }) {
  const open = OPEN_REPORT_STATUSES.includes(report.status);
  return (
    <article className="cd-dispute-report">
      {/* Same complete card as the Reports queue, so both surfaces stay in sync. */}
      <ReportCard
        report={report}
        detailHref={`/pages/organizer-report-detail.html?id=${report.id}`}
        actions={open ? (
          <>
            <button type="button" className="report-btn" onClick={onDiscuss}>Discuss</button>
            <button type="button" className="report-btn primary" onClick={onAct}>Act</button>
            <button type="button" className="report-btn danger" onClick={onDiscard}>Discard</button>
          </>
        ) : (
          <span className="cd-dispute-closed">
            {report.status === 'discarded' ? 'Report discarded' : 'Case closed'} — actions are no longer available.
          </span>
        )}
      />
      {Array.isArray(report.evidence) && report.evidence.length > 0 && (
        <div className="cd-dispute-evidence">
          <EvidenceGallery files={report.evidence} compact />
        </div>
      )}
    </article>
  );
}

/**
 * Reports are the source of truth. This section renders the exact report
 * records the organiser reports queue renders (same ids, same statuses) for
 * this competition only. The status filter narrows the same records.
 */
export function DisputesSection({ competitionId }) {
  const navigate = useNavigate();
  const [reports, setReports] = useState([]);
  const [reportsLoading, setReportsLoading] = useState(true);
  const [reportsError, setReportsError] = useState('');
  const [discardTarget, setDiscardTarget] = useState(null);
  const [decisionTarget, setDecisionTarget] = useState(null);

  const loadReports = useCallback(async () => {
    const response = await ReportsAPI.forCompetition(competitionId);
    if (response.ok) { setReports(response.data || []); setReportsError(''); }
    else setReportsError(response.error || 'Could not load reports.');
    setReportsLoading(false);
  }, [competitionId]);

  useEffect(() => { loadReports(); }, [loadReports]);
  useReportSync(loadReports);

  async function discuss(report) {
    const response = await ReportsAPI.startDiscussion(report.id);
    if (!response.ok) { showToast(response.error || 'Unable to open the case discussion.', 'error'); return; }
    navigate(`/pages/case-discussion.html?discussionId=${response.data.discussion.id}`);
  }

  const [filter, setFilter] = useState('all');
  const visibleReports = filter === 'all' ? reports : reports.filter((report) => report.status === filter);

  return <section className="cd-content-panel cd-disputes-panel">
    <div className="cd-section-heading">
      <div><h2>Player reports</h2><p>Reports about players in this competition — the same records shown in your reports queue.</p></div>
      <select value={filter} onChange={(event) => setFilter(event.target.value)} aria-label="Filter participant reports">
        {DISPUTE_FILTERS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
      </select>
    </div>
    {reportsError && <p className="cd-editor-error" role="alert">{reportsError}</p>}
    {reportsLoading ? <div className="cd-inline-empty">Loading reports…</div> : (
      <div className="cd-dispute-report-list">
        {visibleReports.map((report) => (
          <DisputeReportCard
            key={report.id}
            report={report}
            onDiscuss={() => discuss(report)}
            onAct={() => setDecisionTarget(report)}
            onDiscard={() => setDiscardTarget(report)}
          />
        ))}
        {!reports.length && <div className="cd-inline-empty">No participant reports for this competition yet.</div>}
        {!!reports.length && !visibleReports.length && <div className="cd-inline-empty">No reports in this view.</div>}
      </div>
    )}

    {discardTarget && (
      <DiscardModal
        report={discardTarget}
        onClose={() => setDiscardTarget(null)}
        onDone={() => { setDiscardTarget(null); showToast('Report discarded.', 'success'); loadReports(); }}
      />
    )}
    {decisionTarget && (
      <PlayerDecisionModal
        report={decisionTarget}
        onClose={() => setDecisionTarget(null)}
        onDone={() => { setDecisionTarget(null); showToast('Decision recorded and the participant notified.', 'success'); loadReports(); }}
      />
    )}
  </section>;
}
