import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import NexusData from '../services/data.js';
import { CompetitionsAPI, MatchesAPI, TeamsAPI } from '../services/api.js';
import { assetUrl } from '../lib/assets.js';
import { groupFixtures, isFixtureWinner, normalizeFixture } from '../lib/fixtures.mjs';
import { competitionOutcome } from '../lib/competitionOutcome.mjs';
import CompetitionOutcome from '../components/CompetitionOutcome.jsx';
import FixtureEditor from '../components/FixtureEditor.jsx';
import PlayoffBracket from '../components/PlayoffBracket.jsx';
import FixtureBracket from '../components/FixtureBracket.jsx';
import FixtureSeeds from '../components/FixtureSeeds.jsx';
import { DisputesSection, OrganizersSection, StandingsSection } from '../components/CompetitionInlineSections.jsx';
import '../styles/pages/competition-detail.css';

function Icon({ name, size = 18 }) {
  const paths = {
    bracket: <><rect x="2" y="3" width="6" height="5" rx="1" /><rect x="2" y="16" width="6" height="5" rx="1" /><path d="M8 5h5v14H8m5-7h4" /><rect x="17" y="9" width="5" height="6" rx="1" /></>,
    list: <path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" />,
    arrow: <path d="m9 5 7 7-7 7" />,
    refresh: <path d="M20 7a9 9 0 1 0 1 7M20 2v5h-5" />,
    trophy: <path d="M7 3h10v5a5 5 0 0 1-10 0V3Zm5 10v7m-4 1h8M7 5H3v2a4 4 0 0 0 4 4m10-6h4v2a4 4 0 0 1-4 4" />,
    search: <><circle cx="10" cy="10" r="6" /><path d="m15 15 6 6" /></>,
    clock: <><circle cx="12" cy="12" r="9" /><path d="M12 6v6l4 2" /></>,
  };
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name] || paths.bracket}</svg>;
}

function Avatar({ name }) {
  const text = String(name || '?');
  const hue = [...text].reduce((sum, c) => sum + c.charCodeAt(0), 0) % 360;
  return <span className="cd-avatar" style={{ '--team-hue': hue }} aria-hidden="true">{text.slice(0, 2).toUpperCase()}</span>;
}

function Status({ value }) {
  return <span className={`cd-status cd-status-${value}`}><i />{({ live: 'Live now', completed: 'Completed', scheduled: 'Scheduled', pending: 'Awaiting teams', ready: 'Ready to play', bye: 'Bye · advanced' })[value] || value}</span>;
}

