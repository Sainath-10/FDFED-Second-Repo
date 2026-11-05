/**
 * NEXUS ESPORTS — shared team chat
 *
 * Team chat belongs to the team, not to its captain. Every active member of the
 * same team (leader or ordinary player) reads and writes the same conversation,
 * stored against the same backend team id. The backend re-checks membership on
 * every list/send, so no leader-only permission leaks into this page.
 */
import { Link, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import { useTeamContext } from '../../hooks/useTeamContext.js';
import TeamTabs from '../../components/TeamTabs.jsx';
import ChatRoom from '../../components/ChatRoom.jsx';

export default function TeamChat() {
  const { session } = useAuth();
  const [params] = useSearchParams();
  const { ctx, canManage, canChat, chatTeamId, checkingPermission, isEnded, isRemoved, compId, teamId, teamName } = useTeamContext();

  if (checkingPermission) {
    return <main className="main-content"><p role="status">Checking team membership…</p></main>;
  }
  if (isRemoved) {
    return (
      <main className="main-content">
        <h1 className="page-title">Access restricted</h1>
        <p className="page-subtitle">
          You have been removed from this competition. You can no longer access its team or competition management features.
        </p>
        <a className="btn-primary" href="/pages/my-reports.html">View your reports</a>
      </main>
    );
  }
  if (!canChat || !chatTeamId) {
    return (
      <main className="main-content">
        <h1>Team chat unavailable</h1>
        <p>Only current team members can view this chat.</p>
        <Link to="/pages/my-activity.html">Back to My Activity</Link>
      </main>
    );
  }

  const resolvedCompId = compId || params.get('compId') || '';
  const resolvedTeamId = teamId || params.get('teamId') || chatTeamId;
  const viewer = (session && session.username) || (ctx && ctx.session && ctx.session.username) || '';
  const resolvedName = teamName || (ctx && ctx.team && ctx.team.name) || 'Team';

  return (
    <main className="main-content">
      <h1 className="page-title">{resolvedName} chat</h1>
      <p className="page-subtitle">Only this team's current members can read and send messages.</p>
      {/* Players return to their own competition roster, not the leader-oriented
          team management page. Leaders keep the team roster. */}
      <TeamTabs
        active="chat"
        context={{ compId: resolvedCompId, teamId: resolvedTeamId }}
        canManage={canManage}
        canChat={canChat}
        isEnded={isEnded}
        rosterTo={!canManage && resolvedCompId
          ? `/pages/comp-participant.html?id=${encodeURIComponent(resolvedCompId)}`
          : undefined}
      />
      <ChatRoom scope="team" id={chatTeamId} username={viewer} />
    </main>
  );
}
