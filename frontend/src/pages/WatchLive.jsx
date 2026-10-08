/**
 * NEXUS ESPORTS — Watch Live
 *
 * Live-stream hub: a featured player, the match it is showing, the list of live
 * streams and the upcoming schedule. There is no real stream source available,
 * so the player area shows the stream artwork and an explicit offline notice
 * rather than pretending to play video.
 */
import { showToast } from '../lib/toast.js';
import { assetUrl } from '../lib/assets.js';
import '../styles/pages/watch-live.css';

const FEATURED = {
  img: 'b890c61489a080992ad7e99adabb1145e6d59606.png',
  game: 'Counter-Strike 2',
  competition: 'World Championship 2026',
  home: 'Storm Riders',
  away: 'FaZe Clan',
  stage: 'Quarter Final · Map 2 of 3',
  viewers: '24,803',
  uptime: '1:23:45',
};

const STREAMS = [
  { img: '7b04655f1d50a8b1b25ad53f36d80ff99cb3184e.png', game: 'League of Legends', title: 'Spring Split Finals — SF Game 3', home: 'Cloud9', away: 'T1', stage: 'Map 3 of 5', viewers: '12,441' },
  { img: '0e6f51d89fed056f96d58f2c51d79eb797ccdf75.png', game: 'Dota 2', title: 'Champions League QF — Game 2', home: 'OG', away: 'EG', stage: 'Game 2 of 3', viewers: '8,902' },
  { img: 'fad13be991fc17a28771191ca710b201fb3ee4fb.png', game: 'Valorant', title: 'Pro League S5 — Group Stage', home: 'Sentinels', away: 'NaVi', stage: 'Group Stage', viewers: '6,117' },
  { img: '61fe8554e6377c0b431ed18f65529b1847d225cb.png', game: 'Rocket League', title: 'Championship Series — Round 2', home: 'NRG', away: 'G2', stage: 'Game 3 of 5', viewers: '3,280' },
];

const UPCOMING = [
  { game: 'Counter-Strike 2', title: 'World Championship — Semi Final', meta: 'Starts in 2h 15m · Aug 5 @ 20:00 IST' },
  { game: 'Fortnite', title: 'Battle Royale Masters — Finals', meta: 'Starts Aug 28 · 100 players' },
];

export default function WatchLive() {
  const liveCount = STREAMS.length + 1;

  return (
    <main className="main-content watch-live-page">
      <header className="wl-head">
        <div>
          <h1 className="page-title">Watch Live</h1>
          <p className="page-subtitle">Catch every match as it happens, streamed live.</p>
        </div>
        <div className="live-status-badge">
          <span className="pulse-dot"></span>
          <span className="live-status-text">{liveCount} Streams Live</span>
        </div>
      </header>

      <section className="wl-player" aria-label="Featured stream">
        <button
          type="button"
          className="wl-player-media"
          onClick={() => showToast('Opening stream...')}
          aria-label={`Open stream: ${FEATURED.home} vs ${FEATURED.away}`}
        >
          <img src={assetUrl(FEATURED.img)} alt="" />
          <span className="wl-badge-live">● LIVE</span>
          <span className="wl-viewers">👁 {FEATURED.viewers}</span>
          <span className="wl-play" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="#000"><polygon points="5,3 19,12 5,21" /></svg>
          </span>
          <span className="wl-player-caption">
            <span className="wl-eyebrow">{FEATURED.game} · {FEATURED.competition}</span>
            <span className="wl-player-title">{FEATURED.home} vs {FEATURED.away}</span>
          </span>
        </button>

        <div className="wl-matchbar">
          <div className="wl-team wl-team-home">
            <span className="wl-team-name">{FEATURED.home}</span>
          </div>
          <div className="wl-center">
            <span className="wl-score">VS</span>
            <span className="wl-stage">{FEATURED.stage}</span>
          </div>
          <div className="wl-team wl-team-away">
            <span className="wl-team-name">{FEATURED.away}</span>
          </div>
          <dl className="wl-stats">
            <div><dt>Status</dt><dd className="wl-live-text">Live now</dd></div>
            <div><dt>Viewers</dt><dd>{FEATURED.viewers}</dd></div>
            <div><dt>Elapsed</dt><dd>{FEATURED.uptime}</dd></div>
            <div><dt>Stage</dt><dd>{FEATURED.stage}</dd></div>
          </dl>
        </div>

        <p className="wl-offline">
          No embedded player is available for this event — the button above opens the stream.
        </p>
      </section>

      <section className="wl-section">
        <div className="wl-section-head">
          <span className="wl-accent-bar" aria-hidden="true"></span>
          <h2 className="wl-section-title">All Live Streams</h2>
          <span className="wl-count">{STREAMS.length} live</span>
        </div>

        <div className="wl-grid">
          {STREAMS.map((s) => (
            <button type="button" className="wl-card" key={s.title} onClick={() => showToast('Opening stream...')}>
              <span className="wl-thumb">
                <img src={assetUrl(s.img)} alt="" />
                <span className="wl-badge-live">● LIVE</span>
                <span className="wl-viewers">👁 {s.viewers}</span>
              </span>
              <span className="wl-card-body">
                <span className="wl-game">{s.game}</span>
                <span className="wl-card-title">{s.title}</span>
                <span className="wl-card-teams">
                  <strong>{s.home}</strong> <em>vs</em> <strong>{s.away}</strong> · {s.stage}
                </span>
              </span>
            </button>
          ))}
        </div>
      </section>

      <section className="wl-section">
        <div className="wl-section-head">
          <span className="wl-accent-bar wl-accent-muted" aria-hidden="true"></span>
          <h2 className="wl-section-title">Coming Up</h2>
        </div>

        <div className="wl-grid wl-grid-upcoming">
          {UPCOMING.map((u) => (
            <article className="wl-card wl-card-upcoming" key={u.title}>
              <span className="wl-thumb wl-thumb-upcoming" aria-hidden="true">🕐</span>
              <span className="wl-card-body">
                <span className="wl-game">{u.game}</span>
                <span className="wl-card-title">{u.title}</span>
                <span className="wl-card-teams">{u.meta}</span>
              </span>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
