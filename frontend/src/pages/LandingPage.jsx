import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Sidebar from '../components/Layout/Sidebar';
import Footer from '../components/Layout/Footer';
import WarningModal from '../components/Common/WarningModal';
import CoOrganizerToast from '../components/Common/CoOrganizerToast';
import Toast from '../components/Common/Toast';
import NexusAuth from '../services/authService';
import NexusData from '../services/competitionService';
import '../styles/pages/index.css';

const SHOWCASE_COMPS = [
  {
    id: 'world-championship-2026',
    img: '/assets/b890c61489a080992ad7e99adabb1145e6d59606.png',
    badge: 'Featured',
    bc: 'featured',
    game: 'Counter-Strike 2',
    title: 'World Championship 2026',
    prize: '₹10,00,000',
    teams: '32 Teams',
    date: 'Aug 15, 2026',
    status: 'Registration Open'
  },
  {
    id: 'spring-split-finals',
    img: '/assets/7b04655f1d50a8b1b25ad53f36d80ff99cb3184e.png',
    badge: 'Live',
    bc: 'live',
    game: 'League of Legends',
    title: 'Spring Split Finals',
    prize: '₹8,50,000',
    teams: '24 Teams',
    date: 'Jul 22, 2026',
    status: 'Ongoing'
  },
  {
    id: 'champions-league',
    img: '/assets/0e6f51d89fed056f96d58f2c51d79eb797ccdf75.png',
    badge: 'Hot',
    bc: 'hot',
    game: 'DOTA 2',
    title: 'Champions League',
    prize: '₹12,00,000',
    teams: '16 Teams',
    date: 'Sep 10, 2026',
    status: 'Registration Open'
  },
  {
    id: 'battle-royale-masters',
    img: '/assets/95bc0921c86340a2cee9e0a2d7ecd20b15a26143.png',
    badge: 'New',
    bc: 'featured',
    game: 'Fortnite',
    title: 'Battle Royale Masters',
    prize: '₹15,00,000',
    teams: '100 Players',
    date: 'Jun 30, 2026',
    status: 'Upcoming'
  },
  {
    id: 'pro-league-season-5',
    img: '/assets/fad13be991fc17a28771191ca710b201fb3ee4fb.png',
    badge: 'Featured',
    bc: 'featured',
    game: 'Overwatch 2',
    title: 'Pro League Season 5',
    prize: '₹6,00,000',
    teams: '20 Teams',
    date: 'Jul 05, 2026',
    status: 'Registration Open'
  },
  {
    id: 'rocket-championship',
    img: '/assets/61fe8554e6377c0b431ed18f65529b1847d225cb.png',
    badge: 'Trending',
    bc: 'live',
    game: 'Rocket League',
    title: 'Rocket Championship',
    prize: '₹5,00,000',
    teams: '16 Teams',
    date: 'Aug 20, 2026',
    status: 'Registration Open'
  }
];

