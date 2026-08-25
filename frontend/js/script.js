/**
 * NEXUS ESPORTS — script.js
 * Shared interactive logic + HTML partials for all pages.
 */

// ─────────────────────────────────────────────────
// SHARED HTML PARTIALS
// ─────────────────────────────────────────────────

/**
 * Returns the sidebar HTML.
 * @param {string} activePage  – 'home' | 'competitions' | 'activity' | 'notifications' | 'profile' | 'about'
 */
function getSidebar(activePage, base = '../') {
  const session = localStorage.getItem('nexus.auth.session');

  const items = [
    { id: 'home', label: 'Home', href: base + 'index.html', icon: homeIcon() },
    { id: 'competitions', label: 'Competitions', href: base + 'pages/competitions.html', icon: trophyIcon() },
    { id: 'activity', label: 'Activity', href: base + 'pages/my-activity.html', icon: activityIcon(), protected: true },
    { id: 'notifications', label: 'Notifications', href: base + 'pages/notifications.html', icon: bellIcon(), protected: true },
    { id: 'profile', label: 'Profile', href: base + 'pages/profile.html', icon: profileIcon(), protected: true },
    { id: 'about', label: 'About', href: base + 'pages/about.html', icon: infoIcon() },
  ];

  const visibleItems = session ? items : items.filter(i => !i.protected);

  const navTop = visibleItems.filter(i => items.indexOf(i) < 4).map(item => `
    <a href="${item.href}" class="nav-item ${activePage === item.id ? 'active' : ''}" ${item.id === 'notifications' ? 'id="nav-notif-item"' : ''}>
      ${item.icon}
      <span>${item.label}</span>
    </a>`).join('');

  const navBottom = visibleItems.filter(i => items.indexOf(i) >= 4).map(item => `
    <a href="${item.href}" class="nav-item ${activePage === item.id ? 'active' : ''}">
      ${item.icon}
      <span>${item.label}</span>
    </a>`).join('');

  return `
  <aside class="sidebar">
    <div class="sidebar-logo">
      <img src="${base}assets/f03e2b11537e425d8544ee3ca732bf73af5137c0.png" alt="Nexus Logo">
      <div class="logo-title">NEXUS</div>
      <div class="logo-sub">ESPORTS</div>
    </div>
    <nav class="sidebar-nav">
      ${navTop}
    </nav>
    <div class="sidebar-nav-bottom">
      ${navBottom}
      ${!session ? `
        <a href="${base}pages/login.html" class="nav-item" style="margin-top: 12px; background: rgba(198,255,51,0.08); border-radius: 8px;">
          <svg viewBox="0 0 20 20" fill="none" stroke="#c6ff33" stroke-width="1.67" stroke-linecap="round" stroke-linejoin="round">
            <path d="M12.5 12.5L15.83 9.17 12.5 5.83M15.83 9.17H6.67M10 15.83H4.17a1.67 1.67 0 0 1-1.67-1.66V4.17a1.67 1.67 0 0 1 1.67-1.67H10"/>
          </svg>
          <span style="color: #c6ff33;">Login</span>
        </a>
      ` : ''}
    </div>
  </aside>`;
}

function homeIcon() {
  return `<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.67" stroke-linecap="round" stroke-linejoin="round">
    <path d="M3 9.5L10 3l7 6.5V17a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9.5z"/>
    <path d="M7.5 18V12h5v6"/>
  </svg>`;
}

function trophyIcon() {
  return `<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.67" stroke-linecap="round" stroke-linejoin="round">
    <path d="M4.5 2h11l-1.5 7a5 5 0 0 1-8 0L4.5 2z"/>
    <path d="M2.5 2h2m13 0h2"/><path d="M2.5 4a4 4 0 0 0 2 3.5m13-3.5a4 4 0 0 1-2 3.5"/>
    <path d="M10 16v2m-3 0h6"/><path d="M10 9v7"/>
  </svg>`;
}

function activityIcon() {
  return `<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.67" stroke-linecap="round" stroke-linejoin="round">
    <polyline points="18 9 15 9 12 16 7 3 4 9 1 9"/>
  </svg>`;
}

