const AUTH_SESSION_KEY = 'nexus.auth.session';

function readAuthSession() {
  // First try to get from API
  if (window.NexusAuth && typeof window.NexusAuth.getSession === 'function') {
    const session = window.NexusAuth.getSession();
    if (session && session.username) {
      return session;
    }
  }

  // Fallback to localStorage
  try {
    const raw = localStorage.getItem(AUTH_SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || !parsed.username || !parsed.role) return null;
    return parsed;
  } catch (err) {
    return null;
  }
}

const activeSession = readAuthSession();
if (!activeSession) {
  console.warn('No active session found, redirecting to login');
  window.location.replace('login.html');
}

function getBioStorageKey(username) {
  return 'nexus.profile.bio.' + String(username || '').trim().toLowerCase();
}

function getStoredBio(username) {
  try {
    const key = getBioStorageKey(username);
    return localStorage.getItem(key);
  } catch (err) {
    return null;
  }
}

function formatDate(value) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('en-IN', { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatRole(role) {
  const map = {
    regular: 'User',
    participant: 'User',
    team_lead: 'Team Lead',
    admin: 'Comp Admin',
    comp_admin: 'Comp Admin',
    dispute_admin: 'Dispute Admin',
    revenue_admin: 'Revenue Admin',
    'super-admin': 'Super Admin',
    super_admin: 'Super Admin'
  };
  const key = String(role || '').trim().toLowerCase();
  return map[key] || 'User';
}

function saveStoredBio(username, bio) {
  try {
    const key = getBioStorageKey(username);
    localStorage.setItem(key, bio);
  } catch (err) {
    // Ignore storage errors
  }
}

// Set displayName, username, and bio in profile header
window.addEventListener('DOMContentLoaded', function () {
  if (!activeSession) return;

  const displayName = activeSession.displayName
    || (activeSession.firstName && activeSession.lastName
      ? activeSession.firstName + ' ' + activeSession.lastName
      : activeSession.username);

  const setText = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };

  setText('profile-displayName', displayName || '—');
  setText('profile-username', '@' + (activeSession.username || '—'));
  setText('profile-user-id', activeSession.username || '—');
  setText('profile-last-login', formatDate(activeSession.lastLoginAt || activeSession.loggedInAt));
  setText('profile-joined-date', formatDate(activeSession.joinedAt));
  setText('profile-max-priv', formatRole(activeSession.role));

  // Bio
  const storedBio = getStoredBio(activeSession.username);
  const bioElem = document.getElementById('profile-bio');
  const bioInput = document.getElementById('profile-bio-input');
  if (bioElem) bioElem.textContent = storedBio || '';
  if (bioInput) bioInput.value = storedBio || '';

  // Edit Profile modal pre-fill
  const dnInput = document.getElementById('profile-displayname-input');
  const unInput = document.getElementById('profile-username-input');
  if (dnInput) dnInput.value = displayName || '';
  if (unInput) unInput.value = activeSession.username || '';

  // Account Settings — email from session (matches signup email)
  const emailDisplay = document.getElementById('account-email-display');
  if (emailDisplay) {
    const email = activeSession.email || activeSession.emailAddress || '—';
    emailDisplay.textContent = email;
  }

  // Also fix the "admin account" label → "your account"
  const emailLabel = document.querySelector('#ptab-account .settings-label-info p');
  if (emailLabel && emailLabel.textContent.includes('admin account')) {
    emailLabel.textContent = 'The email address associated with your account.';
  }

  // ── Load competition data and populate sidebar + tabs ──────────
  if (!window.NexusData || typeof window.NexusData.loadCompetitions !== 'function') return;

  const allComps = window.NexusData.loadCompetitions() || [];
  const username = String(activeSession.username || '').toLowerCase();

  // Collect teams this user is in
  const myTeams = [];
  const myUpcomingMatches = [];
  const myMatchHistory = [];
  let wins = 0, losses = 0;

  allComps.forEach(comp => {
    if (!Array.isArray(comp.teams)) return;
    comp.teams.forEach(team => {
      const isLeader = String(team.createdBy || '').toLowerCase() === username;
      const isMember = Array.isArray(team.members) &&
        team.members.some(m => String(m.username || '').toLowerCase() === username);
      if (!isLeader && !isMember) return;

      const role = isLeader ? 'Captain' : 'Player';
      const icon = isLeader ? '⚡' : '🎮';
      myTeams.push({ name: team.name, game: comp.game, role, icon });

      // Upcoming scheduled matches for this team
      if (Array.isArray(comp.matches)) {
        comp.matches.forEach(m => {
          const inMatch = String(m.team1 || '').toLowerCase() === String(team.name || '').toLowerCase()
            || String(m.team2 || '').toLowerCase() === String(team.name || '').toLowerCase();
          if (!inMatch) return;

          if (m.status === 'scheduled' || m.status === 'live') {
            myUpcomingMatches.push({
              game: comp.game,
              event: m.team1 + ' vs ' + m.team2 + (m.round ? ' — ' + m.round : ''),
              dateTime: m.date + (m.time ? ' • ' + m.time : '')
            });
          }

          if (m.status === 'completed') {
            const t1won = Number(m.score1) > Number(m.score2);
            const t2won = Number(m.score2) > Number(m.score1);
            const isT1 = String(m.team1 || '').toLowerCase() === String(team.name || '').toLowerCase();
            const won = (isT1 && t1won) || (!isT1 && t2won);
            myMatchHistory.push({
              game: comp.game,
              event: (m.round ? m.round + ' — ' : '') + m.team1 + ' vs ' + m.team2,
              date: m.date || '',
              result: won ? 'WIN' : 'LOSS'
            });
            if (won) wins++; else losses++;
          }
        });
      }
    });
  });

  // ── My Teams sidebar ───────────────────────────────────────────
  const teamsList = document.getElementById('profile-teams-list');
  if (teamsList) {
    if (myTeams.length === 0) {
      teamsList.innerHTML = '<p style="color:var(--text-muted);font-size:13px;">Not part of any team yet.</p>';
    } else {
      teamsList.innerHTML = myTeams.map(t => `
        <div class="team-row">
          <div class="t-icon">${t.icon}</div>
          <div>
            <div class="t-name">${t.name}</div>
            <div class="t-game">${t.game}</div>
          </div>
          <div class="t-role">${t.role}</div>
        </div>`).join('');
    }
  }

  // ── Upcoming Matches sidebar ───────────────────────────────────
  const upcomingList = document.getElementById('profile-upcoming-matches');
  if (upcomingList) {
    if (myUpcomingMatches.length === 0) {
      upcomingList.innerHTML = '<p style="color:var(--text-muted);font-size:13px;">No upcoming matches scheduled.</p>';
    } else {
      upcomingList.innerHTML = myUpcomingMatches.slice(0, 3).map(m => `
        <div class="match-card-mini">
          <div class="match-game-label">${m.game}</div>
          <div class="match-title-sm">${m.event}</div>
          <div class="match-schedule-sm">${m.dateTime}</div>
        </div>`).join('');
    }
  }

  // ── Match History tab ──────────────────────────────────────────
  const historyList = document.getElementById('match-history-list');
  if (historyList) {
    if (myMatchHistory.length === 0) {
      historyList.innerHTML = '<p style="color:var(--text-muted);font-size:14px;padding:24px 0;">No match history yet. Join a competition to get started!</p>';
    } else {
      historyList.innerHTML = myMatchHistory.map(m => `
        <div class="match-item">
          <div>
            <div class="game">${m.game}</div>
            <div class="event">${m.event}</div>
            <div class="date match-date-alt">${m.date}</div>
          </div>
          <div class="${m.result === 'WIN' ? 'result-win' : 'result-loss'}">${m.result}</div>
        </div>`).join('');
    }
  }

  // ── Statistics tab ─────────────────────────────────────────────
  const statBars = document.getElementById('stat-bars');
  if (statBars) {
    const total = wins + losses;
    if (total === 0) {
      statBars.innerHTML = '<p style="color:var(--text-muted);font-size:14px;padding:24px 0;">No statistics yet. Complete matches to build your stats.</p>';
    } else {
      const winRate = Math.round((wins / total) * 100);
      statBars.innerHTML = `
        <div class="stat-bar-item">
          <div class="stat-bar-label"><span class="name">Win Rate</span><span class="val">${winRate}%</span></div>
          <div class="stat-bar-track"><div class="stat-bar-fill" data-w="${winRate}" style="width:${winRate}%"></div></div>
        </div>
        <div class="stat-bar-item">
          <div class="stat-bar-label"><span class="name">Matches Played</span><span class="val">${total}</span></div>
          <div class="stat-bar-track"><div class="stat-bar-fill" data-w="${Math.min(100, total * 10)}" style="width:${Math.min(100, total * 10)}%"></div></div>
        </div>
        <div class="stat-bar-item">
          <div class="stat-bar-label"><span class="name">Wins</span><span class="val">${wins}</span></div>
          <div class="stat-bar-track"><div class="stat-bar-fill" data-w="${Math.min(100, wins * 12)}" style="width:${Math.min(100, wins * 12)}%"></div></div>
        </div>`;
    }
  }
});

initSidebar('profile', '../');
initFooter('../');

// Profile tabs
const ptabs = document.querySelectorAll('.ptab');
if (ptabs.length > 0) {
  ptabs.forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.ptab').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.ptab-panel').forEach(p => p.classList.remove('active'));
      btn.classList.add('active');
      const target = document.getElementById('ptab-' + btn.dataset.ptab);
      if (target) target.classList.add('active');
      if (btn.dataset.ptab === 'stats') animateBars();
    });
  });
}

