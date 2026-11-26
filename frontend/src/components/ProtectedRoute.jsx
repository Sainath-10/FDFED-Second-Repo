/**
 * NEXUS ESPORTS — ProtectedRoute
 *
 * Requires a signed-in session. Signed-out visitors go to the login page with
 * the page they wanted, so they land back on it after logging in.
 */
import { Navigate, useLocation } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { LOGIN_PATH } from '../routes.js';

export default function ProtectedRoute({ children }) {
  const location = useLocation();
  const session = useSelector((state) => state.auth.session);
  if (!session) {
    const target = `${location.pathname}${location.search}`;
    return <Navigate to={`${LOGIN_PATH}?redirect=${encodeURIComponent(target)}`} replace />;
  }
  return children;
}
