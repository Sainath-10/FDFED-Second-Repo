/**
 * NEXUS ESPORTS — team tabs
 *
 * The shared team-tab nav. Carries the comp/team context in the query string
 * (the `appendContextToTeamTabs` behaviour). Administrative tabs hide for
 * non-captains and when the competition has ended (`applyPermissions` /
 * `lockEndedRosterUI`). Brackets and Standings live in the same row as the
 * team tabs and are available to every member, not just the captain.
 */
import { Link } from 'react-router-dom';

const TABS = [
  { id: 'roster', label: 'Roster', file: 'team-roster.html' },
  { id: 'chat', label: 'Team chat', file: 'team-chat.html' },
  { id: 'add-players', label: 'Add Players', file: 'add-players.html' },
  { id: 'join-requests', label: 'Join Requests', file: 'join-requests.html', badge: true },
  { id: 'invitations', label: 'Invitations Sent', file: 'invitations-sent.html' },
  { id: 'settings', label: 'Settings', file: 'team-settings.html' },
];

/** Competition pages opened from the team dashboard keep the same competition. */
const COMPETITION_TABS = [
  { id: 'brackets', label: 'Brackets', tab: 'bracket' },
  { id: 'standings', label: 'Standings', tab: 'standings' },
];

export function withTeamContext(path, context) {
  if (!context || !context.compId) return path;
  const p = new URLSearchParams();
  p.set('compId', context.compId);
  if (context.teamId) p.set('teamId', context.teamId);
  return `${path}?${p.toString()}`;
}

export default function TeamTabs({
  active,
  context,
  canManage = true,
  canChat = false,
  isEnded = false,
  joinRequestCount,
  rosterTo,
}) {
  const hideAdmin = !canManage || isEnded;
  const competitionId = context && context.compId ? context.compId : '';

  return (
    <nav className="team-tabs-nav" aria-label="Team pages">
      {TABS.map((t) => {
        if (t.id === 'chat' && !canChat) return null;
        if (hideAdmin && t.id !== 'roster' && t.id !== 'chat') return null;
        const href = t.id === 'roster' && rosterTo ? rosterTo : withTeamContext(`/pages/team/${t.file}`, context);
        return (
          <Link
            key={t.id}
            to={href}
            className={`team-tab${active === t.id ? ' active' : ''}`}
            aria-current={active === t.id ? 'page' : undefined}
          >
            {t.label}
            {t.badge && joinRequestCount ? <span className="notif-badge-sm">{joinRequestCount}</span> : null}
          </Link>
        );
      })}
      {competitionId && COMPETITION_TABS.map((t) => (
        <Link
          key={t.id}
          to={`/pages/comp-info.html?id=${encodeURIComponent(competitionId)}&tab=${t.tab}`}
          className={`team-tab${active === t.id ? ' active' : ''}`}
          aria-current={active === t.id ? 'page' : undefined}
        >
          {t.label}
        </Link>
      ))}
    </nav>
  );
}
