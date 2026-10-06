import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import NexusAuth from '../../services/authService';

export default function Header({ mode = 'nav', backTo = '/' }) {
  const location = useLocation();
  const [session, setSession] = useState(null);

  useEffect(() => {
    setSession(NexusAuth.getSession());
  }, [location.pathname]);

  const pathname = location.pathname.toLowerCase();

  if (mode === 'back') {
    return (
      <header className="top-header">
        <Link to={backTo} className="header-logo-link">
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
    );
  }

  return (
    <header className="top-header">
      <Link to="/" className="header-logo-link">
        <img
          src="/assets/f03e2b11537e425d8544ee3ca732bf73af5137c0.png"
          alt="Nexus"
          style={{ width: 40, height: 34, borderRadius: 8, objectFit: 'cover' }}
        />
        <div className="header-logo-text">
          <span className="brand" style={{ fontSize: 18 }}>NEXUS</span>
          <span style={{ fontSize: 10, color: '#c6ff33' }}>ESPORTS</span>
        </div>
      </Link>
      <nav className="header-nav-links">
        <Link to="/" className={pathname === '/' ? 'active' : ''}>
          Home
        </Link>
        <Link to="/competitions" className={pathname.includes('competitions') ? 'active' : ''}>
          Competitions
        </Link>
        <Link to="/about" className={pathname.includes('about') ? 'active' : ''}>
          About
        </Link>
      </nav>
      <div className="header-actions">
        {session ? (
          <Link to="/profile" className="btn-profile-top">
            {session.displayName || session.username || 'Profile'}
          </Link>
        ) : (
          <>
            <Link to="/login" className="btn-login">
              Login
            </Link>
            <Link to="/signup" className="btn-signup">
              SignUp
            </Link>
          </>
        )}
      </div>
    </header>
  );
}
