/* ============================================================
   NEXUS ESPORTS — Competitions Data Store
   Central state for all competitions (organized & participated)
   ============================================================ */

const COMPETITIONS_KEY = 'nexus_competitions';
const DELETED_COMPETITIONS_KEY = 'nexus.deleted.competitionIds';
const NOTIFICATIONS_KEY = 'nexus.notifications.items';

const DEFAULT_COMPETITIONS = [
];

/* ── PARTICIPATED ── */

const PARTICIPATED_DEFAULT = [
  {
    id: 'global-masters',
    name: 'Global Masters',
    game: 'League of Legends',
    type: 'league',
    status: 'ongoing',
    dates: 'May 1–14, 2026',
    participants: 256,
    location: 'Berlin, Germany',
    prizePool: '₹1,00,000',
    season: 'Season 2',
    format: 'Round Robin',
    maxTeams: 32,
    role: 'participant',
    createdDaysAgo: 10,
    bannerColor: '#1a2e2e',
    teams: [], standings: [], matches: [], disputes: [],
    totalMatches: 48, matchesCompleted: 20,
  },
  {
    id: 'pro-circuit-week3',
    name: 'Pro Circuit Week 3',
    game: 'Counter-Strike 2',
    type: 'tournament',
    status: 'ongoing',
    dates: 'Feb 18–20, 2026',
    participants: 225,
    location: 'Online',
    prizePool: '₹75,000',
    season: 'Season 1',
    format: 'Single Elimination',
    maxTeams: 64,
    role: 'participant',
    createdDaysAgo: 20,
    bannerColor: '#2e1a2e',
    teams: [], standings: [], matches: [], disputes: [],
    totalMatches: 63, matchesCompleted: 42,
  },
];

/* ── TEAM LEAD ── */
const TEAMLEAD_DEFAULT = [
  {
    id: 'champions-league-ext',
    name: 'Champions League',
    game: 'Rocket League',
    type: 'league',
    status: 'ongoing',
    dates: 'May 10–15, 2026',
    participants: 96,
    location: 'Sri City, India',
    prizePool: '₹35,000',
    season: 'Season 3',
    format: 'Round Robin',
    maxTeams: 24,
    role: 'teamlead',
    createdDaysAgo: 5,
    bannerColor: '#1a2a1a',
    teams: [], standings: [], matches: [], disputes: [],
    totalMatches: 36, matchesCompleted: 18,
  },
  {
    id: 'open-series-12',
    name: 'Open Series #12',
    game: 'Dota 2',
    type: 'tournament',
    status: 'upcoming',
    dates: 'March 22–24, 2026',
    participants: 128,
    location: 'Online',
    prizePool: '₹18,000',
    season: 'Season 1',
    format: 'Double Elimination',
    maxTeams: 32,
    role: 'teamlead',
    createdDaysAgo: 2,
    bannerColor: '#2a1a2e',
    teams: [], standings: [], matches: [], disputes: [],
    totalMatches: 0, matchesCompleted: 0,
  },
];

// Combine all into seed data
const SEED_DATA = [...DEFAULT_COMPETITIONS, ...PARTICIPATED_DEFAULT, ...TEAMLEAD_DEFAULT];

// IDs permanently removed from seed data — purge them from localStorage if present
const REMOVED_IDS = new Set([
  'world-champ-2026',
  'spring-split-2026',
  'summer-champ-2026',
  'battle-royale-2026',
  'pro-league-s5',
  'rocket-series-2026',
  'champions-league-2026',
  'spring-invitational',
  'winter-cup-2025',
  'city-clash-2026',
  'elite-tournament',
]);

function loadDeletedCompetitionIds() {
  try {
    const raw = localStorage.getItem(DELETED_COMPETITIONS_KEY);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return new Set();
    return new Set(parsed.filter(Boolean).map(id => String(id)));
  } catch (e) {
    return new Set();
  }
}

function saveDeletedCompetitionIds(idsSet) {
  try {
    localStorage.setItem(DELETED_COMPETITIONS_KEY, JSON.stringify(Array.from(idsSet || [])));
  } catch (e) { }
}

function rememberDeletedCompetitionId(id) {
  if (!id) return;
  const ids = loadDeletedCompetitionIds();
  ids.add(String(id));
  saveDeletedCompetitionIds(ids);
}

function forgetDeletedCompetitionId(id) {
  if (!id) return;
  const ids = loadDeletedCompetitionIds();
  if (ids.delete(String(id))) {
    saveDeletedCompetitionIds(ids);
  }
}

function getBannedUsernames() {
  try {
    const accounts = JSON.parse(localStorage.getItem('nexus.auth.accounts') || '[]');
    return new Set(
      accounts
        .filter(a => a && a.banned)
        .map(a => String(a.username || '').trim().toLowerCase())
    );
  } catch (e) { return new Set(); }
}

function stripBannedFromTeams(comps) {
  const banned = getBannedUsernames();
  if (!banned.size) return comps;

  return comps.map(comp => {
    if (!comp || !Array.isArray(comp.teams)) return comp;
    const cleaned = Object.assign({}, comp);

    cleaned.teams = comp.teams
      .map(team => {
        if (!team) return null;
        const t = Object.assign({}, team);

        // Remove banned members
        if (Array.isArray(t.members)) {
          t.members = t.members.filter(m => {
            const mu = (typeof m === 'string' ? m : (m && (m.username || m.name) || '')).trim().toLowerCase();
            return !banned.has(mu);
          });
          t.players = t.members.length;
        }

        // Remove banned from invites
        if (Array.isArray(t.invites)) {
          t.invites = t.invites.filter(inv =>
            !banned.has((inv && (inv.toUsername || inv.username) || '').trim().toLowerCase())
          );
        }

        // Remove banned from joinRequests
        if (Array.isArray(t.joinRequests)) {
          t.joinRequests = t.joinRequests.filter(jr =>
            !banned.has((jr && (jr.username || jr.from) || '').trim().toLowerCase())
          );
        }

        return t;
      })
      .filter(team => {
        if (!team) return false;
        // Remove teams captained or owned by a banned user
        const creator = (team.createdBy || team.leaderUsername || team.captain || '').trim().toLowerCase();
        const tname   = (team.name || '').trim().toLowerCase();
        if (banned.has(creator) || banned.has(tname)) return false;
        // Remove teams now empty
        if (Array.isArray(team.members) && team.members.length === 0) return false;
        return true;
      });

    return cleaned;
  });
}

function loadCompetitions() {
  // This will be called asynchronously from competitions.js
  // For now, return cached data from localStorage for immediate rendering
  const deletedIds = loadDeletedCompetitionIds();
  try {
    const raw = localStorage.getItem(COMPETITIONS_KEY);
    if (raw) {
      let stored = JSON.parse(raw);
      stored = stored.filter(c => c && c.id && !REMOVED_IDS.has(c.id) && !deletedIds.has(c.id));
      return stripBannedFromTeams(stored);
    }
  } catch (e) { }
  return [];
}

function formatApiDateRange(startDate, endDate) {
  const start = startDate ? new Date(startDate) : null;
  const end = endDate ? new Date(endDate) : null;
  if (!start || Number.isNaN(start.getTime()) || !end || Number.isNaN(end.getTime())) return 'TBD';
  return `${start.toLocaleDateString()} - ${end.toLocaleDateString()}`;
}

