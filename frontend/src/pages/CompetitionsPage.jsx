import React, { useState, useEffect, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Shell from '../components/Layout/Shell';
import CompetitionCard from '../components/Common/CompetitionCard';
import NexusData from '../services/competitionService';
import NexusAuth from '../services/authService';
import '../styles/pages/competitions.css';

export default function CompetitionsPage() {
  const navigate = useNavigate();
  const [competitions, setCompetitions] = useState([]);
  const [activeFilter, setActiveFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    // 1. Load local competitions immediately
    let initial = [];
    if (NexusData) {
      if (typeof NexusData.getCompetitionsForPublic === 'function') {
        initial = NexusData.getCompetitionsForPublic();
      } else if (typeof NexusData.loadCompetitions === 'function') {
        initial = NexusData.loadCompetitions();
      }
    }
    // Filter out ended/completed competitions
    const activeComps = (initial || []).filter(c => !c.ended && c.status !== 'completed');
    setCompetitions(activeComps);

    // 2. Fetch active from API in background if available
    if (NexusData && typeof NexusData.fetchActiveCompetitionsFromAPI === 'function') {
      NexusData.fetchActiveCompetitionsFromAPI()
        .then(apiComps => {
          if (Array.isArray(apiComps) && apiComps.length > 0) {
            setCompetitions(apiComps.filter(c => !c.ended && c.status !== 'completed'));
          }
        })
        .catch(() => {});
    }
  }, []);

  const filteredCompetitions = useMemo(() => {
    return competitions.filter(c => {
      // Filter tab logic
      if (activeFilter === 'league' || activeFilter === 'tournament') {
        if ((c.type || '').toLowerCase() !== activeFilter) return false;
      } else if (activeFilter === 'new') {
        const isNew = c.isNew === true || (c.badge || '').toLowerCase() === 'new';
        if (!isNew) return false;
      } else if (activeFilter !== 'all') {
        const badge = (c.badge || '').toLowerCase();
        if (badge !== activeFilter) return false;
      }

      // Search query logic
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const name = (c.name || '').toLowerCase();
        const game = (c.game || '').toLowerCase();
        const desc = (c.description || '').toLowerCase();
        if (!name.includes(q) && !game.includes(q) && !desc.includes(q)) {
          return false;
        }
      }

      return true;
    });
  }, [competitions, activeFilter, searchQuery]);

  return (
    <Shell activePage="competitions">
      <main className="competitions-page">
        {/* Page Header */}
        <div className="comps-page-header-row">
          <div className="comps-page-header">
            <h1>Competitions</h1>
            <p>Browse and register for active tournaments across all games.</p>
          </div>
          <Link to="/create-competition" className="create-comp-btn">
            <svg
              width="16"
              height="16"
              viewBox="0 0 16 16"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            >
              <line x1="8" y1="2" x2="8" y2="14" />
              <line x1="2" y1="8" x2="14" y2="8" />
            </svg>
            Create Competition
          </Link>
        </div>

        {/* Filters + Search */}
        <div className="comps-filters">
          {['all', 'featured', 'live', 'hot', 'new', 'league', 'tournament'].map((filter) => (
            <button
              key={filter}
              className={`filter-tab ${activeFilter === filter ? 'active' : ''}`}
              onClick={() => setActiveFilter(filter)}
            >
              {filter.charAt(0).toUpperCase() + filter.slice(1)}
            </button>
          ))}

          <div className="comps-search">
            <svg
              viewBox="0 0 16 16"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
            >
              <circle cx="7" cy="7" r="5" />
              <line x1="10.5" y1="10.5" x2="14" y2="14" />
            </svg>
            <input
              type="text"
              id="comp-search"
              placeholder="Search competitions…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        {/* Grid */}
        <div className="comps-grid" id="comps-grid">
          {filteredCompetitions.length > 0 ? (
            filteredCompetitions.map((c) => (
              <div
                key={c.id}
                className="comp-card-wrapper"
                data-badge={(c.badge || '').toLowerCase()}
                data-type={(c.type || '').toLowerCase()}
                data-isnew={(c.badge || '').toLowerCase() === 'new' ? 'true' : 'false'}
              >
                <CompetitionCard comp={c} />
              </div>
            ))
          ) : (
            <p style={{ color: 'var(--text-muted)', gridColumn: '1 / -1', padding: '30px 0' }}>
              No competitions found matching your filter criteria.
            </p>
          )}
        </div>
      </main>
    </Shell>
  );
}
