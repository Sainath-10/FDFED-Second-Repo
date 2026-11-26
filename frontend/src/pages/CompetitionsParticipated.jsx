/**
 * NEXUS ESPORTS — Competitions participated
 *
 * Every competition the signed-in player has played in, from the backend,
 * with its state and any prize the player was paid.
 */
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { fetchAllTeams, fetchCompetitions, hasStarted, isCancelledCompetition, isClosedCompetition } from '../services/competitions.js';
import { paymentRequest, money } from '../services/payments.js';
import { EmptyState, LoadingState, PageHeader } from '../components/ui.jsx';

const stateOf = (c) => (isCancelledCompetition(c) ? 'cancelled' : isClosedCompetition(c) ? 'completed' : hasStarted(c) ? 'ongoing' : 'upcoming');
const FILTERS = ['all', 'upcoming', 'ongoing', 'completed', 'cancelled'];

export default function CompetitionsParticipated() {
  const session = useSelector((state) => state.auth.session);
  const [rows, setRows] = useState(null);
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    (async () => {
      const [comps, teams, payments] = await Promise.all([fetchCompetitions(), fetchAllTeams(), paymentRequest('/me').catch(() => [])]);
      const me = String(session?.username || '').toLowerCase();
      const byId = new Map((comps.data || []).map((c) => [c.id, c]));
      const payouts = new Map();
      (payments || []).filter((t) => t.type === 'PAYOUT').forEach((t) => payouts.set(t.competitionId, (payouts.get(t.competitionId) || 0) + t.amountMinor));
      setRows(teams
        .filter((t) => t.members.some((m) => m.username.toLowerCase() === me) && !['rejected'].includes(t.status))
        .map((team) => ({ team, comp: byId.get(team.competitionId), payout: payouts.get(team.competitionId) || 0 }))
        .filter((r) => r.comp)
        .sort((a, b) => new Date(b.comp.startDate) - new Date(a.comp.startDate)));
    })();
  }, [session?.username]);

  const visible = useMemo(() => (rows || []).filter((r) => filter === 'all' || stateOf(r.comp) === filter), [rows, filter]);

  return (
    <main className="main-content">
      <PageHeader title="Competitions participated" subtitle="Every competition you or your team have played in." />
      <div className="ui-tabs">
        {FILTERS.map((f) => <button type="button" key={f} className={`ui-tab${filter === f ? ' active' : ''}`} onClick={() => setFilter(f)}>{f[0].toUpperCase() + f.slice(1)}<span className="count">{(rows || []).filter((r) => f === 'all' || stateOf(r.comp) === f).length}</span></button>)}
      </div>
      {rows === null && <LoadingState label="Loading your competitions…" />}
      {rows && visible.length === 0 && <EmptyState title="Nothing here yet" action={<Link className="btn-primary" to="/pages/competitions.html">Browse competitions</Link>} />}
      <div className="ui-list">
        {visible.map(({ team, comp, payout }) => (
          <div className="ui-row" key={team.id}>
            <div className="ui-avatar">{team.avatar}</div>
            <div className="ui-row-main">
              <div className="ui-row-title">{comp.name}</div>
              <div className="ui-row-meta">{comp.game} · {comp.dates} · team {team.name}{team.status === 'disbanded' ? ' (disbanded)' : team.status === 'banned' ? ' (banned)' : ''}</div>
            </div>
            {payout > 0 && <span className="status-pill approved">Won {money(payout)}</span>}
            <span className="status-pill pending">{comp.badge}</span>
            <Link className="btn-table-secondary" to={`/pages/comp-info.html?id=${encodeURIComponent(comp.id)}`}>View</Link>
          </div>
        ))}
      </div>
    </main>
  );
}
