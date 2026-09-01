if (typeof initSuperAdminSidebar === 'function') {
  initSuperAdminSidebar('admins', '../../');
}

const ACCOUNTS_KEY = 'nexus.auth.accounts';

function normalize(value) {
  return String(value || '').trim().toLowerCase();
}

async function handleAddAdminFormSubmit(e) {
  e.preventDefault();
  const usernameInput = document.getElementById('page-admin-username');
  const username = usernameInput ? usernameInput.value.trim() : '';
  const adminType = document.getElementById('page-admin-type').value;

  if (!username) {
    if (typeof showToast === 'function') showToast('Please enter a username', 'error');
    else alert('Please enter a username');
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

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.message || 'Failed to update admin status in PostgreSQL database');
    }

    // Sync LocalStorage cache
    try {
      const stored = JSON.parse(localStorage.getItem(ACCOUNTS_KEY) || '[]');
      const existingIdx = stored.findIndex(a => normalize(a.username) === normalize(username));
      const updatedItem = {
        username,
        email: email || (username.includes('@') ? username : `${username}@nexus.gg`),
        password: password || 'admin123',
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
    else alert(err.message || 'Error saving admin');
    if (submitBtn) submitBtn.disabled = false;
  }
}

document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('add-admin-page-form');
  if (form) form.addEventListener('submit', handleAddAdminFormSubmit);
});
