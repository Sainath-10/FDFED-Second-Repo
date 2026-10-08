/**
 * NEXUS ESPORTS — AuthCard
 *
 * Shared shell for the login/signup cards (logo, heading, form slot, social
 * divider, switch link). Markup/classes match the auth pages.
 */
import { Link } from 'react-router-dom';
import logo from '../../assets/f03e2b11537e425d8544ee3ca732bf73af5137c0.png';

function GoogleMark() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
      <path d="M18.77 10.204c0-.638-.057-1.252-.164-1.84H10v3.48h4.928a4.208 4.208 0 0 1-1.826 2.761v2.295h2.957c1.728-1.592 2.725-3.938 2.725-6.696z" fill="white" opacity="0.9" />
      <path d="M10 19c2.475 0 4.552-.82 6.069-2.22l-2.957-2.296c-.82.55-1.867.875-3.112.875-2.394 0-4.42-1.617-5.144-3.787H1.806v2.37A9.998 9.998 0 0 0 10 19z" fill="white" opacity="0.7" />
      <path d="M4.856 11.572A6.012 6.012 0 0 1 4.542 10c0-.547.094-1.08.314-1.572V6.06H1.806A9.998 9.998 0 0 0 0 10c0 1.614.386 3.14 1.806 3.94l3.05-2.368z" fill="white" opacity="0.8" />
      <path d="M10 3.958c1.35 0 2.561.464 3.514 1.375l2.635-2.635C14.548 1.19 12.474.2 10 .2A9.998 9.998 0 0 0 1.806 6.06l3.05 2.368C5.58 5.575 7.606 3.958 10 3.958z" fill="white" />
    </svg>
  );
}

export default function AuthCard({
  title,
  subtitle,
  googleLabel,
  switchPrompt,
  switchTo,
  switchLabel,
  children,
}) {
  return (
    <div className="auth-body">
      <div className="auth-card">
        <div className="auth-logo">
          <img src={logo} alt="Nexus Logo" />
          <div className="auth-logo-text">
            <span className="brand">NEXUS</span>
            <span className="sub">ESPORTS</span>
          </div>
        </div>

        <div className="auth-heading">
          <h1>{title}</h1>
          <p>{subtitle}</p>
        </div>

        {children}

        <div className="auth-divider">
          <span>or</span>
        </div>

        <button className="btn-social" type="button">
          <GoogleMark />
          {googleLabel}
        </button>

        <p className="auth-switch">
          {switchPrompt} <Link to={switchTo}>{switchLabel}</Link>
        </p>
      </div>
    </div>
  );
}