function profileIcon() {
  return `<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.67" stroke-linecap="round" stroke-linejoin="round">
    <path d="M13.33 6.67a3.33 3.33 0 1 1-6.67 0 3.33 3.33 0 0 1 6.67 0z"/>
    <path d="M2 17.5c0-3.5 3.58-5.83 8-5.83s8 2.33 8 5.83"/>
  </svg>`;
}

function infoIcon() {
  return `<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.67" stroke-linecap="round" stroke-linejoin="round">
    <circle cx="10" cy="10" r="8.33"/>
    <line x1="10" y1="14" x2="10" y2="10"/>
    <line x1="10" y1="6.67" x2="10.01" y2="6.67"/>
  </svg>`;
}

/**
 * Returns the top header HTML (for auth/back pages).
 * @param {string} mode – 'back' (login/signup) | 'nav' (main pages)
 * @param {string} activePage
 * @param {string} base
 */
function getTopHeader(mode, activePage, base = '../') {
  const sessionRaw = localStorage.getItem('nexus.auth.session');
  let session = null;
  try { if (sessionRaw) session = JSON.parse(sessionRaw); } catch (e) { }

  const authActions = session
    ? `<a href="${base}pages/profile.html" class="btn-profile-top">${session.displayName || 'Profile'}</a>`
    : `
      <a href="${base}pages/login.html" class="btn-login">Login</a>
      <a href="${base}pages/signup.html" class="btn-signup">SignUp</a>
    `;

  if (mode === 'back') {
    return `
    <header class="top-header">
      <a href="${base}index.html" class="header-logo-link">
        <div class="header-icon-btn">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M14 8H2M2 8L8 14M2 8L8 2" stroke="#94A3B8" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </div>
        <div class="header-logo-text">
          <span class="brand">Back</span>
        </div>
      </a>
    </header>`;
  }
  return `
  <header class="top-header">
    <a href="${base}index.html" class="header-logo-link">
      <img src="${base}assets/f03e2b11537e425d8544ee3ca732bf73af5137c0.png" alt="Nexus" style="width:40px;height:34px;border-radius:8px;object-fit:cover;">
      <div class="header-logo-text">
        <span class="brand" style="font-size:18px;">NEXUS</span>
        <span style="font-size:10px;color:#c6ff33;">ESPORTS</span>
      </div>
    </a>
    <nav class="header-nav-links">
      <a href="${base}index.html" class="${activePage === 'home' ? 'active' : ''}">Home</a>
      <a href="${base}pages/competitions.html" class="${activePage === 'competitions' ? 'active' : ''}">Competitions</a>
      <a href="${base}pages/about.html" class="${activePage === 'about' ? 'active' : ''}">About</a>
    </nav>
    <div class="header-actions">
      ${authActions}
    </div>
  </header>`;
}

/**
 * Updates the hero topbar on the landing page based on auth state.
 */
function updateLandingHeader() {
  const actions = document.querySelector('.hero-topbar-actions');
  if (!actions) return;
  const sessionRaw = localStorage.getItem('nexus.auth.session');
  if (sessionRaw) {
    let session = null;
    try { session = JSON.parse(sessionRaw); } catch (e) { }
    actions.innerHTML = `
      <a href="pages/profile.html" class="btn-top">Profile</a>
      <button class="btn-top" onclick="window.logout()">Logout</button>
    `;
    // We need logout defined globally for this
    if (!window.logout) {
      window.logout = () => {
        if (window.NexusAuth && typeof window.NexusAuth.clearSession === 'function') {
          window.NexusAuth.clearSession();
        } else {
          localStorage.removeItem('nexus.auth.session');
        }
        window.location.reload();
      };
    }
  }
}

/**
 * Returns the site footer HTML.
 * @param {string} base – relative path prefix to root, e.g. '../' or './'
 */
