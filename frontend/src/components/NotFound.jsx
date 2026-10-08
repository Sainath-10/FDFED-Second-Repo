/**
 * NEXUS ESPORTS — NotFound
 *
 * 404 fallback for unmatched routes.
 */
import { Link } from 'react-router-dom';
import { FALLBACK_PATH } from '../routes.js';

export default function NotFound() {
  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 12,
        background: '#0b0b0b',
        color: '#fff',
        fontFamily: 'Lato, sans-serif',
        textAlign: 'center',
        padding: 24,
      }}
    >
      <h1 style={{ margin: 0, letterSpacing: 2 }}>404</h1>
      <p style={{ margin: 0, color: 'rgba(255,255,255,0.6)' }}>This page does not exist.</p>
      <Link to={FALLBACK_PATH} style={{ color: '#c6ff33', fontWeight: 700 }}>
        Back to home
      </Link>
    </div>
  );
}


