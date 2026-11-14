/**
 * NEXUS ESPORTS — Site footer
 *
 * The same footer on every page. Every link goes to a real page, the account
 * link follows the viewer's role, and the status line reflects whether the API
 * is actually reachable.
 */
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { PlatformAPI } from '../services/api.js';
import { ROLE_ROUTES } from '../routes.js';
import logo from '../assets/f03e2b11537e425d8544ee3ca732bf73af5137c0.png';

const STAFF = ['admin', 'super-admin', 'finance_moderator', 'community_moderator'];
const PROFILE_FOR = {
  admin: '/pages/admin/admin-profile.html',
  finance_moderator: '/pages/admin/admin-profile.html',
  'super-admin': '/pages/super-admin/profile.html',
  community_moderator: '/pages/moderator/profile.html',
};

export default function SiteFooter() {
  const { session } = useAuth();
  const [online, setOnline] = useState(null);

  useEffect(() => {
    let alive = true;
    const check = () => PlatformAPI.settings().then((res) => { if (alive) setOnline(res.ok); });
    check();
    const timer = window.setInterval(check, 60000);
    return () => { alive = false; window.clearInterval(timer); };
  }, []);

  const staff = session && STAFF.includes(session.role);
  const profileHref = session ? (PROFILE_FOR[session.role] || '/pages/profile.html') : '/pages/login.html';

  return (
    <footer className="site-footer">
      <div className="footer-top">
        <div className="footer-brand">
          <div className="footer-brand-logo">
            <img src={logo} alt="Nexus logo" />
            <div className="footer-brand-name">
              <div className="name">NEXUS</div>
              <div className="sub">ESPORTS</div>
            </div>
          </div>
          <p className="footer-desc">
            Run and play esports competitions: registrations, fixtures, results, disputes and prize payouts held safely in escrow.
          </p>
        </div>
        <div className="footer-col">
          <div className="footer-col-title">Platform</div>
          <ul>
            <li><Link to="/pages/about.html">About</Link></li>
            <li><Link to="/pages/competitions.html">Competitions</Link></li>
            <li><Link to="/pages/watch-live.html">Live now</Link></li>
          </ul>
        </div>
        <div className="footer-col">
          <div className="footer-col-title">{staff ? 'Workspace' : 'Your account'}</div>
          <ul>
            {staff ? (
              <>
                <li><Link to={ROLE_ROUTES[session.role] || '/'}>Dashboard</Link></li>
                <li><Link to={profileHref}>Profile</Link></li>
              </>
            ) : (
              <>
                <li><Link to={session ? '/pages/my-activity.html' : '/pages/login.html'}>My activity</Link></li>
                <li><Link to={profileHref}>{session ? 'Profile' : 'Log in'}</Link></li>
                <li><Link to={session ? '/pages/my-payments.html' : '/pages/signup.html'}>{session ? 'Payments' : 'Sign up'}</Link></li>
              </>
            )}
          </ul>
        </div>
        <div className="footer-col">
          <div className="footer-col-title">Help</div>
          <ul>
            <li><Link to="/pages/about.html#policies">Rules and policies</Link></li>
            <li><Link to={session ? '/pages/my-reports.html' : '/pages/login.html?redirect=/pages/my-reports.html'}>Report a problem</Link></li>
          </ul>
        </div>
      </div>
      <div className="footer-bottom">
        <span className="footer-copy">© {new Date().getFullYear()} NEXUS ESPORTS</span>
        <div className="footer-status" role="status">
          <div className="status-dot" style={online === false ? { background: '#ef4444', boxShadow: 'none' } : undefined}></div>
          <span>{online === null ? 'Checking server…' : online ? 'Server online' : 'Server unreachable'}</span>
        </div>
      </div>
    </footer>
  );
}
