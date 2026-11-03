export default function CompetitionOutcome({ outcome }) {
  if (!outcome) return null;
  return <section className="cd-outcome" aria-label="Final competition results">
    <div className="cd-outcome-item is-winner"><span>Winner</span><strong>{outcome.winner}</strong></div>
    <div className="cd-outcome-item is-runner"><span>Runner-up</span><strong>{outcome.runnerUp}</strong></div>
  </section>;
}
