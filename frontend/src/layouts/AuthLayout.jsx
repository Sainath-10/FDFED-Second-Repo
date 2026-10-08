/**
 * NEXUS ESPORTS — AuthLayout
 *
 * The auth-page chrome: the "Back" top header (getTopHeader 'back' mode) plus
 * the site footer, without the sidebar. Reproduces the `.auth-page`
 * wrapper so styles/pages/login.css & signup.css apply unchanged.
 */
import { Link } from 'react-router-dom';
import SiteFooter from '../components/SiteFooter.jsx';
import { FALLBACK_PATH } from '../routes.js';

export default function AuthLayout({ children }) {
  return (
    <div className="auth-page">
      <header className="top-header">
        <Link to={FALLBACK_PATH} className="header-logo-link">
          <div className="header-icon-btn">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path
                d="M14 8H2M2 8L8 14M2 8L8 2"
                stroke="#94A3B8"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
          <div className="header-logo-text">
            <span className="brand">Back</span>
          </div>
        </Link>
      </header>

      {children}

      <div id="footer-mount">
        <SiteFooter />
      </div>
    </div>
  );
}