function mapApiCompetition(c) {
  return {
    id: c.id,
    dbId: c.id,
    name: c.name,
    description: c.description,
    status: c.status || 'active',
    startDate: c.startDate,
    endDate: c.endDate,
    createdAt: c.createdAt,
    createdBy: c.createdBy,
    organizerId: c.createdBy,
    organizers: Array.isArray(c.organizers) ? c.organizers : [c.createdBy].filter(Boolean),
    approvalStatus: c.approvalStatus || 'approved',
    badge: c.badge || (c.status === 'active' ? 'Active' : c.status === 'draft' ? 'Draft' : 'Completed'),
    badgeClass: c.badgeClass || (c.status === 'active' ? 'live' : 'hot'),
    game: c.game || 'Unknown Game',
    type: c.type || 'tournament',
    dates: c.dates || formatApiDateRange(c.startDate, c.endDate),
    participants: c.participants || 0,
    location: c.location || 'Online',
    prizePool: c.prizePool || (c.prize ? `Rs.${Number(c.prize).toLocaleString('en-IN')}` : 'Rs.0'),
    prize: c.prize || 0,
    season: c.season || 'Season 1',
    format: c.format || 'Tournament',
    maxTeams: c.maxTeams || 100,
    maxPlayersPerTeam: c.maxPlayersPerTeam || 5,
    platformFee: c.platformFee || 0,
    feeType: c.feeType || 'free',
    entryFeeAmount: c.entryFeeAmount || 0,
    entryFee: c.entryFee || 'Free',
    organizerPaid: !!c.organizerPaid,
    img: c.img,
    bannerColor: c.bannerColor || '#1a2e2e',
    teams: Array.isArray(c.teams) ? c.teams : [],
    standings: Array.isArray(c.standings) ? c.standings : [],
    matches: Array.isArray(c.matches) ? c.matches : [],
    disputes: Array.isArray(c.disputes) ? c.disputes : [],
    totalMatches: c.totalMatches || 0,
    matchesCompleted: c.matchesCompleted || 0,
  };
}

function mergeCompetitions(localComps, apiComps) {
  const merged = [];
  const index = new Map();

  (localComps || []).forEach(comp => {
    if (!comp || !comp.id) return;
    const clone = Object.assign({}, comp);
    const keys = [clone.id, clone.dbId, clone.name].filter(Boolean).map(String);
    keys.forEach(key => index.set(key, merged.length));
    merged.push(clone);
  });

  (apiComps || []).forEach(apiComp => {
    if (!apiComp || !apiComp.id) return;
    const keys = [apiComp.id, apiComp.dbId, apiComp.name].filter(Boolean).map(String);
    const foundKey = keys.find(key => index.has(key));
    if (foundKey) {
      const idx = index.get(foundKey);
      const local = merged[idx];
      merged[idx] = Object.assign({}, apiComp, local, {
        dbId: local.dbId || apiComp.dbId || apiComp.id,
        backendSynced: true,
      });
      keys.forEach(key => index.set(key, idx));
    } else {
      const idx = merged.length;
      keys.forEach(key => index.set(key, idx));
      merged.push(Object.assign({}, apiComp, { backendSynced: true }));
    }
  });

  return stripBannedFromTeams(merged);
}

// Fetch competitions from backend API
async function fetchCompetitionsFromAPI() {
  if (!window.NexusAPI) return [];

  const result = await window.NexusAPI.Competitions.getAll();
  if (!result.ok) {
    console.error('Failed to fetch competitions:', result.error);
    return [];
  }

  const competitions = (result.data || []).map(mapApiCompetition); /*
    id: c.id,
    name: c.name,
    description: c.description,
    status: c.status,
    startDate: c.startDate,
    endDate: c.endDate,
    createdAt: c.createdAt,
    badge: c.status === 'active' ? 'Active' : c.status === 'draft' ? 'Draft' : 'Completed',
    type: 'tournament',
    dates: `${new Date(c.startDate).toLocaleDateString()} – ${new Date(c.endDate).toLocaleDateString()}`,
    participants: 0,
    location: 'Online',
    prizePool: '₹0',
    season: 'Season 1',
    format: 'Tournament',
    maxTeams: 100,
    bannerColor: '#1a2e2e',
    teams: [],
    standings: [],
    matches: [],
    disputes: [],
    totalMatches: 0,
    matchesCompleted: 0,
  */

  const merged = mergeCompetitions(loadCompetitions(), competitions);
  saveCompetitions(merged);
  return merged;
}

function saveCompetitions(data) {
  try {
    localStorage.setItem(COMPETITIONS_KEY, JSON.stringify(data));
  } catch (e) { }
}

function getCompetitionById(id) {
  return loadCompetitions().find(c => c.id === id) || null;
}

function updateCompetition(updated) {
  const all = loadCompetitions();
  const idx = all.findIndex(c => c.id === updated.id);
  if (idx >= 0) all[idx] = updated;
  else all.push(updated);
  forgetDeletedCompetitionId(updated.id);
  saveCompetitions(all);

  // Sync to PostgreSQL backend
  if (window.NexusAPI && window.NexusAPI.Competitions && updated.id) {
    window.NexusAPI.Competitions.update(updated.id, {
      name: updated.name,
      description: updated.description,
      status: updated.status,
      endDate: updated.endDate,
    }).catch(() => {});
  }
}

function deleteCompetition(id) {
  if (!id) return false;

  const all = loadCompetitions();
  const existsInCurrent = all.some(comp => comp.id === id);
  const existsInSeed = SEED_DATA.some(comp => comp.id === id);
  if (!existsInCurrent && !existsInSeed) return false;

  const filtered = all.filter(comp => comp.id !== id);
  saveCompetitions(filtered);
  rememberDeletedCompetitionId(id);

  // Clear stale active team context if it belonged to the deleted competition.
  try {
    const ctxRaw = localStorage.getItem('nexus.team.activeContext');
    if (ctxRaw) {
      const ctx = JSON.parse(ctxRaw);
      if (ctx && ctx.compId === id) {
        localStorage.removeItem('nexus.team.activeContext');
      }
    }
  } catch (e) { }

  // Sync delete to PostgreSQL backend
  if (window.NexusAPI && window.NexusAPI.Competitions) {
    window.NexusAPI.Competitions.delete(id).catch(() => {});
  }

  return true;
}

function addCompetition(comp) {
  const all = loadCompetitions();
  // Stamp the creator's ID so goToComp can correctly identify the organizer
  const sessionRaw = localStorage.getItem('nexus.auth.session');
  let creatorUsername = '';
  if (sessionRaw) {
    try {
      const session = JSON.parse(sessionRaw);
      // Always use username as organizerId so activity page matching works (buildBuckets uses session.username as userKey)
      comp.organizerId = session.username || session.id || '';
      creatorUsername = session.username || '';
    } catch (e) { }
  }

  comp.approvalStatus = comp.approvalStatus || 'approved';
  comp.approvalUpdatedAt = new Date().toISOString();
  comp.approvalUpdatedBy = 'auto-approval-system';
  comp.createdBy = creatorUsername || comp.createdBy || comp.organizerId || '';
  comp.organizers = Array.isArray(comp.organizers) && comp.organizers.length > 0
    ? comp.organizers
    : Array.from(new Set([comp.createdBy, comp.organizerId].filter(Boolean)));

  forgetDeletedCompetitionId(comp.id);
  all.unshift(comp);
  saveCompetitions(all);

  // Sync create to PostgreSQL backend
  if (window.NexusAPI && window.NexusAPI.Competitions) {
    window.NexusAPI.Competitions.create({
      name: comp.name,
      description: comp.description || 'No description provided.',
      startDate: comp.startDate || new Date().toISOString(),
      endDate: comp.endDate || new Date(Date.now() + 14 * 86400000).toISOString(),
      coOrganizers: comp.organizers || [],
      game: comp.game,
      type: comp.type,
      location: comp.location || 'Online',
      prizePool: comp.prizePool,
      prize: comp.prize,
      format: comp.format,
      season: comp.season,
      maxTeams: comp.maxTeams,
      maxPlayersPerTeam: comp.maxPlayersPerTeam,
      img: comp.img,
      badge: comp.badge,
      badgeClass: comp.badgeClass,
      feeType: comp.feeType,
      entryFeeAmount: comp.entryFeeAmount,
      entryFee: comp.entryFee,
      platformFee: comp.platformFee,
      organizerPaid: comp.organizerPaid,
      approvalStatus: comp.approvalStatus,
    }).then(res => {
      if (res && res.ok && res.data && res.data.id && res.data.id !== comp.id) {
        // Update local competition id with the real PostgreSQL UUID
        const currentAll = loadCompetitions();
        const found = currentAll.find(c => c.id === comp.id);
        if (found) {
          found.dbId = res.data.id;
          saveCompetitions(currentAll);
        }
      }
    }).catch(() => {});
  }
}

