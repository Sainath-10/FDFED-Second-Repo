const POLICY_STORE_KEY = 'nexus_policies';
let currentTab = 'active';

function normalizePolicyStatus(status) {
    return status === 'active' ? 'active' : 'draft';
}

function safeParse(json, fallback) {
    try {
        const parsed = JSON.parse(json);
        return parsed ?? fallback;
    } catch (err) {
        return fallback;
    }
}

function readPoliciesFromStorage() {
    const local = safeParse(localStorage.getItem(POLICY_STORE_KEY), null);
    if (Array.isArray(local) && local.length) return local;

    const session = safeParse(sessionStorage.getItem(POLICY_STORE_KEY), null);
    if (Array.isArray(session) && session.length) {
        localStorage.setItem(POLICY_STORE_KEY, JSON.stringify(session));
        return session;
    }

    return [];
}

function savePoliciesToStorage(policies) {
    const serialized = JSON.stringify(policies);
    localStorage.setItem(POLICY_STORE_KEY, serialized);
    sessionStorage.setItem(POLICY_STORE_KEY, serialized);
}

function ensureShellConsistency() {
    if (typeof initSuperAdminSidebar === 'function') {
        initSuperAdminSidebar('policy', '../../');
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

function makePolicyId(title, index) {
    const clean = (title || `policy-${index + 1}`).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    return `pol-${clean || index + 1}`;
}

function parseMetaText(card, label) {
    const items = Array.from(card.querySelectorAll('.meta-item')).map(el => el.textContent.trim());
    const target = items.find(item => item.toLowerCase().startsWith(label.toLowerCase()));
    if (!target) return '';
    const idx = target.indexOf(':');
    return idx === -1 ? '' : target.slice(idx + 1).trim();
}

function seedPoliciesFromDom() {
    const cards = Array.from(document.querySelectorAll('.policy-card'));

    return cards.map((card, index) => {
        const title = card.querySelector('.policy-name')?.textContent.trim() || `Policy ${index + 1}`;
        const categoryTag = Array.from(card.querySelectorAll('.tag')).find(tag => !tag.classList.contains('version'));
        const versionTag = card.querySelector('.tag.version');

        return {
            id: makePolicyId(title, index),
            title,
            category: categoryTag?.textContent.trim() || 'General',
            version: versionTag?.textContent.trim() || 'v1.0',
            status: normalizePolicyStatus(card.getAttribute('data-status') || 'active'),
            summary: card.querySelector('.policy-description')?.textContent.trim() || '',
            scope: 'Platform-wide',
            updatedBy: parseMetaText(card, 'By') || 'Admin',
            updatedAt: parseMetaText(card, 'Last Updated') || 'N/A',
            compliance: parseMetaText(card, 'Compliance') || '98%',
            clauses: [],
            tags: [],
            changelog: []
        };
    });
}

function ensurePolicyData() {
    const stored = readPoliciesFromStorage();
    if (stored.length) {
        const normalized = stored.map(policy => ({
            ...policy,
            status: normalizePolicyStatus(policy?.status)
        }));
        savePoliciesToStorage(normalized);
        return normalized;
    }

    const seeded = seedPoliciesFromDom();
    savePoliciesToStorage(seeded);
    return seeded;
}

function escapeHtml(value) {
    return String(value || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function iconClassForCategory(category) {
    const lower = (category || '').toLowerCase();
    if (lower.includes('security') || lower.includes('cheat')) return 'security';
    if (lower.includes('conduct')) return 'conduct';
    if (lower.includes('eligibility') || lower.includes('registration')) return 'eligibility';
    if (lower.includes('finance') || lower.includes('financial') || lower.includes('prize')) return 'financial';
    if (lower.includes('privacy') || lower.includes('data')) return 'privacy';
    return 'conduct';
}

function policyCardSvg() {
    return `
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
            <polyline points="14 2 14 8 20 8"></polyline>
            <line x1="16" y1="13" x2="8" y2="13"></line>
            <line x1="16" y1="17" x2="8" y2="17"></line>
            <polyline points="10 9 9 9 8 9"></polyline>
        </svg>
    `;
}

function buildPolicyCard(policy) {
    const category = policy.category || 'General';
    const iconClass = iconClassForCategory(category);
    const status = normalizePolicyStatus(policy.status);

    return `
        <div class="policy-card" data-status="${escapeHtml(status)}">
            <div class="policy-icon-box ${iconClass}">${policyCardSvg()}</div>
            <div class="policy-details">
                <div class="policy-header-row">
                    <div class="policy-title-group">
                        <h3 class="policy-name">${escapeHtml(policy.title)}</h3>
                        <div class="policy-tags">
                            <span class="tag ${iconClass}">${escapeHtml(category)}</span>
                            <span class="tag version">${escapeHtml(policy.version || 'v1.0')}</span>
                        </div>
                    </div>
                </div>
                <p class="policy-description">${escapeHtml(policy.summary || 'No summary provided yet.')}</p>
                <div class="policy-meta-row">
                    <div class="policy-meta">
                        <span class="meta-item">Last Updated: <strong>${escapeHtml(policy.updatedAt || 'N/A')}</strong></span>
                        <span class="meta-item">By: <strong>${escapeHtml(policy.updatedBy || 'Admin')}</strong></span>
                        <span class="meta-item">Compliance: <span class="compliance-text">${escapeHtml(policy.compliance || '98%')}</span></span>
                    </div>
                    <div class="policy-actions">
                        <button class="btn-policy outline" onclick="location.href='view-policy.html?id=${encodeURIComponent(policy.id)}'">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                                <polyline points="14 2 14 8 20 8"></polyline>
                                <line x1="16" y1="13" x2="8" y2="13"></line>
                                <line x1="16" y1="17" x2="8" y2="17"></line>
                                <polyline points="10 9 9 9 8 9"></polyline>
                            </svg>
                            View Full Policy
                        </button>
                        <button class="btn-policy edit" onclick="location.href='edit-policy.html?id=${encodeURIComponent(policy.id)}'">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                            </svg>
                            Edit
                        </button>
                    </div>
                </div>
            </div>
        </div>
    `;
}

function updateTabCounts(policies) {
    const activeCount = policies.filter(policy => normalizePolicyStatus(policy.status) === 'active').length;
    const draftCount = policies.filter(policy => normalizePolicyStatus(policy.status) === 'draft').length;

    document.querySelectorAll('.pm-tab-btn').forEach(btn => {
        const text = btn.textContent.toLowerCase();
        if (text.includes('active')) btn.textContent = `Active Policies (${activeCount})`;
        if (text.includes('draft')) btn.textContent = `Drafts (${draftCount})`;
    });

    const statValues = document.querySelectorAll('.pm-stat-value');
    if (statValues[0]) statValues[0].textContent = String(activeCount);
    if (statValues[1]) statValues[1].textContent = String(draftCount);
}

function renderPolicies(status) {
    const list = document.querySelector('.pm-policy-list');
    if (!list) return;

    const targetStatus = normalizePolicyStatus(status);
    const policies = ensurePolicyData();
    updateTabCounts(policies);

    const filtered = policies.filter(policy => normalizePolicyStatus(policy.status) === targetStatus);

    if (!filtered.length) {
        list.innerHTML = `
            <div class="pm-empty-msg" style="padding:60px;text-align:center;color:rgba(255,255,255,0.35);border:1px dashed rgba(255,255,255,0.08);border-radius:12px;font-size:14px;">
                No ${escapeHtml(targetStatus)} policies found.
            </div>
        `;
        return;
    }

    list.innerHTML = filtered.map(buildPolicyCard).join('');
}

function switchPMTab(btn, status) {
    currentTab = normalizePolicyStatus(status);
    document.querySelectorAll('.pm-tab-btn').forEach(tab => tab.classList.remove('active'));
    btn.classList.add('active');
    renderPolicies(currentTab);
}

window.addEventListener('storage', event => {
    if (event.key !== POLICY_STORE_KEY) return;
    renderPolicies(currentTab);
});

document.addEventListener('DOMContentLoaded', () => {
    ensureShellConsistency();

    const activeTab = document.querySelector('.pm-tab-btn.active');
    if (activeTab && activeTab.textContent.toLowerCase().includes('draft')) currentTab = 'draft';

    renderPolicies(currentTab);
});

window.switchPMTab = switchPMTab;
