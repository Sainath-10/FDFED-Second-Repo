initSidebar('notifications', '../');
initFooter('../');

const notifTabs = document.querySelectorAll('.notif-tab');
const notifSearch = document.getElementById('notif-search');

function getNotifItems() {
  return document.querySelectorAll('.notif-item');
}

function readSession() {
  try {
    const raw = localStorage.getItem('nexus.auth.session');
    return raw ? JSON.parse(raw) : null;
  } catch (err) {
    return null;
  }
}

function buildDynamicNotificationItem(item) {
  const status = item.status || 'pending';
  const statusClass = status === 'approved' ? 'approved' : (status === 'rejected' ? 'rejected' : 'pending');
  const unreadClass = item.read ? '' : ' unread';
  const dot = item.read ? '' : '<div class="notif-dot"></div>';
  const when = item.createdAt ? new Date(item.createdAt).toLocaleString() : 'just now';
  const actions = buildDynamicActions(item, statusClass);
  const type = item.type || 'system';

  return `
    <div class="notif-item status-${statusClass}${unreadClass}" data-status="${statusClass}" data-dynamic="true" data-notif-id="${item.id}" data-notif-type="${type}">
      ${dot}
      <div class="notif-status-label status-${statusClass}-bg">${statusClass.toUpperCase()}</div>
      <div class="notif-content-wrap">
        <div class="notif-title-row">
          <h3>${item.title || 'Notification'}</h3>
          <span class="notif-time-alt">${when}</span>
        </div>
        <p class="notif-body-text">${item.body || ''}</p>
        ${actions}
      </div>
    </div>
  `;
}

function buildDynamicActions(item, statusClass) {
  if (statusClass !== 'pending') return '';

  const isJoinRequest = item.type === 'team-join-request';
  const isInvite = item.type === 'team-invite';
  if (!isJoinRequest && !isInvite) return '';

  const positiveLabel = isJoinRequest ? 'Accept Player' : 'Accept Invite';
  const negativeLabel = isJoinRequest ? 'Reject Player' : 'Reject Invite';

  return `
    <div class="notif-actions-row">
      <button class="btn-notif-accept" onclick="processNotificationAction('${item.id}','accepted')">${positiveLabel}</button>
      <button class="btn-notif-reject" onclick="processNotificationAction('${item.id}','declined')">${negativeLabel}</button>
    </div>
  `;
}

function renderDynamicNotifications() {
  const list = document.getElementById('notif-list');
  const emptyState = document.getElementById('notif-empty-state');
  if (!list) return;

  list.querySelectorAll('[data-dynamic="true"]').forEach(el => el.remove());

  const session = readSession();
  if (!session || !window.NexusTeamWorkflow || typeof window.NexusTeamWorkflow.getNotificationsForUser !== 'function') {
    // No session or workflow — show empty state if list has nothing
    if (emptyState) emptyState.style.display = list.children.length === 0 ? 'block' : 'none';
    updateTabCounts();
    return;
  }

  const dynamicItems = window.NexusTeamWorkflow.getNotificationsForUser(session.username);
  if (!dynamicItems.length) {
    if (emptyState) emptyState.style.display = list.children.length === 0 ? 'block' : 'none';
    updateTabCounts();
    return;
  }

  if (emptyState) emptyState.style.display = 'none';
  const markup = dynamicItems.map(buildDynamicNotificationItem).join('');
  list.insertAdjacentHTML('afterbegin', markup);
  updateTabCounts();
}

function updateTabCounts() {
  const items = Array.from(getNotifItems());
  const totals = {
    all: items.length,
    pending: items.filter(item => item.dataset.status === 'pending').length,
    approved: items.filter(item => item.dataset.status === 'approved').length,
    rejected: items.filter(item => item.dataset.status === 'rejected').length
  };

  notifTabs.forEach(tab => {
    const filter = tab.dataset.filter || 'all';
    const badge = tab.querySelector('.count-badge');
    if (badge && typeof totals[filter] === 'number') {
      badge.textContent = String(totals[filter]);
    }
  });
}

