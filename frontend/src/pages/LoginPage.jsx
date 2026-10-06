import React, { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import Header from '../components/Layout/Header';
import Footer from '../components/Layout/Footer';
import NexusAuth from '../services/authService';
import '../styles/pages/login.css';

const roleRoutes = {
  regular: '/profile',
  participant: '/profile',
  team_lead: '/team-lead-dashboard',
  admin: '/admin/dashboard',
  comp_admin: '/admin/dashboard',
  dispute_admin: '/admin/disputes',
  revenue_admin: '/admin/revenue-transactions',
  'super-admin': '/super-admin/super-dashboard',
  super_admin: '/super-admin/super-dashboard'
};

export default function LoginPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const redirectParam = searchParams.get('redirect');

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [feedback, setFeedback] = useState({ text: '', isSuccess: false, isRevoked: false });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!username.trim() || !password) {
      setFeedback({ text: 'Please enter both username and password.', isSuccess: false, isRevoked: false });
      return;
    }

    setLoading(true);
    setFeedback({ text: 'Logging in...', isSuccess: true, isRevoked: false });

    try {
      const result = await NexusAuth.login({
        username: username.trim(),
        password: password,
        roleRoutes: roleRoutes,
        fallbackPath: redirectParam || '/'
      });

      if (!result.ok) {
        setFeedback({ text: result.error || 'Login failed. Please try again.', isSuccess: false, isRevoked: false });
        setLoading(false);
        return;
      }

      if (result.revokedReason) {
        const noticeMsg = `⚠️ Notice: Your administrator status was revoked by Super Admin.\nReason: "${result.revokedReason}"\nRedirecting to standard participant dashboard...`;
        setFeedback({ text: noticeMsg, isSuccess: true, isRevoked: true });
        setTimeout(() => {
          navigate(redirectParam || result.redirectPath || '/profile');
        }, 3500);
        return;
      }

      setFeedback({ text: 'Login successful. Redirecting...', isSuccess: true, isRevoked: false });
      setTimeout(() => {
        navigate(redirectParam || result.redirectPath || '/');
      }, 400);
    } catch (err) {
      setFeedback({ text: err.message || 'An error occurred during login.', isSuccess: false, isRevoked: false });
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      {/* Header */}
      <Header mode="back" backTo="/" />

      {/* Body */}
      <div className="auth-body">
        <div className="auth-card">
          {/* Logo */}
          <div className="auth-logo">
            <img src="/assets/f03e2b11537e425d8544ee3ca732bf73af5137c0.png" alt="Nexus Logo" />
            <div className="auth-logo-text">
              <span className="brand">NEXUS</span>
              <span className="sub">ESPORTS</span>
            </div>
          </div>

          {/* Heading */}
          <div className="auth-heading">
            <h1>Login</h1>
            <p>Enter your credentials to access the arena</p>
          </div>

          {/* Form */}
          <form className="auth-form" id="login-form" onSubmit={handleSubmit}>
            <div className="form-group">
              <label className="form-label" htmlFor="username">
                Username
              </label>
              <div className="form-input-wrap">
                <input
                  className="form-input"
                  type="text"
                  id="username"
                  name="username"
                  placeholder="regular@nexus.gg"
                  autoComplete="username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="password">
                Password
              </label>
              <div className="form-input-wrap">
                <input
                  className="form-input form-input-pwd"
                  type={showPassword ? 'text' : 'password'}
                  id="password"
                  name="password"
                  placeholder="••••••••"
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
                <button
                  type="button"
                  className="pwd-toggle"
                  onClick={() => setShowPassword((prev) => !prev)}
                  aria-label="Toggle password"
                >
                  {showPassword ? (
                    <svg
                      width="20"
                      height="20"
                      viewBox="0 0 20 20"
                      fill="none"
                      stroke="#A1A1AA"
                      strokeWidth="1.25"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M17.94 11.94A10.07 10.07 0 0 1 10 17c-5.5 0-9-7-9-7a18.45 18.45 0 0 1 5.06-5.94" />
                      <path d="M9.9 4.24A9.12 9.12 0 0 1 10 4c5.5 0 9 6 9 6a18.5 18.5 0 0 1-2.16 3.19" />
                      <line x1="1" y1="1" x2="19" y2="19" />
                    </svg>
                  ) : (
                    <svg
                      width="20"
                      height="20"
                      viewBox="0 0 20 20"
                      fill="none"
                      stroke="#A1A1AA"
                      strokeWidth="1.25"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M1 10s3.5-7 9-7 9 7 9 7-3.5 7-9 7-9-7-9-7z" />
                      <circle cx="10" cy="10" r="3" />
                    </svg>
                  )}
                </button>
              </div>
            </div>

            <button type="submit" className="btn-auth-submit" disabled={loading}>
              {loading ? 'Logging in...' : 'Login'}
            </button>

            {feedback.text && (
              <p
                className={`auth-feedback ${feedback.isSuccess ? 'success' : ''}`}
                id="login-feedback"
                aria-live="polite"
                style={
                  feedback.isRevoked
                    ? {
                        background: 'rgba(234, 179, 8, 0.15)',
                        border: '1px solid rgba(234, 179, 8, 0.4)',
                        color: '#fde047',
                        padding: '12px 16px',
                        borderRadius: '8px',
                        whiteSpace: 'pre-line',
                        fontWeight: '600'
                      }
                    : undefined
                }
              >
                {feedback.text}
              </p>
            )}
          </form>

          <p className="auth-demo-note">
            Demo accounts: regular@nexus.gg / regular123, admin@nexus.gg / admin123, superadmin@nexus.gg / super123
          </p>

          {/* Divider */}
          <div className="auth-divider">
            <span>or</span>
          </div>

          {/* Google sign-in */}
          <button className="btn-social" type="button">
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <path
                d="M18.77 10.204c0-.638-.057-1.252-.164-1.84H10v3.48h4.928a4.208 4.208 0 0 1-1.826 2.761v2.295h2.957c1.728-1.592 2.725-3.938 2.725-6.696z"
                fill="white"
                opacity="0.9"
              />
              <path
                d="M10 19c2.475 0 4.552-.82 6.069-2.22l-2.957-2.296c-.82.55-1.867.875-3.112.875-2.394 0-4.42-1.617-5.144-3.787H1.806v2.37A9.998 9.998 0 0 0 10 19z"
                fill="white"
                opacity="0.7"
              />
              <path
                d="M4.856 11.572A6.012 6.012 0 0 1 4.542 10c0-.547.094-1.08.314-1.572V6.06H1.806A9.998 9.998 0 0 0 0 10c0 1.614.386 3.14 1.806 3.94l3.05-2.368z"
                fill="white"
                opacity="0.8"
              />
              <path
                d="M10 3.958c1.35 0 2.561.464 3.514 1.375l2.635-2.635C14.548 1.19 12.474.2 10 .2A9.998 9.998 0 0 0 1.806 6.06l3.05 2.368C5.58 5.575 7.606 3.958 10 3.958z"
                fill="white"
              />
            </svg>
            Log in with Google
          </button>

          {/* Switch link */}
          <p className="auth-switch">
            Don't have an account? <Link to="/signup">Sign Up Now</Link>
          </p>
        </div>
      </div>

      {/* Footer */}
      <Footer />
    </div>
  );
}
