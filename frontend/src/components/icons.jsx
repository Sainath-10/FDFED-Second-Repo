/**
 * NEXUS ESPORTS — shared icons
 *
 * Faithful JSX ports of the SVG helpers in frontend/js/script.js. Markup and
 * attributes are preserved so the stylesheet (.nav-item svg, etc.) keeps
 * styling them identically.
 */

export const HomeIcon = () => (
  <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.67" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 9.5L10 3l7 6.5V17a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9.5z" />
    <path d="M7.5 18V12h5v6" />
  </svg>
);

export const TrophyIcon = () => (
  <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.67" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4.5 2h11l-1.5 7a5 5 0 0 1-8 0L4.5 2z" />
    <path d="M2.5 2h2m13 0h2" />
    <path d="M2.5 4a4 4 0 0 0 2 3.5m13-3.5a4 4 0 0 1-2 3.5" />
    <path d="M10 16v2m-3 0h6" />
    <path d="M10 9v7" />
  </svg>
);

export const ActivityIcon = () => (
  <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.67" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="18 9 15 9 12 16 7 3 4 9 1 9" />
  </svg>
);

export const ProfileIcon = () => (
  <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.67" strokeLinecap="round" strokeLinejoin="round">
    <path d="M13.33 6.67a3.33 3.33 0 1 1-6.67 0 3.33 3.33 0 0 1 6.67 0z" />
    <path d="M2 17.5c0-3.5 3.58-5.83 8-5.83s8 2.33 8 5.83" />
  </svg>
);

export const InfoIcon = () => (
  <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.67" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="10" cy="10" r="8.33" />
    <line x1="10" y1="14" x2="10" y2="10" />
    <line x1="10" y1="6.67" x2="10.01" y2="6.67" />
  </svg>
);

export const BellIcon = () => (
  <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.67" strokeLinecap="round" strokeLinejoin="round">
    <path d="M10 2a6 6 0 0 0-6 6c0 7-3 9-3 9h18s-3-2-3-9a6 6 0 0 0-6-6z" />
    <path d="M11.73 17a2 2 0 0 1-3.46 0" />
  </svg>
);

export const ShieldIcon = () => (
  <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.67" strokeLinecap="round" strokeLinejoin="round">
    <path d="M10 2L3 5v5c0 4.5 3 8.5 7 9.5 4-1 7-5 7-9.5V5L10 2z" />
  </svg>
);

export const CheckCircleIcon = () => (
  <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.67" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="10" cy="10" r="8" />
    <path d="M6.5 10l2.5 2.5 5-5" />
  </svg>
);

export const UsersIcon = () => (
  <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.67" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 15v-1a4 4 0 0 0-4-4H4a4 4 0 0 0-4 4v1" />
    <circle cx="7" cy="5" r="3" />
    <path d="M20 15v-1a4 4 0 0 0-3-3.87" />
    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
  </svg>
);

export const MoneyIcon = () => (
  <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.67" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="5" width="16" height="10" rx="2" />
    <circle cx="10" cy="10" r="2" />
    <path d="M5 8v4M15 8v4" />
  </svg>
);

export const LoginIcon = () => (
  <svg viewBox="0 0 20 20" fill="none" stroke="#c6ff33" strokeWidth="1.67" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12.5 12.5L15.83 9.17 12.5 5.83M15.83 9.17H6.67M10 15.83H4.17a1.67 1.67 0 0 1-1.67-1.66V4.17a1.67 1.67 0 0 1 1.67-1.67H10" />
  </svg>
);

export const EyeIcon = () => (
  <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="#A1A1AA" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round">
    <path d="M1 10s3.5-7 9-7 9 7 9 7-3.5 7-9 7-9-7-9-7z" />
    <circle cx="10" cy="10" r="3" />
  </svg>
);

export const EyeOffIcon = () => (
  <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="#A1A1AA" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17.94 11.94A10.07 10.07 0 0 1 10 17c-5.5 0-9-7-9-7a18.45 18.45 0 0 1 5.06-5.94" />
    <path d="M9.9 4.24A9.12 9.12 0 0 1 10 4c5.5 0 9 6 9 6a18.5 18.5 0 0 1-2.16 3.19" />
    <line x1="1" y1="1" x2="19" y2="19" />
  </svg>
);


