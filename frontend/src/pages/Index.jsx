/**
 * NEXUS ESPORTS — Landing / Home
 *
 * hero, stats bar, top competitions
 * (from the COMPS list), live-now, browse-games and the closing CTA.
 *
 * Preserved behaviours:
 * - seeds the showcase competitions into the data store on load
 * (via the shared NexusData.seedShowcaseCompetitions — same ids/data as the
 * inline copy the page used);
 * - auth-aware buttons: when signed in the hero Login/SignUp are hidden and
 * "Join Now" points at Competitions, otherwise at Sign Up;
 * - guest competition clicks route to login with a ?redirect= back-link.
 */
import { useCallback, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import NexusData from '../services/data.js';
import { assetUrl } from '../lib/assets.js';
import '../styles/pages/index.css';

const STATS = [
  { icon: (<><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></>), num: '500+', label: 'Active Players' },
  { icon: (<><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6m12 5h1.5a2.5 2.5 0 0 0 0-5H18m-6-2v2m0 14v-2" /><path d="M5 9v6a7 7 0 0 0 14 0V9" /></>), num: '2.5k', label: 'Tournaments' },
  { icon: (<><line x1="12" y1="1" x2="12" y2="23" /><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" /></>), num: '₹10 Lakh+', label: 'Prize Pool' },
  { icon: (<><circle cx="12" cy="12" r="10" /><polyline points="12,6 12,12 16,14" /></>), num: '24/7', label: 'Support' },
];

const LIVE = [
  { img: 'b890c61489a080992ad7e99adabb1145e6d59606.png', views: '45.2K', avatar: 'P', title: 'Grand Finals', streamer: 'ProGamer', game: 'Counter-Strike 2' },
  { img: '7b04655f1d50a8b1b25ad53f36d80ff99cb3184e.png', views: '32.8K', avatar: 'E', title: 'Semi Finals Match', streamer: 'EliteGamer', game: 'League of Legends' },
  { img: '0e6f51d89fed056f96d58f2c51d79eb797ccdf75.png', views: '18.4K', avatar: 'D', title: 'Champions League QF', streamer: 'DotaPro', game: 'Dota 2' },
];

const GAMES = [
  { badge: '32 Tournaments', title: 'Counter-Strike 2' },
  { badge: '24 Tournaments', title: 'League of Legends' },
  { badge: '18 Tournaments', title: 'Dota 2' },
  { badge: '41 Tournaments', title: 'Fortnite' },
  { badge: '27 Tournaments', title: 'Valorant' },
  { badge: '15 Tournaments', title: 'Rocket League' },
];

const COMPS = [
  { id: 'world-championship-2026', img: 'b890c61489a080992ad7e99adabb1145e6d59606.png', badge: 'Featured', bc: 'featured', game: 'Counter-Strike 2', title: 'World Championship 2026', prize: '₹10,00,000', teams: '32 Teams', date: 'Aug 15, 2026', status: 'Registration Open' },
  { id: 'spring-split-finals', img: '7b04655f1d50a8b1b25ad53f36d80ff99cb3184e.png', badge: 'Live', bc: 'live', game: 'League of Legends', title: 'Spring Split Finals', prize: '₹8,50,000', teams: '24 Teams', date: 'Jul 22, 2026', status: 'Ongoing' },
  { id: 'champions-league', img: '0e6f51d89fed056f96d58f2c51d79eb797ccdf75.png', badge: 'Hot', bc: 'hot', game: 'DOTA 2', title: 'Champions League', prize: '₹12,00,000', teams: '16 Teams', date: 'Sep 10, 2026', status: 'Registration Open' },
  { id: 'battle-royale-masters', img: '95bc0921c86340a2cee9e0a2d7ecd20b15a26143.png', badge: 'New', bc: 'featured', game: 'Fortnite', title: 'Battle Royale Masters', prize: '₹15,00,000', teams: '100 Players', date: 'Jun 30, 2026', status: 'Upcoming' },
  { id: 'pro-league-season-5', img: 'fad13be991fc17a28771191ca710b201fb3ee4fb.png', badge: 'Featured', bc: 'featured', game: 'Overwatch 2', title: 'Pro League Season 5', prize: '₹6,00,000', teams: '20 Teams', date: 'Jul 05, 2026', status: 'Registration Open' },
  { id: 'rocket-championship', img: '61fe8554e6377c0b431ed18f65529b1847d225cb.png', badge: 'Trending', bc: 'live', game: 'Rocket League', title: 'Rocket Championship', prize: '₹5,00,000', teams: '16 Teams', date: 'Aug 20, 2026', status: 'Registration Open' },
];

export default function Index() {
  const { session } = useAuth();
  const navigate = useNavigate();

 // Seed the showcase competitions (same ids/data the page seeded inline).
  useEffect(() => {
    if (NexusData && typeof NexusData.seedShowcaseCompetitions === 'function') {
      NexusData.seedShowcaseCompetitions();
    }
  }, []);

  const joinDest = session ? '/pages/competitions.html' : '/pages/signup.html';

  const goToComp = useCallback((compId) => {
    if (session) {
      navigate(`/pages/comp-info.html?id=${encodeURIComponent(compId)}`);
    } else {
      navigate(`/pages/login.html?redirect=${encodeURIComponent(`pages/comp-info.html?id=${compId}`)}`);
    }
  }, [navigate, session]);

  const joinTeams = useCallback((event, compId) => {
    event.stopPropagation();
    if (session) {
      navigate(`/pages/join-teams.html?id=${encodeURIComponent(compId)}`);
    } else {
      navigate(`/pages/login.html?redirect=${encodeURIComponent(`pages/join-teams.html?id=${compId}`)}`);
    }
  }, [navigate, session]);

  return (
    <main>
      <section className="hero-fullscreen">
        <div className="hero-bg-img" aria-hidden="true">
          <img src={assetUrl('4995f7274a78937e5ef38bb311e6144c2012ab5f.png')} alt="" />
        </div>
        <div className="hero-topbar">
          <Link to="/" className="hero-brand">
            <img src={assetUrl('f03e2b11537e425d8544ee3ca732bf73af5137c0.png')} alt="Nexus Logo" />
            <div className="hero-brand-text"><span className="brand">NEXUS</span><span className="sub">ESPORTS</span></div>
          </Link>
          <div className="hero-topbar-actions" style={{ display: session ? 'none' : 'flex' }}>
            <Link to="/pages/login.html" className="btn-top">Login</Link>
            <Link to="/pages/signup.html" className="btn-top">SignUp</Link>
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
            Enter the ultimate battleground. Compete, conquer, and claim your destiny in the world's most elite
            esports tournaments.
          </p>
          <div className="hero-cta-group">
            <Link to={joinDest} className="btn-cta-join" id="hero-join-btn">
              Join Now
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.67" strokeLinecap="round">
                <line x1="2" y1="10" x2="15" y2="10" />
                <polyline points="10,4 16,10 10,16" />
              </svg>
            </Link>
            <Link to="/pages/watch-live.html" className="btn-cta-watch">
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.67" strokeLinecap="round">
                <polygon points="5,3 18,10 5,17" />
              </svg>
              Watch Live
            </Link>
          </div>
        </div>
      </section>

      <section className="stats-bar">
        <div className="stats-grid">
          {STATS.map((s) => (
            <div className="stat-box" key={s.label}>
              <div className="stat-box-icon"><svg viewBox="0 0 24 24">{s.icon}</svg></div>
              <div className="stat-box-num">{s.num}</div>
              <div className="stat-box-label">{s.label}</div>
            </div>
          ))}
        </div>
      </section>

      <section className="home-section" style={{ background: '#0b0b0b' }}>
        <div className="section-header">
          <div className="section-title-group">
            <div className="section-accent-bar"></div>
            <h2 className="section-title">TOP Competitions</h2>
          </div>
          <Link to="/pages/competitions.html" className="view-all-btn">View All</Link>
        </div>
        <div className="comps-home-grid" id="home-comps-grid">
          {COMPS.map((c) => (
            <div className="comp-card" key={c.id} style={{ cursor: 'pointer' }} onClick={() => goToComp(c.id)}>
              <div className="comp-card-img">
                <img src={assetUrl(c.img)} alt={c.title} />
                <span className={`comp-badge ${c.bc}`}>{c.badge}</span>
              </div>
              <div className="comp-card-body">
                <div className="comp-game-label">{c.game}</div>
                <h3 className="comp-title">{c.title}</h3>
                <div className="comp-meta">
                  <div className="comp-meta-item">
                    <svg viewBox="0 0 16 16" fill="none" stroke="#C6FF33" strokeWidth="1.33" strokeLinecap="round"><line x1="8" y1="1" x2="8" y2="15" /><path d="M11 4H6.5a2.5 2.5 0 0 0 0 5H9a2.5 2.5 0 0 1 0 5H4" /></svg>
                    {c.prize}
                  </div>
                  <div className="comp-meta-item">
                    <svg viewBox="0 0 16 16" fill="none" stroke="#C6FF33" strokeWidth="1.33" strokeLinecap="round"><path d="M11 3H5l-2 5h14l-2-5z" /><path d="M2 8v5h12V8" /></svg>
                    {c.teams}
                  </div>
                  <div className="comp-meta-item">
                    <svg viewBox="0 0 16 16" fill="none" stroke="#C6FF33" strokeWidth="1.33" strokeLinecap="round"><rect x="1" y="2" width="14" height="13" rx="2" /><line x1="1" y1="7" x2="15" y2="7" /></svg>
                    {c.date}
                  </div>
                </div>
                <div className="comp-card-footer">
                  <span className="comp-status">{c.status}</span>
                  <button className="btn-primary" onClick={(e) => joinTeams(e, c.id)}>Join Teams</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="home-section dark">
        <div className="section-header">
          <div className="section-title-group">
            <div className="section-accent-bar"></div>
            <h2 className="section-title">LIVE NOW</h2>
          </div>
          <Link to="/pages/watch-live.html" className="view-all-btn">View All</Link>
        </div>
        <div className="live-grid">
          {LIVE.map((l) => (
            <div className="live-card" key={l.title} onClick={() => navigate('/pages/watch-live.html')}>
              <div className="live-thumb">
                <img src={assetUrl(l.img)} alt="" />
                <div className="live-pill"><div className="dot"></div>Live</div>
                <div className="view-pill">👁 {l.views}</div>
              </div>
              <div className="live-info">
                <div className="live-avatar">{l.avatar}</div>
                <div className="live-meta">
                  <h3>{l.title}</h3>
                  <div className="streamer">{l.streamer}</div>
                  <div className="game">{l.game}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="home-section darker">
        <div className="section-header">
          <div className="section-title-group">
            <div className="section-accent-bar"></div>
            <h2 className="section-title" style={{ fontSize: 36 }}>Browse Games</h2>
          </div>
          <Link to="/pages/competitions.html" className="view-all-btn">View All</Link>
        </div>
        <div className="games-grid" style={{ marginTop: 24 }}>
          {GAMES.map((g) => (
            <div className="game-card" key={g.title} onClick={() => navigate('/pages/competitions.html')}>
              <div className="game-card-badge">{g.badge}</div>
              <h3>{g.title}</h3>
              <p className="tournaments">Active competitions worldwide</p>
              <div className="explore-btn">Explore →</div>
            </div>
          ))}
        </div>
      </section>

      <section className="cta-home">
        <div>
          <h2>Ready to <span>Compete?</span></h2>
          <p>Register for tournaments and show the world what you're made of. The arena awaits.</p>
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginTop: 28 }}>
            <Link to={joinDest} className="btn-hero-primary" id="cta-join-btn">Join Now — It's Free</Link>
          </div>
        </div>
      </section>
    </main>
  );
}


