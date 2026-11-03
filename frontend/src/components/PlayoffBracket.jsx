/** IPL winner and loser routes are persisted by the backend. */
export default function PlayoffBracket({ matches, renderMatch, zoom = 1 }) {
  const layout = { 'Qualifier 1': [24, 40], Eliminator: [24, 330], 'Qualifier 2': [390, 330], Final: [756, 40] };
  const positions = new Map(matches.filter(m => layout[m.round]).map(m => [m.id, layout[m.round]]));
  const routes = matches.flatMap(m => [
    { from: m.id, to: m.bracket?.nextMatchId, label: 'Winner', loser: false },
    { from: m.id, to: m.bracket?.loserMatchId, label: 'Loser', loser: true },
  ]).filter(r => positions.has(r.from) && positions.has(r.to));
  return <div className="cd-playoff-map" style={{ position: 'relative', width: 1080, height: 610, zoom }}>
    <svg className="cd-bracket-lines" width="1080" height="610" aria-hidden="true">
      {routes.map(r => { const [x,y] = positions.get(r.from); const [tx,ty] = positions.get(r.to); const startX=x+274, startY=y+130, targetY=ty+130;
        return <g key={`${r.from}-${r.to}`}><path strokeDasharray={r.loser ? '6 5' : undefined} d={`M ${startX} ${startY} H ${startX+44} V ${targetY} H ${tx}`} /><text x={startX+8} y={startY+(r.loser ? 30 : -10)} fill={r.loser ? '#fbbf24' : '#c6ff33'} fontSize="11">{r.label}</text></g>;
      })}
    </svg>
    {matches.filter(m => positions.has(m.id)).map(m => <section key={m.id} style={{ position: 'absolute', left: positions.get(m.id)[0], top: positions.get(m.id)[1], width: 274 }} aria-label={m.round}>
      <h3 style={{ margin: '0 0 14px', fontSize: 16 }}>{m.round}</h3>{renderMatch(m)}
      <p className="cd-detail-hint">{m.round === 'Qualifier 1' ? 'Winner to Final ? Loser to Qualifier 2' : m.round === 'Eliminator' ? 'Winner to Qualifier 2 ? Loser eliminated' : m.round === 'Qualifier 2' ? 'Winner to Final ? Loser eliminated' : 'Winner becomes champion'}</p>
    </section>)}
  </div>;
}
