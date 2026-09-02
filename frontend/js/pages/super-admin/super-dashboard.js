const DASHBOARD_STATE_KEY = 'nexus.superadmin.dashboard.state';
const ACCOUNTS_KEY = 'nexus.auth.accounts';
const SESSION_KEY = 'nexus.auth.session';

let initialDashboardState = null;

function normalize(value) {
    return String(value || '').trim().toLowerCase();
}

function getDashboardControls() {
    return Array.from(document.querySelectorAll('input, select, textarea')).filter((el) => {
        const id = el.id || '';
        if (id === 'add-admin-user-id' || id === 'add-admin-email' || id === 'revoke-role-user-id' || id === 'revoke-role-select') {
            return false;
        }
        return true;
    });
}

function captureDashboardState() {
    const state = {};
    getDashboardControls().forEach((el, index) => {
        const key = el.id || ('ctrl-' + index);
        if (el.type === 'checkbox') {
            state[key] = !!el.checked;
        } else {
            state[key] = el.value;
        }
    });
    return state;
}

function applyDashboardState(state) {
    const safeState = state || {};
    getDashboardControls().forEach((el, index) => {
        const key = el.id || ('ctrl-' + index);
        if (!(key in safeState)) return;
        if (el.type === 'checkbox') {
            el.checked = !!safeState[key];
        } else {
            el.value = safeState[key];
        }
    });
}

function loadDashboardStateFromStorage() {
    try {
        return JSON.parse(localStorage.getItem(DASHBOARD_STATE_KEY) || 'null');
    } catch (_) {
        return null;
    }
}

function readAccounts() {
    try {
        const parsed = JSON.parse(localStorage.getItem(ACCOUNTS_KEY) || '[]');
        return Array.isArray(parsed) ? parsed : [];
    } catch (_) {
        return [];
    }
}

function saveAccounts(accounts) {
    localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(accounts));
}

function syncCurrentSessionRole(updatedAccount) {
    if (!updatedAccount) return;
    try {
        const session = JSON.parse(localStorage.getItem(SESSION_KEY) || 'null');
        if (!session || !session.username) return;
        if (normalize(session.username) !== normalize(updatedAccount.username)) return;
        session.role = updatedAccount.role;
        localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    } catch (_) {}
}

function findAccountByUserAndEmail(userId, emailId) {
    const userKey = normalize(userId);
    const emailKey = normalize(emailId);
    if (!userKey || !emailKey) return null;

    const accounts = readAccounts();
    return accounts.find((entry) => {
        return normalize(entry.username) === userKey && normalize(entry.email) === emailKey;
    }) || null;
}

// Super Admin Dashboard Logic
document.addEventListener('DOMContentLoaded', () => {
    if (typeof initSuperAdminSidebar === 'function') {
        initSuperAdminSidebar('dashboard', '../../');
    }

    if (typeof initFooter === 'function') {
        initFooter('../../');
    }

    initialDashboardState = captureDashboardState();
    const persisted = loadDashboardStateFromStorage();
    if (persisted) {
        applyDashboardState(persisted);
    }
});

/**
 * Tab Switching Logic
 */
function switchTab(btn, tabId) {
    // Remove active class from all buttons
    document.querySelectorAll('.sa-tab-btn').forEach(b => b.classList.remove('active'));
    // Add active class to clicked button
    btn.classList.add('active');

    // Hide all panels
    document.querySelectorAll('.sa-tab-panel').forEach(p => p.classList.remove('active'));
    // Show target panel
    const target = document.getElementById(`tab-${tabId}`);
    if (target) {
        target.classList.add('active');
    }
}

/**
 * Mock Action Handlers
 */
function saveDashboardChanges() {
    const state = captureDashboardState();
    localStorage.setItem(DASHBOARD_STATE_KEY, JSON.stringify(state));
    if (typeof showToast === 'function') {
        showToast('Dashboard changes saved.');
    }
}

function resetDashboardChanges() {
    if (!initialDashboardState) {
        initialDashboardState = captureDashboardState();
    }
    applyDashboardState(initialDashboardState);
    localStorage.removeItem(DASHBOARD_STATE_KEY);
    if (typeof showToast === 'function') {
        showToast('Dashboard reset to original defaults.');
    }
}

function handleAddAdmin() {
    const userIdInput = document.getElementById('add-admin-user-id');
    const emailInput = document.getElementById('add-admin-email');
    if (!userIdInput || !emailInput) return;

    const userId = userIdInput.value.trim();
    const email = emailInput.value.trim();

    if (!userId || !email) {
        if (typeof showToast === 'function') showToast('Please provide both User ID and Email.', 'error');
        return;
    }

    const accounts = readAccounts();
    if (!accounts.length) {
        if (typeof showToast === 'function') showToast('No registered users found. Ask user to sign up first.', 'error');
        return;
    }

    const account = accounts.find((entry) => {
        return normalize(entry.username) === normalize(userId) && normalize(entry.email) === normalize(email);
    });

    if (!account) {
        if (typeof showToast === 'function') showToast('User ID and email must belong to an existing account.', 'error');
        return;
    }

    account.role = 'admin';
    saveAccounts(accounts);
    syncCurrentSessionRole(account);

    if (typeof showToast === 'function') {
        showToast('Admin privileges granted to ' + account.username + '.');
    }

    userIdInput.value = '';
    emailInput.value = '';
}

function handleRevokeRole() {
    const userIdInput = document.getElementById('revoke-role-user-id');
    const roleSelect = document.getElementById('revoke-role-select');
    if (!userIdInput || !roleSelect) return;

    if (!userIdInput.value || roleSelect.selectedIndex === 0) {
        if (typeof showToast === 'function') showToast('Please specify a user and role to revoke.', 'error');
        return;
    }

    const requestedRole = roleSelect.value;
    const userId = userIdInput.value.trim();
    const accounts = readAccounts();
    const account = accounts.find((entry) => normalize(entry.username) === normalize(userId));

    if (!account) {
        if (typeof showToast === 'function') showToast('User not found.', 'error');
        return;
    }

    if (confirm(`Are you sure you want to revoke the "${requestedRole}" role from user "${userId}"?`)) {
        if (requestedRole === 'Admin') {
            account.role = 'regular';
            saveAccounts(accounts);
            syncCurrentSessionRole(account);
        }

        if (typeof showToast === 'function') {
            showToast(`Role "${requestedRole}" revoked from ${userId}.`, 'error');
            userIdInput.value = '';
            roleSelect.selectedIndex = 0;
        }
    }
}

function handleBackupNow() {
    if (typeof showToast === 'function') {
        showToast('System backup initiated... 0%', 'info');
        setTimeout(() => showToast('Backup completed successfully! 100%'), 1500);
    }
}

// Global exposure
window.switchTab = switchTab;
window.saveDashboardChanges = saveDashboardChanges;
window.resetDashboardChanges = resetDashboardChanges;
window.handleAddAdmin = handleAddAdmin;
window.handleRevokeRole = handleRevokeRole;
window.handleBackupNow = handleBackupNow;