function getFooter(base) {
  return `
  <footer class="site-footer">
    <div class="footer-top">
      <div class="footer-brand">
        <div class="footer-brand-logo">
          <img src="${base}assets/f03e2b11537e425d8544ee3ca732bf73af5137c0.png" alt="Nexus Logo">
          <div class="footer-brand-name">
            <div class="name">NEXUS</div>
            <div class="sub">ESPORTS</div>
          </div>
        </div>
        <p class="footer-desc">The world's leading platform for competitive gaming and live match tracking. Join millions of players worldwide.</p>
      </div>
      <div class="footer-col">
        <div class="footer-col-title">Platform</div>
        <ul>
          <li><a href="${base}pages/about.html">About Us</a></li>
          <li><a href="${base}pages/competitions.html">Tournaments</a></li>
          <li><a href="#">Live Streams</a></li>
        </ul>
      </div>
      <div class="footer-col">
        <div class="footer-col-title">Community</div>
        <ul>
          <li><a href="${base}pages/profile.html">Profile</a></li>
          <li><a href="#">Leaderboard</a></li>
          <li><a href="#">Discord</a></li>
        </ul>
      </div>
      <div class="footer-col">
        <div class="footer-col-title">Support</div>
        <ul>
          <li><a href="#">Help Center</a></li>
          <li><a href="#">Contact Us</a></li>
          <li><a href="#">Privacy Policy</a></li>
        </ul>
      </div>
    </div>
    <div class="footer-bottom">
      <span class="footer-copy">© 2026 NEXUS ESPORTS. All rights reserved.</span>
      <div class="footer-status">
        <div class="status-dot"></div>
        <span>Server Status: Operational</span>
      </div>
    </div>
  </footer>`;
}

// ─────────────────────────────────────────────────
// COMPETITION CARD HELPER
// ─────────────────────────────────────────────────
// Cache session username once (not per-card)
var _compCardUname = null;
function _getCompCardUname() {
  if (_compCardUname !== null) return _compCardUname;
  _compCardUname = '';
  try {
    var raw = localStorage.getItem('nexus.auth.session');
    if (raw) {
      var s = JSON.parse(raw);
      _compCardUname = (s.username || '').trim().toLowerCase();
    }
  } catch(e) {}
  return _compCardUname;
}

function compCard(c) {
  const { img, badge, badgeClass, game, name, prizePool, participants, dates, status, id, role } = c;
  const clickAction = `window.NexusData.goToComp('${id}')`;

  // Determine if the current user is involved in this competition
  let hideJoinBtn = (role === 'organizer');
  if (!hideJoinBtn) {
    var uname = _getCompCardUname();
    if (uname) {
      // Check organizer
      var orgId = (c.organizerId || c.createdBy || '').trim().toLowerCase();
      if (orgId === uname) hideJoinBtn = true;
      // Check teams array directly (no expensive external calls)
      if (!hideJoinBtn && Array.isArray(c.teams)) {
        hideJoinBtn = c.teams.some(function(t) {
          if (!t) return false;
          if ((t.createdBy || '').trim().toLowerCase() === uname) return true;
          if (Array.isArray(t.members)) {
            return t.members.some(function(m) {
              var mu = (typeof m === 'string' ? m : (m && m.username || '')).trim().toLowerCase();
              return mu === uname;
            });
          }
          return false;
        });
      }
    }
  }

  return `
  <div class="comp-card" onclick="${clickAction}">
    <div class="comp-card-img">
      <img src="${img || '../assets/b890c61489a080992ad7e99adabb1145e6d59606.png'}" alt="${name}">
      <span class="comp-badge ${badgeClass || ''}">${badge || ''}</span>
    </div>
    <div class="comp-card-body">
      <div class="comp-game-label">${game}</div>
      <h3 class="comp-title">${name}</h3>
      <div class="comp-meta">
        <div class="comp-meta-item">
          <svg viewBox="0 0 16 16" fill="none" stroke="#C6FF33" stroke-width="1.33" stroke-linecap="round">
            <line x1="8" y1="1" x2="8" y2="15"/><path d="M11 4H6.5a2.5 2.5 0 0 0 0 5H9a2.5 2.5 0 0 1 0 5H4"/>
          </svg>
          <span>${prizePool || '—'}</span>
        </div>
        <div class="comp-meta-item">
          <svg viewBox="0 0 16 16" fill="none" stroke="#C6FF33" stroke-width="1.33" stroke-linecap="round">
            <path d="M11 3H5l-2 5h14l-2-5z"/><path d="M2 8v5h12V8"/><path d="M7 8v5"/>
          </svg>
          <span>${(Array.isArray(c.teams) ? c.teams.length : participants) || 0} Teams</span>
        </div>
        <div class="comp-meta-item">
          <svg viewBox="0 0 16 16" fill="none" stroke="#C6FF33" stroke-width="1.33" stroke-linecap="round">
            <rect x="1" y="2" width="14" height="13" rx="2"/><line x1="1" y1="7" x2="15" y2="7"/>
            <line x1="5" y1="1" x2="5" y2="3"/><line x1="11" y1="1" x2="11" y2="3"/>
          </svg>
          <span>${dates || 'TBD'}</span>
        </div>
      </div>
      <div class="comp-card-footer">
        <span class="comp-status">${status}</span>
        ${hideJoinBtn
      ? ''
      : `<button class="btn-primary" onclick="event.stopPropagation(); window.location.href='join-teams.html?id=${id}'">Join Teams</button>`
    }
      </div>
    </div>
  </div>`;
}

