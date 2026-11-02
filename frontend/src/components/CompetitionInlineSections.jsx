import { useEffect, useMemo, useState } from 'react';
import { CompetitionsAPI, DisputesAPI, MatchesAPI } from '../services/api.js';

function Initial({ name }) {
  return <span className="cd-inline-avatar">{String(name || '?').replace(/^@/, '').slice(0, 1).toUpperCase()}</span>;
}

export function StandingsSection({ competitionId, teams, matches }) {
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
  return <section className="cd-content-panel"><div className="cd-section-heading"><div><h2>Standings</h2><p>Calculated from confirmed match results.</p></div></div>
    {error && <p className="cd-editor-error" role="alert">{error}</p>}
    <div className="cd-inline-table cd-standings-table"><div className="cd-inline-table-head"><span>#</span><span>Team</span><span>Played</span><span>Won</span><span>Drawn</span><span>Lost</span><span>Points</span></div>
      {rows.map((row, index) => <div className="cd-inline-table-row" key={row.team}><span className="cd-rank">{index + 1}</span><span className="cd-table-team"><Initial name={row.team} /><strong>{row.team}</strong><small>{byName.get(row.team)?.status || 'Registered'}</small></span><span>{row.mp}</span><span>{row.w}</span><span>{row.d}</span><span>{row.l}</span><strong>{row.pts}</strong></div>)}
    </div>{!rows.length && !error && <div className="cd-inline-empty">Standings will appear after the first confirmed result.</div>}</section>;
}

export function OrganizersSection({ competition, onChanged }) {
  const primary = competition.createdBy || competition.organizerId;
  const organizers = [...new Set([primary, ...(competition.organizers || [])].filter(Boolean))];
  const coOrganizers = organizers.filter((name) => name !== primary);
  const [username, setUsername] = useState('');
  const [busy, setBusy] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  async function mutate(kind, name) {
    setBusy(name); setError(''); setMessage('');
    const response = kind === 'add' ? await CompetitionsAPI.addCoOrganizer(competition.id, name) : await CompetitionsAPI.removeCoOrganizer(competition.id, name);
    setBusy('');
    if (!response.ok) return setError(response.error || `Could not ${kind} organizer.`);
    setUsername(''); setMessage(kind === 'add' ? `@${name} was added as a co-organizer.` : `@${name} was removed.`); onChanged();
  }
  return <section className="cd-content-panel"><div className="cd-section-heading"><div><h2>Organizers</h2><p>People who can operate this competition and review its disputes.</p></div></div>
    <div className="cd-organizer-list"><article className="cd-organizer-card is-primary"><Initial name={primary} /><div><strong>@{primary}</strong><small>Primary organizer</small></div><span>Owner</span></article>
      {coOrganizers.map((name) => <article className="cd-organizer-card" key={name}><Initial name={name} /><div><strong>@{name}</strong><small>Co-organizer</small></div><button className="cd-text-danger" disabled={!!busy} onClick={() => mutate('remove', name)}>{busy === name ? 'Removing…' : 'Remove'}</button></article>)}
    </div>
    <form className="cd-inline-form" onSubmit={(event) => { event.preventDefault(); const clean = username.trim().replace(/^@/, ''); if (clean) mutate('add', clean); }}><label>Add co-organizer<input value={username} onChange={(event) => setUsername(event.target.value)} placeholder="Exact registered username" /></label><button className="cd-button cd-primary" disabled={!!busy || !username.trim()}>{busy ? 'Saving…' : 'Add organizer'}</button></form>
    {error && <p className="cd-editor-error" role="alert">{error}</p>}{message && <p className="cd-editor-success" role="status">{message}</p>}
  </section>;
}

const pending = (status) => ['open_organizer', 'under_review'].includes(status);
export function DisputesSection({ competitionId }) {
  const [items, setItems] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [filter, setFilter] = useState('all');
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const load = async () => { const response = await DisputesAPI.getByCompetition(competitionId); if (response.ok) setItems(response.data || []); else setError(response.error || 'Could not load disputes.'); };
  useEffect(() => { load(); }, [competitionId]); // eslint-disable-line react-hooks/exhaustive-deps
  const visible = items.filter((item) => filter === 'all' || (filter === 'pending' ? pending(item.status) : item.status === filter));
  const selected = items.find((item) => item.id === selectedId);
  async function review(action) {
    if (notes.trim().length < 5) return setError('Enter review notes with at least 5 characters.');
    setBusy(true); setError('');
    const response = await DisputesAPI.organizerReview(selected.id, action, notes.trim(), false);
    setBusy(false);
    if (!response.ok) return setError(response.error || 'Could not update the dispute.');
    setNotes(''); await load();
  }
  return <section className="cd-content-panel"><div className="cd-section-heading"><div><h2>Disputes</h2><p>Review reports without leaving the competition workspace.</p></div><select value={filter} onChange={(event) => setFilter(event.target.value)}><option value="all">All disputes</option><option value="pending">Pending</option><option value="resolved">Resolved</option><option value="escalated_to_admin">Escalated</option></select></div>
    {error && <p className="cd-editor-error" role="alert">{error}</p>}
    <div className={`cd-disputes-layout ${selected ? 'has-selected' : ''}`}><div className="cd-dispute-list">{visible.map((item) => <button key={item.id} className={item.id === selectedId ? 'active' : ''} onClick={() => { setSelectedId(item.id); setNotes(''); setError(''); }}><span><strong>{item.category || item.targetType || 'Dispute'}</strong><small>Filed by @{item.reportedBy || 'participant'}</small></span><em>{String(item.status || '').replaceAll('_', ' ')}</em><p>{item.reason}</p></button>)}{!visible.length && <div className="cd-inline-empty">No disputes in this view.</div>}</div>
      {selected && <aside className="cd-dispute-detail"><button className="cd-close-inline" aria-label="Close dispute" onClick={() => setSelectedId(null)}>×</button><small>#{String(selected.id).slice(-8)}</small><h3>{selected.targetUserOrTeam || selected.category || 'Competition dispute'}</h3><p>{selected.reason}</p><dl><div><dt>Status</dt><dd>{String(selected.status).replaceAll('_', ' ')}</dd></div><div><dt>Reported by</dt><dd>@{selected.reportedBy}</dd></div></dl>{pending(selected.status) && <><label>Review notes<textarea rows="4" value={notes} onChange={(event) => setNotes(event.target.value)} /></label><div className="cd-editor-actions"><button className="cd-button cd-primary" disabled={busy} onClick={() => review('resolve')}>Resolve</button>{selected.targetType !== 'opponent_team' && <button className="cd-button" disabled={busy} onClick={() => review('escalate_to_admin')}>Escalate</button>}</div></>}</aside>}
    </div></section>;
}
