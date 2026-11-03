/** Identify the title match from its saved fixture, never from standings rank. */
export function competitionOutcome(matches = []) {
  const playoffs = matches.some((match) => match.bracket?.kind === 'ipl');
  const final = matches.find((match) => match.status === 'completed' && (
    playoffs
      ? match.bracket?.kind === 'ipl' && match.round === 'Final'
      : match.bracket?.version === 2
        ? match.bracket.nextMatchId === null
        : /^finals?$/i.test(match.round || '')
  ));
  if (!final || !final.team1 || !final.team2) return null;
  const winningSide = final.winnerId && final.winnerId === final.team1Id ? 1
    : final.winnerId && final.winnerId === final.team2Id ? 2
      : final.winnerName === final.team1 ? 1
        : final.winnerName === final.team2 ? 2 : 0;
  if (!winningSide) return null;
  const losingSide = winningSide === 1 ? 2 : 1;
  return {
    winner: final[`team${winningSide}`],
    runnerUp: final[`team${losingSide}`],
    finalId: final.id,
  };
}
