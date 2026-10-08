/**
 * NEXUS ESPORTS — RoutePlaceholder
 *
 * Fallback renderer for routes that have no page component registered yet
 * (src/pages/registry.js). Useful while new routes are being added.
 */
export default function RoutePlaceholder({ route }) {
  return (
    <div style={{ padding: '48px 32px', maxWidth: 720 }}>
      <p style={{ margin: 0, color: '#c6ff33', fontWeight: 700, letterSpacing: 1, fontSize: 13 }}>
        ROUTE WIRED — UI PENDING
      </p>
      <h1 style={{ margin: '8px 0' }}>{route.label}</h1>
      <code style={{ color: 'rgba(255,255,255,0.75)' }}>{route.path}</code>
      <p style={{ margin: '12px 0 0', color: 'rgba(255,255,255,0.6)', fontSize: 13 }}>
        group: {route.group}
        {route.roles ? ` · roles: ${route.roles.join(', ')}` : ''}
      </p>
      <p style={{ margin: '8px 0 0', color: 'rgba(255,255,255,0.5)', fontSize: 12 }}>
        This route is registered, but no page component is registered for it yet
        (see src/pages/registry.js).
      </p>
    </div>
  );
}


