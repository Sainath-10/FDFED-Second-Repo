/**
 * NEXUS ESPORTS — competition card
 *
 * same markup/classes and the same
 * "hide Join when you're already involved" rule. Navigation uses the router;
 * guests clicking Join are sent to login (matching the grid guard).
 */
import { useNavigate } from 'react-router-dom';
import { assetUrl } from '../lib/assets.js';

const FALLBACK_IMG = 'b890c61489a080992ad7e99adabb1145e6d59606.png';

function normalize(value) {
  return String(value || '').trim().toLowerCase();
}

export default function CompCard({ comp, session }) {
  const navigate = useNavigate();
  const { img, badge, badgeClass, game, name, prizePool, participants, dates, status, id, role, teams } = comp;

  let hideJoinBtn = role === 'organizer';
  if (!hideJoinBtn) {
    const uname = session ? normalize(session.username) : '';
    if (uname) {
      if (normalize(comp.organizerId || comp.createdBy) === uname) hideJoinBtn = true;
      if (!hideJoinBtn && Array.isArray(teams)) {
        hideJoinBtn = teams.some((t) => {
          if (!t) return false;
          if (normalize(t.createdBy) === uname) return true;
          if (Array.isArray(t.members)) {
            return t.members.some((m) => normalize(typeof m === 'string' ? m : m && m.username) === uname);
          }
          return false;
        });
      }
    }
  }

  function handleJoin(event) {
    event.stopPropagation();
    if (!session) {
      navigate('/pages/login.html');
      return;
    }
    navigate(`/pages/join-teams.html?id=${id}`);
  }

  return (
    <div className="comp-card" onClick={() => navigate(`/pages/comp-info.html?id=${id}`)}>
      <div className="comp-card-img">
        <img src={assetUrl(img) || assetUrl(FALLBACK_IMG)} alt={name} />
        <span className={`comp-badge ${badgeClass || ''}`}>{badge || ''}</span>
      </div>
      <div className="comp-card-body">
        <div className="comp-game-label">{game}</div>
        <h3 className="comp-title">{name}</h3>
        <div className="comp-meta">
          <div className="comp-meta-item">
            <svg viewBox="0 0 16 16" fill="none" stroke="#C6FF33" strokeWidth="1.33" strokeLinecap="round">
              <line x1="8" y1="1" x2="8" y2="15" />
              <path d="M11 4H6.5a2.5 2.5 0 0 0 0 5H9a2.5 2.5 0 0 1 0 5H4" />
            </svg>
            <span>{prizePool || '—'}</span>
          </div>
          <div className="comp-meta-item">
            <svg viewBox="0 0 16 16" fill="none" stroke="#C6FF33" strokeWidth="1.33" strokeLinecap="round">
              <path d="M11 3H5l-2 5h14l-2-5z" />
              <path d="M2 8v5h12V8" />
              <path d="M7 8v5" />
            </svg>
            <span>{(Array.isArray(teams) ? teams.length : participants) || 0} Teams</span>
          </div>
          <div className="comp-meta-item">
            <svg viewBox="0 0 16 16" fill="none" stroke="#C6FF33" strokeWidth="1.33" strokeLinecap="round">
              <rect x="1" y="2" width="14" height="13" rx="2" />
              <line x1="1" y1="7" x2="15" y2="7" />
              <line x1="5" y1="1" x2="5" y2="3" />
              <line x1="11" y1="1" x2="11" y2="3" />
            </svg>
            <span>{dates || 'TBD'}</span>
          </div>
        </div>
        <div className="comp-card-footer">
          <span className="comp-status">{status}</span>
          {!hideJoinBtn && (
            <button className="btn-primary" onClick={handleJoin}>Join Teams</button>
          )}
        </div>
      </div>
    </div>
  );
}


