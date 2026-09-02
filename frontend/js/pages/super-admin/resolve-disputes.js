const DISPUTE_STORE_KEY = 'nexus_admin_disputes';

function safeParse(json, fallback) {
    try {
        const parsed = JSON.parse(json);
        return parsed ?? fallback;
    } catch (err) {
        return fallback;
    }
}

function readDisputes() {
    const parsed = safeParse(localStorage.getItem(DISPUTE_STORE_KEY), []);
    return Array.isArray(parsed) ? parsed : [];
}

function saveDisputes(disputes) {
    localStorage.setItem(DISPUTE_STORE_KEY, JSON.stringify(disputes));
}

function escapeHtml(value) {
    return String(value || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function ensureShellConsistency() {
    if (typeof initSuperAdminSidebar === 'function') {
        initSuperAdminSidebar('disputes', '../../');
    }

    if (typeof initFooter === 'function') {
        if (document.getElementById('footer-mount')) {
            initFooter('../../');
        } else if (typeof getFooter === 'function') {
            const footer = document.querySelector('.site-footer');
            if (footer) footer.outerHTML = getFooter('../../');
        }
    }
}

function getEscalations(disputes) {
    return disputes.filter(dispute => dispute.escalated || dispute.status === 'escalated');
}

function getEscalationState(dispute) {
    if (dispute.superAdminState === 'resolved') return 'resolved';
    if (dispute.superAdminState === 'dismissed') return 'dismissed';
    return 'pending';
}

function renderEscalationCard(dispute) {
    const state = getEscalationState(dispute);
    const pending = state === 'pending';
    const stateClass = pending ? 'pending' : 'resolved';
    const badgeText = state === 'dismissed' ? 'Dismissed' : pending ? 'Pending' : 'Resolved';

    const decisionMessage = state === 'dismissed'
        ? '<div class="esc-meta-item"><strong>Decision:</strong> Escalation dismissed by Super Admin</div>'
        : state === 'resolved'
            ? '<div class="esc-meta-item"><strong>Decision:</strong> ' + escapeHtml(dispute.superAdminDecision || 'Resolved') + '</div>'
            : '';

    const cid = escapeHtml(dispute.cardId);
    const actions = pending
        ? '<div class="esc-side-actions">' +
              '<button class="btn-send-warning" onclick="event.stopPropagation();window.handleSendWarning(\'' + cid + '\')">' +
                  '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">' +
                      '<path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>' +
                      '<line x1="12" y1="9" x2="12" y2="13"></line>' +
                      '<line x1="12" y1="17" x2="12.01" y2="17"></line>' +
                  '</svg>' +
                  ' Send Warning' +
              '</button>' +
              '<button class="btn-ban-player" onclick="event.stopPropagation();window.handleBanPlayer(\'' + cid + '\')">' +
                  '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">' +
                      '<circle cx="12" cy="12" r="10"></circle>' +
                      '<line x1="4.93" y1="4.93" x2="19.07" y2="19.07"></line>' +
                  '</svg>' +
                  ' Ban Player' +
              '</button>' +
              '<button class="btn-dismiss" onclick="event.stopPropagation();window.handleDismiss(\'' + cid + '\')">' +
                  '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">' +
                      '<circle cx="12" cy="12" r="10"></circle>' +
                      '<line x1="15" y1="9" x2="9" y2="15"></line>' +
                      '<line x1="9" y1="9" x2="15" y2="15"></line>' +
                  '</svg>' +
                  ' Dismiss' +
              '</button>' +
          '</div>'
        : '';

    return '<div class="esc-card ' + stateClass + '" data-card-id="' + escapeHtml(dispute.cardId) + '" data-state="' + (pending ? 'pending' : 'resolved') + '">' +
        '<div class="esc-main-info">' +
            '<div class="esc-header-row">' +
                '<h4 class="esc-title">' + escapeHtml(dispute.title) + '</h4>' +
                '<span class="esc-badge ' + stateClass + '">' + badgeText + '</span>' +
            '</div>' +
            '<p class="esc-description">' + escapeHtml(dispute.description || 'Escalated dispute waiting for Super Admin action.') + '</p>' +
            (dispute.escalationSummary ? (
                '<div style="margin: 12px 0; padding: 12px; background: rgba(255,255,255,0.03); border-left: 3px solid var(--accent); border-radius: 4px;">' +
                    '<div style="font-size: 11px; color: var(--accent); text-transform: uppercase; margin-bottom: 4px; font-weight: 700;">Admin Escalation Notes</div>' +
                    '<div style="font-size: 13px; color: var(--text-white); font-style: italic;">"' + escapeHtml(dispute.escalationSummary) + '"</div>' +
                    '<div style="font-size: 11px; color: var(--text-muted); margin-top: 4px;">Reason: ' + escapeHtml(dispute.escalationReason || 'Other') + '</div>' +
                '</div>'
            ) : '') +
            '<div class="esc-meta-grid">' +
                '<div class="esc-meta-item">Reported By: <strong>' + escapeHtml(dispute.reporter || dispute.filedBy || 'Unknown') + '</strong></div>' +
                '<div class="esc-meta-item">UserName: <strong>' + escapeHtml(dispute.userName || dispute.against || 'Unknown') + '</strong></div>' +
                '<div class="esc-meta-item">Competition: <strong>' + escapeHtml(dispute.matchName || dispute.competition || 'N/A') + '</strong></div>' +
                '<div class="esc-meta-item">Date: <strong>' + escapeHtml(dispute.time || dispute.filedAt || dispute.updatedAt || 'N/A') + '</strong></div>' +
                '<div class="esc-meta-item">Dispute ID: <strong>' + escapeHtml(dispute.id || dispute.cardId) + '</strong></div>' +
                decisionMessage +
            '</div>' +
        '</div>' +
        actions +
    '</div>';
}

function renderEscalations() {
    const list = document.querySelector('.rd-escalation-list');
    if (!list) return;

    const disputes = readDisputes();
    const escalations = getEscalations(disputes);

    if (!escalations.length) {
        list.innerHTML = '<div class="esc-card resolved" data-state="resolved">' +
            '<div class="esc-main-info">' +
                '<div class="esc-header-row">' +
                    '<h4 class="esc-title">No escalated disputes yet</h4>' +
                    '<span class="esc-badge resolved">Resolved</span>' +
                '</div>' +
                '<p class="esc-description">Escalations from the admin disputes page will appear here automatically.</p>' +
            '</div>' +
        '</div>';
    } else {
        list.innerHTML = escalations.map(renderEscalationCard).join('');
    }

    updateStatCards();
}

function applyFilters() {
    const searchInput = document.querySelector('.filter-search input');
    const statusSelect = document.querySelectorAll('.filter-dropdown select')[0];
    const typeSelect = document.querySelectorAll('.filter-dropdown select')[1];
    const cards = document.querySelectorAll('.esc-card');

    const query = (searchInput?.value || '').toLowerCase();
    const statusFilter = (statusSelect?.value || 'all').toLowerCase();
    const typeFilter = (typeSelect?.value || 'all').toLowerCase();

    cards.forEach(card => {
        const title = card.querySelector('.esc-title')?.textContent.toLowerCase() || '';
        const desc = card.querySelector('.esc-description')?.textContent.toLowerCase() || '';
        const meta = Array.from(card.querySelectorAll('.esc-meta-item')).map(m => m.textContent.toLowerCase()).join(' ');
        const cardStatus = card.dataset.state || 'pending';

        const matchesSearch = !query || title.includes(query) || desc.includes(query) || meta.includes(query);
        const matchesStatus = statusFilter.includes('all') || cardStatus === statusFilter;
        const matchesType = typeFilter.includes('all') || title.includes(typeFilter);

        card.style.display = matchesSearch && matchesStatus && matchesType ? 'flex' : 'none';
    });

    updateStatCards();
}

function initFilters() {
    const searchInput = document.querySelector('.filter-search input');
    const statusSelect = document.querySelectorAll('.filter-dropdown select')[0];
    const typeSelect = document.querySelectorAll('.filter-dropdown select')[1];

    if (!searchInput || !statusSelect || !typeSelect) return;

    searchInput.addEventListener('input', applyFilters);
    statusSelect.addEventListener('change', applyFilters);
    typeSelect.addEventListener('change', applyFilters);
}

function updateDisputeState(cardId, nextState, decision) {
    const disputes = readDisputes();
    const dispute = disputes.find(item => String(item.cardId) === String(cardId));
    if (!dispute) return false;

    dispute.escalated = true;
    dispute.status = 'resolved';
    dispute.superAdminState = nextState;
    dispute.superAdminDecision = decision || (nextState === 'dismissed' ? 'Dismissed' : 'Resolved');
    dispute.updatedAt = new Date().toISOString();

    saveDisputes(disputes);
    return true;
}

/**
 * Helper: push a notification via NexusTeamWorkflow or directly to localStorage
 */
function pushNotif(toUsername, title, body, type, status) {
    if (window.NexusTeamWorkflow && typeof window.NexusTeamWorkflow.pushNotification === 'function') {
        window.NexusTeamWorkflow.pushNotification({
            toUsername: toUsername,
            type: type || 'system',
            status: status || 'approved',
            title: title,
            body: body,
            createdAt: new Date().toISOString(),
            read: false
        });
    } else {
        // Fallback: write directly to localStorage
        var NOTIF_KEY = 'nexus.notifications.items';
        try {
            var items = JSON.parse(localStorage.getItem(NOTIF_KEY) || '[]');
            items.unshift({
                id: 'notif-' + Math.random().toString(36).slice(2, 10),
                toUsername: toUsername,
                type: type || 'system',
                status: status || 'approved',
                title: title,
                body: body,
                createdAt: new Date().toISOString(),
                read: false,
                meta: {}
            });
            localStorage.setItem(NOTIF_KEY, JSON.stringify(items));
        } catch(e) { console.error('Notification fallback failed:', e); }
    }
}

/**
 * Custom Modal — built entirely from JS, no HTML/CSS dependency
 */
window.showConfirmModal = function(options) {
    // Remove any existing modal
    var existing = document.getElementById('_nexus_modal_');
    if (existing) existing.remove();

    var isDanger = options.type === 'danger';

    // Overlay
    var overlay = document.createElement('div');
    overlay.id = '_nexus_modal_';
    overlay.style.cssText = [
        'position:fixed', 'top:0', 'left:0', 'width:100vw', 'height:100vh',
        'background:rgba(0,0,0,0.75)', 'display:flex', 'align-items:center',
        'justify-content:center', 'z-index:2147483647', 'padding:24px',
        'box-sizing:border-box', 'font-family:sans-serif'
    ].join(';');

    // Box
    var box = document.createElement('div');
    box.style.cssText = [
        'background:#111', 'border:2px solid ' + (isDanger ? '#e7000b' : '#c6ff33'),
        'border-radius:16px', 'padding:36px 32px', 'max-width:420px', 'width:100%',
        'text-align:center', 'box-shadow:0 24px 60px rgba(0,0,0,0.9)',
        'position:relative', 'z-index:2147483647'
    ].join(';');

    // Title
    var title = document.createElement('h3');
    title.textContent = options.title || 'Confirm Action';
    title.style.cssText = 'margin:0 0 12px; font-size:20px; font-weight:900; color:#fff; text-transform:uppercase; letter-spacing:1px;';

    // Body
    var body = document.createElement('p');
    body.textContent = options.body || 'Are you sure?';
    body.style.cssText = 'margin:0 0 28px; font-size:15px; color:rgba(255,255,255,0.65); line-height:1.6;';

    // Button row
    var row = document.createElement('div');
    row.style.cssText = 'display:flex; gap:12px; justify-content:center;';

    var cancelBtn = document.createElement('button');
    cancelBtn.textContent = options.cancelText || 'Reject';
    cancelBtn.style.cssText = 'padding:12px 28px; border-radius:8px; font-size:14px; font-weight:800; text-transform:uppercase; cursor:pointer; background:transparent; color:#fff; border:1px solid rgba(255,255,255,0.25); letter-spacing:0.5px;';

    var confirmBtn = document.createElement('button');
    confirmBtn.textContent = options.confirmText || 'Confirm';
    confirmBtn.style.cssText = isDanger
        ? 'padding:12px 28px; border-radius:8px; font-size:14px; font-weight:800; text-transform:uppercase; cursor:pointer; background:#e7000b; color:#fff; border:none; letter-spacing:0.5px;'
        : 'padding:12px 28px; border-radius:8px; font-size:14px; font-weight:800; text-transform:uppercase; cursor:pointer; background:#c6ff33; color:#000; border:none; letter-spacing:0.5px;';

    var closeModal = function() { overlay.remove(); };

    cancelBtn.onclick = function(e) { e.stopPropagation(); closeModal(); };
    confirmBtn.onclick = function(e) {
        e.stopPropagation();
        closeModal();
        if (typeof options.onConfirm === 'function') options.onConfirm();
    };
    overlay.onclick = function(e) { if (e.target === overlay) closeModal(); };

    row.appendChild(cancelBtn);
    row.appendChild(confirmBtn);
    box.appendChild(title);
    box.appendChild(body);
    box.appendChild(row);
    overlay.appendChild(box);
    document.body.appendChild(overlay);
};

/**
 * SEND WARNING handler
 */
window.handleSendWarning = function(cardId) {
    console.log('[Action] Send Warning clicked, cardId:', cardId);
    if (!cardId) return;

    var disputes = readDisputes();
    var dispute = disputes.find(function(d) { return String(d.cardId) === String(cardId); });
    if (!dispute) { console.error('[Action] Dispute not found for cardId:', cardId); return; }

    var targetUser = dispute.userName || dispute.against || 'Unknown User';
    var reporter = dispute.reporter || dispute.filedBy || 'Unknown';

    window.showConfirmModal({
        title: 'Confirm Warning',
        body: 'Are you sure you want to send a warning to ' + targetUser + '?',
        type: 'warning',
        confirmText: 'Confirm',
        cancelText: 'Reject',
        onConfirm: function() {
            console.log('[Action] Warning confirmed for:', targetUser);

            // Set warning flag on user account
            try {
                var ACCOUNTS_KEY = 'nexus.auth.accounts';
                var accounts = JSON.parse(localStorage.getItem(ACCOUNTS_KEY) || '[]');
                var idx = accounts.findIndex(function(a) { return (a.username || '').toLowerCase() === targetUser.toLowerCase(); });
                if (idx >= 0) {
                    if (!Array.isArray(accounts[idx].warnings)) accounts[idx].warnings = [];
                    accounts[idx].warnings.push({
                        reason: dispute.title || 'Platform violation',
                        disputeId: dispute.id || dispute.cardId,
                        issuedAt: new Date().toISOString(),
                        seen: false
                    });
                    localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(accounts));
                    console.log('[Action] Warning flag set on account');
                }
            } catch(e) { console.error('Failed to set warning flag:', e); }

            // Notifications
            pushNotif(targetUser, 'Formal Platform Warning',
                'You have received a formal warning regarding the dispute: "' + (dispute.title || 'N/A') + '". Further violations may lead to account suspension.',
                'system-warning', 'rejected');

            pushNotif(reporter, 'Dispute Update — Warning Issued',
                'The player "' + targetUser + '" has been given a formal warning regarding your report: "' + (dispute.title || 'N/A') + '".',
                'system', 'approved');

            pushNotif('admin@nexus.gg', 'Super Admin Action — Warning Issued',
                'Super Admin has issued a warning to "' + targetUser + '" for dispute: "' + (dispute.title || 'N/A') + '".',
                'system', 'approved');

            var updated = updateDisputeState(cardId, 'resolved', 'Warning Sent');
            if (updated) {
                if (typeof showToast === 'function') showToast('Warning sent to ' + targetUser + '. Escalation resolved.');
                renderEscalations();
            }
        }
    });
};

/**
 * Remove a banned player from every team in every competition.
 * - Removes them from members/invites/joinRequests
 * - Disbands (removes) any team they were captain of
 */
function removePlayerFromAllCompetitions(username) {
    var uname = (username || '').trim().toLowerCase();
    if (!uname) return;

    var COMP_KEY = 'nexus_competitions';

    try {
        var comps = JSON.parse(localStorage.getItem(COMP_KEY) || '[]');
        if (!Array.isArray(comps)) return;

        comps.forEach(function(comp) {
            if (!comp) return;
            if (!Array.isArray(comp.teams)) comp.teams = [];

            // Step 1: strip user from members/invites/joinRequests on every team
            comp.teams.forEach(function(team) {
                if (!team) return;

                if (Array.isArray(team.members)) {
                    team.members = team.members.filter(function(m) {
                        var mu = (typeof m === 'string' ? m : (m && (m.username || m.name) || '')).trim().toLowerCase();
                        return mu !== uname;
                    });
                    team.players = team.members.length;
                }

                if (Array.isArray(team.invites)) {
                    team.invites = team.invites.filter(function(inv) {
                        return (inv && (inv.toUsername || inv.username || '')).trim().toLowerCase() !== uname;
                    });
                }

                if (Array.isArray(team.joinRequests)) {
                    team.joinRequests = team.joinRequests.filter(function(jr) {
                        return (jr && (jr.username || jr.from || '')).trim().toLowerCase() !== uname;
                    });
                }
            });

            // Step 2: remove any team the banned user was captain/creator of
            // Also remove teams that now have 0 members
            comp.teams = comp.teams.filter(function(team) {
                if (!team) return false;
                var creator = (team.createdBy || team.leaderUsername || team.captain || '').trim().toLowerCase();
                var teamName = (team.name || '').trim().toLowerCase();
                // Remove if: creator is the banned user OR team name matches username (edge case) OR team is now empty
                if (creator === uname || teamName === uname) return false;
                if (!team.members || team.members.length === 0) return false;
                return true;
            });
        });

        localStorage.setItem(COMP_KEY, JSON.stringify(comps));
        console.log('[Ban] Removed "' + uname + '" from all competitions and disbanded their teams');

    } catch(e) {
        console.error('[Ban] Failed to remove player from competitions:', e);
    }
}

/**
 * BAN PLAYER handler
 */
window.handleBanPlayer = function(cardId) {
    console.log('[Action] Ban Player clicked, cardId:', cardId);
    if (!cardId) return;

    var disputes = readDisputes();
    var dispute = disputes.find(function(d) { return String(d.cardId) === String(cardId); });
    if (!dispute) { console.error('[Action] Dispute not found for cardId:', cardId); return; }

    var targetUser = dispute.userName || dispute.against || 'Unknown User';
    var reporter = dispute.reporter || dispute.filedBy || 'Unknown';

    window.showConfirmModal({
        title: 'Confirm Ban',
        body: 'Confirm to ban player. Once banned this user cannot log in again.',
        type: 'danger',
        confirmText: 'Confirm',
        cancelText: 'Reject',
        onConfirm: function() {
            console.log('[Action] Ban confirmed for:', targetUser);

            // 1. Ban the user account + kill their active session
            try {
                var ACCOUNTS_KEY = 'nexus.auth.accounts';
                var SESSION_KEY = 'nexus.auth.session';

                var accounts = JSON.parse(localStorage.getItem(ACCOUNTS_KEY) || '[]');
                var idx = accounts.findIndex(function(a) {
                    return (a.username || '').toLowerCase() === targetUser.toLowerCase();
                });
                if (idx >= 0) {
                    accounts[idx].banned = true;
                    localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(accounts));
                    console.log('[Ban] Account flagged as banned');
                } else {
                    // Account not in stored list — add a ban record anyway
                    accounts.push({ username: targetUser, banned: true, role: 'participant' });
                    localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(accounts));
                    console.log('[Ban] New ban record added for:', targetUser);
                }

                // Kill their session if they're currently logged in
                try {
                    var sess = JSON.parse(localStorage.getItem(SESSION_KEY) || 'null');
                    if (sess && (sess.username || '').toLowerCase() === targetUser.toLowerCase()) {
                        localStorage.removeItem(SESSION_KEY);
                        console.log('[Ban] Killed active session for:', targetUser);
                    }
                } catch(se) {}

            } catch(e) {
                console.error('[Ban] Failed to ban user in storage:', e);
            }

            // 2. Remove from all competitions / teams
            removePlayerFromAllCompetitions(targetUser);

            // 3. Notifications
            pushNotif(targetUser, 'Account Permanently Banned',
                'Your account has been permanently banned due to the dispute: "' + (dispute.title || 'N/A') + '". You will no longer be able to log in.',
                'system-ban', 'rejected');

            pushNotif(reporter, 'Player Banned — Dispute Update',
                'The player "' + targetUser + '" has been permanently banned and removed from all competitions regarding your report: "' + (dispute.title || 'N/A') + '".',
                'system', 'approved');

            pushNotif('admin@nexus.gg', 'Super Admin Action — Player Banned',
                'Super Admin has permanently banned "' + targetUser + '" and removed them from all competitions. Dispute: "' + (dispute.title || 'N/A') + '".',
                'system', 'approved');

            var updated = updateDisputeState(cardId, 'resolved', 'Player Banned');
            if (updated) {
                if (typeof showToast === 'function') showToast('Player ' + targetUser + ' has been permanently banned.', 'error');
                renderEscalations();
            }
        }
    });
};