// Animate stat bars when stats tab is shown
function animateBars() {
  document.querySelectorAll('.stat-bar-fill').forEach(bar => {
    const w = bar.dataset.w;
    bar.style.width = w + '%';
  });
}

// Close modal on overlay click
function closeModal(e) {
  if (e.target.id === 'edit-modal') {
    document.getElementById('edit-modal').classList.remove('open');
  }
}

function closeProfileModal(e, modalId) {
  if (e.target.id === modalId) {
    document.getElementById(modalId).classList.remove('open');
  }
}

function openEmailModal() {
  const modal = document.getElementById('email-modal');
  if (modal) {
    const input = document.getElementById('new-email-input');
    if (input) input.value = activeSession.email || '';
    modal.classList.add('open');
  }
}

function openPasswordModal() {
  const modal = document.getElementById('password-modal');
  if (modal) {
    // Clear inputs
    const ids = ['current-password-input', 'new-password-input', 'confirm-password-input'];
    ids.forEach(id => {
      const el = document.getElementById(id);
      if (el) el.value = '';
    });
    modal.classList.add('open');
  }
}

function updateEmail() {
  const input = document.getElementById('new-email-input');
  if (!input) return;
  const newEmail = input.value.trim();

  // Email syntax validation (same as signup)
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
  if (!emailRegex.test(newEmail)) {
    if (typeof showToast === 'function') {
      showToast('Please enter a valid email address.', 'error');
    }
    return;
  }

  // Update in localStorage accounts
  const accountsKey = 'nexus.auth.accounts';
  try {
    const accounts = JSON.parse(localStorage.getItem(accountsKey) || '[]');
    const idx = accounts.findIndex(a => a.username.toLowerCase() === activeSession.username.toLowerCase());
    
    if (idx !== -1) {
      accounts[idx].email = newEmail;
      localStorage.setItem(accountsKey, JSON.stringify(accounts));
      
      // Update session
      activeSession.email = newEmail;
      localStorage.setItem(AUTH_SESSION_KEY, JSON.stringify(activeSession));
      
      // Update UI
      const display = document.getElementById('account-email-display');
      if (display) display.textContent = newEmail;
      
      document.getElementById('email-modal').classList.remove('open');
      if (typeof showToast === 'function') {
        showToast('Email address updated successfully!');
      }
    }
  } catch (err) {
    console.error('Failed to update email:', err);
  }
}

