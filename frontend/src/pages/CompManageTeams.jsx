/**
 * NEXUS ESPORTS — Manage Teams
 *
 * The organizer's view of every registered team, from the backend. Teams are
 * approved automatically on registration; the organizer can warn, reject or
 * ban a team. Rejecting or banning refunds that team's fees from escrow.
 */
import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { CompetitionsAPI, TeamsAPI } from '../services/api.js';
import { isClosedCompetition, isOrganizerOf, useCompetition } from '../services/competitions.js';
import { EmptyState, ErrorState, LoadingState, Notice, PageHeader, ReasonDialog, formatDate, formatINR } from '../components/ui.jsx';
import { showToast } from '../lib/toast.js';
import '../styles/pages/subpage.css';

const STATUS_CLS = { approved: 'status-approved', pending: 'status-pending', rejected: 'status-rejected', banned: 'status-rejected', disbanded: 'status-rejected' };
const ACTION_COPY = {
  warn: { title: 'Warn team', label: 'Send warning', tone: 'primary', min: 5, help: 'The captain is notified. A third warning bans the team automatically.' },
  rejected: { title: 'Reject team', label: 'Reject and refund', tone: 'danger', min: 5, help: 'The team is removed from the competition and its fees are refunded in full.' },
  banned: { title: 'Ban team', label: 'Ban and refund', tone: 'danger', min: 5, help: 'The team is banned from this competition and its fees are refunded in full.' },
};

