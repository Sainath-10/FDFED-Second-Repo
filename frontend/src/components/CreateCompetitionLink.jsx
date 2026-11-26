/**
 * NEXUS ESPORTS — "Create competition" entry point
 *
 * Every Create Competition button uses this. Before routing, it checks the
 * organiser's live reputation: a banned organiser (for example a Community
 * Moderator's temporary competition-creation restriction) gets a pop-up saying
 * how long the ban lasts instead of being sent to the create page. The server
 * still refuses creation on its own; this only explains it up front.
 */
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { ReputationAPI } from '../services/api.js';
import { creationBan } from '../lib/creationBan.js';

export { creationBan, BLOCKING_SANCTIONS } from '../lib/creationBan.js';

const longDate = (value) => new Date(value).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

/** Pop-up explaining a creation ban. */
export function CreationBanDialog({ ban, onClose }) {
  if (!ban) return null;
  return (
    <div className="modal-overlay open" style={{ display: 'flex' }} role="presentation" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal-box ui-dialog" role="alertdialog" aria-modal="true" aria-label="Competition creation banned">
        <div className="modal-header">
          <h3 className="modal-title ui-dialog-title-danger">{ban.message}</h3>
          <button type="button" className="modal-close" aria-label="Close" onClick={onClose}>✕</button>
        </div>
        <p className="ui-dialog-text">
          A Community Moderator restricted you from creating competitions
          {ban.until ? <>. You can create competitions again after <strong style={{ color: '#fff' }}>{longDate(ban.until)}</strong>.</> : '.'}
        </p>
        {ban.reason && <p className="ui-dialog-text"><strong style={{ color: '#fff' }}>Reason:</strong> {ban.reason}</p>}
        <div className="ui-dialog-actions">
          <button type="button" className="btn-primary" onClick={onClose}>OK</button>
        </div>
      </div>
    </div>
  );
}

export default function CreateCompetitionLink({ to = '/pages/create-competition.html', className, children }) {
  const session = useSelector((state) => state.auth.session);
  const navigate = useNavigate();
  const [ban, setBan] = useState(null);
  const [checking, setChecking] = useState(false);

  // Signed out: callers already point the link at login/sign-up.
  if (!session) return <Link to={to} className={className}>{children}</Link>;

  async function open(event) {
    event.preventDefault();
    if (checking) return;
    setChecking(true);
    const res = await ReputationAPI.me();
    setChecking(false);
    const found = res.ok ? creationBan(res.data) : null;
    if (found) setBan(found);
    else navigate(to);
  }

  return (
    <>
      <Link to={to} className={className} onClick={open} aria-busy={checking || undefined}>{children}</Link>
      <CreationBanDialog ban={ban} onClose={() => setBan(null)} />
    </>
  );
}
