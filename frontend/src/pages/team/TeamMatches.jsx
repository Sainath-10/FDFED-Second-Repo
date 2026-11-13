/**
 * NEXUS ESPORTS — Team matches & standings
 *
 * Every member of the team (captain or player) sees the team's own fixtures
 * and results, the next match, and the competition standings with the team
 * highlighted. Final placings appear once the competition is over.
 */
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTeamContext } from '../../hooks/useTeamContext.js';
import { MatchesAPI } from '../../services/api.js';
import TeamHeader, { TeamAvatar, useTeamFixtures } from '../../components/TeamHeader.jsx';
import CompetitionResults from '../../components/CompetitionResults.jsx';
import { EmptyState, Notice } from '../../components/ui.jsx';
import { teamGate } from './TeamGate.jsx';

function resultFor(match, teamId) {
  if (match.status !== 'completed') return null;
  if (!match.winnerId) return { key: 'd', label: 'DRAW' };
  return match.winnerId === teamId ? { key: 'w', label: 'WIN' } : { key: 'l', label: 'LOSS' };
}

function Fixture({ match, teamId, isNext }) {
  const mineFirst = match.team1Id === teamId;
  const us = mineFirst ? match.team1 : match.team2;
  const them = mineFirst ? match.team2 : match.team1;
  const ourScore = mineFirst ? match.score1 : match.score2;
  const theirScore = mineFirst ? match.score2 : match.score1;
  const result = resultFor(match, teamId);
  return (
    <div className={`td-fixture${isNext ? ' is-next' : ''}`}>
      <div className="td-fixture-when">
        <strong>{match.round}</strong>
        {match.status === 'bye' ? 'Bye · advanced automatically' : match.timestamp ? `${match.date}${match.time ? ` · ${match.time}` : ''}` : 'Time to be confirmed'}
      </div>
      <div className="td-fixture-teams">
        <span className="me">{us}</span>
        <span className="vs">vs</span>
        <span>{match.status === 'bye' ? '—' : them}</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        {match.status === 'completed' && <span className="td-fixture-score">{ourScore ?? '—'} : {theirScore ?? '—'}</span>}
        {result && <span className={`td-result td-result-${result.key}`}>{result.label}</span>}
        {!result && match.status === 'live' && <span className="td-result td-result-next">LIVE</span>}
        {!result && match.status !== 'live' && match.status !== 'bye' && <span className={`td-result ${isNext ? 'td-result-next' : 'td-result-later'}`}>{isNext ? 'NEXT' : 'UPCOMING'}</span>}
      </div>
    </div>
  );
}

export default function TeamMatches() {
  const t = useTeamContext();
  const [standings, setStandings] = useState(null);
  const compId = t.comp?.id;
  const teamId = t.team?.id;
  const fixtures = useTeamFixtures(compId, teamId);

  useEffect(() => {
    let cancelled = false;
    if (!compId) return undefined;
    MatchesAPI.getStandings(compId).then((res) => { if (!cancelled) setStandings(res.ok && Array.isArray(res.data) ? res.data : []); });
    return () => { cancelled = true; };
  }, [compId, fixtures.all.length, fixtures.mine.filter((m) => m.status === 'completed').length]);

  const gate = teamGate(t, { title: 'Matches & standings' });
  if (gate) return gate;

  const { team, comp, isEnded } = t;
  const played = fixtures.mine.filter((m) => m.status === 'completed' || m.status === 'bye');
  const upcoming = fixtures.upcoming;
  const isLeague = /league|robin/i.test(`${comp.type} ${comp.format}`);
  const myRank = (standings || []).findIndex((row) => row.team === team.name) + 1;

  return (
    <main className="main-content">
      <TeamHeader t={t} active="matches" />

      {isEnded && <CompetitionResults competitionId={comp.id} highlightTeamId={team.id} />}

      <div className="td-two-col">
        <div>
          <section className="td-section">
            <div className="td-section-head">
              <div>
                <h2 className="td-section-title">Upcoming</h2>
                <p className="td-section-sub">Your team&apos;s next fixtures. Times are in your local time zone.</p>
              </div>
              <Link className="td-btn td-btn-sm" to={`/pages/competition-detail.html?id=${encodeURIComponent(comp.id)}`}>Full bracket</Link>
            </div>
            {!fixtures.loaded ? <p className="td-section-sub">Loading fixtures…</p>
              : upcoming.length ? <div className="td-fixtures">{upcoming.map((m, i) => <Fixture key={m.id} match={m} teamId={team.id} isNext={i === 0} />)}</div>
                : <EmptyState title={fixtures.mine.length ? 'No matches left to play' : 'No fixtures yet'} message={fixtures.mine.length ? (isEnded ? 'The competition is over.' : 'Your team has no pending match right now. The next round appears here once it is decided.') : 'The organiser has not published the fixtures yet. They appear here as soon as they do.'} />}
          </section>

          <section className="td-section">
            <div className="td-section-head">
              <div>
                <h2 className="td-section-title">Results</h2>
                <p className="td-section-sub">{played.length ? `${fixtures.record.w} won · ${fixtures.record.d} drawn · ${fixtures.record.l} lost` : 'No matches played yet.'}</p>
              </div>
            </div>
            {played.length > 0 && <div className="td-fixtures">{[...played].reverse().map((m) => <Fixture key={m.id} match={m} teamId={team.id} />)}</div>}
          </section>
        </div>

        <aside className="td-side">
          <div className="td-panel">
            <div className="td-section-head" style={{ marginBottom: 10 }}>
              <div>
                <h3 className="td-section-title" style={{ fontSize: 16 }}>Standings</h3>
                <p className="td-section-sub">{isLeague ? '3 points for a win, 1 for a draw.' : 'Knockout: wins carry teams forward.'}</p>
              </div>
              {myRank > 0 && <span className="td-pill td-pill-live">#{myRank}</span>}
            </div>
            {standings === null ? <p className="td-section-sub">Loading standings…</p> : standings.length === 0 ? (
              <p className="td-section-sub">Standings appear after the first confirmed result.</p>
            ) : (
              <div className="td-table-wrap">
                <table className="td-table" style={{ minWidth: 0 }}>
                  <thead><tr><th>#</th><th>Team</th><th className="num">P</th><th className="num">W</th><th className="num">Pts</th></tr></thead>
                  <tbody>
                    {standings.map((row, i) => (
                      <tr key={row.team} className={row.team === team.name ? 'is-mine' : ''}>
                        <td>{i + 1}</td>
                        <td><span className="team-cell"><TeamAvatar name={row.team} size="sm" />{row.team}</span></td>
                        <td className="num">{row.mp}</td>
                        <td className="num">{row.w}</td>
                        <td className="num pts">{row.pts}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
          {!isEnded && <Notice tone="info">Results are entered by the organiser. If one is wrong, tell them in Team chat or raise a dispute from the competition page.</Notice>}
        </aside>
      </div>
    </main>
  );
}