export default function CompManageTeams() {
  const [params] = useSearchParams();
  const { session } = useAuth();
  const id = params.get('id') || '';
  const { loading, error, data: comp, reload } = useCompetition(id);
  const [filter, setFilter] = useState('active');
  const [query, setQuery] = useState('');
  const [acting, setActing] = useState(null);
  const [contacts, setContacts] = useState(null);
  const [contactsError, setContactsError] = useState('');

  const canManage = comp && (isOrganizerOf(comp, session?.username) || ['admin', 'super-admin', 'super_admin'].includes(session?.role));

  useEffect(() => {
    if (!id || !canManage) return;
    CompetitionsAPI.getParticipants(id).then((res) => {
      if (res.ok && Array.isArray(res.data)) { setContacts(res.data); setContactsError(''); } else setContactsError(res.error || 'Participant contacts could not be loaded.');
    });
  }, [id, canManage, comp?.teams?.length]);

  if (!id) return <main className="main-content"><ErrorState message="Open Manage Teams from a competition." /></main>;
  if (loading && !comp) return <main className="main-content"><LoadingState label="Loading teams…" /></main>;
  if (error || !comp) return <main className="main-content"><ErrorState message={error || 'That competition could not be found.'} onRetry={reload} /></main>;
  if (!canManage) return <main className="main-content"><ErrorState message="Only this competition's organizers can manage its teams." /></main>;

  const ended = isClosedCompetition(comp);
  const teams = comp.teams;
  const active = teams.filter((t) => !['rejected', 'banned', 'disbanded'].includes(t.status));
  const visible = teams
    .filter((t) => filter === 'all' || (filter === 'active' ? active.includes(t) : t.status === filter))
    .filter((t) => !query || `${t.name} ${t.leader}`.toLowerCase().includes(query.toLowerCase()));
  const fee = comp.feeType === 'free' ? 0 : comp.entryFeeAmount;

  async function act(reason) {
    const { team, action } = acting;
    const res = action === 'warn'
      ? await TeamsAPI.addWarning(team.id, reason)
      : action === 'banned' ? await TeamsAPI.banTeam(team.id, reason) : await TeamsAPI.setStatus(team.id, action, reason);
    if (!res.ok) { showToast(res.error || 'Unable to update the team.', 'error'); return; }
    if (action === 'warn') showToast(res.data?.banned ? `${team.name} reached three warnings and was banned.` : `Warning ${res.data?.warningsCount || ''} sent to ${team.name}.`);
    else showToast(`${team.name} was ${action}.${fee > 0 ? ' Its fees were refunded.' : ''}`);
    setActing(null);
    reload();
  }

  const copy = acting ? ACTION_COPY[acting.action] : null;

  return (
    <main className="main-content">
      <PageHeader
        title="Manage teams"
        subtitle={`${comp.name} · ${active.length} / ${comp.maxTeams || '—'} teams registered`}
        actions={<Link className="btn-cancel" to={`/pages/competition-detail.html?id=${encodeURIComponent(comp.id)}&tab=teams`}>Back to competition</Link>}
      />
      {ended && <Notice tone="warning">This competition has ended. Team actions are closed; raise a dispute for finance review instead.</Notice>}

      <div className="teams-stats-row">
        <div className="stat-card"><div className="stat-label">Active teams</div><div className="stat-big stat-green">{active.length}</div></div>
        <div className="stat-card"><div className="stat-label">Rejected or banned</div><div className="stat-big stat-red">{teams.filter((t) => ['rejected', 'banned'].includes(t.status)).length}</div></div>
        <div className="stat-card"><div className="stat-label">Disbanded</div><div className="stat-big">{teams.filter((t) => t.status === 'disbanded').length}</div></div>
        <div className="stat-card"><div className="stat-label">Entry fee</div><div className="stat-big">{comp.entryFee}</div></div>
      </div>

      <div className="sub-panel">
        <div className="sub-panel-toolbar">
          <input type="search" className="sub-search" aria-label="Search teams" placeholder="Search by team or captain…" value={query} onChange={(e) => setQuery(e.target.value)} />
          <select className="sub-select" aria-label="Filter by status" value={filter} onChange={(e) => setFilter(e.target.value)}>
            <option value="active">Active</option>
            <option value="all">All</option>
            <option value="rejected">Rejected</option>
            <option value="banned">Banned</option>
            <option value="disbanded">Disbanded</option>
          </select>
        </div>

        {visible.length === 0 ? <EmptyState title="No teams" message="No teams match this view." /> : (
          <div className="ui-table-wrap">
            <table className="ui-table">
              <thead><tr><th>Team</th><th>Captain</th><th>Players</th><th>Registered</th><th>Warnings</th><th>Status</th><th>Actions</th></tr></thead>
              <tbody>
                {visible.map((t) => {
                  const isActive = active.includes(t);
                  return (
                    <tr key={t.id}>
                      <td><Link to={`/pages/team/team-roster.html?compId=${encodeURIComponent(comp.id)}&teamId=${encodeURIComponent(t.id)}`}>{t.name}</Link></td>
                      <td>@{t.leader}</td>
                      <td>{t.members.length} / {comp.maxPlayersPerTeam || '—'}</td>
                      <td>{formatDate(t.createdAt)}</td>
                      <td>{t.warningsCount || 0} / 3</td>
                      <td><span className={`badge-status ${STATUS_CLS[t.status] || ''}`}>{String(t.status).toUpperCase()}</span></td>
                      <td>
                        {isActive && !ended ? (
                          <div className="ui-row-actions">
                            <button type="button" className="btn-table-secondary" onClick={() => setActing({ team: t, action: 'warn' })}>Warn</button>
                            <button type="button" className="btn-table-danger" onClick={() => setActing({ team: t, action: 'rejected' })}>Reject</button>
                            <button type="button" className="btn-table-danger" onClick={() => setActing({ team: t, action: 'banned' })}>Ban</button>
                          </div>
                        ) : <span style={{ color: 'var(--text-dimmer)' }}>—</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="sub-panel" style={{ marginTop: 24 }}>
        <h2 className="ui-card-title">Participant contacts</h2>
        <p className="ui-row-meta" style={{ marginBottom: 12 }}>Emails of registered players, visible only to organizers. Use your own email client to contact them.</p>
        {contactsError && <p className="ui-field-error">{contactsError}</p>}
        {contacts === null && !contactsError && <LoadingState label="Loading contacts…" />}
        {contacts && contacts.length === 0 && <EmptyState title="No participants yet" />}
        {contacts && contacts.length > 0 && (
          <div className="ui-table-wrap">
            <table className="ui-table">
              <thead><tr><th>Player</th><th>Email</th><th>Team</th><th>Role</th></tr></thead>
              <tbody>
                {contacts.map((c, i) => (
                  <tr key={`${c.username}-${i}`}>
                    <td>@{c.username}</td>
                    <td>{c.email ? <a href={`mailto:${c.email}`} style={{ color: '#60a5fa' }}>{c.email}</a> : '—'}</td>
                    <td>{c.teamName}</td>
                    <td>{c.role === 'team_lead' ? 'Captain' : 'Player'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <ReasonDialog
        open={!!acting}
        title={copy ? `${copy.title}: ${acting.team.name}` : ''}
        description={copy ? `${copy.help}${acting.action !== 'warn' && fee > 0 ? ` Refund: ${comp.feeType === 'per_player' ? `${formatINR(fee)} per paying player` : formatINR(fee)}.` : ''}` : ''}
        placeholder="Reason shown to the team"
        minLength={copy?.min || 5}
        tone={copy?.tone}
        confirmLabel={copy?.label}
        onConfirm={act}
        onClose={() => setActing(null)}
      />
    </main>
  );
}
