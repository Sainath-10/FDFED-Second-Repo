const profileRoleRoutes = {
  regular: '../profile.html',
  admin: '../admin/profile.html',
  'super-admin': 'profile.html'
};

if (!window.NexusAuth) {
  window.location.replace('../login.html');
} else {
  window.NexusAuth.requireProfileAccess({
    loginPath: '../login.html',
    pageRole: 'super-admin',
    roleRoutes: profileRoleRoutes
  });
}

// Populate hero card from session
document.addEventListener('DOMContentLoaded', function () {
  const session = (() => {
    try { return JSON.parse(localStorage.getItem('nexus.auth.session') || 'null'); } catch (e) { return null; }
  })();

  if (session) {
    const displayName = session.displayName || session.username || 'Super Admin';
    const emailVal = session.email || '';

    const heroUsername = document.getElementById('sa-hero-username');
    if (heroUsername) heroUsername.textContent = displayName;

    const heroEmail = document.getElementById('hero-email');
    if (heroEmail) heroEmail.textContent = emailVal;

    const accountEmail = document.getElementById('account-email-value');
    if (accountEmail) accountEmail.textContent = emailVal;

    const userIdEl = document.getElementById('sa-user-id');
    if (userIdEl) {
      const uname = session.username || 'SA-01';
      // If username is already email-format (contains @), show as-is; otherwise prefix with @
      userIdEl.textContent = uname.includes('@') ? uname : '@' + uname;
    }

    const lastLoginEl = document.getElementById('sa-last-login');
    if (lastLoginEl) {
      const loginTime = session.lastLoginAt || session.loggedInAt || Date.now();
      const d = new Date(loginTime);
      lastLoginEl.textContent = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) + ' · ' + d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
    }

    const joinedEl = document.getElementById('sa-joined-date');
    if (joinedEl) {
      const jTime = session.joinedAt ? new Date(session.joinedAt) : null;
      joinedEl.textContent = jTime && !isNaN(jTime.getTime()) ? jTime.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'Jan 2, 2026';
    }

    // Also persist so the email-change modal starts with the correct value
    if (emailVal) {
      try { localStorage.setItem('nexus.profile.email', emailVal); } catch (e) { }
    }
  }
});


if (typeof initSuperAdminSidebar === 'function') {
  initSuperAdminSidebar('profile', '../../');
}

const saveBtn = document.getElementById('save-profile-btn');
const logoutBtn = document.getElementById('logout-btn');
const saveFeedback = document.getElementById('save-feedback');
const twoFactor = document.getElementById('two-factor');
const twoFactorLabel = document.getElementById('two-factor-label');
const toggleInputs = document.querySelectorAll('.switch input[type="checkbox"]');
const languageSelect = document.getElementById('language');

const updatePasswordBtn = document.getElementById('update-password-btn');
const passwordModal = document.getElementById('password-modal');
const savePasswordBtn = document.getElementById('save-password-btn');
const passwordPopupMessage = document.getElementById('password-popup-message');

const emailEditBtn = document.getElementById('email-edit-btn');
const emailModal = document.getElementById('email-modal');
const saveEmailBtn = document.getElementById('save-email-btn');
const newEmailInput = document.getElementById('new-email');
const emailPopupMessage = document.getElementById('email-popup-message');
const accountEmailValue = document.getElementById('account-email-value');
const heroEmail = document.getElementById('hero-email');

const currentPasswordInput = document.getElementById('current-password');
const newPasswordInput = document.getElementById('new-password');
const confirmPasswordInput = document.getElementById('confirm-password');

const STORAGE_EMAIL = 'nexus.profile.email';
const STORAGE_LANG = 'nexus.profile.language';
const STORAGE_TOGGLE_PREFIX = 'nexus.profile.toggle.';

function readStorage(key) {
  try {
    return localStorage.getItem(key);
  } catch (err) {
    return null;
  }
}

function writeStorage(key, value) {
  try {
    localStorage.setItem(key, value);
  } catch (err) {
    // Ignore storage failures in restricted browser contexts.
  }
}

function showPopupMessage(el, message, isSuccess) {
  if (!el) return;
  el.textContent = message || '';
  el.classList.toggle('success', !!isSuccess);
}

function openPopup(modalEl) {
  if (!modalEl) return;
  modalEl.classList.add('open');
  modalEl.setAttribute('aria-hidden', 'false');
}

function closePopup(modalEl) {
  if (!modalEl) return;
  modalEl.classList.remove('open');
  modalEl.setAttribute('aria-hidden', 'true');
}

function applyEmail(emailValue) {
  if (accountEmailValue) accountEmailValue.textContent = emailValue;
  if (heroEmail) heroEmail.textContent = emailValue;
}

function persistToggleState(input) {
  if (!input || !input.id) return;
  writeStorage(STORAGE_TOGGLE_PREFIX + input.id, input.checked ? '1' : '0');
}

function restoreToggleState(input) {
  if (!input || !input.id) return;
  const stored = readStorage(STORAGE_TOGGLE_PREFIX + input.id);
  if (stored === null) return;
  input.checked = stored === '1';
}

function updateTwoFactorLabel() {
  if (!twoFactor || !twoFactorLabel) return;
  twoFactorLabel.textContent = twoFactor.checked ? 'Enabled' : 'Disabled';
}

function clearFeedbackSoon() {
  window.setTimeout(() => {
    if (saveFeedback) saveFeedback.textContent = '';
  }, 1800);
}