function addCoOrganizerToComp(compId, organizerUsername) {
  if (!compId || !organizerUsername) return { ok: false, error: 'Missing competition or username.' };
  const all = loadCompetitions();
  const comp = all.find(c => c && c.id === compId);
  if (!comp) return { ok: false, error: 'Competition not found.' };

  if (!Array.isArray(comp.organizers)) {
    comp.organizers = Array.from(new Set([comp.createdBy, comp.organizerId].filter(Boolean)));
  }

  const cleanUser = String(organizerUsername).trim();
  if (!comp.organizers.includes(cleanUser)) {
    comp.organizers.push(cleanUser);
  }

  updateCompetition(comp);
  return { ok: true, competition: comp };
}

function removeCoOrganizerFromComp(compId, organizerUsername) {
  if (!compId || !organizerUsername) return { ok: false, error: 'Missing competition or username.' };
  const all = loadCompetitions();
  const comp = all.find(c => c && c.id === compId);
  if (!comp) return { ok: false, error: 'Competition not found.' };

  if (Array.isArray(comp.organizers)) {
    comp.organizers = comp.organizers.filter(u => u !== organizerUsername && u !== comp.createdBy);
  }

  updateCompetition(comp);
  return { ok: true, competition: comp };
}

function getApprovalStatus(comp) {
  const raw = String((comp && comp.approvalStatus) || '').toLowerCase();
  if (raw === 'pending' || raw === 'approved' || raw === 'rejected') return raw;
  return 'approved';
}

function loadSystemNotifications() {
  try {
    const raw = localStorage.getItem(NOTIFICATIONS_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    return [];
  }
}

function saveSystemNotifications(items) {
  try {
    localStorage.setItem(NOTIFICATIONS_KEY, JSON.stringify(items || []));
  } catch (e) { }
}

function pushSystemNotification(entry) {
  if (!entry || !entry.toUsername) return;
  const list = loadSystemNotifications();
  const notifObj = {
    id: 'notif-' + Math.random().toString(36).slice(2, 10),
    toUsername: String(entry.toUsername || '').trim(),
    type: entry.type || 'system',
    status: entry.status || 'pending',
    title: entry.title || 'Notification',
    body: entry.body || '',
    createdAt: entry.createdAt || new Date().toISOString(),
    read: false,
    meta: entry.meta || {}
  };
  list.unshift(notifObj);
  saveSystemNotifications(list);

  // Sync to PostgreSQL backend
  if (window.NexusAPI && window.NexusAPI.Notifications) {
    window.NexusAPI.Notifications.create(
      notifObj.toUsername,
      notifObj.title,
      notifObj.body,
      notifObj.type,
      notifObj.status,
      notifObj.meta
    ).catch(() => {});
  }
}

function setCompetitionApproval(compId, decision, adminUsername) {
  const next = String(decision || '').toLowerCase();
  if (!compId || (next !== 'approved' && next !== 'rejected' && next !== 'pending')) {
    return { ok: false, error: 'Invalid approval decision.' };
  }

  const all = loadCompetitions();
  const idx = all.findIndex(c => c && c.id === compId);
  if (idx < 0) return { ok: false, error: 'Competition not found.' };

  const comp = all[idx];
  comp.approvalStatus = next;
  comp.approvalUpdatedAt = new Date().toISOString();
  comp.approvalUpdatedBy = adminUsername || 'admin';
  all[idx] = comp;
  saveCompetitions(all);

  if (window.NexusAPI && window.NexusAPI.Competitions) {
    window.NexusAPI.Competitions.setApproval(comp.dbId || comp.id, next).catch(() => {});
  }

  const organizer = comp.createdBy || comp.organizerId;
  if (organizer) {
    pushSystemNotification({
      toUsername: organizer,
      type: 'competition-approval',
      status: next === 'approved' ? 'approved' : (next === 'rejected' ? 'rejected' : 'pending'),
      title: 'Competition ' + (next === 'approved' ? 'approved' : (next === 'rejected' ? 'rejected' : 'is pending')),
      body: 'Your competition "' + (comp.name || 'Competition') + '" was ' + next + ' by admin review.',
      meta: {
        compId: comp.id,
        approvalStatus: next
      }
    });
  }

  // Log Admin Activity
  try {
    const session = JSON.parse(localStorage.getItem('nexus.auth.session') || '{}');
    const adminUser = adminUsername || session.username || session.email || 'admin@nexus.gg';
    const actionLabel = next === 'approved' ? 'Approved' : (next === 'rejected' ? 'Rejected' : 'Set Pending');
    logAdminActivity(adminUser, 'COMPETITION_APPROVAL', `${actionLabel} competition "${comp.name || 'Tournament'}"`, {
      compId: comp.id,
      competitionName: comp.name,
      decision: next
    });
  } catch (e) {
    console.error('Error logging approval activity:', e);
  }

  return { ok: true, competition: comp };
}

function setTeamRegistrationStatus(compId, teamId, decision, organizerUsername) {
  const next = String(decision || '').toLowerCase();
  if (!compId || !teamId || (next !== 'approved' && next !== 'rejected' && next !== 'pending')) {
    return { ok: false, error: 'Invalid team status decision.' };
  }

  const all = loadCompetitions();
  const compIdx = all.findIndex(c => c && c.id === compId);
  if (compIdx < 0) return { ok: false, error: 'Competition not found.' };

  const comp = all[compIdx];
  if (!Array.isArray(comp.teams)) comp.teams = [];
  const teamIdx = comp.teams.findIndex(t => t && t.id === teamId);
  if (teamIdx < 0) return { ok: false, error: 'Team not found.' };

  const team = comp.teams[teamIdx];
  team.status = next;
  team.statusUpdatedAt = new Date().toISOString();
  team.statusUpdatedBy = organizerUsername || 'organizer';
  comp.teams[teamIdx] = team;
  all[compIdx] = comp;
  saveCompetitions(all);

  // Update any stale pending notifications for this team
  try {
    const notifItems = JSON.parse(localStorage.getItem(NOTIFICATIONS_KEY) || '[]');
    let notifModified = false;
    notifItems.forEach(n => {
      if (n && n.meta && n.meta.compId === compId && n.meta.teamId === teamId && n.status === 'pending') {
        n.status = next;
        if (next === 'approved') {
          n.title = '✔ Team Registration Approved';
          n.body = 'Your team "' + (team.name || 'Team') + '" has been approved for ' + (comp.name || 'the competition') + '.';
        } else if (next === 'rejected') {
          n.title = '✖ Team Registration Rejected';
          n.body = 'Your team "' + (team.name || 'Team') + '" was rejected for ' + (comp.name || 'the competition') + '.';
        }
        notifModified = true;
      }
    });
    if (notifModified) {
      localStorage.setItem(NOTIFICATIONS_KEY, JSON.stringify(notifItems));
    }
  } catch (e) {}

  const captain = team.createdBy || team.leaderUsername;
  const notified = new Set();
  if (captain) {
    pushSystemNotification({
      toUsername: captain,
      type: 'team-registration',
      status: next,
      title: 'Team ' + (next === 'approved' ? 'approved' : (next === 'rejected' ? 'rejected' : 'pending')),
      body: 'Your team "' + (team.name || 'Team') + '" was ' + next + ' for ' + (comp.name || 'the competition') + '.',
      meta: { compId: comp.id, teamId: team.id, teamStatus: next }
    });
    notified.add(String(captain).toLowerCase());
  }

  (team.members || []).forEach(member => {
    const username = String(member && member.username || '').trim();
    if (!username) return;
    const key = username.toLowerCase();
    if (notified.has(key)) return;
    pushSystemNotification({
      toUsername: username,
      type: 'team-registration',
      status: next,
      title: 'Team ' + (next === 'approved' ? 'approved' : (next === 'rejected' ? 'rejected' : 'pending')),
      body: 'Team "' + (team.name || 'Team') + '" was ' + next + ' for ' + (comp.name || 'the competition') + '.',
      meta: { compId: comp.id, teamId: team.id, teamStatus: next }
    });
    notified.add(key);
  });

  return { ok: true, competition: comp, team };
}

function getCompetitionsForPublic() {
  return loadCompetitions().filter(c => getApprovalStatus(c) === 'approved');
}

// Fetch active competitions from backend API
async function fetchActiveCompetitionsFromAPI() {
  if (!window.NexusAPI) return [];

  const result = await window.NexusAPI.Competitions.getActive();
  if (!result.ok) {
    console.error('Failed to fetch active competitions:', result.error);
    return [];
  }

  return mergeCompetitions(loadCompetitions(), (result.data || []).map(mapApiCompetition)); /*
    id: c.id,
    name: c.name,
    description: c.description,
    status: c.status,
    startDate: c.startDate,
    endDate: c.endDate,
    createdAt: c.createdAt,
    badge: 'Active',
    type: 'tournament',
    dates: `${new Date(c.startDate).toLocaleDateString()} – ${new Date(c.endDate).toLocaleDateString()}`,
    participants: 0,
    location: 'Online',
    prizePool: '₹0',
    season: 'Season 1',
    format: 'Tournament',
    maxTeams: 100,
    bannerColor: '#1a2e2e',
    teams: [],
    standings: [],
    matches: [],
    disputes: [],
    totalMatches: 0,
    matchesCompleted: 0,
  */
}

function generateId(name) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-') + '-' + Math.random().toString(36).slice(2, 7);
}

