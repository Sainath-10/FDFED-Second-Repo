if (typeof initSuperAdminSidebar === 'function') {
  initSuperAdminSidebar('admins', '../../');
}

const ACCOUNTS_KEY = 'nexus.auth.accounts';

function normalize(value) {
  return String(value || '').trim().toLowerCase();
}

async function handleRevokeAdminFormSubmit(e) {
  e.preventDefault();
  const username = document.getElementById('page-revoke-username').value.trim();
  const reason = document.getElementById('page-revoke-reason').value.trim();

  if (!username || !reason) {
    if (typeof showToast === 'function') showToast('Please enter both username and reason', 'error');
    else alert('Please enter both username and reason');
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

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.message || 'Failed to revoke admin in database');
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
    else alert(err.message || 'Error revoking admin');
    if (submitBtn) submitBtn.disabled = false;
  }
}

document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('revoke-admin-page-form');
  if (form) form.addEventListener('submit', handleRevokeAdminFormSubmit);
});
