/**
 * NEXUS ESPORTS — Live now
 *
 * Competitions in progress and their matches, from the backend. The platform
 * does not host video streams, so this page shows live results and the next
 * fixtures rather than a player.
 */
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { MatchesAPI } from '../services/api.js';
import { isDraft, isLiveCompetition } from '../services/competitions.js';
import useCompetitions from '../hooks/useCompetitions.js';
import { competitionBanner } from '../lib/assets.js';
import { EmptyState, LoadingState, PageHeader, formatDate } from '../components/ui.jsx';

export default function WatchLive() {
  const { data, loading } = useCompetitions();
  const [matches, setMatches] = useState({});
  const live = data.filter((c) => !isDraft(c) && isLiveCompetition(c));
  const liveIds = live.map((c) => c.id).join(',');

  useEffect(() => {
    if (!liveIds) return;
    Promise.all(live.map((c) => MatchesAPI.getByCompetition(c.id).then((res) => [c.id, res.ok ? res.data : []])))
      .then((pairs) => setMatches(Object.fromEntries(pairs)));
  }, [liveIds]);

  return (
    <main className="main-content">
      <PageHeader title="Live now" subtitle="Competitions in progress, with their latest results and next matches." />
      {loading && <LoadingState label="Loading live competitions…" />}
      {!loading && live.length === 0 && (
        <EmptyState title="Nothing is being played right now" message="Competitions appear here once their start date arrives." action={<Link className="btn-primary" to="/pages/competitions.html">Browse upcoming competitions</Link>} />
      )}
      <div className="ui-list">
        {live.map((c) => {
          const list = (matches[c.id] || []).filter((m) => m.status !== 'bye');
          const recent = list.filter((m) => m.status === 'completed').slice(-3).reverse();
          const next = list.filter((m) => !['completed'].includes(m.status) && m.team1Id && m.team2Id).slice(0, 3);
          return (
            <section className="ui-card" key={c.id}>
              <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'center', marginBottom: 12 }}>
                <img src={competitionBanner(c)} alt="" style={{ width: 120, height: 68, objectFit: 'cover', borderRadius: 8 }} />
                <div style={{ flex: 1, minWidth: 200 }}>
                  <div className="ui-row-title">{c.name}</div>
                  <div className="ui-row-meta">{c.game} · {c.activeTeams.length} teams · {c.dates}</div>
                </div>
                <Link className="btn-table-secondary" to={`/pages/comp-info.html?id=${encodeURIComponent(c.id)}&tab=bracket`}>Bracket</Link>
              </div>
              <div className="ui-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))' }}>
                <div>
                  <div className="ui-row-meta" style={{ marginBottom: 6 }}>Latest results</div>
                  {recent.length === 0 ? <p className="ui-row-meta">No results yet.</p> : recent.map((m) => (
                    <div className="ui-kv" key={m.id}><span className="k">{m.team1Name} vs {m.team2Name}</span><span className="v">{m.score || '—'}{m.winnerName ? ` · ${m.winnerName}` : ''}</span></div>
                  ))}
                </div>
                <div>
                  <div className="ui-row-meta" style={{ marginBottom: 6 }}>Next matches</div>
                  {next.length === 0 ? <p className="ui-row-meta">No upcoming matches.</p> : next.map((m) => (
                    <div className="ui-kv" key={m.id}><span className="k">{m.team1Name} vs {m.team2Name}</span><span className="v">{m.scheduledAt ? formatDate(m.scheduledAt, true) : 'Time TBC'}</span></div>
                  ))}
                </div>
              </div>
            </section>
          );
        })}
      </div>
    </main>
  );
}