// ── URL helpers ──────────────────────────────────────────────
function getCompIdFromUrl() {
  return new URLSearchParams(window.location.search).get('id');
}

function goToComp(id) {
  // Always route everyone to comp-info.html
  window.location.href = "comp-info.html?id=" + id;
}

function goToParticipant(id) {
  window.location.href = `comp-participant.html?id=${id}`;
}

// ─── Notification & Warning Helpers ──────────────────────────────────────────
function sendNotificationHelper(toTarget, title, body, type = 'dispute', status = 'pending', compId = null) {
  if (!toTarget) return;

  const targets = new Set();
  targets.add(String(toTarget).trim());

  if (compId) {
    const comp = getCompetitionById(compId);
    if (comp && Array.isArray(comp.teams)) {
      const team = comp.teams.find(t => t.name && t.name.toLowerCase() === String(toTarget).trim().toLowerCase());
      if (team) {
        if (team.createdBy) targets.add(team.createdBy);
        if (Array.isArray(team.members)) {
          team.members.forEach(m => {
            if (typeof m === 'string') targets.add(m);
            else if (m && m.username) targets.add(m.username);
          });
        }
      }
    }
  }

  targets.forEach(user => {
    const entry = {
      id: 'notif-' + Date.now() + '-' + Math.random().toString(36).slice(2, 7),
      toUsername: String(user).trim(),
      type: type,
      status: status,
      title: title,
      body: body,
      createdAt: new Date().toISOString(),
      read: false,
    };

    if (window.NexusTeamWorkflow && typeof window.NexusTeamWorkflow.pushNotification === 'function') {
      window.NexusTeamWorkflow.pushNotification(entry);
    } else {
      try {
        const NOTIFS_KEY = 'nexus.notifications.items';
        const items = JSON.parse(localStorage.getItem(NOTIFS_KEY) || '[]');
        items.unshift(entry);
        localStorage.setItem(NOTIFS_KEY, JSON.stringify(items));
      } catch(e) {}
    }
  });
}

function registerAccountWarning(targetUserOrTeam, reason, issuedBy, compId = null) {
  if (!targetUserOrTeam) return 0;

  const targets = new Set();
  targets.add(String(targetUserOrTeam).trim());

  let isTeam = false;
  let teamWarnCount = 0;
  if (compId) {
    const comps = loadCompetitions();
    const comp = comps.find(c => c.id === compId);
    if (comp && Array.isArray(comp.teams)) {
      const team = comp.teams.find(t => t.name && t.name.toLowerCase() === String(targetUserOrTeam).trim().toLowerCase());
      if (team) {
        isTeam = true;
        team.warningsCount = (team.warningsCount || 0) + 1;
        teamWarnCount = team.warningsCount;
        if (teamWarnCount >= 3) {
          team.status = 'banned';
          team.bannedAt = new Date().toISOString();
          team.bannedReason = `Banned from the tournament after receiving ${teamWarnCount} warnings.`;
        }
        updateCompetition(comp);

        if (team.createdBy) targets.add(team.createdBy);
        // Include leaderId or captain if present
        if (team.leaderId) targets.add(team.leaderId);
        if (team.leaderUsername) targets.add(team.leaderUsername);
        if (team.captain) targets.add(team.captain);
        if (Array.isArray(team.members)) {
          team.members.forEach(m => {
            if (typeof m === 'string') targets.add(m);
            else if (m && m.username) targets.add(m.username);
          });
        }
        if (Array.isArray(team.players)) {
          team.players.forEach(p => {
            if (typeof p === 'string') targets.add(p);
            else if (p && p.username) targets.add(p.username);
          });
        }
      }
    }
  }

  const ACCOUNTS_KEY = 'nexus.auth.accounts';
  let maxWarnings = 0;

  try {
    let accounts = JSON.parse(localStorage.getItem(ACCOUNTS_KEY) || '[]');

    targets.forEach(target => {
      const norm = String(target).trim().toLowerCase();
      let account = accounts.find(a => (a.username || '').toLowerCase() === norm || (a.email || '').toLowerCase() === norm);
      if (!account) {
        account = { username: target, email: `${norm}@nexus.com`, warnings: [], banned: false };
        accounts.push(account);
      }
      account.warnings = account.warnings || [];
      account.warnings.push({
        id: 'warn-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6),
        reason: reason || 'Violation of tournament/platform rules',
        seen: false,
        date: new Date().toISOString(),
        issuedBy: issuedBy || 'Tournament Organizer',
        targetType: isTeam ? 'team' : 'player',
        teamName: isTeam ? targetUserOrTeam : null,
        compId: compId || null,
        teamWarnCount: isTeam ? teamWarnCount : null
      });
      if (account.warnings.length > maxWarnings) maxWarnings = account.warnings.length;

      // Only auto-ban platform-wide if 3+ individual PLAYER warnings exist (not team warnings)
      const playerWarnings = account.warnings.filter(w => w.targetType !== 'team');
      if (!isTeam && playerWarnings.length >= 3) {
        account.banned = true;
        banUserPlatformWide(target);
      }
    });

    localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(accounts));
  } catch(e) {
    console.error('Error registering warning:', e);
  }

  return isTeam ? teamWarnCount : maxWarnings;
}

// ─── Dispute Store ─────────────────────────────────────────────────────────────
const DISPUTES_KEY = 'nexus.disputes';

function loadDisputes() {
  try { return JSON.parse(localStorage.getItem(DISPUTES_KEY) || '[]'); } catch (e) { return []; }
}

function saveDisputes(disputes) {
  localStorage.setItem(DISPUTES_KEY, JSON.stringify(disputes));
}

