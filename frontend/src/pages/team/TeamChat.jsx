/**
 * NEXUS ESPORTS — shared team chat
 *
 * Every active member of the team (captain or player) reads and writes the same
 * conversation. The backend re-checks membership on every request.
 */
import { useTeamContext } from '../../hooks/useTeamContext.js';
import TeamHeader from '../../components/TeamHeader.jsx';
import ChatRoom from '../../components/ChatRoom.jsx';
import { EmptyState } from '../../components/ui.jsx';
import { teamGate } from './TeamGate.jsx';

export default function TeamChat() {
  const t = useTeamContext();

  const gate = teamGate(t, { title: 'Team chat' });
  if (gate) return gate;

  const { team, canChat } = t;
  return (
    <main className="main-content">
      <TeamHeader active="chat" />
      <p className="td-section-sub" style={{ margin: '-8px 0 14px' }}>Only this team&apos;s current members can read and send messages.</p>
      {canChat
        ? <ChatRoom scope="team" id={team.id} />
        : <EmptyState title="Team chat unavailable" message="Only current members of an active team can use its chat." />}
    </main>
  );
}
