import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import NexusAuth from '../../services/authService';

function HomeIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.67" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 9.5L10 3l7 6.5V17a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9.5z" />
      <path d="M7.5 18V12h5v6" />
    </svg>
  );
}

function TrophyIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.67" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4.5 2h11l-1.5 7a5 5 0 0 1-8 0L4.5 2z" />
      <path d="M2.5 2h2m13 0h2" /><path d="M2.5 4a4 4 0 0 0 2 3.5m13-3.5a4 4 0 0 1-2 3.5" />
      <path d="M10 16v2m-3 0h6" /><path d="M10 9v7" />
    </svg>
  );
}

function ActivityIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.67" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="18 9 15 9 12 16 7 3 4 9 1 9" />
    </svg>
  );
}

function BellIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.67" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10 2a6 6 0 0 0-6 6c0 7-3 9-3 9h18s-3-2-3-9a6 6 0 0 0-6-6z" />
      <path d="M11.73 17a2 2 0 0 1-3.46 0" />
    </svg>
  );
}

function ProfileIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.67" strokeLinecap="round" strokeLinejoin="round">
      <path d="M13.33 6.67a3.33 3.33 0 1 1-6.67 0 3.33 3.33 0 0 1 6.67 0z" />
      <path d="M2 17.5c0-3.5 3.58-5.83 8-5.83s8 2.33 8 5.83" />
    </svg>
  );
}

function InfoIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.67" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="10" cy="10" r="8.33" />
      <line x1="10" y1="14" x2="10" y2="10" />
      <line x1="10" y1="6.67" x2="10.01" y2="6.67" />
    </svg>
  );
}

function ShieldIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.67" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10 2L3 5v5c0 4.5 3 8.5 7 9.5 4-1 7-5 7-9.5V5L10 2z" />
    </svg>
  );
}

function CheckCircleIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.67" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="10" cy="10" r="8" /><path d="M6.5 10l2.5 2.5 5-5" />
    </svg>
  );
}

function UsersIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.67" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 15v-1a4 4 0 0 0-4-4H4a4 4 0 0 0-4 4v1" />
      <circle cx="7" cy="5" r="3" />
      <path d="M20 15v-1a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

function MoneyIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.67" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="5" width="16" height="10" rx="2" />
      <circle cx="10" cy="10" r="2" />
      <path d="M5 8v4M15 8v4" />
    </svg>
  );
}