function isUserOnTeam(team, username) {
  const target = String(username || '').trim().toLowerCase();
  if (!team || !target) return false;
  const same = value => {
    const raw = typeof value === 'string' ? value : (value && (value.username || value.name || value.id));
    return String(raw || '').trim().toLowerCase() === target;
  };
  if (same(team.createdBy) || same(team.leaderId) || same(team.leaderUsername) || same(team.captain)) return true;
  return (Array.isArray(team.members) && team.members.some(same)) || (Array.isArray(team.players) && team.players.some(same));
}

function getUserTeamNameInCompetition(compId, username) {
  const comp = getCompetitionById(compId);
  if (!comp || !Array.isArray(comp.teams)) return '';
  const team = comp.teams.find(t => isUserOnTeam(t, username));
  return team ? String(team.name || '').trim().toLowerCase() : '';
}

function addDispute(disputeData) {
  const disputes = loadDisputes();
  const id = 'disp-' + Date.now() + '-' + Math.random().toString(36).slice(2, 7);
  const reporter = String(disputeData.reportedBy || disputeData.filedBy || disputeData.submitter || '').trim().toLowerCase();
  const target = String(disputeData.targetUserOrTeam || disputeData.against || '').trim().toLowerCase();

  if (reporter && target && reporter === target) {
    return { ok: false, error: 'You cannot raise a dispute against yourself.' };
  }

  if ((disputeData.targetType === 'team' || disputeData.targetType === 'opponent_team') && reporter && target) {
    const reporterTeamName = getUserTeamNameInCompetition(disputeData.competitionId, reporter);
    if (reporterTeamName && reporterTeamName === target) {
      return { ok: false, error: 'You cannot raise a dispute against your own team.' };
    }
  }

  // Check if filed by organizer
  let isOrg = disputeData.isOrganizer || disputeData.reportedByRole === 'organizer' || disputeData.filedByRole === 'organizer';
  if (!isOrg) {
    try {
      const sess = JSON.parse(localStorage.getItem('nexus.auth.session') || '{}');
      const role = String(sess.role || '').toLowerCase();
      if (role === 'organizer' || role === 'admin' || role === 'super-admin') {
        isOrg = true;
      } else if (sess.username && disputeData.competitionId) {
        const comp = getCompetitionById(disputeData.competitionId);
        if (comp && (comp.createdBy === sess.username || (Array.isArray(comp.organizers) && comp.organizers.includes(sess.username)))) {
          isOrg = true;
        }
      }
    } catch(e) {}
  }

  const isTeamTarget = disputeData.targetType === 'team' || disputeData.targetType === 'opponent_team';
  const initialStatus = isTeamTarget ? 'open_organizer' : (isOrg ? 'escalated_to_admin' : (disputeData.status || 'open_organizer'));
  const newDispute = {
    id,
    ...disputeData,
    createdAt: disputeData.createdAt || new Date().toISOString(),
    updatedAt: disputeData.updatedAt || new Date().toISOString(),
    status: initialStatus,
    escalated: !isTeamTarget && (isOrg || !!disputeData.escalated),
    superAdminState: !isTeamTarget && isOrg ? 'pending' : (disputeData.superAdminState || ''),
    escalatedReason: !isTeamTarget && isOrg ? 'Dispute raised directly by Organizer — auto-escalated to Super Admin' : (disputeData.escalatedReason || '')
  };

  disputes.unshift(newDispute);
  saveDisputes(disputes);

  if (!isTeamTarget) {
    // Also sync directly to admin store (nexus_admin_disputes)
    try {
      const adminKey = 'nexus_admin_disputes';
      const adminDisputes = JSON.parse(localStorage.getItem(adminKey) || '[]');
      adminDisputes.unshift({
        ...newDispute,
        cardId: 'disp-' + Date.now(),
        disputeId: '#DISP-' + (new Date().getFullYear()) + '-' + Math.floor(1000 + Math.random() * 9000),
        competition: disputeData.matchName || disputeData.competition || 'Competition',
        filedBy: disputeData.reportedBy || disputeData.submitter || 'Organizer',
        against: disputeData.targetUserOrTeam || disputeData.against || 'Target'
      });
      localStorage.setItem(adminKey, JSON.stringify(adminDisputes));
    } catch(e) {}
  }

  // Send notification to target user/team that a dispute was raised against them
  if (disputeData.targetUserOrTeam) {
    sendNotificationHelper(
      disputeData.targetUserOrTeam,
      '⚠️ Dispute Raised Against You',
      `A dispute has been raised against you by @${disputeData.reportedBy || 'a participant'} in competition ${disputeData.competitionId || 'tournament'}. Reason: ${disputeData.reason}`,
      'dispute',
      'pending',
      disputeData.competitionId
    );
  }

  return { ok: true, id, dispute: newDispute };
}

function getDisputesByStatus(status) {
  return loadDisputes().filter(d => d.status === status);
}

function getDisputesByCompetition(compId) {
  return loadDisputes().filter(d => d.competitionId === compId);
}

function updateDisputeStatus(id, updates) {
  const disputes = loadDisputes();
  const idx = disputes.findIndex(d => d.id === id);
  if (idx === -1) return false;

  const oldDispute = disputes[idx];
  disputes[idx] = { ...oldDispute, ...updates, updatedAt: new Date().toISOString() };
  saveDisputes(disputes);

  const updatedDispute = disputes[idx];

  // When a dispute is resolved -> notify both the creator (reportedBy) and target (targetUserOrTeam)
  if (updates.status === 'resolved') {
    const notes = updates.organizerNotes || updates.adminNotes || updates.notes || 'Dispute resolved by authority.';

    // 1. Notify reporter (creator)
    if (updatedDispute.reportedBy) {
      sendNotificationHelper(
        updatedDispute.reportedBy,
        '✔ Dispute Resolved',
        `Your dispute regarding "${updatedDispute.targetUserOrTeam}" in competition ${updatedDispute.competitionId} has been resolved. Resolution: ${notes}`,
        'dispute',
        'approved',
        updatedDispute.competitionId
      );
    }

    // 2. Notify target user/team
    if (updatedDispute.targetUserOrTeam) {
      sendNotificationHelper(
        updatedDispute.targetUserOrTeam,
        '✔ Dispute Resolved',
        `The dispute raised against you by @${updatedDispute.reportedBy || 'a participant'} in competition ${updatedDispute.competitionId} has been resolved. Resolution: ${notes}`,
        'dispute',
        'approved',
        updatedDispute.competitionId
      );
    }
  }

  return true;
}

function getCompetitionParticipants(compId) {
  const comp = getCompetitionById(compId);
  if (!comp) return { teams: [], players: [], organizer: 'organizer' };

  const teams = (comp.teams || []).map(t => ({ id: t.id, name: t.name, status: t.status }));
  const playerSet = new Set();

  (comp.teams || []).forEach(t => {
    if (t.createdBy) playerSet.add(t.createdBy);
    if (Array.isArray(t.members)) {
      t.members.forEach(m => {
        if (typeof m === 'string') playerSet.add(m);
        else if (m && m.username) playerSet.add(m.username);
      });
    }
  });

  const organizer = (Array.isArray(comp.organizers) && comp.organizers[0]) || comp.organizerId || comp.createdBy || 'organizer';
  return {
    teams,
    players: Array.from(playerSet).filter(Boolean),
    organizer,
  };
}

