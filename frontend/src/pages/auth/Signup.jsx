/**
 * NEXUS ESPORTS — Signup
 *
 *
 * email / password-match validation via toast, then createAccount + an
 * auto-login.
 *
 * Deliberate change: the page left the user on the signup screen after
 * the auto-login succeeded (no redirect). Here we navigate to the role home
 * returned by login() — otherwise a successful signup would appear to hang.
 */
import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { loginUser, signupUser } from '../../store/authSlice.js';
import { ROLE_ROUTES, FALLBACK_PATH, LOGIN_PATH } from '../../routes.js';
import { showToast } from '../../lib/toast.js';
import AuthCard from './AuthCard.jsx';
import { EyeIcon, EyeOffIcon } from '../../components/icons.jsx';
import '../../styles/pages/signup.css';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
/** Same rule as the backend: 3–30 letters, numbers, underscores, dots or hyphens. */
const USERNAME_RE = /^[A-Za-z0-9_.-]{3,30}$/;

export default function Signup() {
  const session = useSelector((state) => state.auth.session);
  const dispatch = useDispatch();
  const navigate = useNavigate();

  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  // Sign-up / login in progress, from the auth slice (set by the thunks).
  const busy = useSelector((state) => state.auth.status === 'loading');

  if (session && !busy) return <Navigate to={ROLE_ROUTES[session.role] || FALLBACK_PATH} replace />;

  async function handleSubmit(event) {
    event.preventDefault();

    if (username && !USERNAME_RE.test(username.trim())) {
      showToast('Username must be 3–30 characters: letters, numbers, underscores, dots or hyphens.', 'error');
      return;
    }
    if (password && password.length < 6) {
      showToast('Password must be at least 6 characters.', 'error');
      return;
    }

    if (!username || !email || !password || !confirm) {
      showToast('Please fill all required fields.', 'error');
      return;
    }

    if (!EMAIL_RE.test(email)) {
      showToast('Please enter a valid email address (e.g. name@example.com).', 'error');
      return;
    }

    if (password !== confirm) {
      showToast('Passwords do not match!', 'error');
      return;
    }

    const errorText = (err) => (typeof err === 'string' ? err : err?.message);
    try {
      await dispatch(signupUser({ username: username.trim(), email: email.trim(), password })).unwrap();
    } catch (err) {
      showToast(errorText(err) || 'Unable to create account.', 'error');
      return;
    }

    showToast('Account created successfully! Logging you in...');

    let loginResult;
    try {
      loginResult = await dispatch(loginUser({
        username: username.trim(),
        password,
        roleRoutes: ROLE_ROUTES,
        fallbackPath: FALLBACK_PATH,
      })).unwrap();
    } catch (err) {
      showToast(errorText(err) || 'Signup succeeded but login failed. Please log in.', 'error');
      navigate(LOGIN_PATH);
      return;
    }

    navigate(loginResult.redirectPath || FALLBACK_PATH, { replace: true });
  }

  return (
    <AuthCard
      title="Create Account"
      subtitle="Join the platform to manage competitions"
      switchPrompt="Already have an account?"
      switchTo="/pages/login.html"
      switchLabel="Log In"
    >
      <form className="auth-form" id="signup-form" onSubmit={handleSubmit}>
        <div className="form-group">
          <label className="form-label" htmlFor="username">User Name</label>
          <div className="form-input-wrap">
            <input
              className="form-input"
              type="text"
              id="username"
              name="username"
              placeholder="johndoe.11"
              autoComplete="username"
              required
              value={username}
              onChange={(e) => setUsername(e.target.value)}
            />
          </div>
        </div>

        <div className="form-group">
          <label className="form-label" htmlFor="email">Email Address</label>
          <div className="form-input-wrap">
            <input
              className="form-input"
              type="email"
              id="email"
              name="email"
              placeholder="name@example.com"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
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
              autoComplete="new-password"
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

        <div className="form-group">
          <label className="form-label" htmlFor="confirm-password">Confirm Password</label>
          <div className="form-input-wrap">
            <input
              className="form-input form-input-pwd"
              type={showConfirm ? 'text' : 'password'}
              id="confirm-password"
              name="confirm-password"
              placeholder="••••••••"
              autoComplete="new-password"
              required
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
            />
            <button
              type="button"
              className="pwd-toggle"
              onClick={() => setShowConfirm((v) => !v)}
              aria-label="Toggle confirm password"
            >
              {showConfirm ? <EyeOffIcon /> : <EyeIcon />}
            </button>
          </div>
        </div>

        <button type="submit" className="btn-auth-submit" disabled={busy}>Create Account</button>
      </form>
    </AuthCard>
  );
}