export default function Sidebar({ variant, activePage }) {
  const location = useLocation();
  const [session, setSession] = useState(null);

  useEffect(() => {
    setSession(NexusAuth.getSession());
  }, [location.pathname]);

  const pathname = location.pathname.toLowerCase();

  // Determine sidebar type: 'super-admin' | 'admin' | 'team' | 'player'
  let sidebarType = variant;
  if (!sidebarType) {
    if (pathname.startsWith('/super-admin')) {
      sidebarType = 'super-admin';
    } else if (pathname.startsWith('/admin')) {
      sidebarType = 'admin';
    } else if (pathname.startsWith('/team')) {
      sidebarType = 'team';
    } else {
      sidebarType = 'player';
    }
  }

  // Brand Logo Target Link
  let logoHref = '/';
  if (sidebarType === 'super-admin') {
    logoHref = '/super-admin/super-dashboard';
  } else if (sidebarType === 'admin') {
    const adminType = String((session && (session.adminType || session.role)) || '').trim().toLowerCase();
    if (adminType === 'dispute_admin') logoHref = '/admin/disputes';
    else if (adminType === 'revenue_admin') logoHref = '/admin/revenue-transactions';
    else logoHref = '/admin/dashboard';
  }

  // 1. SUPER ADMIN SIDEBAR
  if (sidebarType === 'super-admin') {
    const items = [
      { id: 'dashboard', label: 'Dashboard', href: '/super-admin/super-dashboard', icon: <HomeIcon /> },
      { id: 'policy', label: 'Policy', href: '/super-admin/policy-management', icon: <CheckCircleIcon /> },
      { id: 'users', label: 'Users', href: '/super-admin/users', icon: <UsersIcon /> },
      { id: 'admins', label: 'Admins', href: '/super-admin/admins', icon: <ShieldIcon /> },
      { id: 'profile', label: 'Profile', href: '/super-admin/profile', icon: <ProfileIcon /> },
    ];

    const currentActive = activePage || (
      pathname.includes('super-dashboard') ? 'dashboard' :
      pathname.includes('policy') ? 'policy' :
      pathname.includes('users') ? 'users' :
      pathname.includes('admins') || pathname.includes('add-admin') || pathname.includes('revoke-admin') ? 'admins' :
      pathname.includes('profile') ? 'profile' : ''
    );

    const topItems = items.slice(0, 4);
    const bottomItems = items.slice(4);

    return (
      <aside className="sidebar">
        <div className="sidebar-logo">
          <Link to={logoHref} style={{ display: 'contents', textDecoration: 'none', color: 'inherit' }}>
            <img src="/assets/f03e2b11537e425d8544ee3ca732bf73af5137c0.png" alt="Nexus Logo" />
            <div className="logo-title">NEXUS</div>
            <div className="logo-sub">ESPORTS</div>
          </Link>
        </div>
        <nav className="sidebar-nav">
          {topItems.map(item => (
            <Link
              key={item.id}
              to={item.href}
              className={`nav-item ${currentActive === item.id ? 'active' : ''}`}
            >
              {item.icon}
              <span>{item.label}</span>
            </Link>
          ))}
        </nav>
        <div className="sidebar-nav-bottom">
          {bottomItems.map(item => (
            <Link
              key={item.id}
              to={item.href}
              className={`nav-item ${currentActive === item.id ? 'active' : ''}`}
            >
              {item.icon}
              <span>{item.label}</span>
            </Link>
          ))}
        </div>
      </aside>
    );
  }

  // 2. ADMIN SIDEBAR (comp_admin, dispute_admin, revenue_admin)
  if (sidebarType === 'admin') {
    let normType = String((session && (session.adminType || session.role)) || '').trim().toLowerCase();
    if (normType === 'admin') normType = 'comp_admin';

    let items = [];
    if (normType === 'comp_admin') {
      items = [
        { id: 'home', label: 'Comp Dashboard', href: '/admin/dashboard', icon: <HomeIcon /> },
        { id: 'users', label: 'Users', href: '/admin/users', icon: <UsersIcon /> },
        { id: 'activity', label: 'Activity', href: '/admin/admin-activity', icon: <CheckCircleIcon /> },
        { id: 'profile', label: 'Profile', href: '/admin/admin-profile', icon: <ProfileIcon /> },
      ];
    } else if (normType === 'dispute_admin') {
      items = [
        { id: 'disputes', label: 'Dispute Dashboard', href: '/admin/disputes', icon: <ShieldIcon /> },
        { id: 'users', label: 'Users', href: '/admin/users', icon: <UsersIcon /> },
        { id: 'activity', label: 'Activity', href: '/admin/admin-activity', icon: <CheckCircleIcon /> },
        { id: 'profile', label: 'Profile', href: '/admin/admin-profile', icon: <ProfileIcon /> },
      ];
    } else if (normType === 'revenue_admin') {
      items = [
        { id: 'revenue', label: 'Revenue Dashboard', href: '/admin/revenue-transactions', icon: <MoneyIcon /> },
        { id: 'users', label: 'Users', href: '/admin/users', icon: <UsersIcon /> },
        { id: 'activity', label: 'Activity', href: '/admin/admin-activity', icon: <CheckCircleIcon /> },
        { id: 'profile', label: 'Profile', href: '/admin/admin-profile', icon: <ProfileIcon /> },
      ];
    } else {
      // Fallback
      items = [
        { id: 'home', label: 'Comp Dashboard', href: '/admin/dashboard', icon: <HomeIcon /> },
        { id: 'disputes', label: 'Disputes', href: '/admin/disputes', icon: <ShieldIcon /> },
        { id: 'revenue', label: 'Revenue', href: '/admin/revenue-transactions', icon: <MoneyIcon /> },
        { id: 'users', label: 'Users', href: '/admin/users', icon: <UsersIcon /> },
        { id: 'activity', label: 'Activity', href: '/admin/admin-activity', icon: <CheckCircleIcon /> },
        { id: 'profile', label: 'Profile', href: '/admin/admin-profile', icon: <ProfileIcon /> },
      ];
    }

    const currentActive = activePage || (
      pathname.includes('/admin/dashboard') || pathname.includes('competition-detail') || pathname.includes('manage-teams') || pathname.includes('manage-matches') || pathname.includes('match-results') || pathname.includes('view-standings') || pathname.includes('edit-competition') ? (normType === 'comp_admin' ? 'home' : '') :
      pathname.includes('/admin/disputes') || pathname.includes('dispute-review') ? 'disputes' :
      pathname.includes('revenue') ? 'revenue' :
      pathname.includes('users') ? 'users' :
      pathname.includes('admin-activity') ? 'activity' :
      pathname.includes('admin-profile') ? 'profile' : ''
    );

    const splitIdx = items.length > 4 ? 4 : 2;
    const topItems = items.slice(0, splitIdx);
    const bottomItems = items.slice(splitIdx);

    return (
      <aside className="sidebar">
        <div className="sidebar-logo">
          <Link to={logoHref} style={{ display: 'contents', textDecoration: 'none', color: 'inherit' }}>
            <img src="/assets/f03e2b11537e425d8544ee3ca732bf73af5137c0.png" alt="Nexus Logo" />
            <div className="logo-title">NEXUS</div>
            <div className="logo-sub">ESPORTS</div>
          </Link>
        </div>
        <nav className="sidebar-nav">
          {topItems.map(item => (
            <Link
              key={item.id}
              to={item.href}
              className={`nav-item ${currentActive === item.id ? 'active' : ''}`}
            >
              {item.icon}
              <span>{item.label}</span>
            </Link>
          ))}
        </nav>
        <div className="sidebar-nav-bottom">
          {bottomItems.map(item => (
            <Link
              key={item.id}
              to={item.href}
              className={`nav-item ${currentActive === item.id ? 'active' : ''}`}
            >
              {item.icon}
              <span>{item.label}</span>
            </Link>
          ))}
        </div>
      </aside>
    );
  }

  // 3. TEAM SIDEBAR (Team Pages)
  if (sidebarType === 'team') {
    const items = [
      { id: 'home', label: 'Home', href: '/', icon: <HomeIcon /> },
      { id: 'competitions', label: 'Competitions', href: '/competitions', icon: <TrophyIcon /> },
      { id: 'activity', label: 'Activity', href: '/my-activity', icon: <ActivityIcon /> },
      { id: 'notifications', label: 'Notifications', href: '/notifications', icon: <BellIcon /> },
      { id: 'profile', label: 'Profile', href: '/profile', icon: <ProfileIcon /> },
      { id: 'about', label: 'About', href: '/about', icon: <InfoIcon /> },
    ];

    const currentActive = activePage || (
      pathname === '/' ? 'home' :
      pathname.includes('competitions') ? 'competitions' :
      pathname.includes('my-activity') ? 'activity' :
      pathname.includes('notifications') ? 'notifications' :
      pathname.includes('profile') ? 'profile' :
      pathname.includes('about') ? 'about' : ''
    );

    const topItems = items.slice(0, 4);
    const bottomItems = items.slice(4);

    return (
      <aside className="sidebar">
        <div className="sidebar-logo">
          <Link to="/" style={{ display: 'contents', textDecoration: 'none', color: 'inherit' }}>
            <img src="/assets/f03e2b11537e425d8544ee3ca732bf73af5137c0.png" alt="Nexus Logo" />
            <div className="logo-title">NEXUS</div>
            <div className="logo-sub">ESPORTS</div>
          </Link>
        </div>
        <nav className="sidebar-nav">
          {topItems.map(item => (
            <Link
              key={item.id}
              to={item.href}
              className={`nav-item ${currentActive === item.id ? 'active' : ''}`}
              id={item.id === 'notifications' ? 'nav-notif-item' : undefined}
            >
              {item.icon}
              <span>{item.label}</span>
            </Link>
          ))}
        </nav>
        <div className="sidebar-nav-bottom">
          {bottomItems.map(item => (
            <Link
              key={item.id}
              to={item.href}
              className={`nav-item ${currentActive === item.id ? 'active' : ''}`}
            >
              {item.icon}
              <span>{item.label}</span>
            </Link>
          ))}
        </div>
      </aside>
    );
  }

  // 4. PLAYER / GENERAL SIDEBAR (Default)
  const items = [
    { id: 'home', label: 'Home', href: '/', icon: <HomeIcon /> },
    { id: 'competitions', label: 'Competitions', href: '/competitions', icon: <TrophyIcon /> },
    { id: 'activity', label: 'Activity', href: '/my-activity', icon: <ActivityIcon />, protected: true },
    { id: 'notifications', label: 'Notifications', href: '/notifications', icon: <BellIcon />, protected: true },
    { id: 'profile', label: 'Profile', href: '/profile', icon: <ProfileIcon />, protected: true },
    { id: 'about', label: 'About', href: '/about', icon: <InfoIcon /> },
  ];

  const visibleItems = session ? items : items.filter(i => !i.protected);
  const currentActive = activePage || (
    pathname === '/' ? 'home' :
    pathname.includes('competitions') ? 'competitions' :
    pathname.includes('my-activity') ? 'activity' :
    pathname.includes('notifications') ? 'notifications' :
    pathname.includes('profile') ? 'profile' :
    pathname.includes('about') ? 'about' : ''
  );

  const topItems = visibleItems.filter(i => items.indexOf(i) < 4);
  const bottomItems = visibleItems.filter(i => items.indexOf(i) >= 4);

  return (
    <aside className="sidebar">
      <div className="sidebar-logo">
        <Link to="/" style={{ display: 'contents', textDecoration: 'none', color: 'inherit' }}>
          <img src="/assets/f03e2b11537e425d8544ee3ca732bf73af5137c0.png" alt="Nexus Logo" />
          <div className="logo-title">NEXUS</div>
          <div className="logo-sub">ESPORTS</div>
        </Link>
      </div>
      <nav className="sidebar-nav">
        {topItems.map(item => (
          <Link
            key={item.id}
            to={item.href}
            className={`nav-item ${currentActive === item.id ? 'active' : ''}`}
            id={item.id === 'notifications' ? 'nav-notif-item' : undefined}
          >
            {item.icon}
            <span>{item.label}</span>
          </Link>
        ))}
      </nav>
      <div className="sidebar-nav-bottom">
        {bottomItems.map(item => (
          <Link
            key={item.id}
            to={item.href}
            className={`nav-item ${currentActive === item.id ? 'active' : ''}`}
          >
            {item.icon}
            <span>{item.label}</span>
          </Link>
        ))}
        {!session && (
          <Link
            to="/login"
            className="nav-item"
            style={{ marginTop: 12, background: 'rgba(198,255,51,0.08)', borderRadius: 8 }}
          >
            <svg viewBox="0 0 20 20" fill="none" stroke="#c6ff33" strokeWidth="1.67" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12.5 12.5L15.83 9.17 12.5 5.83M15.83 9.17H6.67M10 15.83H4.17a1.67 1.67 0 0 1-1.67-1.66V4.17a1.67 1.67 0 0 1 1.67-1.67H10" />
            </svg>
            <span style={{ color: '#c6ff33' }}>Login</span>
          </Link>
        )}
      </div>
    </aside>
  );
}
