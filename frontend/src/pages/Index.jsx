/**
 * NEXUS ESPORTS — Home
 *
 * Landing page with real figures and competitions from the public API:
 * platform totals, open competitions, competitions in progress and games.
 */
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import CompCard from '../components/CompCard.jsx';
import { EmptyState, formatINR } from '../components/ui.jsx';
import { hasStarted, isClosedCompetition, isDraft, useCompetitions } from '../services/competitions.js';
import { assetUrl, competitionBanner } from '../lib/assets.js';
import '../styles/pages/index.css';

const ICONS = {
  players: (<><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></>),
  trophy: (<><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6m12 5h1.5a2.5 2.5 0 0 0 0-5H18m-6-2v2m0 14v-2" /><path d="M5 9v6a7 7 0 0 0 14 0V9" /></>),
  money: (<><line x1="12" y1="1" x2="12" y2="23" /><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" /></>),
  teams: (<><circle cx="12" cy="12" r="10" /><polyline points="12,6 12,12 16,14" /></>),
};

export default function Index() {
  const { session } = useAuth();
  const navigate = useNavigate();
  const { data, loading } = useCompetitions({ withTeams: true });
  const joinDest = session ? '/pages/competitions.html' : '/pages/signup.html';

  const published = data.filter((c) => !isDraft(c));
  const browsable = published.filter((c) => !isClosedCompetition(c));
  const live = browsable.filter((c) => hasStarted(c));
  const featured = [...browsable].sort((a, b) => Number(b.registration.open) - Number(a.registration.open) || b.prize - a.prize).slice(0, 6);
  const players = new Set(published.flatMap((c) => c.activeTeams.flatMap((t) => t.members.map((m) => m.username.toLowerCase()))));
  const totalPrize = published.reduce((sum, c) => sum + c.prize, 0);
  const stats = [
    { icon: ICONS.players, num: players.size.toLocaleString('en-IN'), label: 'Players in teams' },
    { icon: ICONS.trophy, num: published.length.toLocaleString('en-IN'), label: 'Competitions' },
    { icon: ICONS.money, num: formatINR(totalPrize), label: 'Total prize pools' },
    { icon: ICONS.teams, num: published.reduce((n, c) => n + c.activeTeams.length, 0).toLocaleString('en-IN'), label: 'Registered teams' },
  ];
  const games = Object.entries(browsable.reduce((acc, c) => ({ ...acc, [c.game]: (acc[c.game] || 0) + 1 }), {}))
    .sort((a, b) => b[1] - a[1]);

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
              Live now
            </Link>
          </div>
        </div>
      </section>

      <section className="stats-bar">
        <div className="stats-grid">
          {stats.map((s) => (
            <div className="stat-box" key={s.label}>
              <div className="stat-box-icon"><svg viewBox="0 0 24 24">{s.icon}</svg></div>
              <div className="stat-box-num">{loading ? '—' : s.num}</div>
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
          {featured.map((comp) => <CompCard key={comp.id} comp={comp} session={session} />)}
        </div>
        {!loading && featured.length === 0 && <EmptyState title="No open competitions yet" message="Create the first one." action={<Link className="btn-primary" to={session ? '/pages/create-competition.html' : '/pages/signup.html'}>Create a competition</Link>} />}
      </section>

      <section className="home-section dark">
        <div className="section-header">
          <div className="section-title-group">
            <div className="section-accent-bar"></div>
            <h2 className="section-title">IN PROGRESS</h2>
          </div>
          <Link to="/pages/watch-live.html" className="view-all-btn">View All</Link>
        </div>
        <div className="live-grid">
          {live.slice(0, 3).map((c) => (
            <div className="live-card" key={c.id} role="link" tabIndex={0} onClick={() => navigate(`/pages/comp-info.html?id=${encodeURIComponent(c.id)}&tab=bracket`)} onKeyDown={(e) => { if (e.key === 'Enter') navigate(`/pages/comp-info.html?id=${encodeURIComponent(c.id)}&tab=bracket`); }}>
              <div className="live-thumb">
                <img src={competitionBanner(c)} alt="" />
                <div className="live-pill"><div className="dot"></div>In progress</div>
                <div className="view-pill">{c.activeTeams.length} teams</div>
              </div>
              <div className="live-info">
                <div className="live-avatar">{String(c.game).charAt(0)}</div>
                <div className="live-meta">
                  <h3>{c.name}</h3>
                  <div className="streamer">by @{c.createdBy}</div>
                  <div className="game">{c.game}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
        {!loading && live.length === 0 && <EmptyState title="Nothing in progress right now" message="Competitions appear here once play starts." />}
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
          {games.map(([game, count]) => (
            <Link className="game-card" key={game} to={`/pages/competitions.html?q=${encodeURIComponent(game)}`}>
              <div className="game-card-badge">{count} competition{count === 1 ? '' : 's'}</div>
              <h3>{game}</h3>
              <p className="tournaments">Open and running competitions</p>
              <div className="explore-btn">Explore →</div>
            </Link>
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


