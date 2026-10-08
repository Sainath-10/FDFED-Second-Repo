/**
 * NEXUS ESPORTS — View Team
 *
 *
 * profile link and the "View Profile" toasts.
 */
import { useNavigate } from 'react-router-dom';
import { showToast } from '../lib/toast.js';
import { assetUrl } from '../lib/assets.js';
import '../styles/pages/view-team.css';

const PLAYERS = [
  { name: 'AryanX99', role: 'Captain · IGL', stats: 'Diamond I', avatar: '88bb61dd411e2e781af6284e0036a9672ba8ef32.png', linkProfile: true },
  { name: 'ninja_byte', role: 'AWPer', stats: 'Platinum II', placeholder: 'N' },
  { name: 'xXProSlayer', role: 'Entry Fragger', stats: 'Gold I', placeholder: 'X' },
  { name: 'SniperGod99', role: 'Support', stats: 'Platinum I', placeholder: 'S' },
];

const MATCHES = [
  { event: 'World Championship 2026 · QF', date: 'Jul 12, 2026', result: 'WIN 16–9', win: true },
  { event: 'World Championship 2026 · R16', date: 'Jul 10, 2026', result: 'WIN 16–11', win: true },
  { event: 'Regional Cup · SF', date: 'Jun 20, 2026', result: 'LOSS 9–16', win: false },
];

export default function ViewTeam() {
  const navigate = useNavigate();

  return (
    <main className="main-content">
      <a href="/pages/competitions-participated.html" className="back-btn-alt" onClick={(e) => { e.preventDefault(); navigate('/pages/competitions-participated.html'); }}>
        ← Back to Competition
      </a>

      <div className="team-header-row">
        <div className="team-logo-lg">⚡</div>
        <div>
          <h1 className="team-title-lg">Storm Riders</h1>
          <p className="team-subtitle-lg">Counter-Strike 2 · South Asia · Captain: AryanX99</p>
          <div className="team-meta-row">
            <span className="status-pill ongoing">Active</span>
            <span className="player-count-badge">4 / 5 Players</span>
          </div>
        </div>
      </div>

      <div className="layout-wrapper">
        <div>
          <div className="roster-card">
            <h2 className="card-title-sm">Roster</h2>
            <div className="roster-grid">
              {PLAYERS.map((p) => (
                <div className="player-card" key={p.name}>
                  {p.avatar ? (
                    <img
                      className="player-avatar"
                      src={assetUrl(p.avatar)}
                      alt=""
                      onError={(e) => { e.currentTarget.style.background = '#222'; e.currentTarget.removeAttribute('src'); }}
                    />
                  ) : (
                    <div className="player-avatar-placeholder">{p.placeholder}</div>
                  )}
                  <div className="p-name">{p.name}</div>
                  <div className="p-role">{p.role}</div>
                  <div className="p-stats">{p.stats}</div>
                  <div className="btn-profile-wrapper">
                    <button
                      className="btn-table-secondary btn-profile-mini"
                      onClick={() => (p.linkProfile ? navigate('/pages/profile.html') : showToast('Viewing profile...'))}
                    >
                      View Profile
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="match-card">
            <h2 className="card-title-sm">Recent Matches</h2>
            <div className="match-history">
              {MATCHES.map((m) => (
                <div className="match-item" key={m.event}>
                  <div>
                    <div className="game">CS2</div>
                    <div className="event">{m.event}</div>
                    <div className="date match-date-alt">{m.date}</div>
                  </div>
                  <div className={m.win ? 'result-win' : 'result-loss'}>{m.result}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="sidebar-stack">
          <div className="comp-sidebar-block">
            <h3>Team Stats</h3>
            <div className="info-row"><span className="key">Win Rate</span><span className="val stat-val-accent">66.7%</span></div>
            <div className="info-row"><span className="key">Matches</span><span className="val">48</span></div>
            <div className="info-row"><span className="key">Wins</span><span className="val">32</span></div>
            <div className="info-row"><span className="key">Trophies</span><span className="val">2</span></div>
          </div>
          <button className="btn-primary manage-team-btn" onClick={() => navigate('/pages/team/team-roster.html')}>
            Manage My Team
          </button>
        </div>
      </div>
    </main>
  );
}


