/**
 * NEXUS ESPORTS — competition card
 *
 * Shows a competition with its real team count and registration state. "Join
 * teams" appears only while registration is open and the viewer is neither an
 * organizer nor already on a team in it.
 */
import { useNavigate } from 'react-router-dom';
import { competitionBanner } from '../lib/assets.js';
import { isOrganizerOf } from '../services/competitions.js';

const normalize = (value) => String(value || '').trim().toLowerCase();

export default function CompCard({ comp, session }) {
  const navigate = useNavigate();
  const { badge, badgeClass, game, name, prizePool, dates, id } = comp;
  const teams = comp.activeTeams || comp.teams || [];
  const me = normalize(session?.username);
  const involved = !!me && (isOrganizerOf(comp, me) || teams.some((t) => (t.members || []).some((m) => normalize(m.username || m) === me)));
  const canJoin = comp.registration?.open && !involved;

  function handleJoin(event) {
    event.stopPropagation();
    const target = `/pages/join-teams.html?id=${encodeURIComponent(id)}`;
    navigate(session ? target : `/pages/login.html?redirect=${encodeURIComponent(target)}`);
  }

  const open = () => navigate(`/pages/comp-info.html?id=${encodeURIComponent(id)}`);

  return (
    <div className="comp-card" role="link" tabIndex={0} onClick={open} onKeyDown={(e) => { if (e.key === 'Enter') open(); }}>
      <div className="comp-card-img">
        <img src={competitionBanner(comp)} alt="" loading="lazy" />
        <span className={`comp-badge ${badgeClass || ''}`}>{badge || ''}</span>
      </div>
      <div className="comp-card-body">
        <div className="comp-game-label">{game}</div>
        <h3 className="comp-title">{name}</h3>
        <div className="comp-meta">
          <div className="comp-meta-item">
            <svg viewBox="0 0 16 16" fill="none" stroke="#C6FF33" strokeWidth="1.33" strokeLinecap="round" aria-hidden="true"><line x1="8" y1="1" x2="8" y2="15" /><path d="M11 4H6.5a2.5 2.5 0 0 0 0 5H9a2.5 2.5 0 0 1 0 5H4" /></svg>
            <span>{prizePool}</span>
          </div>
          <div className="comp-meta-item">
            <svg viewBox="0 0 16 16" fill="none" stroke="#C6FF33" strokeWidth="1.33" strokeLinecap="round" aria-hidden="true"><path d="M11 3H5l-2 5h14l-2-5z" /><path d="M2 8v5h12V8" /><path d="M7 8v5" /></svg>
            <span>{teams.length}{comp.maxTeams ? ` / ${comp.maxTeams}` : ''} teams</span>
          </div>
          <div className="comp-meta-item">
            <svg viewBox="0 0 16 16" fill="none" stroke="#C6FF33" strokeWidth="1.33" strokeLinecap="round" aria-hidden="true"><rect x="1" y="2" width="14" height="13" rx="2" /><line x1="1" y1="7" x2="15" y2="7" /><line x1="5" y1="1" x2="5" y2="3" /><line x1="11" y1="1" x2="11" y2="3" /></svg>
            <span>{dates}</span>
          </div>
        </div>
        <div className="comp-card-footer">
          <span className="comp-status">{comp.registration?.label}</span>
          {canJoin && <button type="button" className="btn-primary" onClick={handleJoin}>Join teams</button>}
        </div>
      </div>
    </div>
  );
}