function banUserPlatformWide(usernameOrEmail) {
  const norm = String(usernameOrEmail).trim().toLowerCase();
  ['nexus.accounts', 'nexus.auth.accounts'].forEach(key => {
    try {
      const accounts = JSON.parse(localStorage.getItem(key) || '[]');
      let updated = false;
      accounts.forEach(a => {
        if ((a.username && a.username.toLowerCase() === norm) || (a.email && a.email.toLowerCase() === norm)) {
          a.banned = true;
          updated = true;
        }
      });
      if (updated) localStorage.setItem(key, JSON.stringify(accounts));
    } catch(e) {}
  });

  try {
    const banned = JSON.parse(localStorage.getItem('nexus.banned.users') || '[]');
    if (!banned.includes(usernameOrEmail)) banned.push(usernameOrEmail);
    localStorage.setItem('nexus.banned.users', JSON.stringify(banned));
  } catch(e) {}
}

function issueOrganizerWarning(disputeId, reason) {
  const disputes = loadDisputes();
  const d = disputes.find(x => x.id === disputeId);
  if (!d) return null;

  const isTeamDispute = d.targetType === 'team' || d.targetType === 'opponent_team';
  d.organizerWarnings = (d.organizerWarnings || 0) + 1;
  d.organizerNotes = reason || d.organizerNotes;
  d.updatedAt = new Date().toISOString();

  // 1. Register warning on target user's account so warning popup triggers on next login
  const warnCount = registerAccountWarning(d.targetUserOrTeam, `Organizer Warning (${d.competitionId}): ${reason}`, 'Tournament Organizer', d.competitionId);
  if (isTeamDispute) {
    d.organizerWarnings = warnCount;
  }

  // 2. Send warning notification to target user
  sendNotificationHelper(
    d.targetUserOrTeam,
    `⚠️ Tournament Organizer Warning (${warnCount}/3)`,
    `You received a warning from the organizer in competition ${d.competitionId}. Reason: ${reason}`,
    'warning',
    'pending',
    d.competitionId
  );

  let autoEscalated = false;
  let autoBanned = false;
  if (isTeamDispute && warnCount >= 3) {
    d.status = 'resolved';
    d.banApplied = true;
    d.teamBanned = true;
    d.resolvedBy = 'Tournament Organizer';
    d.resolvedAt = new Date().toISOString();
    d.organizerNotes = `${reason} Team banned after 3 organizer warnings.`;
    autoBanned = true;
  } else if (!isTeamDispute && d.organizerWarnings >= 2) {
    d.status = 'escalated_to_admin';
    d.banRequested = true;
    d.escalatedReason = `Auto-escalated to admin after 2 organizer warnings: ${reason}`;
    autoEscalated = true;
  }

  saveDisputes(disputes);
  return { warningCount: d.organizerWarnings, autoEscalated, autoBanned, dispute: d };
}

function issueAdminWarning(disputeId, reason, targetUsername) {
  const disputes = loadDisputes();
  const d = disputes.find(x => x.id === disputeId);
  const target = targetUsername || d?.targetUserOrTeam;
  if (!target) return null;

  const totalWarnings = registerAccountWarning(target, `Admin Warning: ${reason}`, 'Platform Admin', d?.competitionId);
  
  // Check if it is a team target
  let isTeam = false;
  if (d) {
    isTeam = d.targetType === 'team' || d.targetType === 'opponent_team';
  }
  
  let autoBanned = false;
  if (isTeam) {
    if (d?.competitionId) {
      const comp = getCompetitionById(d.competitionId);
      const team = comp?.teams?.find(t => t.name && t.name.toLowerCase() === target.toLowerCase());
      if (team) {
        autoBanned = (team.warningsCount || 0) >= 3;
      }
    }
  } else {
    autoBanned = totalWarnings >= 3;
  }

  // Send notification to target user
  sendNotificationHelper(
    target,
    isTeam ? `⚠️ Team Warning (${totalWarnings}/3)` : `⚠️ Platform Warning (${totalWarnings}/3)`,
    autoBanned
      ? (isTeam
          ? `Your team received its 3rd warning: "${reason}". Your team has been banned from the tournament.`
          : `You received your 3rd warning: "${reason}". Your account has been permanently banned.`)
      : (isTeam
          ? `Your team received a tournament warning (${totalWarnings}/3): "${reason}". Note: After 3 warnings your team will be banned from the tournament.`
          : `You received a platform warning (${totalWarnings}/3): "${reason}". Note: After 3 warnings your account will be permanently banned.`),
    'warning',
    'pending',
    d?.competitionId
  );

  if (d) {
    d.adminNotes = `Admin Warning (${totalWarnings}/3): ${reason}`;
    if (autoBanned) {
      d.status = 'resolved';
      d.banApplied = true;
      d.resolvedBy = 'Platform Admin';
      if (isTeam) {
        d.teamBanned = true;
      }
    }
    saveDisputes(disputes);
  }

  return { totalWarnings, autoBanned };
}

function isTeamBannedInComp(teamName, compIdOrData) {
  if (!teamName) return false;
  let comp = compIdOrData;
  if (typeof compIdOrData === 'string') {
    comp = getCompetitionById(compIdOrData);
  }
  if (!comp || !Array.isArray(comp.teams)) return false;
  const team = comp.teams.find(t => (t.name || '').toLowerCase() === (teamName || '').toLowerCase());
  return !!(team && team.status === 'banned');
}

const REVENUE_CONFIG_KEY = 'nexus.revenue_config';

function getRevenueConfig() {
  try {
    const raw = localStorage.getItem(REVENUE_CONFIG_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        percentage: typeof parsed.percentage === 'number' ? parsed.percentage : 7,
        minCost: typeof parsed.minCost === 'number' ? parsed.minCost : 50,
        updatedAt: parsed.updatedAt || null
      };
    }
  } catch (e) {}
  return { percentage: 7, minCost: 50, updatedAt: null };
}

function saveRevenueConfig(config) {
  const percentage = parseFloat(config.percentage);
  const minCost = parseFloat(config.minCost);

  if (isNaN(percentage) || percentage < 0 || percentage >= 15) {
    return { ok: false, error: 'Percentage from Prize Pool must be strictly less than 15%' };
  }
  if (isNaN(minCost) || minCost < 0 || minCost >= 100) {
    return { ok: false, error: 'Minimum Cost to host a Competition must be strictly less than 100' };
  }

  const cleanConfig = {
    percentage: percentage,
    minCost: minCost,
    updatedAt: new Date().toISOString()
  };

  localStorage.setItem(REVENUE_CONFIG_KEY, JSON.stringify(cleanConfig));
  return { ok: true, config: cleanConfig };
}

function calculatePlatformFee(prizePoolAmount) {
  const amt = parseFloat(prizePoolAmount) || 0;
  const config = getRevenueConfig();
  const percentageFee = Math.round(amt * (config.percentage / 100));
  return Math.max(config.minCost, percentageFee);
}

const ADMIN_ACTIVITY_KEY = 'nexus.admin.activity_logs';

function getAdminActivityLogs(adminUsername) {
  try {
    const raw = localStorage.getItem(ADMIN_ACTIVITY_KEY);
    const logs = raw ? JSON.parse(raw) : [];
    if (!adminUsername) return logs;
    const target = String(adminUsername).trim().toLowerCase();
    return logs.filter(item => String(item.adminUsername || '').trim().toLowerCase() === target);
  } catch (e) {
    return [];
  }
}

function logAdminActivity(adminUsername, actionType, details, metadata) {
  try {
    const raw = localStorage.getItem(ADMIN_ACTIVITY_KEY);
    const logs = raw ? JSON.parse(raw) : [];
    const newEntry = {
      id: 'act-' + Date.now() + '-' + Math.random().toString(36).substr(2, 4),
      adminUsername: adminUsername || 'admin@nexus.gg',
      actionType: actionType,
      details: details,
      metadata: metadata || {},
      timestamp: new Date().toISOString()
    };
    logs.unshift(newEntry);
    localStorage.setItem(ADMIN_ACTIVITY_KEY, JSON.stringify(logs));
    return newEntry;
  } catch (e) {
    console.error('Failed to log admin activity:', e);
  }
}

