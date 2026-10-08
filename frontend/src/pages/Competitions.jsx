/**
 * NEXUS ESPORTS — Competitions
 *
 *
 * competition grid from the data layer (instant local render, then an API refresh
 * if it responds within 2s), with badge/type filters and search.
 */
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import NexusData from '../services/data.js';
import CompCard from '../components/CompCard.jsx';
import '../styles/pages/competitions.css';

const FILTERS = ['all', 'featured', 'live', 'hot', 'new', 'league', 'tournament'];

function isHidden(comp) {
  return comp.ended || comp.status === 'completed';
}

export default function Competitions() {
  const { session } = useAuth();
  const [comps, setComps] = useState([]);
  const [filter, setFilter] = useState('all');
  const [query, setQuery] = useState('');

  useEffect(() => {
 // Instant local render.
    let local = NexusData.getCompetitionsForPublic
      ? NexusData.getCompetitionsForPublic()
      : NexusData.loadCompetitions();
    setComps((local || []).filter((c) => !isHidden(c)));

 // Background API refresh (2s timeout); keep local data on failure.
    let cancelled = false;
    (async () => {
      try {
        const apiComps = await Promise.race([
          NexusData.fetchActiveCompetitionsFromAPI(),
          new Promise((resolve) => setTimeout(() => resolve(null), 2000)),
        ]);
        if (!cancelled && apiComps && apiComps.length > 0) {
          setComps(apiComps.filter((c) => !isHidden(c)));
        }
      } catch (err) {
 /* keep local data */
      }
    })();

    return () => { cancelled = true; };
  }, []);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return comps.filter((c) => {
      if (q) {
        const haystack = `${c.name || ''} ${c.game || ''} ${c.type || ''}`.toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      if (filter === 'all') return true;
      const badge = String(c.badge || '').toLowerCase();
      const type = String(c.type || '').toLowerCase();
      if (filter === 'league' || filter === 'tournament') return type === filter;
      if (filter === 'new') return badge === 'new';
      return badge === filter;
    });
  }, [comps, filter, query]);

  return (
    <main className="competitions-page">
      <div className="comps-page-header-row">
        <div className="comps-page-header">
          <h1>Competitions</h1>
          <p>Browse and register for active tournaments across all games.</p>
        </div>
        <Link to="/pages/create-competition.html" className="create-comp-btn">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <line x1="8" y1="2" x2="8" y2="14" />
            <line x1="2" y1="8" x2="14" y2="8" />
          </svg>
          Create Competition
        </Link>
      </div>

      <div className="comps-filters">
        {FILTERS.map((f) => (
          <button
            key={f}
            className={`filter-tab${filter === f ? ' active' : ''}`}
            data-filter={f}
            onClick={() => setFilter(f)}
          >
            {f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}

        <div className="comps-search">
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
            <circle cx="7" cy="7" r="5" />
            <line x1="10.5" y1="10.5" x2="14" y2="14" />
          </svg>
          <input
            type="text"
            id="comp-search"
            placeholder="Search competitions…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
      </div>

      <div className="comps-grid" id="comps-grid">
        {visible.map((comp) => (
          <div
            key={comp.id}
            className="comp-card-wrapper"
            data-badge={String(comp.badge || '').toLowerCase()}
            data-type={String(comp.type || '').toLowerCase()}
            data-isnew={String(comp.badge || '').toLowerCase() === 'new' ? 'true' : 'false'}
          >
            <CompCard comp={comp} session={session} />
          </div>
        ))}
      </div>
    </main>
  );
}


