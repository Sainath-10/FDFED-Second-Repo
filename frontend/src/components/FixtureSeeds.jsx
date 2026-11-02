import { useState } from 'react';

export default function FixtureSeeds({ teams, initialOrder, locked, busy, onApply, error }) {
  const [order, setOrder] = useState(initialOrder);
  const names = new Map(teams.map((team) => [team.id, team.name]));
  function move(index, direction) {
    setOrder((old) => { const next = [...old]; [next[index], next[index + direction]] = [next[index + direction], next[index]]; return next; });
  }
  return <details className="cd-seeds"><summary>Tournament seeding</summary><p>Seed 1 is strongest. Initial seeds follow registration order; arrange them by strength before play starts. The highest seeds receive byes.</p><ol>{order.map((id, index) => <li key={id}><span>#{index + 1}</span><strong>{names.get(id)}</strong><button type="button" disabled={locked || busy || index === 0} aria-label={`Move ${names.get(id)} up a seed`} onClick={() => move(index, -1)}>↑</button><button type="button" disabled={locked || busy || index === order.length - 1} aria-label={`Move ${names.get(id)} down a seed`} onClick={() => move(index, 1)}>↓</button></li>)}</ol>{locked ? <p>Seeds are locked because play has started.</p> : <button className="cd-button" disabled={busy || order.length < 2} onClick={() => onApply(order)}>{busy ? 'Saving…' : 'Apply seeds & build bracket'}</button>}{error && <p role="alert" className="cd-editor-error">{error}</p>}</details>;
}
