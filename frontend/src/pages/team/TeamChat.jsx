import { Link } from 'react-router-dom';
import { useTeamContext } from '../../hooks/useTeamContext.js';
import TeamTabs from '../../components/TeamTabs.jsx';
import ChatRoom from '../../components/ChatRoom.jsx';

export default function TeamChat() {
  const { ctx, canManage, canChat, checkingPermission, isEnded } = useTeamContext();
  if (checkingPermission) return <main className="main-content"><p role="status">Checking team membership…</p></main>;
  if (!ctx?.team || !canChat) return <main className="main-content"><h1>Team chat unavailable</h1><p>Only current team members can view this chat.</p><Link to="/pages/my-activity.html">Back to My Activity</Link></main>;
  return <main className="main-content"><h1 className="page-title">{ctx.team.name} chat</h1><p className="page-subtitle">Only this team's current members can read and send messages.</p>
    <TeamTabs active="chat" context={ctx.context} canManage={canManage} canChat={canChat} isEnded={isEnded} />
    <ChatRoom scope="team" id={ctx.team.dbId || ctx.team.id} username={ctx.session.username} />
  </main>;
}