// Expose globally
window.logAdminActivity = logAdminActivity;
window.getAdminActivityLogs = getAdminActivityLogs;

window.NexusData = {
  loadCompetitions, saveCompetitions, getCompetitionById,
  updateCompetition, deleteCompetition, addCompetition, generateId, getCompIdFromUrl,
  fetchCompetitionsFromAPI, fetchActiveCompetitionsFromAPI, mapApiCompetition, mergeCompetitions,
  goToComp, goToParticipant,
  getApprovalStatus, setCompetitionApproval, getCompetitionsForPublic,
  addCoOrganizer: addCoOrganizerToComp,
  removeCoOrganizer: removeCoOrganizerFromComp,
  setTeamRegistrationStatus,
  seedShowcaseCompetitions,
  getRevenueConfig,
  saveRevenueConfig,
  calculatePlatformFee,
  isTeamBannedInComp,
  getAdminActivityLogs,
  logAdminActivity,
  // Disputes
  addDispute, loadDisputes, saveDisputes,
  getDisputesByStatus, getDisputesByCompetition, updateDisputeStatus,
  getCompetitionParticipants, issueOrganizerWarning, issueAdminWarning, banUserPlatformWide,
};

// -- Ended-competition helpers ---------------------------------
function isCompEnded(comp) {
  if (!comp) return false;
  return !!(comp.ended || comp.status === 'completed');
}

function enforceNotEnded(comp, disableSelectors) {
  if (!isCompEnded(comp)) return false;
  if (!document.getElementById('_ended_banner_')) {
    var banner = document.createElement('div');
    banner.id = '_ended_banner_';
    banner.style.cssText = 'position:fixed;top:0;left:0;right:0;z-index:99999;background:#fb923c;color:#000;font-weight:800;font-size:13px;text-align:center;padding:10px 16px;letter-spacing:0.5px;font-family:sans-serif;';
    banner.textContent = '\uD83C\uDFC1 This competition has ended. All actions are locked \u2014 view only.';
    document.body.prepend(banner);
    document.body.style.marginTop = '42px';
  }
  if (disableSelectors) {
    try {
      document.querySelectorAll(disableSelectors).forEach(function(el) {
        el.disabled = true;
        el.style.opacity = '0.35';
        el.style.pointerEvents = 'none';
        el.style.cursor = 'not-allowed';
        el.title = 'Competition has ended';
      });
    } catch(e) {}
  }
  return true;
}

// Re-expose with new helpers
window.NexusData.isCompEnded = isCompEnded;
window.NexusData.enforceNotEnded = enforceNotEnded;

