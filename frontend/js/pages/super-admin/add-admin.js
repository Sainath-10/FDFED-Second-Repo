if (typeof initSuperAdminSidebar === 'function') {
  initSuperAdminSidebar('admins', '../../');
}

const ACCOUNTS_KEY = 'nexus.auth.accounts';

function normalize(value) {
  return String(value || '').trim().toLowerCase();
}

function showFormError(msg) {
  let errBox = document.getElementById('add-admin-error-box');
  if (!errBox) {
    errBox = document.createElement('div');
    errBox.id = 'add-admin-error-box';
    errBox.style.cssText = 'padding:12px 16px;background:rgba(239,68,68,0.15);border:1px solid rgba(239,68,68,0.4);border-radius:10px;color:#ef4444;font-size:13px;font-weight:700;margin-bottom:16px;display:flex;align-items:center;gap:8px;';
    const form = document.getElementById('add-admin-page-form');
    if (form) form.insertBefore(errBox, form.firstChild);
  }
  errBox.innerHTML = `<span>⚠️</span> <span>${msg}</span>`;
  errBox.style.display = 'flex';
}

function clearFormError() {
  const errBox = document.getElementById('add-admin-error-box');
  if (errBox) errBox.style.display = 'none';
}

async function handleAddAdminFormSubmit(e) {
  e.preventDefault();
  clearFormError();

  const usernameInput = document.getElementById('page-admin-username');
  const username = usernameInput ? usernameInput.value.trim() : '';
  const adminType = document.getElementById('page-admin-type').value;

  if (!username) {
    showFormError('Please enter a username');
    if (typeof showToast === 'function') showToast('Please enter a username', 'error');
    return;
  }

  const submitBtn = document.getElementById('add-admin-submit-btn');
  if (submitBtn) submitBtn.disabled = true;

  try {
    const res = await fetch('http://localhost:3001/auth/add-admin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username,
        adminType
      })
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      const msg = data.message || 'Failed to update admin status in PostgreSQL database';
      showFormError(msg);
      throw new Error(msg);
    }

    // Sync LocalStorage cache
    try {
      const stored = JSON.parse(localStorage.getItem(ACCOUNTS_KEY) || '[]');
      const existingIdx = stored.findIndex(a => normalize(a.username) === normalize(username));
      const updatedItem = {
        username,
        email: (username.includes('@') ? username : `${username}@nexus.gg`),
        password: 'admin123',
        role: adminType,
        adminType: adminType
      };
      if (existingIdx >= 0) stored[existingIdx] = Object.assign(stored[existingIdx], updatedItem);
      else stored.push(updatedItem);
      localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(stored));
    } catch(err) {}

    if (typeof showToast === 'function') showToast(`Successfully granted ${adminType} access to ${username}!`, 'success');
    
    setTimeout(() => {
      window.location.href = 'admins.html';
    }, 600);
  } catch (err) {
    if (typeof showToast === 'function') showToast(err.message || 'Error saving admin', 'error');
    if (submitBtn) submitBtn.disabled = false;
  }
}

document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('add-admin-page-form');
  if (form) form.addEventListener('submit', handleAddAdminFormSubmit);
});