// ─────────────────────────────────────────────────
// COMPETITIONS DATA (Moved to competitions-data.js)
// ─────────────────────────────────────────────────

// ─────────────────────────────────────────────────
// PAGE INIT FUNCTIONS
// ─────────────────────────────────────────────────

/**
 * Injects sidebar into any element with id="sidebar-mount"
 */
function initSidebar(activePage, base = '../') {
  const el = document.getElementById('sidebar-mount');
  if (el) el.innerHTML = getSidebar(activePage, base);
}

/**
 * Injects footer into any element with id="footer-mount"
 */
function initFooter(base) {
  const el = document.getElementById('footer-mount');
  if (el) el.innerHTML = getFooter(base);
}

/**
 * Injects team sidebar
 */
function initTeamSidebar(activePage, activeTab, base = '../../') {
  const el = document.getElementById('sidebar-mount');
  if (el) el.innerHTML = getTeamSidebar(activePage, activeTab, base);
}

/**
 * Injects admin sidebar
 */
function initAdminSidebar(activePage, base = '../../') {
  const el = document.getElementById('sidebar-mount');
  if (el) el.innerHTML = getAdminSidebar(activePage, base);
}

// ─────────────────────────────────────────────────
// FORM HELPERS
// ─────────────────────────────────────────────────

/** Toggle password visibility */
function initPasswordToggles() {
  document.querySelectorAll('[data-pwd-toggle]').forEach(btn => {
    const targetId = btn.getAttribute('data-pwd-toggle');
    const input = document.getElementById(targetId);
    if (!input) return;
    btn.addEventListener('click', () => {
      const isText = input.type === 'text';
      input.type = isText ? 'password' : 'text';
      btn.innerHTML = isText ? eyeIcon() : eyeOffIcon();
    });
  });
}

function eyeIcon() {
  return `<svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="#A1A1AA" stroke-width="1.25" stroke-linecap="round" stroke-linejoin="round">
    <path d="M1 10s3.5-7 9-7 9 7 9 7-3.5 7-9 7-9-7-9-7z"/>
    <circle cx="10" cy="10" r="3"/>
  </svg>`;
}

function eyeOffIcon() {
  return `<svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="#A1A1AA" stroke-width="1.25" stroke-linecap="round" stroke-linejoin="round">
    <path d="M17.94 11.94A10.07 10.07 0 0 1 10 17c-5.5 0-9-7-9-7a18.45 18.45 0 0 1 5.06-5.94"/>
    <path d="M9.9 4.24A9.12 9.12 0 0 1 10 4c5.5 0 9 6 9 6a18.5 18.5 0 0 1-2.16 3.19"/>
    <line x1="1" y1="1" x2="19" y2="19"/>
  </svg>`;
}

