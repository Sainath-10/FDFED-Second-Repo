/**
 * NEXUS ESPORTS — Login
 *
 *
 * same role-based redirect (ROLE_ROUTES), and the same revoked-admin notice.
 */
import { useState } from 'react';
import { Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import * as AuthService from '../../services/auth.js';
import { setSession } from '../../store/authSlice.js';
import { ROLE_ROUTES, FALLBACK_PATH } from '../../routes.js';
import AuthCard from './AuthCard.jsx';
import { EyeIcon, EyeOffIcon } from '../../components/icons.jsx';
import '../../styles/pages/login.css';

const REVOKED_STYLE = {
  background: 'rgba(234, 179, 8, 0.15)',
  border: '1px solid rgba(234, 179, 8, 0.4)',
  color: '#fde047',
  padding: '12px 16px',
  borderRadius: 8,
  whiteSpace: 'pre-line',
  fontWeight: 600,
};

/** Only same-site paths are honoured, so a crafted link cannot send users elsewhere. */
function safeRedirect(value) {
  const v = String(value || '');
  return v.startsWith('/') && !v.startsWith('//') ? v : '';
}

export default function Login() {
  const session = useSelector((state) => state.auth.session);
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const redirect = safeRedirect(params.get('redirect'));

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState(null);

  if (session && !feedback) {
    return <Navigate to={redirect || ROLE_ROUTES[session.role] || FALLBACK_PATH} replace />;
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (!username || !password) {
      setFeedback({ text: 'Please enter both username and password.', success: false });
      return;
    }

    setBusy(true);
    setFeedback({ text: 'Logging in...', success: true });

    const result = await AuthService.login({
      username,
      password,
      roleRoutes: ROLE_ROUTES,
      fallbackPath: FALLBACK_PATH,
    });
    // Put the logged-in user into the Redux store.
    if (result.ok) dispatch(setSession(result.user));

    setBusy(false);

    if (!result.ok) {
      setFeedback({ text: result.error || 'Login failed. Please try again.', success: false });
      return;
    }

    if (result.revokedReason) {
      setFeedback({
        text: `⚠️ Notice: Your administrator status was revoked by Super Admin.\nReason: "${result.revokedReason}"\nRedirecting to standard participant dashboard...`,
        success: false,
        revoked: true,
      });
      setTimeout(() => navigate(redirect || result.redirectPath || '/pages/profile.html'), 4000);
      return;
    }

    setFeedback({ text: 'Login successful. Redirecting...', success: true });
    navigate(redirect || result.redirectPath || FALLBACK_PATH, { replace: true });
  }

  return (
    <AuthCard
      title="Login"
      subtitle="Enter your credentials to access the arena"
      switchPrompt="Don't have an account?"
      switchTo="/pages/signup.html"
      switchLabel="Sign Up Now"
    >
      <form className="auth-form" id="login-form" onSubmit={handleSubmit}>
        <div className="form-group">
          <label className="form-label" htmlFor="username">Username</label>
          <div className="form-input-wrap">
            <input
              className="form-input"
              type="text"
              id="username"
              name="username"
              placeholder="Username or email"
              autoComplete="username"
              required
              value={username}
              onChange={(e) => setUsername(e.target.value)}
            />
          </div>
        </div>

        <div className="form-group">
          <label className="form-label" htmlFor="password">Password</label>
          <div className="form-input-wrap">
            <input
              className="form-input form-input-pwd"
              type={showPwd ? 'text' : 'password'}
              id="password"
              name="password"
              placeholder="••••••••"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <button
              type="button"
              className="pwd-toggle"
              onClick={() => setShowPwd((v) => !v)}
              aria-label="Toggle password"
            >
              {showPwd ? <EyeOffIcon /> : <EyeIcon />}
            </button>
          </div>
        </div>

        <button type="submit" className="btn-auth-submit" disabled={busy}>Login</button>

        {feedback && (
          <p
            className={`auth-feedback${feedback.success ? ' success' : ''}`}
            id="login-feedback"
            aria-live="polite"
            style={feedback.revoked ? REVOKED_STYLE : undefined}
          >
            {feedback.text}
          </p>
        )}
      </form>

    </AuthCard>
  );
}