// -- Showcase / Demo Competition Seed --------------------------
function seedShowcaseCompetitions() {
  var SHOWCASE_IDS = [
    'world-championship-2026','spring-split-finals','champions-league',
    'battle-royale-masters','pro-league-season-5','rocket-championship'
  ];
  var all = loadCompetitions();
  var existingIds = new Set(all.map(function(c){ return c.id; }));
  if (SHOWCASE_IDS.every(function(id){ return existingIds.has(id); })) return;

  var S = [
    {
      id:'world-championship-2026', name:'World Championship 2026', game:'Counter-Strike 2',
      type:'tournament', status:'upcoming', dates:'Aug 15 - Sep 2, 2026', participants:256,
      location:'Mumbai, India', prizePool:'Rs.10,00,000', season:'Season 1',
      format:'Single Elimination', maxTeams:32, bannerColor:'#0d2235',
      img:'../assets/b890c61489a080992ad7e99adabb1145e6d59606.png', badge:'Featured', badgeClass:'featured',
      description:'The biggest Counter-Strike 2 tournament of the year. 32 of the best teams compete for the ultimate crown and a prize pool of Rs.10,00,000.',
      entryFee:'Rs.2,000 per team', registrationDates:{open:'Jul 1, 2026',close:'Aug 10, 2026'},
      rules:'All participants must be 16 years or older.\nTeams must have 5 players and 1 substitute.\nFormat: Single Elimination.\nMax 32 teams.\nEntry fee: Rs.2,000 per team.',
      approvalStatus:'approved', organizerId:'system', createdBy:'system',
      totalMatches:31, matchesCompleted:0,
      teams:[
        {id:'t1',name:'Team Nexus',avatar:'N',players:5,status:'approved',createdBy:'nexus_captain',members:[{username:'nexus_captain',role:'captain'},{username:'player_a',role:'player'},{username:'player_b',role:'player'},{username:'player_c',role:'player'},{username:'player_d',role:'player'}],invites:[],joinRequests:[]},
        {id:'t2',name:'Storm Riders',avatar:'S',players:5,status:'approved',createdBy:'storm_lead',members:[{username:'storm_lead',role:'captain'},{username:'storm_a',role:'player'},{username:'storm_b',role:'player'},{username:'storm_c',role:'player'},{username:'storm_d',role:'player'}],invites:[],joinRequests:[]},
        {id:'t3',name:'Phoenix Guard',avatar:'P',players:5,status:'approved',createdBy:'phoenix_lead',members:[{username:'phoenix_lead',role:'captain'}],invites:[],joinRequests:[]},
        {id:'t4',name:'Shadow Wolves',avatar:'W',players:5,status:'pending',createdBy:'shadow_lead',members:[{username:'shadow_lead',role:'captain'}],invites:[],joinRequests:[]}
      ],
      standings:[], matches:[], disputes:[], createdAt: new Date().toISOString()
    },
    {
      id:'spring-split-finals', name:'Spring Split Finals', game:'League of Legends',
      type:'league', status:'ongoing', dates:'May 1 - Jul 22, 2026', participants:192,
      location:'Online', prizePool:'Rs.8,50,000', season:'Season 3',
      format:'Round Robin + Playoffs', maxTeams:24, bannerColor:'#1e0d35',
      img:'../assets/7b04655f1d50a8b1b25ad53f36d80ff99cb3184e.png', badge:'Live', badgeClass:'live',
      description:'The Spring Split Finals brings together the top 24 League of Legends teams for an intense round-robin league followed by playoffs.',
      entryFee:'Free', registrationDates:{open:'Apr 1, 2026',close:'Apr 28, 2026'},
      rules:'Platinum rank or above required.\nTeams must have 5 players.\nFormat: Round Robin + Playoffs.\nEntry fee: Free.',
      approvalStatus:'approved', organizerId:'system', createdBy:'system',
      totalMatches:72, matchesCompleted:44,
      teams:[
        {id:'t1',name:'Apex Legends',avatar:'A',players:5,status:'approved',createdBy:'apex_lead',members:[{username:'apex_lead',role:'captain'}],invites:[],joinRequests:[]},
        {id:'t2',name:'Night Owls',avatar:'N',players:5,status:'approved',createdBy:'owl_lead',members:[{username:'owl_lead',role:'captain'}],invites:[],joinRequests:[]},
        {id:'t3',name:'Digital Hawks',avatar:'D',players:5,status:'approved',createdBy:'hawk_lead',members:[{username:'hawk_lead',role:'captain'}],invites:[],joinRequests:[]},
        {id:'t4',name:'Cyber Titans',avatar:'C',players:5,status:'approved',createdBy:'titan_lead',members:[{username:'titan_lead',role:'captain'}],invites:[],joinRequests:[]},
        {id:'t5',name:'Iron Wolves',avatar:'I',players:5,status:'approved',createdBy:'iron_lead',members:[{username:'iron_lead',role:'captain'}],invites:[],joinRequests:[]}
      ],
      standings:[
        {rank:1,team:'Apex Legends',mp:12,w:9,l:2,d:1,points:28},
        {rank:2,team:'Night Owls',mp:12,w:8,l:3,d:1,points:25},
        {rank:3,team:'Digital Hawks',mp:12,w:7,l:4,d:1,points:22},
        {rank:4,team:'Cyber Titans',mp:12,w:5,l:6,d:1,points:16},
        {rank:5,team:'Iron Wolves',mp:12,w:2,l:9,d:1,points:7}
      ],
      matches:[
        {id:'m1',round:'Week 1',team1:'Apex Legends',team2:'Night Owls',status:'completed',score1:2,score2:1,date:'May 3, 2026',time:'6:00 PM'},
        {id:'m2',round:'Week 2',team1:'Digital Hawks',team2:'Cyber Titans',status:'completed',score1:2,score2:0,date:'May 10, 2026',time:'6:00 PM'},
        {id:'m3',round:'Week 3',team1:'Apex Legends',team2:'Iron Wolves',status:'live',score1:1,score2:0,date:'May 17, 2026',time:'6:00 PM'},
        {id:'m4',round:'Week 4',team1:'Night Owls',team2:'Digital Hawks',status:'scheduled',score1:0,score2:0,date:'May 24, 2026',time:'6:00 PM'}
      ],
      disputes:[], createdAt: new Date().toISOString()
    },
    {
      id:'champions-league', name:'Champions League', game:'DOTA 2',
      type:'tournament', status:'upcoming', dates:'Sep 10 - Oct 5, 2026', participants:128,
      location:'Hyderabad, India', prizePool:'Rs.12,00,000', season:'Season 2',
      format:'Double Elimination', maxTeams:16, bannerColor:'#0d1a2a',
      img:'../assets/0e6f51d89fed056f96d58f2c51d79eb797ccdf75.png', badge:'Hot', badgeClass:'hot',
      description:'The Champions League is a Double Elimination DOTA 2 tournament with Rs.12,00,000 in prize money. Only the best 16 teams qualify.',
      entryFee:'Rs.3,000 per team', registrationDates:{open:'Aug 1, 2026',close:'Sep 5, 2026'},
      rules:'Teams must have 5 players and 2 substitutes.\nFormat: Double Elimination.\nMax 16 teams.\nEntry fee: Rs.3,000 per team.\nAll players must be 18+.',
      approvalStatus:'approved', organizerId:'system', createdBy:'system',
      totalMatches:30, matchesCompleted:0,
      teams:[
        {id:'t1',name:'Thunder Strike',avatar:'T',players:5,status:'approved',createdBy:'thunder_lead',members:[{username:'thunder_lead',role:'captain'}],invites:[],joinRequests:[]},
        {id:'t2',name:'Nova Force',avatar:'N',players:5,status:'approved',createdBy:'nova_lead',members:[{username:'nova_lead',role:'captain'}],invites:[],joinRequests:[]},
        {id:'t3',name:'Blaze Unit',avatar:'B',players:5,status:'pending',createdBy:'blaze_lead',members:[{username:'blaze_lead',role:'captain'}],invites:[],joinRequests:[]}
      ],
      standings:[], matches:[], disputes:[], createdAt: new Date().toISOString()
    },
    {
      id:'battle-royale-masters', name:'Battle Royale Masters', game:'Fortnite',
      type:'tournament', status:'upcoming', dates:'Jun 30 - Jul 10, 2026', participants:500,
      location:'Online', prizePool:'Rs.15,00,000', season:'Season 1',
      format:'Battle Royale Points', maxTeams:100, bannerColor:'#2a1500',
      img:'../assets/95bc0921c86340a2cee9e0a2d7ecd20b15a26143.png', badge:'New', badgeClass:'featured',
      description:'The biggest Fortnite tournament in India! 100 players compete in multiple rounds for a share of Rs.15,00,000.',
      entryFee:'Rs.500 per player', registrationDates:{open:'May 15, 2026',close:'Jun 25, 2026'},
      rules:'Solo players only.\nPoints: 10 per elimination + placement.\nTop 3 rounds count.\nMax 100 players.\nEntry fee: Rs.500.',
      approvalStatus:'approved', organizerId:'system', createdBy:'system',
      totalMatches:3, matchesCompleted:0,
      teams:[
        {id:'t1',name:'ProSniper_99',avatar:'P',players:1,status:'approved',createdBy:'ProSniper_99',members:[{username:'ProSniper_99',role:'captain'}],invites:[],joinRequests:[]},
        {id:'t2',name:'GhostViper',avatar:'G',players:1,status:'approved',createdBy:'GhostViper',members:[{username:'GhostViper',role:'captain'}],invites:[],joinRequests:[]}
      ],
      standings:[], matches:[], disputes:[], createdAt: new Date().toISOString()
    },
    {
      id:'pro-league-season-5', name:'Pro League Season 5', game:'Overwatch 2',
      type:'league', status:'upcoming', dates:'Jul 5 - Aug 25, 2026', participants:160,
      location:'Online', prizePool:'Rs.6,00,000', season:'Season 5',
      format:'Round Robin', maxTeams:20, bannerColor:'#1a2e1a',
      img:'../assets/fad13be991fc17a28771191ca710b201fb3ee4fb.png', badge:'Featured', badgeClass:'featured',
      description:'Season 5 of the Nexus Overwatch 2 Pro League. 20 teams battle in round-robin format with playoffs for top 8.',
      entryFee:'Rs.1,500 per team', registrationDates:{open:'Jun 1, 2026',close:'Jun 30, 2026'},
      rules:'Teams must have 6 players.\nFormat: Round Robin, top 8 to playoffs.\nMax 20 teams.\nEntry fee: Rs.1,500 per team.',
      approvalStatus:'approved', organizerId:'system', createdBy:'system',
      totalMatches:60, matchesCompleted:0,
      teams:[
        {id:'t1',name:'Overwatch Elite',avatar:'O',players:6,status:'approved',createdBy:'ow_elite_lead',members:[{username:'ow_elite_lead',role:'captain'}],invites:[],joinRequests:[]},
        {id:'t2',name:'Sentinel Force',avatar:'S',players:6,status:'approved',createdBy:'sentinel_lead',members:[{username:'sentinel_lead',role:'captain'}],invites:[],joinRequests:[]}
      ],
      standings:[], matches:[], disputes:[], createdAt: new Date().toISOString()
    },
    {
      id:'rocket-championship', name:'Rocket Championship', game:'Rocket League',
      type:'tournament', status:'upcoming', dates:'Aug 20 - Sep 1, 2026', participants:128,
      location:'Online', prizePool:'Rs.5,00,000', season:'Season 1',
      format:'Double Elimination', maxTeams:16, bannerColor:'#1a0a25',
      img:'../assets/61fe8554e6377c0b431ed18f65529b1847d225cb.png', badge:'Trending', badgeClass:'live',
      description:"India's premier Rocket League championship! 16 teams of 3 compete in a Double Elimination bracket for Rs.5,00,000.",
      entryFee:'Rs.1,000 per team', registrationDates:{open:'Jul 20, 2026',close:'Aug 15, 2026'},
      rules:'Teams of 3 players.\nFormat: Double Elimination.\nMax 16 teams.\nEntry fee: Rs.1,000 per team.\nGrand Champion rank required.',
      approvalStatus:'approved', organizerId:'system', createdBy:'system',
      totalMatches:30, matchesCompleted:0,
      teams:[
        {id:'t1',name:'Rocket Elite',avatar:'R',players:3,status:'approved',createdBy:'rocket_lead',members:[{username:'rocket_lead',role:'captain'}],invites:[],joinRequests:[]},
        {id:'t2',name:'Boost Kings',avatar:'B',players:3,status:'approved',createdBy:'boost_lead',members:[{username:'boost_lead',role:'captain'}],invites:[],joinRequests:[]}
      ],
      standings:[], matches:[], disputes:[], createdAt: new Date().toISOString()
    }
  ];

  var toAdd = S.filter(function(c){ return !existingIds.has(c.id); });
  if (!toAdd.length) return;
  saveCompetitions(all.concat(toAdd));
}