/** Generic form submission redirect */
function initAuthForm(formId, redirectUrl) {
  const form = document.getElementById(formId);
  if (!form) return;
  form.addEventListener('submit', e => {
    e.preventDefault();
    window.location.href = redirectUrl;
  });
}

// ─────────────────────────────────────────────────
// FILTER TABS
// ─────────────────────────────────────────────────
function initFilterTabs() {
  document.querySelectorAll('.filter-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.filter-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      const filter = tab.dataset.filter;
      filterCompetitions(filter);
    });
  });
}

function filterCompetitions(filter) {
  const cards = document.querySelectorAll('.comp-card-wrapper');
  cards.forEach(card => {
    if (filter === 'all') {
      card.style.display = '';
      return;
    }
    // Type-based filters: league / tournament → match data-type
    if (filter === 'league' || filter === 'tournament') {
      card.style.display = (card.dataset.type === filter) ? '' : 'none';
      return;
    }
    // 'new' filter → match data-badge === 'new' OR data-isnew === 'true'
    if (filter === 'new') {
      const isNew = card.dataset.isnew === 'true' || (card.dataset.badge || '') === 'new';
      card.style.display = isNew ? '' : 'none';
      return;
    }
    // Badge-based filters: featured / live / hot
    const badge = (card.dataset.badge || '').toLowerCase();
    card.style.display = badge === filter ? '' : 'none';
  });
}

// ─────────────────────────────────────────────────
// SEARCH
// ─────────────────────────────────────────────────
function initSearch() {
  const input = document.getElementById('comp-search');
  if (!input) return;
  input.addEventListener('input', () => {
    const q = input.value.toLowerCase();
    document.querySelectorAll('.comp-card-wrapper').forEach(card => {
      const text = card.innerText.toLowerCase();
      card.style.display = text.includes(q) ? '' : 'none';
    });
  });
}

// ─────────────────────────────────────────────────
// MOBILE MENU TOGGLE
// ─────────────────────────────────────────────────
function initMobileMenu() {
  const btn = document.getElementById('mobile-menu-btn');
  const menu = document.getElementById('mobile-menu');
  if (!btn || !menu) return;
  btn.addEventListener('click', () => menu.classList.toggle('open'));
}

// ─────────────────────────────────────────────────
// TOAST NOTIFICATION
// ─────────────────────────────────────────────────
function showToast(msg, type = 'success') {
  const toast = document.createElement('div');
  toast.textContent = msg;
  toast.style.cssText = `
    position:fixed; bottom:24px; right:24px; z-index:9999;
    background:${type === 'success' ? '#c6ff33' : '#e7000b'};
    color:${type === 'success' ? '#000' : '#fff'};
    font-family: 'Lato', sans-serif; font-weight:700;
    padding:12px 24px; border-radius:8px;
    box-shadow:0 8px 24px rgba(0,0,0,0.4);
    font-size:14px; letter-spacing:0.5px;
    transform:translateY(20px); opacity:0;
    transition: all 0.3s;
  `;
  document.body.appendChild(toast);
  requestAnimationFrame(() => { toast.style.transform = 'translateY(0)'; toast.style.opacity = '1'; });
  setTimeout(() => {
    toast.style.transform = 'translateY(20px)'; toast.style.opacity = '0';
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

// ─────────────────────────────────────────────────
// HERO COUNTER ANIMATION
// ─────────────────────────────────────────────────
function animateCounters() {
  document.querySelectorAll('[data-count]').forEach(el => {
    const target = parseInt(el.dataset.count);
    const suffix = el.dataset.suffix || '';
    let current = 0;
    const step = Math.ceil(target / 60);
    const timer = setInterval(() => {
      current = Math.min(current + step, target);
      el.textContent = current.toLocaleString() + suffix;
      if (current >= target) clearInterval(timer);
    }, 16);
  });
}

// Run counter animation when visible
if ('IntersectionObserver' in window) {
  const observer = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting) { animateCounters(); observer.disconnect(); }
    });
  }, { threshold: 0.3 });
  document.addEventListener('DOMContentLoaded', () => {
    const el = document.querySelector('.hero-stats');
    if (el) observer.observe(el);
  });
}

