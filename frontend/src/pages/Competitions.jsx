/**
 * NEXUS ESPORTS — Competitions
 *
 * Published competitions from the backend with their real team counts.
 * Filters work on the competition's actual state, not on display badges.
 *
 * The list, the filter tab and the search text all live in the Redux store
 * (state.competitions), so they are still there when you come back.
 */
import { useEffect, useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import CreateCompetitionLink from '../components/CreateCompetitionLink.jsx';
import { useDispatch, useSelector } from 'react-redux';
import { setFilter, setQuery } from '../store/competitionsSlice.js';
import CompCard from '../components/CompCard.jsx';
import { EmptyState, ErrorState, LoadingState } from '../components/ui.jsx';
import { hasStarted, isClosedCompetition, isDraft, isLiveCompetition, useCompetitions } from '../services/competitions.js';
import '../styles/pages/competitions.css';

const FILTERS = [
  { id: 'all', label: 'All', test: () => true },
  { id: 'open', label: 'Registration open', test: (c) => c.registration.open },
  { id: 'live', label: 'Live', test: (c) => isLiveCompetition(c) },
  { id: 'upcoming', label: 'Upcoming', test: (c) => !hasStarted(c) },
  { id: 'league', label: 'League', test: (c) => String(c.type).toLowerCase() === 'league' },
  { id: 'tournament', label: 'Tournament', test: (c) => String(c.type).toLowerCase() === 'tournament' },
];

export default function Competitions() {
  const session = useSelector((state) => state.auth.session);
  const { loading, error, data, reload } = useCompetitions();
  const filter = useSelector((state) => state.competitions.filter);
  const query = useSelector((state) => state.competitions.query);
  const dispatch = useDispatch();
  const [params] = useSearchParams();

  // Arriving from a game card on Home (?q=Valorant): search for that game.
  useEffect(() => {
    const q = params.get('q');
    if (q !== null) {
      dispatch(setQuery(q));
      dispatch(setFilter('all'));
    }
  }, [params, dispatch]);

  const browsable = useMemo(() => data.filter((c) => !isDraft(c) && !isClosedCompetition(c)), [data]);
  const counts = useMemo(() => Object.fromEntries(FILTERS.map((f) => [f.id, browsable.filter(f.test).length])), [browsable]);
  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    const active = FILTERS.find((f) => f.id === filter) || FILTERS[0];
    return browsable.filter((c) => active.test(c) && (!q || `${c.name} ${c.game} ${c.type} ${c.format}`.toLowerCase().includes(q)));
  }, [browsable, filter, query]);

  return (
    <main className="competitions-page">
      <div className="comps-page-header-row">
        <div className="comps-page-header">
          <h1>Competitions</h1>
          <p>Browse and register for active tournaments across all games.</p>
        </div>
        <CreateCompetitionLink to={session ? '/pages/create-competition.html' : '/pages/login.html?redirect=/pages/create-competition.html'} className="create-comp-btn">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><line x1="8" y1="2" x2="8" y2="14" /><line x1="2" y1="8" x2="14" y2="8" /></svg>
          Create competition
        </CreateCompetitionLink>
      </div>

      <div className="comps-filters">
        {FILTERS.map((f) => (
          <button type="button" key={f.id} className={`filter-tab${filter === f.id ? ' active' : ''}`} aria-pressed={filter === f.id} onClick={() => dispatch(setFilter(f.id))}>
            {f.label} <span style={{ opacity: 0.6 }}>({counts[f.id] || 0})</span>
          </button>
        ))}
        <div className="comps-search">
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden="true"><circle cx="7" cy="7" r="5" /><line x1="10.5" y1="10.5" x2="14" y2="14" /></svg>
          <input type="search" aria-label="Search competitions" placeholder="Search competitions…" value={query} onChange={(e) => dispatch(setQuery(e.target.value))} />
        </div>
      </div>

      {loading && <LoadingState label="Loading competitions…" />}
      {!loading && error && <ErrorState message={error} onRetry={reload} />}
      {!loading && !error && visible.length === 0 && (
        <EmptyState
          title={browsable.length ? 'No competitions match' : 'No competitions yet'}
          message={browsable.length ? 'Try another filter or search term.' : 'Be the first to create one.'}
        />
      )}

      <div className="comps-grid">
        {visible.map((comp) => <div key={comp.id} className="comp-card-wrapper"><CompCard comp={comp} /></div>)}
      </div>
    </main>
  );
}
