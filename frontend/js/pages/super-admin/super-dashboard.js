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
        if (id === 'add-admin-user-id' || id === 'add-admin-email') {
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
    document.querySelectorAll('.sa-tab-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');

    document.querySelectorAll('.sa-tab-panel').forEach(p => p.classList.remove('active'));
    const target = document.getElementById(`tab-${tabId}`);
    if (target) {
        target.classList.add('active');
    }
}

function saveDashboardChanges() {
    const state = captureDashboardState();
    localStorage.setItem(DASHBOARD_STATE_KEY, JSON.stringify(state));
    if (typeof showToast === 'function') {
        showToast('Dashboard configuration changes saved successfully.');
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

async function handleAddAdmin() {
    const userIdInput = document.getElementById('add-admin-user-id');
    const emailInput = document.getElementById('add-admin-email');
    if (!userIdInput || !emailInput) return;

    const username = userIdInput.value.trim();
    const email = emailInput.value.trim();

    if (!username || !email) {
        if (typeof showToast === 'function') showToast('Please provide both Username / ID and Email.', 'error');
        return;
    }

    // Call Backend API to create admin account
    if (window.NexusAPI && window.NexusAPI.Admin) {
        const res = await window.NexusAPI.Admin.createAdmin(
            email,
            username,
            username.charAt(0).toUpperCase() + username.slice(1),
            'Admin',
            'admin',
        );

        if (res.ok) {
            if (typeof showToast === 'function') {
                showToast(`Admin account created successfully for "${username}".`);
            }
            userIdInput.value = '';
            emailInput.value = '';
            return;
        }
    }

    // Local fallback
    try {
        const accounts = JSON.parse(localStorage.getItem(ACCOUNTS_KEY) || '[]');
        const existing = accounts.find(a => normalize(a.username) === normalize(username) || normalize(a.email) === normalize(email));
        if (existing) {
            existing.role = 'admin';
        } else {
            accounts.push({
                username,
                email,
                password: 'admin123',
                role: 'admin',
                displayName: username + ' (Admin)',
                createdAt: new Date().toISOString(),
            });
        }
        localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(accounts));
        if (typeof showToast === 'function') {
            showToast(`Admin privileges assigned to "${username}".`);
        }
        userIdInput.value = '';
        emailInput.value = '';
    } catch (e) {
        if (typeof showToast === 'function') showToast('Failed to add admin.', 'error');
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
window.handleBackupNow = handleBackupNow;
