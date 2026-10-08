/**
 * NEXUS ESPORTS — ProtectedRoute
 *
 * Requires a signed-in session. Delegates the decision to the ported
 * `requireProfileAccess` so the behaviour matches the guard
 * exactly: no session -> the login path; wrong role -> the role's own home.
 *
 * Recomputed whenever the auth context session changes, so logging in/out
 * re-evaluates the guard without a full reload.
 */
import { useMemo } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { requireProfileAccess } from '../services/auth.js';
import { LOGIN_PATH, ROLE_ROUTES } from '../routes.js';

export default function ProtectedRoute({ children }) {
  const location = useLocation();
  const { session } = useAuth();

  const decision = useMemo(
    () => requireProfileAccess({ loginPath: LOGIN_PATH, roleRoutes: ROLE_ROUTES }),
    [session],
  );

  if (decision.redirectTo) {
    return <Navigate to={decision.redirectTo} replace state={{ from: location }} />;
  }

  return children;
}


