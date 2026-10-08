/**
 * NEXUS ESPORTS — team tabs
 *
 * The shared team-tab nav. Carries the comp/team context in the query string
 * (the `appendContextToTeamTabs` behaviour). Administrative tabs hide for
 * non-captains and when the competition has ended (`applyPermissions` /
 * `lockEndedRosterUI`).
 */
import { Link } from 'react-router-dom';

const TABS = [
  { id: 'roster', label: 'Roster', file: 'team-roster.html' },
  { id: 'add-players', label: 'Add Players', file: 'add-players.html' },
  { id: 'join-requests', label: 'Join Requests', file: 'join-requests.html', badge: true },
  { id: 'invitations', label: 'Invitations Sent', file: 'invitations-sent.html' },
  { id: 'settings', label: 'Settings', file: 'team-settings.html' },
];

export function withTeamContext(path, context) {
  if (!context || !context.compId) return path;
  const p = new URLSearchParams();
  p.set('compId', context.compId);
  if (context.teamId) p.set('teamId', context.teamId);
  return `${path}?${p.toString()}`;
}

export default function TeamTabs({ active, context, canManage = true, isEnded = false, joinRequestCount }) {
  const hideAdmin = !canManage || isEnded;

  return (
    <div className="team-tabs-nav">
      {TABS.map((t) => {
        const hidden = hideAdmin && t.id !== 'roster';
        return (
          <Link
            key={t.id}
            to={withTeamContext(`/pages/team/${t.file}`, context)}
            className={`team-tab${active === t.id ? ' active' : ''}`}
            style={hidden ? { display: 'none' } : undefined}
          >
            {t.label}
            {t.badge && joinRequestCount ? <span className="notif-badge-sm">{joinRequestCount}</span> : null}
          </Link>
        );
      })}
    </div>
  );
}


