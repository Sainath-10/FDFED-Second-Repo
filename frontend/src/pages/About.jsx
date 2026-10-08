/**
 * NEXUS ESPORTS — About
 *
 * hero, purpose, key features,
 * scope + animated counters, overview, team, platform policies (from the
 * localStorage policy store, with the defaults) and the CTA.
 */
import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import '../styles/pages/about.css';

const DEFAULT_POLICIES = [
  {
    id: 'pol-fair-play',
    title: 'Fair Play & Anti-Cheat Policy',
    category: 'Security',
    version: 'v2.4',
    status: 'active',
    summary: 'Zero tolerance policy for hacking, exploits, third-party software, and unsportsmanlike behavior across all platform competitions.',
  },
  {
    id: 'pol-eligibility',
    title: 'Player & Team Eligibility Policy',
    category: 'Eligibility',
    version: 'v1.8',
    status: 'active',
    summary: 'Rules governing minimum age requirements, regional lock restrictions, roster change windows, and player account verification.',
  },
  {
    id: 'pol-dispute-escalation',
    title: 'Match Dispute & Escalation Policy',
    category: 'Disputes',
    version: 'v1.2',
    status: 'active',
    summary: 'Governs the process for filing, reviewing, and resolving match disputes and auto-escalations between teams and tournament organizers.',
  },
  {
    id: 'pol-financial',
    title: 'Financial & Prize Distribution Policy',
    category: 'Financial',
    version: 'v2.0',
    status: 'active',
    summary: 'Rules regarding prize pool payouts, tax documentation, withdrawal timelines, and declared captain prize split distribution.',
  },
];

const TEAM = [
  { initial: 'T', name: 'Tholkappian\nMurugesan' },
  { initial: 'D', name: 'Dharun Prasad' },
  { initial: 'S', name: 'Sainath' },
  { initial: 'H', name: 'Harshita Karnam' },
  { initial: 'A', name: 'Akhil' },
];

