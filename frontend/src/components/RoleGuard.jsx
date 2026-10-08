/**
 * NEXUS ESPORTS — RoleGuard
 *
 * Generalized (array-capable) form of the role check. If a session's
 * role is not in `roles`, it redirects to that role's own home — the same
 * behaviour `requireProfileAccess` uses for a single `pageRole`. Renders inside
 * ProtectedRoute, so the "no session" case is already handled there.
 */
import { useMemo } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { FALLBACK_PATH, ROLE_ROUTES } from '../routes.js';

export default function RoleGuard({ roles, children }) {
  const { session } = useAuth();

  const redirectTo = useMemo(() => {
    if (!roles || roles.length === 0) return null;
    if (!session) return null; // ProtectedRoute owns the unauthenticated case
    if (roles.includes(session.role)) return null;
    return ROLE_ROUTES[session.role] || FALLBACK_PATH;
  }, [session, roles]);

  if (redirectTo) {
    return <Navigate to={redirectTo} replace />;
  }

  return children;
}