function saveProfileSettings() {
  if (!saveBtn) return;

  const activeEmail = accountEmailValue ? accountEmailValue.textContent.trim() : '';
  if (activeEmail) writeStorage(STORAGE_EMAIL, activeEmail);
  if (languageSelect) writeStorage(STORAGE_LANG, languageSelect.value);

  toggleInputs.forEach(persistToggleState);

  saveBtn.disabled = true;
  saveBtn.textContent = 'Saving...';

  window.setTimeout(() => {
    saveBtn.disabled = false;
    saveBtn.textContent = 'Save Changes';

    if (saveFeedback) {
      saveFeedback.textContent = 'Saved just now';
      clearFeedbackSoon();
    }

    if (typeof showToast === 'function') {
      showToast('Profile settings saved successfully!');
    }
  }, 600);
}

function openPasswordPopup() {
  if (currentPasswordInput) currentPasswordInput.value = '';
  if (newPasswordInput) newPasswordInput.value = '';
  if (confirmPasswordInput) confirmPasswordInput.value = '';
  showPopupMessage(passwordPopupMessage, '', false);
  openPopup(passwordModal);
}

function saveNewPassword() {
  const currentValue = currentPasswordInput ? currentPasswordInput.value.trim() : '';
  const nextValue = newPasswordInput ? newPasswordInput.value.trim() : '';
  const confirmValue = confirmPasswordInput ? confirmPasswordInput.value.trim() : '';

  if (!currentValue || !nextValue || !confirmValue) {
    showPopupMessage(passwordPopupMessage, 'Please fill all password fields.', false);
    return;
  }

  if (nextValue.length < 8) {
    showPopupMessage(passwordPopupMessage, 'New password must be at least 8 characters.', false);
    return;
  }

  if (nextValue !== confirmValue) {
    showPopupMessage(passwordPopupMessage, 'New password and confirmation do not match.', false);
    return;
  }

  showPopupMessage(passwordPopupMessage, 'Password updated successfully.', true);
  window.setTimeout(() => {
    closePopup(passwordModal);
    if (typeof showToast === 'function') {
      showToast('Password updated successfully!');
    }
  }, 550);
}

function openEmailPopup() {
  const currentEmail = accountEmailValue ? accountEmailValue.textContent.trim() : '';
  if (newEmailInput) newEmailInput.value = currentEmail;
  showPopupMessage(emailPopupMessage, '', false);
  openPopup(emailModal);
}

function saveEmail() {
  if (!newEmailInput) return;
  const nextEmail = newEmailInput.value.trim();
  const validEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  if (!validEmail.test(nextEmail)) {
    showPopupMessage(emailPopupMessage, 'Please enter a valid email address.', false);
    return;
  }

  applyEmail(nextEmail);
  writeStorage(STORAGE_EMAIL, nextEmail);
  showPopupMessage(emailPopupMessage, 'Email updated.', true);

  window.setTimeout(() => {
    closePopup(emailModal);
    if (typeof showToast === 'function') {
      showToast('Email address updated successfully!');
    }
  }, 450);
}

document.querySelectorAll('[data-close-popup]').forEach(btn => {
  btn.addEventListener('click', () => {
    const modalId = btn.getAttribute('data-close-popup');
    const modal = modalId ? document.getElementById(modalId) : null;
    closePopup(modal);
  });
});

[passwordModal, emailModal].forEach(modal => {
  if (!modal) return;
  modal.addEventListener('click', event => {
    if (event.target === modal) closePopup(modal);
  });
});

document.addEventListener('keydown', event => {
  if (event.key !== 'Escape') return;
  closePopup(passwordModal);
  closePopup(emailModal);
});

if (twoFactor) {
  restoreToggleState(twoFactor);
  updateTwoFactorLabel();
  twoFactor.addEventListener('change', () => {
    updateTwoFactorLabel();
    persistToggleState(twoFactor);
  });
}

toggleInputs.forEach(toggle => {
  if (toggle.id !== 'two-factor') {
    restoreToggleState(toggle);
  }

  toggle.addEventListener('change', () => {
    persistToggleState(toggle);
  });
});

if (languageSelect) {
  const savedLanguage = readStorage(STORAGE_LANG);
  if (savedLanguage) languageSelect.value = savedLanguage;
  languageSelect.addEventListener('change', () => {
    writeStorage(STORAGE_LANG, languageSelect.value);
  });
}

const savedEmail = readStorage(STORAGE_EMAIL);
if (savedEmail) {
  applyEmail(savedEmail);
}

if (saveBtn) {
  saveBtn.addEventListener('click', saveProfileSettings);
}

if (logoutBtn) {
  logoutBtn.addEventListener('click', () => {
    // Robust session clearance
    localStorage.removeItem('nexus.auth.session');
    if (window.NexusAuth && typeof window.NexusAuth.clearSession === 'function') {
      window.NexusAuth.clearSession();
    }
    window.location.replace('../login.html');
  });
}

if (updatePasswordBtn) {
  updatePasswordBtn.addEventListener('click', openPasswordPopup);
}

if (savePasswordBtn) {
  savePasswordBtn.addEventListener('click', saveNewPassword);
}

if (emailEditBtn) {
  emailEditBtn.addEventListener('click', openEmailPopup);
}

if (saveEmailBtn) {
  saveEmailBtn.addEventListener('click', saveEmail);
}