const FEATURES = [
  { title: 'Tournament Management', desc: 'Create and manage tournaments with ease, from setup to completion', icon: (<><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6m12 5h1.5a2.5 2.5 0 0 0 0-5H18" /><path d="M6 4v1m12-1v1M6 9v6a6 6 0 0 0 12 0V9" /><path d="M6 9h12" /></>) },
  { title: 'Team Registration', desc: 'Seamless team and player registration process for all participants', icon: (<><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></>) },
  { title: 'Match Scheduling', desc: 'Automated scheduling system to coordinate matches efficiently', icon: (<><rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></>) },
  { title: 'Score Tracking', desc: 'Real-time score updates and result recording for all matches', icon: (<><circle cx="12" cy="12" r="10" /><circle cx="12" cy="12" r="6" /><circle cx="12" cy="12" r="2" /></>) },
  { title: 'Fair Competition', desc: 'Ensuring transparency and fairness in all tournament operations', icon: (<><path d="M21 1L12.5 9.5 7.5 4.5 1 11" /><path d="M15 1H21V7" /></>) },
  { title: 'Leaderboards', desc: 'Dynamic standings and performance tracking for teams and players', icon: (<><path d="M21 1L12.5 9.5 7.5 4.5 1 11" /><path d="M15 1H21V7" /></>) },
];

const STATS = [
  { target: '4+', initial: '0', label: 'User Roles' },
  { target: '100%', initial: '0%', label: 'Web-Based' },
  { target: '24/7', initial: '—', label: 'Availability' },
  { target: 'Real-Time', initial: '—', label: 'Updates' },
];

function loadPolicies() {
  let policies = [];
  try {
    const raw = localStorage.getItem('nexus_policies') || localStorage.getItem('nexus.policies');
    if (raw) {
      try { policies = JSON.parse(raw); } catch (e) { /* ignore */ }
    }
  } catch (e) { /* ignore */ }

  if (!Array.isArray(policies) || policies.length === 0) {
    policies = DEFAULT_POLICIES;
    try { localStorage.setItem('nexus_policies', JSON.stringify(policies)); } catch (e) { /* ignore */ }
  }
  return policies;
}

function animateCounter(el) {
  const raw = el.dataset.target;
  const suffix = raw.replace(/[\d.]/g, '');
  const num = parseFloat(raw);
  if (Number.isNaN(num)) {
    el.textContent = raw;
    return;
  }
  const duration = 1200;
  const fps = 60;
  const steps = Math.round(duration / (1000 / fps));
  let frame = 0;
  const tick = () => {
    frame++;
    const progress = 1 - Math.pow(1 - frame / steps, 3);
    el.textContent = Math.round(num * progress) + suffix;
    if (frame < steps) requestAnimationFrame(tick);
    else el.textContent = raw;
  };
  requestAnimationFrame(tick);
}

export default function About() {
  const rootRef = useRef(null);
  const [policies] = useState(loadPolicies);
  const activePolicies = policies.filter((p) => !p.status || p.status === 'active');

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return undefined;

    const faders = root.querySelectorAll('.fade-in');
    const counters = root.querySelectorAll('.stat-num[data-target]');
    const fired = new WeakSet();

    if (!('IntersectionObserver' in window)) {
      faders.forEach((el) => el.classList.add('visible'));
      counters.forEach((el) => animateCounter(el));
      return undefined;
    }

    const fadeObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('visible');
            fadeObserver.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.12, rootMargin: '0px 0px -40px 0px' },
    );
    faders.forEach((el) => fadeObserver.observe(el));

    const counterObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && !fired.has(entry.target)) {
            fired.add(entry.target);
            animateCounter(entry.target);
            counterObserver.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.5 },
    );
    counters.forEach((el) => counterObserver.observe(el));

    return () => {
      fadeObserver.disconnect();
      counterObserver.disconnect();
    };
  }, []);

  const glow = (shadow) => ({
    onMouseEnter: (e) => { e.currentTarget.style.boxShadow = shadow; },
    onMouseLeave: (e) => { e.currentTarget.style.boxShadow = ''; },
  });

  return (
    <div ref={rootRef}>
      <section className="hero" id="hero">
        <div className="hero-inner">
          <div className="hero-icon" aria-hidden="true">
            <svg viewBox="0 0 48 48" fill="none" stroke="#0b0b0b" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 6h24l-4 18a12 12 0 0 1-16 0L12 6z" />
              <path d="M6 6h6m30 0h-6" />
              <path d="M6 10a9 9 0 0 0 5 8m36-8a9 9 0 0 1-5 8" />
              <path d="M24 38v4m-6 0h12" />
              <path d="M24 22v16" />
            </svg>
          </div>
          <h1 className="hero-title">Esports Tournament &amp; League Management System</h1>
          <p className="hero-subtitle">
            A centralized platform revolutionizing the way esports competitions are organized and managed
          </p>
        </div>
      </section>

      <section className="section-purpose" id="purpose">
        <div className="purpose-grid">
          <div className="fade-in">
            <h2 className="purpose-heading">Our Purpose</h2>
            <p className="purpose-text">
              The purpose of the Esports Tournament and League Management System is to provide a centralized and
              efficient platform for managing esports tournaments and leagues. The system aims to simplify the
              processes involved in organizing competitions, registering teams and players, scheduling matches,
              recording results, and maintaining leaderboards.
            </p>
            <p className="purpose-text">
              By automating manual and error-prone tasks, the system seeks to improve accuracy, transparency, and
              ease of management for organizers, while providing players and teams with timely information about
              tournaments, matches, and standings. The system also ensures fair competition management and enhances
              the overall esports event experience.
            </p>
          </div>

          <div className="features-card fade-in">
            <div className="feature-item">
              <div className="feature-icon" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none" stroke="#c6ff33" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" /><circle cx="12" cy="12" r="6" /><circle cx="12" cy="12" r="2" />
                </svg>
              </div>
              <div>
                <h3 className="feature-title">Efficiency</h3>
                <p className="feature-desc">Streamline tournament operations and reduce manual effort</p>
              </div>
            </div>
            <div className="feature-item">
              <div className="feature-icon" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none" stroke="#c6ff33" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" />
                </svg>
              </div>
              <div>
                <h3 className="feature-title">Transparency</h3>
                <p className="feature-desc">Ensure fair play and clear communication for all participants</p>
              </div>
            </div>
            <div className="feature-item">
              <div className="feature-icon" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none" stroke="#c6ff33" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
                </svg>
              </div>
              <div>
                <h3 className="feature-title">Experience</h3>
                <p className="feature-desc">Enhance the overall esports event experience for everyone</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="section-features" id="features">
        <div className="inner">
          <h2 className="section-title">Key Features</h2>
          <p className="section-subtitle">
            Comprehensive tools designed to manage every aspect of esports tournaments and leagues
          </p>
          <div className="features-grid">
            {FEATURES.map((f) => (
              <div className="feat-card fade-in" key={f.title} {...glow('0 4px 24px rgba(198,255,51,0.1)')}>
                <div className="feat-icon" aria-hidden="true">
                  <svg viewBox="0 0 24 24" fill="none" stroke="#c6ff33" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    {f.icon}
                  </svg>
                </div>
                <h3 className="feat-title">{f.title}</h3>
                <p className="feat-desc">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="section-scope" id="scope">
        <div className="inner">
          <h2 className="scope-heading fade-in">Scope</h2>
          <div className="scope-card fade-in">
            <div>
              <p className="scope-text">
                The Esports Tournament and League Management System is a web-based application designed to automate
                and streamline the organization and management of esports tournaments and leagues. The system enables
                organizers to create and manage tournaments, teams, schedules, and match results, while allowing
                players and teams to register, participate, and track their performance.
              </p>
              <br />
              <p className="scope-text">
                The system supports multiple user roles such as administrators, organizers, team managers, and
                players. Key features include user authentication, tournament creation, team registration, match
                scheduling, score updates, leaderboard generation, and result tracking. The scope of the system is
                limited to tournament and league management and does not include game development or in-game
                analytics.
              </p>
            </div>
            <div className="scope-stats">
              {STATS.map((s) => (
                <div className="stat-item" key={s.label}>
                  <div className="stat-num count-up" data-target={s.target}>{s.initial}</div>
                  <div className="stat-label">{s.label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="section-overview" id="overview">
        <div className="inner">
          <h2 className="overview-heading fade-in">Overview</h2>
          <div className="fade-in">
            <p className="overview-text">
              The Esports Tournament and League Management System is a web-based application designed to support the
              end-to-end management of esports competitions. The system provides tools for creating and managing
              tournaments and leagues, handling team and player registrations, scheduling matches, updating scores,
              and generating standings.
            </p>
            <p className="overview-text">
              The platform is intended to reduce manual effort and improve coordination between organizers, teams,
              and players. By offering a unified interface for all tournament-related activities, the system enhances
              operational efficiency and ensures consistent and reliable management of esports events.
            </p>
          </div>
        </div>
      </section>

      <section className="section-team" id="team">
        <div className="inner">
          <h2 className="team-heading fade-in">Our Team</h2>
          <p className="team-subheading fade-in">Meet the talented individuals who brought this platform to life</p>
          <div className="team-grid">
            {TEAM.map((member) => (
              <div className="team-card fade-in" key={member.name} {...glow('0 0 20px rgba(198,255,51,0.12)')}>
                <div className="team-avatar">{member.initial}</div>
                <h3 className="team-name">
                  {member.name.split('\n').map((line, i) => (
                    <span key={line}>{i > 0 && <br />}{line}</span>
                  ))}
                </h3>
                <p className="team-role">Developer</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="section-scope" id="policies">
        <div className="inner">
          <h2 className="scope-heading fade-in">Platform Policies</h2>
          <div id="about-policies-list" className="fade-in">
            {activePolicies.length === 0 ? (
              <div className="scope-card fade-in" style={{ color: 'var(--text-muted)', fontSize: 15 }}>
                No published policies yet. Platform policies set by administrators will appear here.
              </div>
            ) : (
              activePolicies.map((p) => (
                <div
                  key={p.id}
                  className="scope-card visible"
                  style={{
                    marginBottom: 16,
                    background: '#141414',
                    border: '1px solid #262626',
                    borderLeft: '3px solid #c6ff33',
                    borderRadius: 12,
                    padding: '22px 26px',
                    opacity: 1,
                    transform: 'none',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, flexWrap: 'wrap', gap: 8 }}>
                    <h3 style={{ fontSize: 17, fontWeight: 700, color: '#fff', margin: 0 }}>{p.title || 'Platform Policy'}</h3>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      {p.version && (
                        <span style={{ fontSize: 11, fontWeight: 700, background: 'rgba(255,255,255,0.08)', color: '#d4d4d4', padding: '3px 10px', borderRadius: 20 }}>{p.version}</span>
                      )}
                      {p.category && (
                        <span style={{ fontSize: 11, fontWeight: 700, background: 'rgba(198,255,51,0.15)', color: '#c6ff33', border: '1px solid rgba(198,255,51,0.3)', padding: '3px 10px', borderRadius: 20, textTransform: 'uppercase' }}>{p.category}</span>
                      )}
                    </div>
                  </div>
                  <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.75)', lineHeight: 1.6, margin: 0 }}>
                    {p.summary || p.content || p.description || ''}
                  </p>
                  {p.updatedAt && (
                    <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginTop: 10, marginBottom: 0 }}>
                      Last updated: {new Date(p.updatedAt).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </p>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      </section>

      <section className="section-cta" id="cta">
        <div className="inner">
          <h2 className="cta-heading fade-in">Ready to Get Started?</h2>
          <p className="cta-sub fade-in">
            Join thousands of organizers and players using our platform to manage competitive esports events
          </p>
          <Link to="/pages/competitions.html" className="cta-btn fade-in" id="cta-btn">
            <svg viewBox="0 0 20 20" fill="none" stroke="#0b0b0b" strokeWidth="1.67" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4.5 2h11l-1.5 7a5 5 0 0 1-8 0L4.5 2z" />
              <path d="M2.5 2h2m13 0h2" />
              <path d="M2.5 4a4 4 0 0 0 2 3.5m13-3.5a4 4 0 0 1-2 3.5" />
              <path d="M10 16v2m-3 0h6" />
            </svg>
            Start Managing Tournaments
          </Link>
        </div>
      </section>
    </div>
  );
}


