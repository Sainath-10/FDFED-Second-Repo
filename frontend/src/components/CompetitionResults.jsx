/**
 * NEXUS ESPORTS — final results
 *
 * Once a competition has finished, shows the podium (1st–3rd, with ties), every
 * other placing, the prize each team won and its players. Placings come from
 * the server (the same ranking finance uses to pay prizes), never from the UI.
 * Renders nothing while the competition is still running.
 */
import { useEffect, useState } from 'react';
import { CompetitionsAPI } from '../services/api.js';

const MEDALS = { 1: '🥇', 2: '🥈', 3: '🥉' };
const ordinal = (n) => {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return `${n}${s[(v - 20) % 10] || s[v] || s[0]}`;
};
const money = (minor) => `₹${(Number(minor || 0) / 100).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;

function hue(name) {
  return [...String(name || '?')].reduce((sum, c) => sum + c.charCodeAt(0), 0) % 360;
}

export function useCompetitionResults(competitionId, refreshKey) {
  const [results, setResults] = useState(null);
  useEffect(() => {
    let cancelled = false;
    if (!competitionId) { setResults(null); return undefined; }
    CompetitionsAPI.results(competitionId).then((res) => {
      if (!cancelled) setResults(res.ok ? res.data : null);
    });
    return () => { cancelled = true; };
  }, [competitionId, refreshKey]);
  return results;
}

/** `highlightTeamId` marks the viewer's own team. `compact` hides the player lists. */
export default function CompetitionResults({ competitionId, results: given, highlightTeamId, compact = false, refreshKey }) {
  const fetched = useCompetitionResults(given ? null : competitionId, refreshKey);
  const results = given || fetched;
  if (!results?.available || !results.places?.length) return null;

  const podium = results.places.filter((p) => p.position <= 3);
  const rest = results.places.filter((p) => p.position > 3);
  const mine = results.places.find((p) => p.teams.some((t) => t.id === highlightTeamId));

  return (
    <section className="results-board" aria-label="Final results">
      <header className="results-head">
        <div>
          <span className="results-eyebrow">Final results</span>
          <h2>{podium[0]?.teams.map((t) => t.name).join(' & ')} {podium[0]?.tied ? 'share the title' : 'are the champions'}</h2>
          <p>
            {results.settled
              ? 'Prizes have been paid out to every winning player.'
              : results.disputeWindowEndsAt && new Date(results.disputeWindowEndsAt) > new Date()
                ? `Results are final. Players can raise a dispute until ${new Date(results.disputeWindowEndsAt).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}; prizes are paid after that.`
                : 'Results are final. A finance moderator releases the prizes after reviewing them.'}
          </p>
        </div>
        {mine && (
          <div className="results-mine">
            <span>Your team finished</span>
            <strong>{mine.tied ? 'joint ' : ''}{ordinal(mine.position)}</strong>
          </div>
        )}
      </header>

      <div className={`results-podium podium-${Math.min(podium.length, 3)}`}>
        {podium.map((place) => place.teams.map((team) => (
          <article key={team.id} className={`podium-step place-${Math.min(place.position, 3)}${team.id === highlightTeamId ? ' is-mine' : ''}`}>
            <div className="podium-medal" aria-hidden="true">{MEDALS[place.position] || '🏅'}</div>
            <div className="podium-avatar" style={{ '--team-hue': hue(team.name) }} aria-hidden="true">{team.name.slice(0, 2).toUpperCase()}</div>
            <h3>{team.name}</h3>
            <span className="podium-place">{place.tied ? 'Joint ' : ''}{ordinal(place.position)} place</span>
            {team.prizeMinor > 0 && <strong className="podium-prize">{money(team.prizeMinor)}</strong>}
            {!compact && team.members.length > 0 && (
              <p className="podium-players">{team.members.map((m) => `@${m}`).join(' · ')}</p>
            )}
          </article>
        )))}
      </div>

      {rest.length > 0 && (
        <ol className="results-rest">
          {rest.map((place) => place.teams.map((team) => (
            <li key={team.id} className={team.id === highlightTeamId ? 'is-mine' : ''}>
              <span className="results-pos">{place.tied ? '=' : ''}{place.position}</span>
              <span className="results-team">{team.name}{!compact && <small>{team.members.length} player{team.members.length === 1 ? '' : 's'}</small>}</span>
              {team.prizeMinor > 0 && <span className="results-prize">{money(team.prizeMinor)}</span>}
            </li>
          )))}
        </ol>
      )}
    </section>
  );
}
