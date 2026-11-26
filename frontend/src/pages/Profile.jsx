/**
 * NEXUS ESPORTS — Profile
 *
 * The signed-in player's profile from the backend: their teams and upcoming
 * matches, their organiser reputation, and account settings.
 */
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { MatchesAPI, ReputationAPI } from '../services/api.js';
import { fetchAllTeams, fetchCompetitions } from '../services/competitions.js';
import AccountSettings from '../components/AccountSettings.jsx';
import ReputationOverview from '../components/ReputationOverview.jsx';
import ReputationBadge from '../components/ReputationBadge.jsx';
import { EmptyState, LoadingState, formatDate } from '../components/ui.jsx';

const TABS = [
  { id: 'overview', label: 'Teams and matches' },
  { id: 'reputation', label: 'Organiser reputation' },
  { id: 'account', label: 'Account settings' },
];

const ROLE_LABEL = { participant: 'Player', regular: 'Player', team_lead: 'Team lead', admin: 'Admin', finance_moderator: 'Finance moderator', 'super-admin': 'Super Admin', community_moderator: 'Community moderator' };

export default function Profile() {
  const session = useSelector((state) => state.auth.session);
  const [tab, setTab] = useState('overview');
  const [data, setData] = useState(null);
  const [reputation, setReputation] = useState(null);
  const [overview, setOverview] = useState(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      const [comps, teams] = await Promise.all([fetchCompetitions(), fetchAllTeams()]);
      const me = String(session?.username || '').toLowerCase();
      const byId = new Map((comps.data || []).map((c) => [c.id, c]));
      const mine = teams
        .filter((t) => !['rejected', 'disbanded', 'banned'].includes(t.status) && t.members.some((m) => m.username.toLowerCase() === me))
        .map((team) => ({ team, comp: byId.get(team.competitionId) }))
        .filter((x) => x.comp);
      const matchLists = await Promise.all(mine.map(({ comp }) => MatchesAPI.getByCompetition(comp.id)));
      const upcoming = [];
      mine.forEach(({ team, comp }, i) => {
        const list = matchLists[i].ok ? matchLists[i].data : [];
        list.filter((m) => [m.team1Id, m.team2Id].includes(team.id) && !['completed', 'bye'].includes(m.status))
          .forEach((m) => upcoming.push({ ...m, compName: comp.name, compId: comp.id }));
      });
      upcoming.sort((a, b) => new Date(a.scheduledAt || 8.64e15) - new Date(b.scheduledAt || 8.64e15));
      if (alive) setData({ mine, upcoming });
    })();
    ReputationAPI.me().then((res) => { if (alive && res.ok) setReputation(res.data); });
    ReputationAPI.overview().then((res) => { if (alive && res.ok) setOverview(res.data); });
    return () => { alive = false; };
  }, [session?.username]);

  const initial = String(session?.username || '?').charAt(0).toUpperCase();
  const role = ROLE_LABEL[session?.role] || 'Player';
  const visibleTabs = useMemo(() => TABS, []);

  return (
    <main className="main-content">
      <div className="ui-card" style={{ display: 'flex', gap: 18, alignItems: 'center', flexWrap: 'wrap', marginBottom: 24 }}>
        {session?.profilePicUrl
          ? <img src={session.profilePicUrl} alt="" style={{ width: 72, height: 72, borderRadius: '50%', objectFit: 'cover' }} />
          : <span className="ui-avatar" style={{ width: 72, height: 72, fontSize: 28 }}>{initial}</span>}
        <div style={{ flex: 1, minWidth: 200 }}>
          <h1 className="page-title" style={{ marginBottom: 2 }}>@{session?.username}</h1>
          <div className="ui-row-meta">{role} · {session?.email}</div>
          {session?.bio && <p className="ui-row-meta" style={{ marginTop: 8, color: 'var(--text-light)' }}>{session.bio}</p>}
        </div>
        {reputation && <ReputationBadge level={reputation.level} limit={reputation.limit} />}
      </div>

      <div className="ui-tabs">
        {visibleTabs.map((t) => <button type="button" key={t.id} className={`ui-tab${tab === t.id ? ' active' : ''}`} onClick={() => setTab(t.id)}>{t.label}</button>)}
      </div>

      {tab === 'overview' && (
        !data ? <LoadingState label="Loading your teams…" /> : (
          <div className="ui-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', alignItems: 'start' }}>
            <section className="ui-card">
              <h2 className="ui-card-title">My teams</h2>
              {data.mine.length === 0 ? (
                <EmptyState title="No teams yet" action={<Link className="btn-table-secondary" to="/pages/competitions.html">Browse competitions</Link>} />
              ) : (
                <div className="ui-list">
                  {data.mine.map(({ team, comp }) => (
                    <Link key={team.id} className="ui-row" to={`/pages/team/team-roster.html?compId=${encodeURIComponent(comp.id)}&teamId=${encodeURIComponent(team.id)}`}>
                      <div className="ui-avatar">{team.avatar}</div>
                      <div className="ui-row-main">
                        <div className="ui-row-title">{team.name}</div>
                        <div className="ui-row-meta">{comp.name} · {team.leader.toLowerCase() === String(session?.username).toLowerCase() ? 'Captain' : 'Player'} · {team.members.length} players</div>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </section>
            <section className="ui-card">
              <h2 className="ui-card-title">Upcoming matches</h2>
              {data.upcoming.length === 0 ? <EmptyState title="No matches scheduled" message="Fixtures appear here once organizers publish them." /> : (
                <div className="ui-list">
                  {data.upcoming.slice(0, 10).map((m) => (
                    <Link key={m.id} className="ui-row" to={`/pages/comp-info.html?id=${encodeURIComponent(m.compId)}&tab=bracket`}>
                      <div className="ui-row-main">
                        <div className="ui-row-title">{m.team1Name} vs {m.team2Name}</div>
                        <div className="ui-row-meta">{m.compName} · {m.round || 'Match'}</div>
                      </div>
                      <span className="ui-row-meta">{m.scheduledAt ? formatDate(m.scheduledAt, true) : 'Time to be confirmed'}</span>
                    </Link>
                  ))}
                </div>
              )}
              <div className="ui-row-actions" style={{ marginTop: 14 }}>
                <Link className="btn-table-secondary" to="/pages/competitions-participated.html">Competition history</Link>
                <Link className="btn-table-secondary" to="/pages/my-payments.html">My payments</Link>
              </div>
            </section>
          </div>
        )
      )}

      {tab === 'reputation' && <ReputationOverview overview={overview} />}
      {tab === 'account' && <AccountSettings />}
    </main>
  );
}
