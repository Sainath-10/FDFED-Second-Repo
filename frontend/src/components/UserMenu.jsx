/**
 * NEXUS ESPORTS — account menu
 *
 * The profile avatar in the top-right corner of every signed-in page. Clicking
 * it opens a small menu with Profile settings and Log out (these are no longer
 * sidebar items). The profile link is the signed-in role's own profile page.
 */
import { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { getSidebarNav } from '../config/nav.js';
import { LogoutIcon, ProfileIcon } from './icons.jsx';
import '../styles/components/user-menu.css';

const ROLE_LABEL = {
  'super-admin': 'Super Admin',
  admin: 'Admin',
  finance_moderator: 'Finance moderator',
  community_moderator: 'Community moderator',
  team_lead: 'Team lead',
  participant: 'Player',
};

export default function UserMenu({ floating = false }) {
  const { session, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);

  // Close on route change, outside click and Escape.
  useEffect(() => { setOpen(false); }, [location.pathname, location.search]);
  useEffect(() => {
    if (!open) return undefined;
    const onPointer = (event) => { if (rootRef.current && !rootRef.current.contains(event.target)) setOpen(false); };
    const onKey = (event) => { if (event.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  if (!session) return null;

  const { profileTo } = getSidebarNav(session);
  const username = String(session.username || '').replace(/^@/, '');
  const initial = (username.slice(0, 1) || '?').toUpperCase();

  function handleLogout() {
    setOpen(false);
    logout();
    navigate('/pages/login.html', { replace: true });
  }

  return (
    <div className={`user-menu${floating ? ' is-floating' : ''}`} ref={rootRef}>
      <button
        type="button"
        className={`user-menu-trigger${open ? ' is-open' : ''}`}
        onClick={() => setOpen((value) => !value)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Account menu"
        title={`@${username}`}
      >
        {session.profilePicUrl
          ? <img src={session.profilePicUrl} alt="" />
          : <span aria-hidden="true">{initial}</span>}
      </button>

      {open && (
        <div className="user-menu-dropdown" role="menu">
          <div className="user-menu-identity">
            <strong>@{username}</strong>
            <small>{ROLE_LABEL[session.role] || session.role}</small>
          </div>
          {profileTo && (
            <Link className="user-menu-item" role="menuitem" to={profileTo}>
              <ProfileIcon />
              <span>Profile settings</span>
            </Link>
          )}
          <button type="button" className="user-menu-item is-danger" role="menuitem" onClick={handleLogout}>
            <LogoutIcon />
            <span>Log out</span>
          </button>
        </div>
      )}
    </div>
  );
}