export default function LandingPage() {
  const navigate = useNavigate();
  const [session, setSession] = useState(null);

  useEffect(() => {
    // Seed showcase data if needed
    if (NexusData && typeof NexusData.seedShowcaseCompetitions === 'function') {
      NexusData.seedShowcaseCompetitions();
    }
    setSession(NexusAuth.getSession());
  }, []);

  const handleLogout = () => {
    NexusAuth.clearSession();
    setSession(null);
  };

  const goToComp = (compId) => {
    if (session) {
      navigate(`/comp-info?id=${encodeURIComponent(compId)}`);
    } else {
      navigate(`/login?redirect=${encodeURIComponent(`/comp-info?id=${compId}`)}`);
    }
  };

  const joinTeams = (e, compId) => {
    e.stopPropagation();
    if (session) {
      navigate(`/join-teams?id=${encodeURIComponent(compId)}`);
    } else {
      navigate(`/login?redirect=${encodeURIComponent(`/join-teams?id=${compId}`)}`);
    }
  };

  const joinDest = session ? '/competitions' : '/signup';

  return (
    <>
      <WarningModal />
      <CoOrganizerToast />
      <Toast />

      {/* Sidebar Mount */}
      <Sidebar variant="player" activePage="home" />

      <main>
        {/* HERO */}
        <section className="hero-fullscreen">
          <div className="hero-bg-img" aria-hidden="true">
            <img src="/assets/4995f7274a78937e5ef38bb311e6144c2012ab5f.png" alt="" />
          </div>
          <div className="hero-topbar">
            <Link to="/" className="hero-brand">
              <img src="/assets/f03e2b11537e425d8544ee3ca732bf73af5137c0.png" alt="Nexus Logo" />
              <div className="hero-brand-text">
                <span className="brand">NEXUS</span>
                <span className="sub">ESPORTS</span>
              </div>
            </Link>
            <div className="hero-topbar-actions">
              {session ? (
                <button className="btn-top" onClick={handleLogout}>
                  Logout
                </button>
              ) : (
                <>
                  <Link to="/login" className="btn-top">
                    Login
                  </Link>
                  <Link to="/signup" className="btn-top">
                    SignUp
                  </Link>
                </>
              )}
            </div>
          </div>
          <div className="hero-center">
            <div className="hero-badge">
              <div className="hero-badge-dot"></div>
              <span>Esports League Management</span>
            </div>
            <h1 className="hero-title-orbitron">
              <span className="l1">WELCOME TO</span>
              <span className="l2">NEXUS</span>
            </h1>
            <p className="hero-tagline">
              Enter the ultimate battleground. Compete, conquer, and claim your destiny in the
              world's most elite esports tournaments.
            </p>
            <div className="hero-cta-group">
              <Link to={joinDest} className="btn-cta-join" id="hero-join-btn">
                Join Now
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 20 20"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.67"
                  strokeLinecap="round"
                >
                  <line x1="2" y1="10" x2="15" y2="10" />
                  <polyline points="10,4 16,10 10,16" />
                </svg>
              </Link>
              <Link to="/watch-live" className="btn-cta-watch">
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 20 20"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.67"
                  strokeLinecap="round"
                >
                  <polygon points="5,3 18,10 5,17" />
                </svg>
                Watch Live
              </Link>
            </div>
          </div>
        </section>

        {/* STATS BAR */}
        <section className="stats-bar">
          <div className="stats-grid">
            <div className="stat-box">
              <div className="stat-box-icon">
                <svg viewBox="0 0 24 24">
                  <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                  <circle cx="9" cy="7" r="4" />
                  <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                  <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                </svg>
              </div>
              <div className="stat-box-num">500+</div>
              <div className="stat-box-label">Active Players</div>
            </div>
            <div className="stat-box">
              <div className="stat-box-icon">
                <svg viewBox="0 0 24 24">
                  <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6m12 5h1.5a2.5 2.5 0 0 0 0-5H18m-6-2v2m0 14v-2" />
                  <path d="M5 9v6a7 7 0 0 0 14 0V9" />
                </svg>
              </div>
              <div className="stat-box-num">2.5k</div>
              <div className="stat-box-label">Tournaments</div>
            </div>
            <div className="stat-box">
              <div className="stat-box-icon">
                <svg viewBox="0 0 24 24">
                  <line x1="12" y1="1" x2="12" y2="23" />
                  <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
                </svg>
              </div>
              <div className="stat-box-num">₹10 Lakh+</div>
              <div className="stat-box-label">Prize Pool</div>
            </div>
            <div className="stat-box">
              <div className="stat-box-icon">
                <svg viewBox="0 0 24 24">
                  <circle cx="12" cy="12" r="10" />
                  <polyline points="12,6 12,12 16,14" />
                </svg>
              </div>
              <div className="stat-box-num">24/7</div>
              <div className="stat-box-label">Support</div>
            </div>
          </div>
        </section>

        {/* TOP COMPETITIONS */}
        <section className="home-section" style={{ background: '#0b0b0b' }}>
          <div className="section-header">
            <div className="section-title-group">
              <div className="section-accent-bar"></div>
              <h2 className="section-title">TOP Competitions</h2>
            </div>
            <Link to="/competitions" className="view-all-btn">
              View All
            </Link>
          </div>
          <div className="comps-home-grid" id="home-comps-grid">
            {SHOWCASE_COMPS.map((c) => (
              <div
                key={c.id}
                className="comp-card"
                onClick={() => goToComp(c.id)}
                style={{ cursor: 'pointer' }}
              >
                <div className="comp-card-img">
                  <img src={c.img} alt={c.title} />
                  <span className={`comp-badge ${c.bc}`}>{c.badge}</span>
                </div>
                <div className="comp-card-body">
                  <div className="comp-game-label">{c.game}</div>
                  <h3 className="comp-title">{c.title}</h3>
                  <div className="comp-meta">
                    <div className="comp-meta-item">
                      <svg
                        viewBox="0 0 16 16"
                        fill="none"
                        stroke="#C6FF33"
                        strokeWidth="1.33"
                        strokeLinecap="round"
                      >
                        <line x1="8" y1="1" x2="8" y2="15" />
                        <path d="M11 4H6.5a2.5 2.5 0 0 0 0 5H9a2.5 2.5 0 0 1 0 5H4" />
                      </svg>
                      {c.prize}
                    </div>
                    <div className="comp-meta-item">
                      <svg
                        viewBox="0 0 16 16"
                        fill="none"
                        stroke="#C6FF33"
                        strokeWidth="1.33"
                        strokeLinecap="round"
                      >
                        <path d="M11 3H5l-2 5h14l-2-5z" />
                        <path d="M2 8v5h12V8" />
                      </svg>
                      {c.teams}
                    </div>
                    <div className="comp-meta-item">
                      <svg
                        viewBox="0 0 16 16"
                        fill="none"
                        stroke="#C6FF33"
                        strokeWidth="1.33"
                        strokeLinecap="round"
                      >
                        <rect x="1" y="2" width="14" height="13" rx="2" />
                        <line x1="1" y1="7" x2="15" y2="7" />
                      </svg>
                      {c.date}
                    </div>
                  </div>
                  <div className="comp-card-footer">
                    <span className="comp-status">{c.status}</span>
                    <button
                      className="btn-primary"
                      onClick={(e) => joinTeams(e, c.id)}
                    >
                      Join Teams
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* LIVE NOW */}
        <section className="home-section dark">
          <div className="section-header">
            <div className="section-title-group">
              <div className="section-accent-bar"></div>
              <h2 className="section-title">LIVE NOW</h2>
            </div>
            <Link to="/watch-live" className="view-all-btn">
              View All
            </Link>
          </div>
          <div className="live-grid">
            <div
              className="live-card"
              onClick={() => navigate('/watch-live')}
              style={{ cursor: 'pointer' }}
            >
              <div className="live-thumb">
                <img src="/assets/b890c61489a080992ad7e99adabb1145e6d59606.png" alt="" />
                <div className="live-pill">
                  <div className="dot"></div>Live
                </div>
                <div className="view-pill">👁 45.2K</div>
              </div>
              <div className="live-info">
                <div className="live-avatar">P</div>
                <div className="live-meta">
                  <h3>Grand Finals</h3>
                  <div className="streamer">ProGamer</div>
                  <div className="game">Counter-Strike 2</div>
                </div>
              </div>
            </div>

            <div
              className="live-card"
              onClick={() => navigate('/watch-live')}
              style={{ cursor: 'pointer' }}
            >
              <div className="live-thumb">
                <img src="/assets/7b04655f1d50a8b1b25ad53f36d80ff99cb3184e.png" alt="" />
                <div className="live-pill">
                  <div className="dot"></div>Live
                </div>
                <div className="view-pill">👁 32.8K</div>
              </div>
              <div className="live-info">
                <div className="live-avatar">E</div>
                <div className="live-meta">
                  <h3>Semi Finals Match</h3>
                  <div className="streamer">EliteGamer</div>
                  <div className="game">League of Legends</div>
                </div>
              </div>
            </div>

            <div
              className="live-card"
              onClick={() => navigate('/watch-live')}
              style={{ cursor: 'pointer' }}
            >
              <div className="live-thumb">
                <img src="/assets/0e6f51d89fed056f96d58f2c51d79eb797ccdf75.png" alt="" />
                <div className="live-pill">
                  <div className="dot"></div>Live
                </div>
                <div className="view-pill">👁 18.4K</div>
              </div>
              <div className="live-info">
                <div className="live-avatar">D</div>
                <div className="live-meta">
                  <h3>Champions League QF</h3>
                  <div className="streamer">DotaPro</div>
                  <div className="game">Dota 2</div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* BROWSE GAMES */}
        <section className="home-section darker">
          <div className="section-header">
            <div className="section-title-group">
              <div className="section-accent-bar"></div>
              <h2 className="section-title" style={{ fontSize: 36 }}>
                Browse Games
              </h2>
            </div>
            <Link to="/competitions" className="view-all-btn">
              View All
            </Link>
          </div>
          <div className="games-grid" style={{ marginTop: 24 }}>
            <div
              className="game-card"
              onClick={() => navigate('/competitions')}
              style={{ cursor: 'pointer' }}
            >
              <div className="game-card-badge">32 Tournaments</div>
              <h3>Counter-Strike 2</h3>
              <p className="tournaments">Active competitions worldwide</p>
              <div className="explore-btn">Explore →</div>
            </div>
            <div
              className="game-card"
              onClick={() => navigate('/competitions')}
              style={{ cursor: 'pointer' }}
            >
              <div className="game-card-badge">24 Tournaments</div>
              <h3>League of Legends</h3>
              <p className="tournaments">Active competitions worldwide</p>
              <div className="explore-btn">Explore →</div>
            </div>
            <div
              className="game-card"
              onClick={() => navigate('/competitions')}
              style={{ cursor: 'pointer' }}
            >
              <div className="game-card-badge">18 Tournaments</div>
              <h3>Dota 2</h3>
              <p className="tournaments">Active competitions worldwide</p>
              <div className="explore-btn">Explore →</div>
            </div>
            <div
              className="game-card"
              onClick={() => navigate('/competitions')}
              style={{ cursor: 'pointer' }}
            >
              <div className="game-card-badge">41 Tournaments</div>
              <h3>Fortnite</h3>
              <p className="tournaments">Active competitions worldwide</p>
              <div className="explore-btn">Explore →</div>
            </div>
            <div
              className="game-card"
              onClick={() => navigate('/competitions')}
              style={{ cursor: 'pointer' }}
            >
              <div className="game-card-badge">27 Tournaments</div>
              <h3>Valorant</h3>
              <p className="tournaments">Active competitions worldwide</p>
              <div className="explore-btn">Explore →</div>
            </div>
            <div
              className="game-card"
              onClick={() => navigate('/competitions')}
              style={{ cursor: 'pointer' }}
            >
              <div className="game-card-badge">15 Tournaments</div>
              <h3>Rocket League</h3>
              <p className="tournaments">Active competitions worldwide</p>
              <div className="explore-btn">Explore →</div>
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="cta-home">
          <div>
            <h2>
              Ready to <span>Compete?</span>
            </h2>
            <p>
              Register for tournaments and show the world what you're made of. The arena awaits.
            </p>
            <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginTop: 28 }}>
              <Link to={joinDest} className="btn-hero-primary" id="cta-join-btn">
                Join Now — It's Free
              </Link>
            </div>
          </div>
        </section>

        {/* Footer */}
        <div className="footer-offset">
          <Footer />
        </div>
      </main>
    </>
  );
}
