// Normalize API and legacy cached fixtures into one rendering contract.
export function normalizeFixture(match, index = 0) {
  const score = String(match.score || '').match(/^\s*(\d+)\s*[-:–]\s*(\d+)\s*$/);
  const date = match.scheduledAt ? new Date(match.scheduledAt) : null;
  const validDate = date && Number.isFinite(date.getTime());
  return {
    ...match,
    id: String(match.id || `cached-${index}`),
    team1: match.team1Name || match.team1 || 'To be decided',
    team2: match.team2Name || match.team2 || 'To be decided',
    round: match.round || 'Unassigned round',
    status: ['ongoing', 'live'].includes(match.status) ? 'live' : (match.status || 'scheduled'),
    score1: score ? Number(score[1]) : match.score1 ?? null,
    score2: score ? Number(score[2]) : match.score2 ?? null,
    timestamp: validDate ? date.getTime() : null,
    date: match.status === 'bye' ? 'Automatic advancement · no match played' : validDate ? date.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) : match.date || 'Date to be confirmed',
    time: validDate ? date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' }) : match.time || '',
  };
}

export function roundOrder(label) {
  const value = String(label).toLowerCase().replace(/[^a-z0-9]/g, '');
  if (value.includes('group')) return 0;
  const numbered = value.match(/^round(\d+)$/);
  if (numbered) return Number(numbered[1]);
  const size = value.match(/roundof(\d+)/);
  if (size) return 100 - Math.log2(Number(size[1]));
  if (value.includes('quarter')) return 98;
  if (value.includes('semi')) return 99;
  if (value.includes('qualifier1')) return 100;
  if (value.includes('eliminator')) return 101;
  if (value.includes('qualifier2')) return 102;
  if (value === 'final' || value === 'finals' || value === 'grandfinal') return 110;
  return 50;
}

export function groupFixtures(matches) {
  const groups = new Map();
  matches.forEach((match) => {
    const key = match.bracket?.version === 2 ? match.bracket.round : match.round;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(match);
  });
  return [...groups].sort(([a], [b]) => (typeof a === 'number' ? a - b : roundOrder(a) - roundOrder(b) || a.localeCompare(b, undefined, { numeric: true })))
    .map(([key, fixtures]) => ({ name: fixtures[0].round, index: typeof key === 'number' ? key : undefined, matches: fixtures.sort((a, b) => a.bracket?.version === 2 ? a.bracket.position - b.bracket.position : (a.timestamp ?? Infinity) - (b.timestamp ?? Infinity)) }));
}

export function isFixtureWinner(match, side) {
  if (!['completed', 'bye'].includes(match.status)) return false;
  if (match.winnerId) return String(match.winnerId) === String(match[`team${side}Id`]);
  if (match.winnerName) return match.winnerName === match[`team${side}`];
  const own = match[`score${side}`];
  const other = match[`score${side === 1 ? 2 : 1}`];
  return own !== null && other !== null && Number(own) > Number(other);
}