function updatePassword() {
  const currInput = document.getElementById('current-password-input');
  const nextInput = document.getElementById('new-password-input');
  const confInput = document.getElementById('confirm-password-input');
  
  if (!currInput || !nextInput || !confInput) return;
  
  const currPwd = currInput.value;
  const nextPwd = nextInput.value;
  const confPwd = confInput.value;
  
  if (!currPwd || !nextPwd || !confPwd) {
    if (typeof showToast === 'function') showToast('Please fill all password fields.', 'error');
    return;
  }
  
  if (nextPwd !== confPwd) {
    if (typeof showToast === 'function') showToast('New passwords do not match.', 'error');
    return;
  }
  
  if (nextPwd.length < 6) {
    if (typeof showToast === 'function') showToast('Password must be at least 6 characters.', 'error');
    return;
  }

  // Update in localStorage accounts
  const accountsKey = 'nexus.auth.accounts';
  try {
    const accounts = JSON.parse(localStorage.getItem(accountsKey) || '[]');
    const idx = accounts.findIndex(a => a.username.toLowerCase() === activeSession.username.toLowerCase());
    
    if (idx !== -1) {
      // Check current password
      if (accounts[idx].password !== currPwd) {
        if (typeof showToast === 'function') showToast('Current password is incorrect.', 'error');
        return;
      }
      
      accounts[idx].password = nextPwd;
      localStorage.setItem(accountsKey, JSON.stringify(accounts));
      
      document.getElementById('password-modal').classList.remove('open');
      if (typeof showToast === 'function') {
        showToast('Password updated successfully!');
      }
    }
  } catch (err) {
    console.error('Failed to update password:', err);
  }
}

function saveProfile() {
  const modal = document.getElementById('edit-modal');
  const bioInput = document.getElementById('profile-bio-input');
  const bioElem = document.getElementById('profile-bio');

  if (activeSession && bioInput && bioElem) {
    const nextBio = bioInput.value.trim();
    bioElem.textContent = nextBio || 'No bio added yet.';
    saveStoredBio(activeSession.username, nextBio || '');
  }

  if (modal) modal.classList.remove('open');
  if (typeof showToast === 'function') {
    showToast('Profile updated successfully!');
  }
}

// Global exposure
window.closeModal = closeModal;
window.closeProfileModal = closeProfileModal;
window.openEmailModal = openEmailModal;
window.openPasswordModal = openPasswordModal;
window.updateEmail = updateEmail;
window.updatePassword = updatePassword;
window.saveProfile = saveProfile;
window.animateBars = animateBars;

function logout() {
  if (window.NexusAuth && typeof window.NexusAuth.clearSession === 'function') {
    window.NexusAuth.clearSession();
  } else {
    localStorage.removeItem(AUTH_SESSION_KEY);
  }
  window.location.replace('login.html');
}
window.logout = logout;