function MatchCard({ match, selected, onSelect, number }) {
  return <button type="button" className={`cd-match ${selected ? 'is-selected' : ''} ${match.status === 'live' ? 'is-live' : ''}`} onClick={() => onSelect(match.id)} aria-pressed={selected} aria-label={`${match.team1} vs ${match.team2}, ${match.round}, ${match.status}. View match details`}>
    <span className="cd-match-heading"><span>{match.bracket?.version === 2 ? `R${match.bracket.round} · M${match.bracket.position}` : `M${String(number).padStart(2, '0')}`}</span><Status value={match.status} /></span>
    {[1, 2].map((side) => <span key={side} className={`cd-contender ${isFixtureWinner(match, side) ? 'is-winner' : ''}`}>
      <Avatar name={match[`team${side}`]} /><span className="cd-team-name">{match.bracket?.slots?.[side - 1]?.seed && <small className="cd-seed-number">#{match.bracket.slots[side - 1].seed} </small>}{match[`team${side}`]}</span>
      <strong>{['completed', 'live'].includes(match.status) ? match[`score${side}`] ?? '—' : '—'}</strong>
    </span>)}
    <span className="cd-match-foot"><Icon name="clock" size={13} /><span>{match.date}{match.time ? ` · ${match.time}` : ''}</span><Icon name="arrow" size={13} /></span>
  </button>;
}

export default function CompetitionDetail() {
  const [params, setParams] = useSearchParams();
  const id = params.get('id') || '';
  const { session } = useAuth();
  const [revision, setRevision] = useState(0);
  const cached = useMemo(() => NexusData.getCompetitionById?.(id), [id, revision]);
  const apiId = cached?.dbId || id;
  const [remote, setRemote] = useState({ id: '', competition: null, matches: null, teams: null, errors: [], loading: true });
  const [stage, setStage] = useState('league');
  const [view, setView] = useState('board');
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('all');
  const [selectedId, setSelectedId] = useState(null);
  const [zoom, setZoom] = useState(1);
  const [building, setBuilding] = useState(false);
  const [buildError, setBuildError] = useState('');
  const repaired = useRef(new Set());
  const boardRef = useRef(null);
  const detailRef = useRef(null);

  useEffect(() => {
    const refresh = () => setRevision((v) => v + 1);
    window.addEventListener('focus', refresh);
    return () => window.removeEventListener('focus', refresh);
  }, []);

  useEffect(() => {
    let cancelled = false;
    if (!apiId) {
      setRemote({ id: '', competition: null, matches: null, teams: null, errors: ['Open a competition from My Activity.'], loading: false });
      return;
    }
    setRemote((old) => ({ ...(old.id === apiId ? old : { competition: null, matches: null, teams: null }), id: apiId, errors: [], loading: true }));
    const requests = [CompetitionsAPI.getById(apiId), MatchesAPI.getByCompetition(apiId), TeamsAPI.getByCompetition(apiId)];
    Promise.allSettled(requests).then((results) => {
      if (cancelled) return;
      const keys = ['competition', 'matches', 'teams'];
      setRemote((old) => {
        const next = { ...old, loading: false, errors: [] };
        results.forEach((result, i) => {
          const response = result.status === 'fulfilled' ? result.value : null;
          if (response?.ok && response.data && (i === 0 || Array.isArray(response.data))) next[keys[i]] = response.data;
          else next.errors.push(`Could not refresh ${keys[i]}. ${response?.error || 'Please check your connection and retry.'}`);
        });
        return next;
      });
    });
    return () => { cancelled = true; };
  }, [apiId, revision]);

  useEffect(() => { setSelectedId(params.get('matchId')); setQuery(''); setStatus('all'); }, [id]);
  const current = remote.id === apiId ? remote : { loading: true, errors: [] };
  const comp = current.competition ? { ...cached, ...current.competition } : cached;
  // A successful empty API response is authoritative too; never resurrect cached matches.
  const matches = useMemo(() => (current.matches ?? cached?.matches ?? []).map(normalizeFixture), [current.matches, cached]);
  const teams = current.teams ?? cached?.teams ?? [];
  const playoffMatches = matches.filter(m => m.bracket?.kind === 'ipl');
  const stageMatches = playoffMatches.length ? matches.filter(m => stage === 'playoffs' ? m.bracket?.kind === 'ipl' : m.bracket?.kind !== 'ipl') : matches;
  const selected = stageMatches.find((match) => match.id === selectedId);
  const filtered = stageMatches.filter((m) => (status === 'all' || m.status === status) && `${m.team1} ${m.team2} ${m.round}`.toLowerCase().includes(query.trim().toLowerCase()));
  const rounds = groupFixtures(filtered);
  const numbers = new Map(matches.map((m, index) => [m.id, index + 1]));
  const outcome = competitionOutcome(matches);
  const completed = matches.filter((m) => m.status === 'completed').length;
  const playedCount = matches.filter((m) => m.status !== 'bye').length;
  const byeCount = matches.filter((m) => m.status === 'bye').length;
  const live = matches.filter((m) => m.status === 'live').length;
  const ended = Boolean(comp?.ended || comp?.status === 'completed');
  const isLeague = /league|robin/i.test(`${comp?.type} ${comp?.format}`);
  const creator = comp?.createdBy || comp?.organizerId;
  const organizers = [...new Set([creator, ...(comp?.organizers || [])].filter(Boolean))];
  const canManage = organizers.includes(session?.username) || ['admin', 'comp_admin', 'super-admin', 'super_admin'].includes(session?.role);
  const availableTabs = canManage ? ['fixtures', 'teams', 'overview', 'standings', 'organizers', 'disputes'] : ['fixtures', 'teams', 'overview', 'standings'];
  const activeTab = availableTabs.includes(params.get('tab')) ? params.get('tab') : 'fixtures';
  const singleElimination = !isLeague && !/double/i.test(comp?.format || '');
  const eligibleTeams = teams.filter((team) => !['rejected', 'banned', 'disbanded'].includes(team.status));
  const storedSeeds = matches.filter((match) => match.bracket?.version === 2 && match.bracket.round === 1).flatMap((match) => match.bracket.slots).filter((slot) => slot.teamId).sort((a, b) => a.seed - b.seed).map((slot) => slot.teamId);
  const seedOrder = storedSeeds.length === eligibleTeams.length ? storedSeeds : eligibleTeams.map((team) => team.id);
  const route = (page, extra = {}) => `/pages/${page}.html?${new URLSearchParams({ id: apiId, ...extra })}`;
  const tab = (value) => { const next = new URLSearchParams(params); next.set('tab', value); setParams(next, { replace: true }); };
  const selectMatch = (matchId) => setSelectedId(matchId);

  async function buildFixtures(repair = false, seedOrder) {
    if (building) return;
    setBuilding(true); setBuildError('');
    try {
      const response = repair ? await MatchesAPI.completeBracket(apiId, seedOrder) : await MatchesAPI.generateSchedule(apiId, { seedOrder });
      if (!response.ok) throw new Error(String(response.error || 'Could not build fixtures.'));
      setRevision((value) => value + 1);
    } catch (error) { setBuildError(error.message); }
    finally { setBuilding(false); }
  }

  // Upgrade the old first-round-only bracket once, without replacing any fixtures.
  useEffect(() => {
    if (current.loading || !current.matches || !current.teams || !canManage || ended || !singleElimination || !matches.length || eligibleTeams.length < 2 || repaired.current.has(apiId)) return;
    if (matches.some((match) => match.bracket?.version !== 2) && !matches.some((match) => ['completed', 'live'].includes(match.status))) {
      repaired.current.add(apiId);
      buildFixtures(true);
    }
  }, [current.loading, current.matches, current.teams, canManage, ended, singleElimination, apiId]);

  function savedMatch(updated) {
    setRemote((old) => ({ ...old, matches: old.matches?.map((match) => match.id === updated.id ? updated : match) }));
    setRevision((value) => value + 1);
  }

  useEffect(() => { if (comp?.name) document.title = `NEXUS ESPORTS — ${comp.name}`; }, [comp?.name]);
  useEffect(() => { if (selectedId) detailRef.current?.focus({ preventScroll: true }); }, [selectedId]);

  if (!comp) return <main className="cd-page"><div className="cd-empty" role="status"><Icon name="bracket" size={36} /><h1>{current.loading ? 'Loading competition…' : 'Competition unavailable'}</h1><p>{current.errors.join(' ')}</p><Link className="cd-button" to="/pages/my-activity.html">Back to My Activity</Link></div></main>;

  const banner = assetUrl(comp.img || 'c4f97eccde97e10ac89b61ec5fb36fdce0ab2477.png');
  return <main className="cd-page">
    <div className="cd-breadcrumb"><Link to="/pages/my-activity.html">My activity</Link><span>/</span><span>Competition center</span></div>
    <header className="cd-hero" style={{ '--cover': `url("${banner}")` }}>
      <div className="cd-hero-copy"><div className="cd-eyebrow"><span className={`cd-dot ${ended ? 'ended' : ''}`} />{ended ? 'Completed' : comp.status || 'Upcoming'}<span className="cd-divider">/</span>{comp.game || 'Esports'}</div>
        <h1>{comp.name}</h1><p>{comp.format || comp.type || 'Tournament'}<span>•</span>{comp.location || 'Online'}{comp.season && <><span>•</span>{comp.season}</>}</p>
      </div>
      <div className="cd-hero-stats"><div><strong>{teams.length}</strong><span>Teams</span></div><div><strong>{current.loading && !current.matches ? '—' : matches.length}</strong><span>Fixtures</span></div><div><strong>{completed}<small>/{playedCount}</small></strong><span>Completed</span></div></div>
    </header>

    <nav className="cd-nav" aria-label="Competition sections">
      {availableTabs.map((value) => <button key={value} type="button" aria-current={activeTab === value ? 'page' : undefined} className={activeTab === value ? 'active' : ''} onClick={() => tab(value)}>{value === 'fixtures' && <Icon name="bracket" size={16} />}{value[0].toUpperCase() + value.slice(1)}</button>)}
      {canManage && <>{comp.feeType && comp.feeType !== 'free' && <Link to={route('organizer-revenue')}>Transactions</Link>}{!ended && <Link to={route('edit-competition')}>Settings</Link>}</>}
    </nav>

    {!!current.errors.length && <div className="cd-notice" role="alert"><div>{current.errors.map((error) => <p key={error}>{error}</p>)}{matches.length > 0 && <small>Showing the last available fixtures until refresh succeeds.</small>}</div><button className="cd-button" onClick={() => setRevision((v) => v + 1)} disabled={current.loading}>Retry</button></div>}

    {activeTab === 'fixtures' && <section className="cd-fixtures" aria-labelledby="cd-fixture-title">
      <div className="cd-section-heading"><div><h2 id="cd-fixture-title">{outcome ? 'Winner and runner-up' : 'Fixtures'}</h2></div>
      </div>
      <CompetitionOutcome outcome={outcome} />
      {building && <p className="cd-fixture-message" role="status">Building the full bracket and reserving match times…</p>}
      {buildError && <div className="cd-notice" role="alert"><p>{buildError}</p><button className="cd-button" disabled={building} onClick={() => buildFixtures(matches.length > 0 && singleElimination)}>Retry</button></div>}
      {playoffMatches.length > 0 && <div className="cd-segment" role="tablist" aria-label="Competition stage" style={{ marginBottom: 18 }}>
        {[['league', 'League stage'], ['playoffs', 'Playoffs']].map(([value, label]) => <button key={value} role="tab" aria-selected={stage === value} aria-pressed={stage === value} onClick={() => { setStage(value); setSelectedId(null); setQuery(''); setStatus('all'); }}>{label}</button>)}
      </div>}
      <div className="cd-toolbar"><div className="cd-segment" aria-label="Fixture view">{[['board', 'bracket', 'Round board'], ['schedule', 'list', 'Schedule']].map(([value, icon, label]) => <button key={value} type="button" aria-pressed={view === value} onClick={() => setView(value)}><Icon name={icon} size={16} />{label}</button>)}</div>
        <label className="cd-search"><Icon name="search" size={17} /><input aria-label="Search teams or rounds" placeholder="Find a team or round…" value={query} onChange={(e) => setQuery(e.target.value)} /></label>
        <select aria-label="Filter match status" value={status} onChange={(e) => setStatus(e.target.value)}><option value="all">All matches</option><option value="ready">Ready to play</option><option value="pending">Awaiting teams</option><option value="bye">Byes</option><option value="scheduled">Scheduled</option><option value="live">Live now</option><option value="completed">Completed</option></select>
      </div>

      {current.loading && current.matches == null ? <div className="cd-empty" role="status"><span className="cd-loader" /><h3>Loading scheduled matches…</h3></div>
        : !filtered.length ? <div className="cd-empty"><Icon name="bracket" size={40} /><h3>{matches.length ? 'No matches match your filters' : current.errors.length ? 'Fixtures could not be loaded' : 'The stage is set'}</h3><p>{matches.length ? 'Try a different team, round, or status.' : current.errors.length ? 'Use Retry above to load the schedule.' : 'Create the schedule when your teams are ready.'}</p>{matches.length > 0 ? <button className="cd-button" onClick={() => { setQuery(''); setStatus('all'); }}>Clear filters</button> : canManage && !ended && !current.errors.length && <button className="cd-button cd-primary" disabled={building || eligibleTeams.length < 2} onClick={() => buildFixtures()}>{building ? 'Creating…' : 'Create fixtures'}</button>}</div>
          : <div className={`cd-workspace ${selected ? 'has-details' : ''}`}>
            <div className="cd-visual">
              {view === 'board' ? <>
                <div className="cd-board-meta"><span>{rounds.length} {rounds.length === 1 ? 'round' : 'rounds'} <span className="cd-divider">/</span> {filtered.filter((match) => match.status !== 'bye').length} matches{byeCount > 0 && ` ? ${byeCount} byes`} {live > 0 && <b className="cd-live-count">{live} live</b>}</span><div className="cd-board-controls"><button aria-label="Scroll rounds left" onClick={() => boardRef.current?.scrollBy({ left: -310, behavior: 'smooth' })}>←</button><button aria-label="Scroll rounds right" onClick={() => boardRef.current?.scrollBy({ left: 310, behavior: 'smooth' })}>→</button><span /><button aria-label="Zoom out" disabled={zoom <= .8} onClick={() => setZoom((v) => Math.max(.8, v - .1))}>−</button><button aria-label="Reset zoom" onClick={() => setZoom(1)}>{Math.round(zoom * 100)}%</button><button aria-label="Zoom in" disabled={zoom >= 1.3} onClick={() => setZoom((v) => Math.min(1.3, v + .1))}>+</button></div></div>
                <div className="cd-board-scroll" ref={boardRef} tabIndex={0} role="region" aria-label="Scrollable fixture rounds">
                  {stage === 'playoffs' && playoffMatches.length > 0 && !query && status === 'all'
                    ? <PlayoffBracket matches={stageMatches} zoom={zoom} renderMatch={(match) => <MatchCard match={match} number={numbers.get(match.id)} selected={match.id === selectedId} onSelect={selectMatch} />} />
                    : stageMatches.every((match) => match.bracket?.version === 2) && !query && status === 'all'
                    ? <FixtureBracket matches={stageMatches} selectedId={selectedId} onSelect={selectMatch} zoom={zoom} renderMatch={(match) => <MatchCard match={match} number={numbers.get(match.id)} selected={match.id === selectedId} onSelect={selectMatch} />} />
                    : <div className={`cd-board ${isLeague ? 'is-league' : 'is-knockout'}`} style={{ zoom }}>
                    {rounds.map((round, index) => <section className="cd-round" key={round.name} aria-label={round.name}><header><span className="cd-round-number">{String(index + 1).padStart(2, '0')}</span><div><h3>{round.name}</h3><small>{round.matches.length} {round.matches.length === 1 ? 'match' : 'matches'}</small></div>{!isLeague && index < rounds.length - 1 && <Icon name="arrow" size={16} />}</header><div className="cd-round-cards">{round.matches.map((match) => <MatchCard key={match.id} match={match} number={numbers.get(match.id)} selected={match.id === selectedId} onSelect={selectMatch} />)}</div></section>)}
                    {!isLeague && <div className="cd-title-stage"><div className="cd-trophy"><Icon name="trophy" size={34} /></div><span className="cd-eyebrow">CHAMPION</span><h3>{final?.winnerName || 'Who takes the title?'}</h3><p>{final ? 'Final result confirmed' : 'Winners advance along the bracket. Byes go straight to the next round.'}</p></div>}
                  </div>}

                </div><div className="cd-board-caption"><span><i className="cd-legend-line" />Rounds shown in competition order</span><span>Scroll to explore · Click a match for details</span></div>
              </> : <div className="cd-schedule">{rounds.map((round) => <section key={round.name}><h3>{round.name}<span>{round.matches.length} matches</span></h3><div className="cd-schedule-grid">{round.matches.map((match) => <MatchCard key={match.id} match={match} selected={match.id === selectedId} number={numbers.get(match.id)} onSelect={selectMatch} />)}</div></section>)}</div>}
            </div>
            {selected && <aside className="cd-detail" ref={detailRef} tabIndex={-1} aria-label="Selected match details" onKeyDown={(e) => { if (e.key === 'Escape') setSelectedId(null); }}><div className="cd-detail-heading"><span className="cd-eyebrow">MATCH {String(numbers.get(selected.id)).padStart(2, '0')}</span><button aria-label="Close match details" onClick={() => setSelectedId(null)}>×</button></div><h3>{selected.round}</h3><Status value={selected.status} /><div className="cd-detail-versus"><div><Avatar name={selected.team1} /><strong>{selected.team1}</strong></div><span>{selected.status === 'completed' ? `${selected.score1 ?? '—'} : ${selected.score2 ?? '—'}` : 'VS'}</span><div><Avatar name={selected.team2} /><strong>{selected.team2}</strong></div></div><dl><div><dt>Date</dt><dd>{selected.date}</dd></div><div><dt>Time</dt><dd>{selected.time || 'To be confirmed'}</dd></div><div><dt>Format</dt><dd>{comp.format || comp.type}</dd></div>{selected.winnerName && <div><dt>Winner</dt><dd>{selected.winnerName}</dd></div>}</dl>{selected.notes && <p className="cd-detail-notes">{selected.notes}</p>}{canManage && !ended && !['completed', 'bye'].includes(selected.status) && <FixtureEditor key={selected.id} match={selected} matches={matches} competition={comp} isLeague={isLeague && selected.bracket?.kind !== 'ipl'} onSaved={savedMatch} />}{selected.resultDetails?.hostWinnerId && <p className="cd-detail-hint">Host's offline choice: {selected.winnerName}</p>}{selected.status === 'bye' && <p className="cd-detail-hint">This team advances automatically. No match is played.</p>}<p className="cd-detail-hint">Times are shown in your local time zone.</p></aside>}
          </div>}
      <div className="cd-progress"><span>{completed} of {playedCount} matches completed</span><div role="progressbar" aria-label="Competition progress" aria-valuenow={playedCount ? Math.round(completed / playedCount * 100) : 0} aria-valuemin={0} aria-valuemax={100}><i style={{ width: `${playedCount ? completed / playedCount * 100 : 0}%` }} /></div><strong>{playedCount ? Math.round(completed / playedCount * 100) : 0}%</strong></div>
    </section>}

    {activeTab === 'teams' && <section className="cd-content-panel"><div className="cd-section-heading"><div><h2>Registered teams</h2><p>{teams.length} teams in this competition</p></div>{canManage && !ended && <Link className="cd-button" to={route('comp-manage-teams')}>Manage teams <Icon name="arrow" size={15} /></Link>}</div>{canManage && singleElimination && <FixtureSeeds key={`${apiId}:${seedOrder.join(',')}`} teams={eligibleTeams} initialOrder={seedOrder} error={buildError} locked={ended || matches.some((match) => ['completed', 'live'].includes(match.status))} busy={building} onApply={(order) => buildFixtures(matches.length > 0, order)} />}<div className="cd-team-grid">{teams.map((team) => <Link className="cd-team-tile" key={team.id || team.name} to={`/pages/team/team-roster.html?${new URLSearchParams({ compId: apiId, teamId: team.dbId || team.id })}`}><Avatar name={team.name} /><div><h3>{team.name}</h3><p>{team.memberUsernames?.length ?? team.members?.length ?? team.players ?? 0} players · {team.status || 'Registered'}</p></div><Icon name="arrow" size={16} /></Link>)}</div>{!teams.length && <div className="cd-empty"><h3>No teams registered yet</h3><p>Teams will appear here after registration.</p></div>}</section>}
    {activeTab === 'overview' && <section className="cd-content-panel"><div className="cd-section-heading"><div><h2>About the competition</h2><p>{comp.description || 'Competition details and organizers.'}</p></div></div><dl className="cd-overview-grid">{[['Game', comp.game], ['Format', comp.format || comp.type], ['Starts', comp.startDate ? new Date(comp.startDate).toLocaleDateString() : comp.dates], ['Ends', comp.endDate ? new Date(comp.endDate).toLocaleDateString() : null], ['Prize pool', comp.prizePool || (comp.prize ? `₹${Number(comp.prize).toLocaleString('en-IN')}` : 'No prize pool')], ['Entry', comp.entryFee || (comp.entryFeeAmount ? `₹${comp.entryFeeAmount}` : 'Free')], ['Team capacity', comp.maxTeams], ['Organizers', organizers.map((name) => `@${name}`).join(', ')]].map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value || 'Not specified'}</dd></div>)}</dl></section>}
    {activeTab === 'standings' && <StandingsSection competitionId={apiId} teams={teams} matches={matches} outcome={outcome} />}
    {activeTab === 'organizers' && canManage && <OrganizersSection competition={{ ...comp, id: apiId }} onChanged={() => setRevision((value) => value + 1)} />}
    {activeTab === 'disputes' && canManage && <DisputesSection competitionId={apiId} />}
  </main>;
}