// ─────────────────────────────────────────────────
// EXTENDED SIDEBAR VARIANTS (New pages)
// ─────────────────────────────────────────────────

/**
 * Team-Lead sidebar: Home, Competitions, Activity, Notifications, Profile, About
 * with secondary tab nav: Roster | Add Players | Join Requests | Invitations Sent | Settings
 */
function getTeamSidebar(activePage, activeTab, base = '../../') {
  const items = [
    { id: 'home', label: 'Home', href: base + 'index.html', icon: homeIcon() },
    { id: 'competitions', label: 'Competitions', href: base + 'pages/competitions.html', icon: trophyIcon() },
    { id: 'activity', label: 'Activity', href: base + 'pages/my-activity.html', icon: activityIcon() },
    { id: 'notifications', label: 'Notifications', href: base + 'pages/notifications.html', icon: bellIcon() },
    { id: 'profile', label: 'Profile', href: base + 'pages/profile.html', icon: profileIcon() },
    { id: 'about', label: 'About', href: base + 'pages/about.html', icon: infoIcon() },
  ];

  return `
  <aside class="sidebar">
    <div class="sidebar-logo">
      <img src="${base}assets/f03e2b11537e425d8544ee3ca732bf73af5137c0.png" alt="Nexus Logo">
      <div class="logo-title">NEXUS</div>
      <div class="logo-sub">ESPORTS</div>
    </div>
    <nav class="sidebar-nav">
      ${items.slice(0, 4).map(item => `
        <a href="${item.href}" class="nav-item ${activePage === item.id ? 'active' : ''}" ${item.id === 'notifications' ? 'id="nav-notif-item"' : ''}>
          ${item.icon}
          <span>${item.label}</span>
        </a>`).join('')}
    </nav>
    <div class="sidebar-nav-bottom">
      ${items.slice(4).map(item => `
        <a href="${item.href}" class="nav-item ${activePage === item.id ? 'active' : ''}">
          ${item.icon}
          <span>${item.label}</span>
        </a>`).join('')}
    </div>
  </aside>`;
}

/**
 * Admin sidebar: Home, Disputes, Profile
 */
function getAdminSidebar(activePage, base = '../../') {
  const items = [
    { id: 'home', label: 'Home', href: base + 'pages/admin/dashboard.html', icon: homeIcon() },
    { id: 'disputes', label: 'Disputes', href: base + 'pages/admin/disputes.html', icon: shieldIcon() },
    { id: 'users', label: 'Users', href: base + 'pages/admin/users.html', icon: usersIcon() },
    { id: 'profile', label: 'Profile', href: base + 'pages/admin/admin-profile.html', icon: profileIcon() },
  ];

  return `
  <aside class="sidebar">
    <div class="sidebar-logo">
      <img src="${base}assets/f03e2b11537e425d8544ee3ca732bf73af5137c0.png" alt="Nexus Logo">
      <div class="logo-title">NEXUS</div>
      <div class="logo-sub">ESPORTS</div>
    </div>
    <nav class="sidebar-nav">
      ${items.slice(0, 3).map(item => `
        <a href="${item.href}" class="nav-item ${activePage === item.id ? 'active' : ''}">
          ${item.icon}<span>${item.label}</span>
        </a>`).join('')}
    </nav>
    <div class="sidebar-nav-bottom">
      ${items.slice(3).map(item => `
        <a href="${item.href}" class="nav-item ${activePage === item.id ? 'active' : ''}">
          ${item.icon}<span>${item.label}</span>
        </a>`).join('')}
    </div>
  </aside>`;
}

/**
 * Super Admin sidebar (admin-style shell): Dashboard, Disputes, Policy, Profile
 */
