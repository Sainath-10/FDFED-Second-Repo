import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Header from '../components/Layout/Header';
import Footer from '../components/Layout/Footer';
import { showToast } from '../components/Common/Toast';
import NexusAuth from '../services/authService';
import '../styles/pages/signup.css';

const roleRoutes = {
  regular: '/profile',
  participant: '/profile',
  team_lead: '/team-lead-dashboard',
  admin: '/admin/admin-profile',
  'super-admin': '/super-admin/profile',
  super_admin: '/super-admin/profile'
};

export default function SignupPage() {
  const navigate = useNavigate();

  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();

    const u = username.trim();
    const em = email.trim();
    const p = password;
    const cp = confirmPassword;

    if (!u || !em || !p || !cp) {
      showToast('Please fill all required fields.', 'error');
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
    if (!emailRegex.test(em)) {
      showToast('Please enter a valid email address (e.g. name@example.com).', 'error');
      return;
    }

    if (p !== cp) {
      showToast('Passwords do not match!', 'error');
      return;
    }

    setLoading(true);

    try {
      const result = await NexusAuth.createAccount({
        username: u,
        email: em,
        password: p,
        displayName: u,
        role: 'participant'
      });

      if (!result.ok) {
        showToast(result.error || 'Unable to create account.', 'error');
        setLoading(false);
        return;
      }

      showToast('Account created successfully! Logging you in...', 'success');

      const loginResult = await NexusAuth.login({
        username: u,
        password: p,
        roleRoutes: roleRoutes,
        fallbackPath: '/profile'
      });

      if (!loginResult.ok) {
        showToast(loginResult.error || 'Signup succeeded but login failed. Please log in.', 'error');
        navigate('/login');
        return;
      }

      setTimeout(() => {
        navigate(loginResult.redirectPath || '/profile');
      }, 400);
    } catch (err) {
      showToast(err.message || 'An error occurred during sign up.', 'error');
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
            <h1>Create Account</h1>
            <p>Join the platform to manage competitions</p>
          </div>

          {/* Form */}
          <form className="auth-form" id="signup-form" onSubmit={handleSubmit}>
            <div className="form-group">
              <label className="form-label" htmlFor="username">
                User Name
              </label>
              <div className="form-input-wrap">
                <input
                  className="form-input"
                  type="text"
                  id="username"
                  name="username"
                  placeholder="johndoe.11"
                  autoComplete="username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="email">
                Email Address
              </label>
              <div className="form-input-wrap">
                <input
                  className="form-input"
                  type="email"
                  id="email"
                  name="email"
                  placeholder="name@example.com"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
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
                  autoComplete="new-password"
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

            <div className="form-group">
              <label className="form-label" htmlFor="confirm-password">
                Confirm Password
              </label>
              <div className="form-input-wrap">
                <input
                  className="form-input form-input-pwd"
                  type={showConfirmPassword ? 'text' : 'password'}
                  id="confirm-password"
                  name="confirm-password"
                  placeholder="••••••••"
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                />
                <button
                  type="button"
                  className="pwd-toggle"
                  onClick={() => setShowConfirmPassword((prev) => !prev)}
                  aria-label="Toggle confirm password"
                >
                  {showConfirmPassword ? (
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
              {loading ? 'Creating Account...' : 'Create Account'}
            </button>
          </form>

          {/* Divider */}
          <div className="auth-divider">
            <span>or</span>
          </div>

          {/* Google sign-up */}
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
            Sign up with Google
          </button>

          {/* Switch link */}
          <p className="auth-switch">
            Already have an account? <Link to="/login">Log In</Link>
          </p>
        </div>
      </div>

      {/* Footer */}
      <Footer />
    </div>
  );
}
