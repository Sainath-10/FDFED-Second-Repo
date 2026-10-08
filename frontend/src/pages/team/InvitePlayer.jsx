/**
 * NEXUS ESPORTS — Invite Player
 *
 * username + role +
 * message form, send invite, then redirect to the roster.
 */
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTeamContext } from '../../hooks/useTeamContext.js';
import NexusTeamWorkflow from '../../services/teamWorkflow.js';
import { withTeamContext } from '../../components/TeamTabs.jsx';
import { showToast } from '../../lib/toast.js';
import '../../styles/pages/team/invite-player.css';

const ROLES = ['IGL', 'AWPer', 'Entry Fragger', 'Support', 'Rifler'];

export default function InvitePlayer() {
  const { ctx } = useTeamContext();
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [role, setRole] = useState('');
  const [message, setMessage] = useState('');

  const backHref = withTeamContext('/pages/team/add-players.html', ctx && ctx.context);

  function onSubmit(event) {
    event.preventDefault();
    const u = username.trim();
    if (!u) { showToast('Please enter a username!', 'error'); return; }
    if (!ctx || !ctx.comp || !ctx.team) { showToast('Team context not found.', 'error'); return; }

    const result = NexusTeamWorkflow.sendInvite({
      compId: ctx.comp.id,
      teamId: ctx.team.id,
      toUsername: u,
      roleOffered: role || 'Player',
      message: message.trim(),
    });
    if (!result.ok) { showToast(result.error || 'Failed to send invite.', 'error'); return; }

    showToast(`Invitation sent to ${u} successfully!`);
    setTimeout(() => navigate(`/pages/team/team-roster.html?compId=${encodeURIComponent(ctx.comp.id)}&teamId=${encodeURIComponent(ctx.team.id)}`), 1400);
  }

  return (
    <main className="main-content">
      <Link to={backHref} className="back-btn-alt">← Back to Add Players</Link>
      <h1 className="page-title">Send Invitation</h1>
      <p className="page-subtitle">Invite a specific player to join {ctx && ctx.team ? ctx.team.name : 'your team'}.</p>

      <div className="form-container-sm">
        <div className="form-card">
          <form id="invite-form" className="form-stack" onSubmit={onSubmit}>
            <div className="form-group">
              <label className="form-label">Player Username</label>
              <input className="form-input" type="text" id="invite-username" placeholder="Enter username exactly as registered…" required value={username} onChange={(e) => setUsername(e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">Role Offered</label>
              <select className="form-select" value={role} onChange={(e) => setRole(e.target.value)}>
                <option value="">Select role…</option>
                {ROLES.map((r) => <option key={r}>{r}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Personal Message (optional)</label>
              <textarea className="form-textarea form-textarea-sm" placeholder="Add a personal note to your invitation…" value={message} onChange={(e) => setMessage(e.target.value)} />
            </div>
            <div className="btn-row">
              <button type="submit" className="btn-primary btn-submit-full">Send Invitation</button>
              <button type="button" className="btn-outline btn-cancel-alt" onClick={() => window.history.back()}>Cancel</button>
            </div>
          </form>
        </div>
      </div>
    </main>
  );
}


