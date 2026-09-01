if (typeof initSuperAdminSidebar === 'function') {
  initSuperAdminSidebar('admins', '../../');
}

const ACCOUNTS_KEY = 'nexus.auth.accounts';

function normalize(value) {
  return String(value || '').trim().toLowerCase();
}

function showRevokeFormError(msg) {
  let errBox = document.getElementById('revoke-admin-error-box');
  if (!errBox) {
    errBox = document.createElement('div');
    errBox.id = 'revoke-admin-error-box';
    errBox.style.cssText = 'padding:12px 16px;background:rgba(239,68,68,0.15);border:1px solid rgba(239,68,68,0.4);border-radius:10px;color:#ef4444;font-size:13px;font-weight:700;margin-bottom:16px;display:flex;align-items:center;gap:8px;';
    const form = document.getElementById('revoke-admin-page-form');
    if (form) form.insertBefore(errBox, form.firstChild);
  }
  errBox.innerHTML = `<span>⚠️</span> <span>${msg}</span>`;
  errBox.style.display = 'flex';
}

function clearRevokeFormError() {
  const errBox = document.getElementById('revoke-admin-error-box');
  if (errBox) errBox.style.display = 'none';
}

async function handleRevokeAdminFormSubmit(e) {
  e.preventDefault();
  clearRevokeFormError();

  const username = document.getElementById('page-revoke-username').value.trim();
  const reason = document.getElementById('page-revoke-reason').value.trim();

  if (!username || !reason) {
    showRevokeFormError('Please enter both username and reason');
    if (typeof showToast === 'function') showToast('Please enter both username and reason', 'error');
    return;
  }

  const submitBtn = document.getElementById('revoke-admin-submit-btn');
  if (submitBtn) submitBtn.disabled = true;

  try {
    const res = await fetch('http://localhost:3001/auth/revoke-admin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username,
        reason
      })
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      const msg = data.message || 'Failed to revoke admin in database';
      showRevokeFormError(msg);
      throw new Error(msg);
    }

    // Sync LocalStorage cache
    try {
      const stored = JSON.parse(localStorage.getItem(ACCOUNTS_KEY) || '[]');
      const item = stored.find(a => normalize(a.username) === normalize(username));
      if (item) {
        item.role = 'participant';
        item.adminType = null;
        localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(stored));
      }
    } catch(err) {}

    if (typeof showToast === 'function') showToast(`Revoked admin privileges for ${username}. Reason recorded in DB.`, 'success');
    
    setTimeout(() => {
      window.location.href = 'admins.html';
    }, 600);
  } catch (err) {
    if (typeof showToast === 'function') showToast(err.message || 'Error revoking admin', 'error');
    if (submitBtn) submitBtn.disabled = false;
  }
}

document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('revoke-admin-page-form');
  if (form) form.addEventListener('submit', handleRevokeAdminFormSubmit);
});
