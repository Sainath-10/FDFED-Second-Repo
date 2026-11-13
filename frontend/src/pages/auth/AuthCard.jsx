/**
 * NEXUS ESPORTS — AuthCard
 *
 * Shared shell for the login/signup cards (logo, heading, form slot, switch link). Markup/classes match the auth pages.
 */
import { Link } from 'react-router-dom';
import logo from '../../assets/f03e2b11537e425d8544ee3ca732bf73af5137c0.png';

export default function AuthCard({
  title,
  subtitle,
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

        <p className="auth-switch">
          {switchPrompt} <Link to={switchTo}>{switchLabel}</Link>
        </p>
      </div>
    </div>
  );
}


