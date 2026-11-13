/**
 * NEXUS ESPORTS — Invite Player
 *
 * Sends one invitation, picked from a live username search limited to players
 * this team may invite, then returns to the invitations list.
 */
import { useCallback, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTeamContext } from '../../hooks/useTeamContext.js';
import { TeamsAPI } from '../../services/api.js';
import TeamHeader from '../../components/TeamHeader.jsx';
import { withTeamContext } from '../../components/TeamTabs.jsx';
import UsernameSearch from '../../components/UsernameSearch.jsx';
import { Notice } from '../../components/ui.jsx';
import { teamGate } from './TeamGate.jsx';
import { showToast } from '../../lib/toast.js';

export default function InvitePlayer() {
  const t = useTeamContext();
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [sending, setSending] = useState(false);
  const teamId = t.team?.id;

  const searchAvailable = useCallback(async (query) => {
    const res = await TeamsAPI.getAvailablePlayers(teamId, query);
    if (!res.ok) throw new Error(res.error || 'Unable to search players.');
    return (res.data || []).map((p) => ({ ...p, disabled: p.invited }));
  }, [teamId]);

  const gate = teamGate(t, { captainOnly: true, title: 'Send invitation' });
  if (gate) return gate;

  const { team, comp, rosterLocked, context } = t;

  async function send(name) {
    const clean = String(name || '').trim().replace(/^@/, '');
    if (!clean) { showToast('Choose a player from the list.', 'error'); return; }
    setSending(true);
    const res = await TeamsAPI.createInvite(team.id, comp.id, clean);
    setSending(false);
    if (!res.ok) { showToast(res.error || 'Unable to send the invitation.', 'error'); return; }
    showToast(`Invitation sent to @${clean}.`);
    navigate(withTeamContext('/pages/team/invitations-sent.html', context));
  }

  return (
    <main className="main-content">
      <TeamHeader t={t} active="add-players" />
      {rosterLocked && <Notice tone="info">The roster is locked because the competition has started or ended.</Notice>}

      <section className="td-panel" style={{ maxWidth: 560 }}>
        <h2 className="td-section-title">Send an invitation</h2>
        <p className="td-section-sub" style={{ marginBottom: 14 }}>The player receives a notification and accepts or declines it there.</p>
        <UsernameSearch
          id="invite-username"
          value={username}
          onChange={setUsername}
          onPick={send}
          search={searchAvailable}
          disabled={rosterLocked || sending}
          autoFocus
          renderHint={(row) => (row.invited ? 'Already invited' : 'Invite')}
        />
        <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
          <Link className="td-btn" to={withTeamContext('/pages/team/add-players.html', context)}>Back to Add players</Link>
        </div>
      </section>
    </main>
  );
}