function processNotificationAction(notificationId, action) {
  const session = readSession();
  if (!session || !window.NexusTeamWorkflow) {
    if (typeof showToast === 'function') showToast('Please log in first.', 'error');
    return;
  }

  const item = window.NexusTeamWorkflow.getNotificationById(notificationId, session.username);
  if (!item) {
    if (typeof showToast === 'function') showToast('Notification not found.', 'error');
    return;
  }

  const meta = item.meta || {};
  let result = { ok: false, error: 'Unsupported action.' };

  if (item.type === 'team-join-request') {
    result = window.NexusTeamWorkflow.decideJoinRequest({
      compId: meta.compId,
      teamId: meta.teamId,
      requestId: meta.requestId,
      action: action
    });
  } else if (item.type === 'team-invite') {
    result = window.NexusTeamWorkflow.decideInvite({
      compId: meta.compId,
      teamId: meta.teamId,
      inviteId: meta.inviteId,
      action: action
    });
  }

  if (!result.ok) {
    if (typeof showToast === 'function') showToast(result.error || 'Action failed.', 'error');
    return;
  }

  const finalStatus = action === 'accepted' ? 'approved' : 'rejected';
  const finalVerb = action === 'accepted' ? 'accepted' : 'declined';
  window.NexusTeamWorkflow.updateNotification(notificationId, {
    status: finalStatus,
    read: true,
    body: (item.body || '') + ' (You ' + finalVerb + ' this.)'
  }, session.username);

  if (typeof showToast === 'function') {
    showToast('Request ' + finalVerb + ' successfully.');
  }

  renderDynamicNotifications();
  filterNotifications();
}

// Status Tabs Filtering
if (notifTabs.length > 0) {
  notifTabs.forEach(tab => {
    tab.addEventListener('click', () => {
      notifTabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      filterNotifications();
    });
  });
}

// Search & Status Combined Filter
function filterNotifications() {
  const activeTab = document.querySelector('.notif-tab.active');
  const activeFilter = activeTab ? activeTab.dataset.filter : 'all';
  const searchQuery = notifSearch ? notifSearch.value.toLowerCase().trim() : '';
  const notifItems = getNotifItems();

  notifItems.forEach(item => {
    const status = item.dataset.status;
    const titleEl = item.querySelector('h3');
    const bodyEl = item.querySelector('p');
    const title = titleEl ? titleEl.textContent.toLowerCase() : '';
    const body = bodyEl ? bodyEl.textContent.toLowerCase() : '';
    
    const matchesTab = (activeFilter === 'all' || status === activeFilter);
    const matchesSearch = (title.includes(searchQuery) || body.includes(searchQuery) || status.includes(searchQuery));

    if (matchesTab && matchesSearch) {
      item.style.display = 'flex';
    } else {
      item.style.display = 'none';
    }
  });
}

function handleAction(btn, action) {
  const item = btn.closest('.notif-item');
  if (!item) return;
  
  // Logic updated for new mockup structure if needed
  item.classList.remove('unread');
  const dot = item.querySelector('.notif-dot');
  if (dot) dot.classList.add('read');
  
  if (typeof showToast === 'function') {
    showToast(action === 'accepted' ? 'Action successful!' : 'Request handled.');
  }
}

function markAllRead() {
  const session = readSession();
  if (session && window.NexusTeamWorkflow && typeof window.NexusTeamWorkflow.markAllNotificationsRead === 'function') {
    window.NexusTeamWorkflow.markAllNotificationsRead(session.username);
  }

  const notifItems = getNotifItems();
  notifItems.forEach(item => {
    item.classList.remove('unread');
    const dot = item.querySelector('.notif-dot');
    if (dot) dot.classList.add('read');
  });
  if (typeof showToast === 'function') {
    showToast('All notifications marked as read.');
  }
}

// Global exposure
window.handleAction = handleAction;
window.markAllRead = markAllRead;
window.filterNotifications = filterNotifications;
window.processNotificationAction = processNotificationAction;

renderDynamicNotifications();
