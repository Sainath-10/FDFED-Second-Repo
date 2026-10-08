/**
 * NEXUS ESPORTS — App
 *
 * Routes are declared in src/routes.js and resolved through src/pages/registry.js,
 * then wrapped in the shared chrome.
 *
 * Wrapping order:
 * auth pages -> AuthLayout (back header + footer, no sidebar)
 * landing ('/') -> bare
 * other public -> AppLayout
 * everything else -> ProtectedRoute -> RoleGuard -> AppLayout -> page
 *
 * Routes without a registry entry render RoutePlaceholder.
 */
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext.jsx';
import ProtectedRoute from './components/ProtectedRoute.jsx';
import RoleGuard from './components/RoleGuard.jsx';
import RoutePlaceholder from './components/RoutePlaceholder.jsx';
import NotFound from './components/NotFound.jsx';
import ScrollToTop from './components/ScrollToTop.jsx';
import AppLayout from './layouts/AppLayout.jsx';
import AuthLayout from './layouts/AuthLayout.jsx';
import { PAGE_COMPONENTS } from './pages/registry.js';
import { ROUTES } from './routes.js';

/** Routes whose page is full-bleed (no `.page-with-sidebar` wrapper). */
const FULL_WIDTH_PATHS = new Set(['/']);
/** Full-bleed pages that keep a plain `#footer-mount` (super-admin-style layout). */
const BARE_PATHS = new Set([
  '/pages/team-lead-dashboard.html',
  '/pages/admin/users.html',
  '/pages/super-admin/super-dashboard.html',
  '/pages/super-admin/users.html',
  '/pages/super-admin/admins.html',
  '/pages/super-admin/add-admin.html',
  '/pages/super-admin/revoke-admin.html',
  '/pages/super-admin/policy-management.html',
  '/pages/super-admin/create-policy.html',
  '/pages/super-admin/edit-policy.html',
  '/pages/super-admin/view-policy.html',
  '/pages/super-admin/profile.html',
]);
const AUTH_PATHS = new Set(['/pages/login.html', '/pages/signup.html']);

function renderRoute(route) {
  const Component = PAGE_COMPONENTS[route.path];
  const page = Component ? <Component /> : <RoutePlaceholder route={route} />;

  const isBare = BARE_PATHS.has(route.path);
  const isFull = FULL_WIDTH_PATHS.has(route.path) || isBare;

  let shell;
  if (AUTH_PATHS.has(route.path)) shell = <AuthLayout>{page}</AuthLayout>;
  else shell = (
    <AppLayout offset={!isFull} footerClassName={isBare ? '' : undefined}>
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
  return (
    <BrowserRouter>
      <AuthProvider>
        <ScrollToTop />
        <Routes>
          {ROUTES.map((route) => (
            <Route key={route.path} path={route.path} element={renderRoute(route)} />
          ))}
          <Route path="/index.html" element={<Navigate to="/" replace />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}