function getSuperAdminSidebar(activePage, base = '../../') {
  const items = [
    { id: 'dashboard', label: 'Dashboard', href: base + 'pages/super-admin/super-dashboard.html', icon: homeIcon() },
    { id: 'disputes', label: 'Disputes', href: base + 'pages/super-admin/resolve-disputes.html', icon: shieldIcon() },
    { id: 'policy', label: 'Policy', href: base + 'pages/super-admin/policy-management.html', icon: checkCircleIcon() },
    { id: 'users', label: 'Users', href: base + 'pages/super-admin/users.html', icon: usersIcon() },
    { id: 'profile', label: 'Profile', href: base + 'pages/super-admin/profile.html', icon: profileIcon() },
  ];

  return `
  <aside class="sidebar">
    <div class="sidebar-logo">
      <img src="${base}assets/f03e2b11537e425d8544ee3ca732bf73af5137c0.png" alt="Nexus Logo">
      <div class="logo-title">NEXUS</div>
      <div class="logo-sub">ESPORTS</div>
    </div>
    <nav class="sidebar-nav">
      ${items.slice(0, 4).map(item => `
        <a href="${item.href}" class="nav-item ${activePage === item.id ? 'active' : ''}">
          ${item.icon}<span>${item.label}</span>
        </a>`).join('')}
    </nav>
    <div class="sidebar-nav-bottom">
      ${items.slice(4).map(item => `
        <a href="${item.href}" class="nav-item ${activePage === item.id ? 'active' : ''}">
          ${item.icon}<span>${item.label}</span>
        </a>`).join('')}
    </div>
  </aside>`;
}

/**
 * Injects super-admin sidebar. If legacy sidebar exists, it will be replaced.
 */
function initSuperAdminSidebar(activePage, base = '../../') {
  const html = getSuperAdminSidebar(activePage, base);
  const mount = document.getElementById('sidebar-mount');
  if (mount) {
    mount.innerHTML = html;
  } else {
    const legacySidebar = document.querySelector('.sa-sidebar-v2');
    if (legacySidebar) {
      legacySidebar.outerHTML = html;
    }
  }

  document.body.classList.add('super-admin-classic-shell');
}

function bellIcon() {
  return `<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.67" stroke-linecap="round" stroke-linejoin="round">
    <path d="M10 2a6 6 0 0 0-6 6c0 7-3 9-3 9h18s-3-2-3-9a6 6 0 0 0-6-6z"/>
    <path d="M11.73 17a2 2 0 0 1-3.46 0"/>
  </svg>`;
}

function shieldIcon() {
  return `<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.67" stroke-linecap="round" stroke-linejoin="round">
    <path d="M10 2L3 5v5c0 4.5 3 8.5 7 9.5 4-1 7-5 7-9.5V5L10 2z"/>
  </svg>`;
}

function checkCircleIcon() {
  return `<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.67" stroke-linecap="round" stroke-linejoin="round">
    <circle cx="10" cy="10" r="8"/><path d="M6.5 10l2.5 2.5 5-5"/>
  </svg>`;
}

function usersIcon() {
  return `<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.67" stroke-linecap="round" stroke-linejoin="round">
    <path d="M14 15v-1a4 4 0 0 0-4-4H4a4 4 0 0 0-4 4v1"/>
    <circle cx="7" cy="5" r="3"/>
    <path d="M20 15v-1a4 4 0 0 0-3-3.87"/>
    <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
  </svg>`;
}

function settingsIcon() {
  return `<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.67" stroke-linecap="round" stroke-linejoin="round">
    <circle cx="10" cy="10" r="3"/>
    <path d="M10 2v1m0 14v1M2 10h1m14 0h1m-2.05-6.95-.71.71M4.76 15.24l-.71.71m0-11.9.71.71m10.48 10.48.71.71"/>
  </svg>`;
}

// ─────────────────────────────────────────────────
// SHARED TEAM-LEAD TABS
// ─────────────────────────────────────────────────
function getTeamTabs(activeTab, base) {
  const tabs = [
    { id: 'roster', label: 'Roster', href: base + 'team-roster.html' },
    { id: 'add-players', label: 'Add Players', href: base + 'add-players.html' },
    { id: 'join-requests', label: 'Join Requests', href: base + 'join-requests.html' },
    { id: 'invitations', label: 'Invitations Sent', href: base + 'invitations-sent.html' },
    { id: 'settings', label: 'Settings', href: base + 'team-settings.html' },
  ];
  return `
  <div class="team-tabs-nav">
    ${tabs.map(t => `<a href="${t.href}" class="team-tab ${activeTab === t.id ? 'active' : ''}">${t.label}</a>`).join('')}
  </div>`;
}

