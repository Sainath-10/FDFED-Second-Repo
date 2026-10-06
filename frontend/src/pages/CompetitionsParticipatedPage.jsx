import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Shell from '../components/Layout/Shell';
import { useToast } from '../components/Common/Toast';
import '../styles/pages/competitions-participated.css';

export default function CompetitionsParticipatedPage() {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [filter, setFilter] = useState('all');

  const items = [
    {
      id: 'part-1',
      status: 'ongoing',
      bannerImg: '/assets/b890c61489a080992ad7e99adabb1145e6d59606.png',
      game: 'Counter-Strike 2',
      title: 'World Championship 2026',
      team: 'Storm Riders',
      round: 'Quarter Finals',
      wl: '2 / 0',
      nextMatch: 'Aug 5, 18:00',
      isOngoing: true,
      hasReport: true
    },
    {
      id: 'part-2',
      status: 'completed',
      bannerImg: '/assets/fad13be991fc17a28771191ca710b201fb3ee4fb.png',
      game: 'Valorant',
      title: 'Pro League Season 4',
      team: 'Inferno Squad',
      result: 'Semi Final',
      wl: '4 / 1',
      prize: '₹75,000',
      isOngoing: false,
      hasReport: false
    },
    {
      id: 'part-3',
      status: 'completed',
      bannerImg: '/assets/61fe8554e6377c0b431ed18f65529b1847d225cb.png',
      game: 'Rocket League',
      title: 'Regional Cup 2026',
      team: 'Storm Riders',
      eliminated: 'Semi Final',
      wl: '3 / 1',
      placement: '3rd / 16',
      isOngoing: false,
      hasReport: false
    }
  ];

  const filteredItems = items.filter(card => {
    if (filter === 'all') return true;
    return card.status === filter;
  });

  return (
    <Shell activeTab="activity">
      <main className="main-content">
          <h1 className="page-title">Competitions Participated</h1>
          <p className="page-description">All competitions you or your team have been part of.</p>

          <div className="filter-row">
            <button
              type="button"
              className={`filter-tab ${filter === 'all' ? 'active' : ''}`}
              onClick={() => setFilter('all')}
            >
              All
            </button>
            <button
              type="button"
              className={`filter-tab ${filter === 'ongoing' ? 'active' : ''}`}
              onClick={() => setFilter('ongoing')}
            >
              Ongoing
            </button>
            <button
              type="button"
              className={`filter-tab ${filter === 'completed' ? 'active' : ''}`}
              onClick={() => setFilter('completed')}
            >
              Completed
            </button>
            <button
              type="button"
              className={`filter-tab ${filter === 'upcoming' ? 'active' : ''}`}
              onClick={() => setFilter('upcoming')}
            >
              Upcoming
            </button>
          </div>

          <div id="comps-part-list" className="participated-list">
            {filteredItems.map(card => {
              if (card.isOngoing) {
                return (
                  <div key={card.id} className="comp-participation-card ongoing" data-status="ongoing">
                    <div className="card-banner">
                      <img src={card.bannerImg} className="banner-img" alt={card.title} />
                      <div className="banner-overlay"></div>
                      <div className="banner-content">
                        <div className="banner-game-label">{card.game}</div>
                        <div className="banner-title">{card.title}</div>
                      </div>
                      <span className="status-pill ongoing status-pill-absolute">● Ongoing</span>
                    </div>
                    <div className="card-body">
                      <div className="stat-group">
                        <div className="label">Your Team</div>
                        <div className="value">{card.team}</div>
                      </div>
                      <div className="stat-group">
                        <div className="label">Current Round</div>
                        <div className="value accent">{card.round}</div>
                      </div>
                      <div className="stat-group">
                        <div className="label">W / L</div>
                        <div className="value">{card.wl}</div>
                      </div>
                      <div className="stat-group">
                        <div className="label">Next Match</div>
                        <div className="value">{card.nextMatch}</div>
                      </div>
                      <div className="card-actions">
                        <button
                          type="button"
                          className="btn-table-secondary"
                          onClick={() => navigate('/view-team')}
                        >
                          View My Team
                        </button>
                        <button
                          type="button"
                          className="btn-table-secondary"
                          onClick={() => showToast('Viewing standings...')}
                        >
                          View Standings
                        </button>
                        <button
                          type="button"
                          className="btn-table-primary"
                          onClick={() => navigate('/submit-report')}
                        >
                          Submit Report
                        </button>
                      </div>
                    </div>
                  </div>
                );
              }

              return (
                <div key={card.id} className="comp-participation-card" data-status={card.status}>
                  <div className="card-banner small">
                    <img src={card.bannerImg} className="banner-img" alt={card.title} />
                    <div className="banner-overlay"></div>
                    <div className="banner-content">
                      <div className="banner-game-label">{card.game}</div>
                      <div className="banner-title">{card.title}</div>
                    </div>
                    <span className="status-pill completed status-pill-absolute">Completed</span>
                  </div>
                  <div className="card-body small">
                    <div className="stat-group">
                      <div className="label">Team</div>
                      <div className="value">{card.team}</div>
                    </div>
                    {card.result && (
                      <div className="stat-group">
                        <div className="label">Result</div>
                        <div className="value muted">{card.result}</div>
                      </div>
                    )}
                    {card.eliminated && (
                      <div className="stat-group">
                        <div className="label">Eliminated</div>
                        <div className="value muted">{card.eliminated}</div>
                      </div>
                    )}
                    <div className="stat-group">
                      <div className="label">W / L</div>
                      <div className="value">{card.wl}</div>
                    </div>
                    {card.prize && (
                      <div className="stat-group">
                        <div className="label">Prize Won</div>
                        <div className="value accent">{card.prize}</div>
                      </div>
                    )}
                    {card.placement && (
                      <div className="stat-group">
                        <div className="label">Placement</div>
                        <div className="value muted">{card.placement}</div>
                      </div>
                    )}
                    <div className="card-actions">
                      <button
                        type="button"
                        className="btn-table-secondary"
                        onClick={() => showToast('Viewing standings...')}
                      >
                        View Standings
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </main>
    </Shell>
  );
}
