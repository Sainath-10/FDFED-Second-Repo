/**
 * NEXUS ESPORTS — team tabs
 *
 * The tab bar under the team header. Every member sees Roster, Matches and
 * Chat; the captain also sees the roster-management tabs until the competition
 * ends. The comp/team context travels in the query string.
 */
import { Link } from 'react-router-dom';

const TABS = [
  { id: 'roster', label: 'Roster', file: 'team-roster.html' },
  { id: 'matches', label: 'Matches & standings', file: 'team-matches.html' },
  { id: 'chat', label: 'Team chat', file: 'team-chat.html', member: true },
  { id: 'add-players', label: 'Add players', file: 'add-players.html', captain: true },
  { id: 'join-requests', label: 'Join requests', file: 'join-requests.html', captain: true, badge: true },
  { id: 'invitations', label: 'Invitations', file: 'invitations-sent.html', captain: true },
  { id: 'settings', label: 'Settings', file: 'team-settings.html', captain: true },
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
  return (
    <nav className="td-tabs" aria-label="Team pages">
      {TABS.map((t) => {
        if (t.member && !canChat) return null;
        if (t.captain && hideAdmin) return null;
        const href = t.id === 'roster' && rosterTo ? rosterTo : withTeamContext(`/pages/team/${t.file}`, context);
        return (
          <Link
            key={t.id}
            to={href}
            className={`td-tab${active === t.id ? ' is-active' : ''}`}
            aria-current={active === t.id ? 'page' : undefined}
          >
            {t.label}
            {t.badge && joinRequestCount ? <span className="td-tab-badge">{joinRequestCount}</span> : null}
          </Link>
        );
      })}
      {context?.compId && (
        <Link className="td-tab td-tab-external" to={`/pages/comp-info.html?id=${encodeURIComponent(context.compId)}`}>
          Competition page ↗
        </Link>
      )}
    </nav>
  );
}