// ─────────────────────────────────────────────────
// SHARED ADMIN COMPETITION NAV TABS
// ─────────────────────────────────────────────────
function getAdminCompTabs(activeTab, variant) {
  const v = variant || '';
  const tabs = [
    { id: 'overview', label: 'Overview', href: 'competition-detail.html' + v },
    { id: 'teams', label: 'Manage Teams', href: 'manage-teams.html' + v },
    { id: 'matches', label: 'Manage Matches', href: 'manage-matches.html' + v },
    { id: 'results', label: 'Match Results', href: 'match-results.html' + v },
    { id: 'standings', label: 'Standings', href: 'view-standings.html' },
    { id: 'disputes', label: 'Disputes', href: 'dispute-review.html' + v },
    { id: 'edit', label: 'Edit', href: 'edit-competition.html' + v },
  ];
  return `
  <div class="admin-comp-tabs">
    ${tabs.map(t => `<a href="${t.href}" class="admin-tab ${activeTab === t.id ? 'active' : ''}">${t.label}</a>`).join('')}
  </div>`;
}

// ─────────────────────────────────────────────────
// WARNING POPUP — shows on page load if user has unseen warnings
// ─────────────────────────────────────────────────
(function checkUserWarnings() {
  document.addEventListener('DOMContentLoaded', function() {
    try {
      var sessionRaw = localStorage.getItem('nexus.auth.session');
      if (!sessionRaw) return;
      var session = JSON.parse(sessionRaw);
      if (!session || !session.username) return;

      var ACCOUNTS_KEY = 'nexus.auth.accounts';
      var accounts = JSON.parse(localStorage.getItem(ACCOUNTS_KEY) || '[]');
      var uname = session.username.trim().toLowerCase();
      var account = accounts.find(function(a) { return (a.username || '').trim().toLowerCase() === uname; });
      if (!account || !Array.isArray(account.warnings)) return;

      // Find first unseen warning
      var unseenIdx = account.warnings.findIndex(function(w) { return !w.seen; });
      if (unseenIdx < 0) return;

      var warning = account.warnings[unseenIdx];

      // Create and show warning overlay
      var overlay = document.createElement('div');
      overlay.id = 'nexus-warning-overlay';
      overlay.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.85);z-index:99999;display:flex;align-items:center;justify-content:center;';

      var modal = document.createElement('div');
      modal.style.cssText = 'background:#1a1a2e;border:2px solid #f59e0b;border-radius:16px;padding:40px;max-width:480px;width:90%;text-align:center;box-shadow:0 0 60px rgba(245,158,11,0.3);';

      modal.innerHTML = '<div style="font-size:48px;margin-bottom:16px;">⚠️</div>'
        + '<h2 style="color:#f59e0b;font-size:22px;margin-bottom:12px;font-weight:800;">PLATFORM WARNING</h2>'
        + '<p style="color:#e2e8f0;font-size:15px;line-height:1.6;margin-bottom:8px;">You have received a formal warning from the Super Admin.</p>'
        + '<p style="color:#94a3b8;font-size:13px;line-height:1.5;margin-bottom:24px;">Reason: <strong style="color:#f59e0b;">' + (warning.reason || 'Platform violation') + '</strong><br>Further violations may result in a permanent ban.</p>'
        + '<button id="nexus-warning-ok-btn" style="background:#f59e0b;color:#000;border:none;padding:12px 48px;font-size:15px;font-weight:700;border-radius:8px;cursor:pointer;text-transform:uppercase;letter-spacing:1px;">OK</button>';

      overlay.appendChild(modal);
      document.body.appendChild(overlay);

      document.getElementById('nexus-warning-ok-btn').addEventListener('click', function() {
        // Mark warning as seen
        account.warnings[unseenIdx].seen = true;
        localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(accounts));
        overlay.remove();
      });
    } catch(e) {
      console.error('Warning popup check failed:', e);
    }
  });
})();

