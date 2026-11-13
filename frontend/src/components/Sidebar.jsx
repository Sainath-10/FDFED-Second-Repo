/**
 * NEXUS ESPORTS — Sidebar
 *
 * Renders the same `<aside class="sidebar">` markup
 * injected into `#sidebar-mount`, using the role-based nav config. Active state
 * comes from NavLink instead of a passed-in `activePage` string.
 */
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { getSidebarNav } from '../config/nav.js';
import { LoginIcon, LogoutIcon } from './icons.jsx';
import logo from '../assets/f03e2b11537e425d8544ee3ca732bf73af5137c0.png';

function NavItem({ item }) {
  const Icon = item.icon;
  return (
    <NavLink
      to={item.to}
      end={item.end}
      className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}
    >
      <Icon />
      <span>{item.label}</span>
    </NavLink>
  );
}

export default function Sidebar() {
  const { session, logout } = useAuth();
  const navigate = useNavigate();
  const { top, bottom, showLogin } = getSidebarNav(session);

  function handleLogout() {
    logout();
    navigate('/pages/login.html', { replace: true });
  }

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
        {session && (
          <button
            type="button"
            className="nav-item"
            onClick={handleLogout}
            style={{ background: 'none', border: 'none', font: 'inherit' }}
          >
            <LogoutIcon />
            <span>Log out</span>
          </button>
        )}
      </div>
    </aside>
  );
}


