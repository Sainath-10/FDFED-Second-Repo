/**
 * NEXUS ESPORTS — Sidebar
 *
 * Renders the same `<aside class="sidebar">` markup
 * injected into `#sidebar-mount`, using the role-based nav config. Active state
 * comes from NavLink instead of a passed-in `activePage` string.
 */
import { NavLink } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { getSidebarNav } from '../config/nav.js';
import { selectUnreadCount } from '../store/notificationsSlice.js';
import { LoginIcon } from './icons.jsx';
import logo from '../assets/f03e2b11537e425d8544ee3ca732bf73af5137c0.png';

function NavItem({ item }) {
  const Icon = item.icon;
  // Unread count from the notifications slice, shown on the "Alerts" link.
  const unread = useSelector(selectUnreadCount);
  const badge = item.id === 'notifications' && unread > 0 ? unread : 0;
  return (
    <NavLink
      to={item.to}
      end={item.end}
      className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}
    >
      <Icon />
      <span>{item.label}</span>
      {badge > 0 && <span className="nav-badge" aria-label={`${badge} unread`}>{badge > 99 ? '99+' : badge}</span>}
    </NavLink>
  );
}

export default function Sidebar() {
  const session = useSelector((state) => state.auth.session);
  const { top, bottom, showLogin } = getSidebarNav(session);

  return (
    <aside className="sidebar">
      <div className="sidebar-logo">
        <img src={logo} alt="Nexus Logo" />
        <div className="logo-title">NEXUS</div>
        <div className="logo-sub">ESPORTS</div>
      </div>
      <nav className="sidebar-nav">
        {top.map((item) => (
          <NavItem key={item.id} item={item} />
        ))}
      </nav>
      <div className="sidebar-nav-bottom">
        {bottom.map((item) => (
          <NavItem key={item.id} item={item} />
        ))}
        {showLogin && (
          <NavLink
            to="/pages/login.html"
            className="nav-item"
            style={{ marginTop: 12, background: 'rgba(198,255,51,0.08)', borderRadius: 8 }}
          >
            <LoginIcon />
            <span style={{ color: '#c6ff33' }}>Login</span>
          </NavLink>
        )}
      </div>
    </aside>
  );
}


