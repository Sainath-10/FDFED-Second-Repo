import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Shell from '../components/Layout/Shell';
import { useToast } from '../components/Common/Toast';
import '../styles/pages/view-team.css';

export default function ViewTeamPage() {
  const navigate = useNavigate();
  const { showToast } = useToast();

  const roster = [
    {
      name: 'AryanX99',
      role: 'Captain · IGL',
      rank: 'Diamond I',
      avatar: '/assets/88bb61dd411e2e781af6284e0036a9672ba8ef32.png',
      isMe: true
    },
    {
      name: 'ninja_byte',
      role: 'AWPer',
      rank: 'Platinum II',
      placeholder: 'N'
    },
    {
      name: 'xXProSlayer',
      role: 'Entry Fragger',
      rank: 'Gold I',
      placeholder: 'X'
    },
    {
      name: 'SniperGod99',
      role: 'Support',
      rank: 'Platinum I',
      placeholder: 'S'
    }
  ];

  const matches = [
    {
      game: 'CS2',
      event: 'World Championship 2026 · QF',
      date: 'Jul 12, 2026',
      result: 'WIN 16–9',
      isWin: true
    },
    {
      game: 'CS2',
      event: 'World Championship 2026 · R16',
      date: 'Jul 10, 2026',
      result: 'WIN 16–11',
      isWin: true
    },
    {
      game: 'CS2',
      event: 'Regional Cup · SF',
      date: 'Jun 20, 2026',
      result: 'LOSS 9–16',
      isWin: false
    }
  ];

  return (
    <Shell activeTab="activity">
      <main className="main-content">
          <Link to="/competitions-participated" className="back-btn-alt">
            ← Back to Competition
          </Link>

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
              {/* Roster */}
              <div className="roster-card">
                <h2 className="card-title-sm">Roster</h2>
                <div className="roster-grid">
                  {roster.map((player, idx) => (
                    <div className="player-card" key={idx}>
                      {player.avatar ? (
                        <img
                          className="player-avatar"
                          src={player.avatar}
                          alt=""
                          onError={(e) => {
                            e.target.style.background = '#222';
                            e.target.removeAttribute('src');
                          }}
                        />
                      ) : (
                        <div className="player-avatar-placeholder">{player.placeholder}</div>
                      )}
                      <div className="p-name">{player.name}</div>
                      <div className="p-role">{player.role}</div>
                      <div className="p-stats">{player.rank}</div>
                      <div className="btn-profile-wrapper">
                        {player.isMe ? (
                          <Link to="/profile" className="btn-table-secondary btn-profile-mini">
                            View Profile
                          </Link>
                        ) : (
                          <button
                            type="button"
                            className="btn-table-secondary btn-profile-mini"
                            onClick={() => showToast('Viewing profile...')}
                          >
                            View Profile
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Match history */}
              <div className="match-card">
                <h2 className="card-title-sm">Recent Matches</h2>
                <div className="match-history">
                  {matches.map((m, idx) => (
                    <div className="match-item" key={idx}>
                      <div>
                        <div className="game">{m.game}</div>
                        <div className="event">{m.event}</div>
                        <div className="date match-date-alt">{m.date}</div>
                      </div>
                      <div className={m.isWin ? 'result-win' : 'result-loss'}>{m.result}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="sidebar-stack">
              <div className="comp-sidebar-block">
                <h3>Team Stats</h3>
                <div className="info-row">
                  <span className="key">Win Rate</span>
                  <span className="val stat-val-accent">66.7%</span>
                </div>
                <div className="info-row">
                  <span className="key">Matches</span>
                  <span className="val">48</span>
                </div>
                <div className="info-row">
                  <span className="key">Wins</span>
                  <span className="val">32</span>
                </div>
                <div className="info-row">
                  <span className="key">Trophies</span>
                  <span className="val">2</span>
                </div>
              </div>
              <Link to="/team/team-roster" className="btn-primary manage-team-btn">
                Manage My Team
              </Link>
            </div>
          </div>
        </main>
    </Shell>
  );
}
