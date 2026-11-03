import { groupFixtures } from '../lib/fixtures.mjs';

/** Coordinates and connectors come only from persisted positions and destinations. */
export default function FixtureBracket({ matches, renderMatch, selectedId, onSelect, zoom }) {
  const rounds = groupFixtures(matches);
  const byId = new Map(matches.map((match) => [match.id, match]));
  const columnWidth = 274, columnGap = 60, rowPitch = 200, cardHeight = 166, padding = 24, heading = 66;
  const roundCount = matches[0]?.bracket.roundCount || 0;
  const openingCount = (matches[0]?.bracket.bracketSize || 2) / 2;
  const width = padding * 2 + roundCount * (columnWidth + columnGap) - columnGap;
  const height = heading + padding + openingCount * rowPitch;
  const coordinates = new Map(matches.map((match) => [match.id, {
    x: padding + (match.bracket.round - 1) * (columnWidth + columnGap),
    y: heading + (match.bracket.position - .5) * 2 ** (match.bracket.round - 1) * rowPitch - cardHeight / 2,
  }]));
  return <div className="cd-bracket-map" style={{ width, height, zoom }}>
    <svg className="cd-bracket-lines" width={width} height={height} aria-hidden="true">
      {matches.filter((match) => coordinates.has(match.bracket.nextMatchId)).map((match) => {
        const from = coordinates.get(match.id), to = coordinates.get(match.bracket.nextMatchId);
        const x = from.x + columnWidth, y = from.y + cardHeight / 2, targetY = to.y + cardHeight / 2 + (match.bracket.nextSlot === 1 ? -22 : 22);
        return <path key={match.id} className={selectedId === match.id || selectedId === match.bracket.nextMatchId ? 'is-highlighted' : ''} d={`M ${x} ${y} H ${x + columnGap / 2} V ${targetY} H ${to.x}`} />;
      })}
    </svg>
    {rounds.map((round) => <header className="cd-map-round" key={round.index} style={{ left: padding + (round.index - 1) * (columnWidth + columnGap), width: columnWidth }}><span className="cd-round-number">{String(round.index).padStart(2, '0')}</span><div><h3>{round.name}</h3><small>{round.matches.filter((match) => match.status !== 'bye').length} matches{round.matches.some((match) => match.status === 'bye') && ` · ${round.matches.filter((match) => match.status === 'bye').length} byes`}</small></div></header>)}
    {matches.map((match) => <div className={`cd-map-match ${match.status === 'bye' ? 'is-bye' : ''}`} key={match.id} style={{ left: coordinates.get(match.id).x, top: coordinates.get(match.id).y, width: columnWidth, height: cardHeight }}>
      {renderMatch(match)}
      {byId.has(match.bracket.nextMatchId) && <button className="cd-destination" onClick={() => onSelect(match.bracket.nextMatchId)} aria-label={`Follow winner from round ${match.bracket.round}, position ${match.bracket.position} to the next match`}>Winner → R{byId.get(match.bracket.nextMatchId).bracket.round} · M{byId.get(match.bracket.nextMatchId).bracket.position} · slot {match.bracket.nextSlot}</button>}
    </div>)}
  </div>;
}
