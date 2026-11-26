/**
 * NEXUS ESPORTS — App
 *
 * Routes are declared in src/routes.js and resolved through src/pages/registry.js,
 * then wrapped in the shared chrome.
 *
 * Wrapping order:
 * auth pages -> AuthLayout (back header + footer, no sidebar)
 * landing ('/') -> AppLayout without the content offset
 * other public -> AppLayout
 * everything else -> ProtectedRoute -> RoleGuard -> AppLayout -> page
 *
 * Routes without a registry entry render RoutePlaceholder.
 */
import { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { refreshSession } from './store/authSlice.js';
import ProtectedRoute from './components/ProtectedRoute.jsx';
import RoleGuard from './components/RoleGuard.jsx';
import RoutePlaceholder from './components/RoutePlaceholder.jsx';
import NotFound from './components/NotFound.jsx';
import ScrollToTop from './components/ScrollToTop.jsx';
import Toaster from './components/Toaster.jsx';
import AppLayout from './layouts/AppLayout.jsx';
import AuthLayout from './layouts/AuthLayout.jsx';
import { PAGE_COMPONENTS } from './pages/registry.js';
import { ROUTES } from './routes.js';

/** Only the landing page is full-bleed; every other page shares the same sidebar, frame and footer. */
const FULL_WIDTH_PATHS = new Set(['/']);
const AUTH_PATHS = new Set(['/pages/login.html', '/pages/signup.html']);

function renderRoute(route) {
  const Component = PAGE_COMPONENTS[route.path];
  const page = Component ? <Component /> : <RoutePlaceholder route={route} />;

  const isFull = FULL_WIDTH_PATHS.has(route.path);

  let shell;
  if (AUTH_PATHS.has(route.path)) shell = <AuthLayout>{page}</AuthLayout>;
  else shell = (
    <AppLayout offset={!isFull}>
      {page}
    </AppLayout>
  );

  if (route.group === 'public') {
    return shell;
  }

  return (
    <ProtectedRoute>
      <RoleGuard roles={route.roles}>{shell}</RoleGuard>
    </ProtectedRoute>
  );
}

export default function App() {
  const session = useSelector((state) => state.auth.session);
  const dispatch = useDispatch();
  const isLoggedIn = !!session;

  // While logged in, re-read the account from the server on load and whenever the
  // tab regains focus, so a role change or ban made elsewhere shows up straight away.
  useEffect(() => {
    if (!isLoggedIn) return undefined;
    const refresh = () => dispatch(refreshSession());
    refresh();
    window.addEventListener('focus', refresh);
    return () => window.removeEventListener('focus', refresh);
  }, [isLoggedIn, dispatch]);

  return (
    <BrowserRouter>
      <ScrollToTop />
      <Routes>
        {ROUTES.map((route) => (
          <Route key={route.path} path={route.path} element={renderRoute(route)} />
        ))}
        <Route path="/index.html" element={<Navigate to="/" replace />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
      <Toaster />
    </BrowserRouter>
  );
}