/**
 * DISMISS handler
 */
window.handleDismiss = function(cardId) {
    if (!cardId) return;

    window.showConfirmModal({
        title: 'DISMISS ESCALATION?',
        body: 'Are you sure you want to dismiss this escalation? No action will be taken.',
        type: 'warning',
        confirmText: 'YES, DISMISS',
        cancelText: 'NO, CANCEL',
        onConfirm: function() {
            var updated = updateDisputeState(cardId, 'dismissed', 'Escalation Dismissed');
            if (updated) {
                if (typeof showToast === 'function') showToast('Escalation dismissed and marked resolved.');
                renderEscalations();
            }
        }
    });
};

function updateStatCards() {
    const allDisputes = readDisputes();
    const escalations = getEscalations(allDisputes);

    const total    = escalations.length;
    const pending  = escalations.filter(d => getEscalationState(d) === 'pending').length;
    const resolved = escalations.filter(d => getEscalationState(d) !== 'pending').length;

    const totalEl   = document.getElementById('rd-stat-total');
    const pendingEl = document.getElementById('rd-stat-pending');
    const resolvedEl = document.getElementById('rd-stat-resolved');

    if (totalEl)   totalEl.textContent   = total;
    if (pendingEl) pendingEl.textContent = pending;
    if (resolvedEl) resolvedEl.textContent = resolved;

    const countEl = document.querySelector('.rd-list-title');
    if (countEl) countEl.textContent = 'Escalation Requests (' + total + ')';
}

window.addEventListener('storage', function(event) {
    if (event.key !== DISPUTE_STORE_KEY) return;
    renderEscalations();
});

document.addEventListener('DOMContentLoaded', function() {
    console.log('[Nexus] Resolve Disputes initialized');
    ensureShellConsistency();
    renderEscalations();
    initFilters();

    // Global click listener for dispute actions
    document.addEventListener('click', function(e) {
        var btn = e.target.closest('button[data-action]');
        if (!btn) return;

        e.preventDefault();
        e.stopPropagation();
        var action = btn.dataset.action;

        var card = btn.closest('.esc-card');
        if (!card) return;
        var cardId = card.dataset.cardId;

        console.log('[Click] Action:', action, 'CardId:', cardId);

        if (action === 'send-warning') {
            window.handleSendWarning(cardId);
        } else if (action === 'ban-player') {
            window.handleBanPlayer(cardId);
        } else if (action === 'dismiss') {
            window.handleDismiss(cardId);
        }
    });
});
