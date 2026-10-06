import React from 'react';
import Shell from '../components/Layout/Shell';
import { useToast } from '../components/Common/Toast';
import '../styles/pages/watch-live.css';

export default function WatchLivePage() {
  const { showToast } = useToast();

  const handleOpenStream = (name) => {
    showToast(`Opening ${name || 'stream'}...`);
  };

  return (
    <Shell activeTab="competitions">
      <main className="main-content">
          <div className="page-header-row">
            <div>
              <h1 className="page-title">Watch Live</h1>
              <p className="page-subtitle">Catch every match as it happens, streamed live.</p>
            </div>
            <div className="live-status-badge">
              <span className="pulse-dot"></span>
              <span className="live-status-text">5 Streams Live</span>
            </div>
          </div>

          {/* Featured Stream */}
          <div
            className="featured-stream"
            onClick={() => handleOpenStream('Counter-Strike 2 World Championship')}
          >
            <img src="/assets/b890c61489a080992ad7e99adabb1145e6d59606.png" alt="Featured Stream" />
            <div className="featured-overlay">
              <div className="featured-game">Counter-Strike 2 · World Championship 2026</div>
              <div className="featured-title">Storm Riders vs FaZe Clan — Quarter Final</div>
              <div className="featured-meta">
                <span>🔴 LIVE</span>
                <span>👁 24,803 viewers</span>
                <span>⏱ 1:23:45</span>
                <span>Map 2 of 3</span>
              </div>
            </div>
            <div className="play-btn">
              <svg viewBox="0 0 24 24" fill="#000">
                <polygon points="5,3 19,12 5,21" />
              </svg>
            </div>
            <div className="stream-live-badge featured-live-badge">● LIVE</div>
          </div>

          {/* Section heading */}
          <div className="section-header">
            <div className="section-title-group">
              <div className="section-accent-bar"></div>
              <h2 className="section-title section-title-alt">All Live Streams</h2>
            </div>
          </div>

          <div className="stream-grid streams-grid-alt">
            <div
              className="stream-card"
              onClick={() => handleOpenStream('League of Legends Finals')}
            >
              <div className="stream-thumb">
                <img src="/assets/7b04655f1d50a8b1b25ad53f36d80ff99cb3184e.png" alt="" />
                <span className="stream-live-badge">● LIVE</span>
                <div className="stream-viewers">👁 12,441</div>
              </div>
              <div className="stream-card-body">
                <div className="stream-game">League of Legends</div>
                <div className="stream-title">Spring Split Finals — SF Game 3</div>
                <div className="stream-teams">Cloud9 vs T1 · Map 3 of 5</div>
              </div>
            </div>

            <div
              className="stream-card"
              onClick={() => handleOpenStream('Dota 2 Champions League')}
            >
              <div className="stream-thumb">
                <img src="/assets/0e6f51d89fed056f96d58f2c51d79eb797ccdf75.png" alt="" />
                <span className="stream-live-badge">● LIVE</span>
                <div className="stream-viewers">👁 8,902</div>
              </div>
              <div className="stream-card-body">
                <div className="stream-game">Dota 2</div>
                <div className="stream-title">Champions League QF — Game 2</div>
                <div className="stream-teams">OG vs EG · Game 2 of 3</div>
              </div>
            </div>

            <div
              className="stream-card"
              onClick={() => handleOpenStream('Valorant Pro League')}
            >
              <div className="stream-thumb">
                <img src="/assets/fad13be991fc17a28771191ca710b201fb3ee4fb.png" alt="" />
                <span className="stream-live-badge">● LIVE</span>
                <div className="stream-viewers">👁 6,117</div>
              </div>
              <div className="stream-card-body">
                <div className="stream-game">Valorant</div>
                <div className="stream-title">Pro League S5 — Group Stage</div>
                <div className="stream-teams">Sentinels vs NaVi · Live</div>
              </div>
            </div>

            <div
              className="stream-card"
              onClick={() => handleOpenStream('Rocket League Championship')}
            >
              <div className="stream-thumb">
                <img src="/assets/61fe8554e6377c0b431ed18f65529b1847d225cb.png" alt="" />
                <span className="stream-live-badge">● LIVE</span>
                <div className="stream-viewers">👁 3,280</div>
              </div>
              <div className="stream-card-body">
                <div className="stream-game">Rocket League</div>
                <div className="stream-title">Championship Series — Round 2</div>
                <div className="stream-teams">NRG vs G2 · Game 3 of 5</div>
              </div>
            </div>

            {/* Upcoming Streams */}
            <div className="stream-card card-upcoming">
              <div className="stream-thumb thumb-upcoming">
                <span className="emoji-large">🕐</span>
              </div>
              <div className="stream-card-body">
                <div className="stream-game">Counter-Strike 2</div>
                <div className="stream-title">World Championship — Semi Final</div>
                <div className="stream-teams">Starts in 2h 15m · Aug 5 @ 20:00 IST</div>
              </div>
            </div>

            <div className="stream-card card-upcoming">
              <div className="stream-thumb thumb-upcoming">
                <span className="emoji-large">🕑</span>
              </div>
              <div className="stream-card-body">
                <div className="stream-game">Fortnite</div>
                <div className="stream-title">Battle Royale Masters — Finals</div>
                <div className="stream-teams">Starts Aug 28 · 100 players</div>
              </div>
            </div>
          </div>
        </main>
    </Shell>
  );
}
