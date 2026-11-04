(function (window) {
  const SESSION_KEY = 'nexus.auth.session';
  const NOTIFICATIONS_KEY = 'nexus.notifications.items';
  const TEAM_CONTEXT_KEY = 'nexus.team.activeContext';
  const COMPETITIONS_KEY = 'nexus_competitions';
  const MAX_TEAM_PLAYERS = 5;

  function normalize(value) {
    return String(value || '').trim().toLowerCase();
  }

  function parseJson(raw, fallback) {
    if (!raw) return fallback;
    try {
      return JSON.parse(raw);
    } catch (err) {
      return fallback;
    }
  }

  function getSession() {
    const raw = localStorage.getItem(SESSION_KEY);
    const parsed = parseJson(raw, null);
    if (!parsed || !parsed.username) return null;
    return parsed;
  }

  function makeId(prefix) {
    return prefix + '-' + Math.random().toString(36).slice(2, 10);
  }

  function isoNow() {
    return new Date().toISOString();
  }

  /** §6.2 — one competition-started check shared by every local roster rule. */
  function hasCompetitionStarted(comp) {
    if (!comp) return false;
    const status = normalize(comp.status);
    if (['ongoing', 'live', 'completed', 'ended', 'finished'].includes(status)) return true;
    const start = comp.startDate ? new Date(comp.startDate) : null;
    return !!(start && !isNaN(start.getTime()) && start.getTime() <= Date.now());
  }

  /** §2.4 — returns an error string when a private competition's code is missing/invalid. */
  function privateJoinCodeError(comp, joinCode) {
    if (!comp || String(comp.visibility || 'public') !== 'private') return '';
    const code = String(joinCode || '').trim();
    if (!code) return 'This is a private competition. Enter the join code shared by the organizer.';
    if (comp.joinCode && normalize(code) !== normalize(comp.joinCode)) {
      return 'Invalid join code. Please check the code with your organizer and try again.';
    }
    return '';
  }

  function maxPlayers(comp) {
    const configured = Number(comp && comp.maxPlayersPerTeam);
    return configured > 0 ? configured : MAX_TEAM_PLAYERS;
  }

  /**
   * Local mirror of the backend player-eligibility rule. Only normal player
   * accounts may join a competition team; the stored role/adminType decides,
   * never the display name. Unknown local accounts are validated by the API.
   */
  const PLAYER_ROLES = new Set(['participant', 'team_lead', 'regular', 'user', 'player']);

  function accountEligibleForTeam(username) {
    const name = normalize(username);
    if (!name) return false;
    let account = null;
    try {
      const auth = window.NexusAuth;
      if (auth && typeof auth.getAccounts === 'function') {
        account = (auth.getAccounts() || []).find(
          (row) => normalize(row.username) === name || normalize(row.email) === name,
        ) || null;
      }
    } catch (err) {
      account = null;
    }
    if (!account) {
      const session = getSession();
      account = session && normalize(session.username) === name ? session : null;
    }
    if (!account) return true;
    if (account.banned) return false;
    if (normalize(account.adminType)) return false;
    return PLAYER_ROLES.has(normalize(account.role));
  }

  const STAFF_TEAM_ERROR = 'Staff and administrative accounts cannot join competition teams.';

  function loadNotifications() {
    return parseJson(localStorage.getItem(NOTIFICATIONS_KEY), []);
  }

  function saveNotifications(items) {
    localStorage.setItem(NOTIFICATIONS_KEY, JSON.stringify(items || []));
  }

  function pushNotification(entry) {
    const all = loadNotifications();
    all.unshift({
      id: entry.id || makeId('notif'),
      toUsername: String(entry.toUsername || '').trim(),
      type: entry.type || 'system',
      status: entry.status || 'pending',
      title: entry.title || 'Notification',
      body: entry.body || '',
      createdAt: entry.createdAt || isoNow(),
      read: !!entry.read,
      meta: entry.meta || {}
    });
    saveNotifications(all);
  }

  function getNotificationsForUser(username) {
    const user = normalize(username);
    const notifications = loadNotifications()
      .filter(item => normalize(item.toUsername) === user)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

 // Dynamically update stale notifications with live competition/team status
    try {
      const comps = (window.NexusData && typeof window.NexusData.loadCompetitions === 'function')
        ? window.NexusData.loadCompetitions()
        : [];

      notifications.forEach(item => {
        if (!item.meta || !item.meta.compId || !item.meta.teamId) return;
        const comp = comps.find(c => c && c.id === item.meta.compId);
        if (!comp || !Array.isArray(comp.teams)) return;
        const team = comp.teams.find(t => t && t.id === item.meta.teamId);
        if (!team) return;

        const liveTeamStatus = String(team.status || 'pending').toLowerCase();

 // Resolve stale team-registration pending notifications
        if (item.status === 'pending' && (item.type === 'team-registration' || item.type === 'team-created')) {
          if (liveTeamStatus === 'approved') {
            item.status = 'approved';
            item.title = '✔ Team Registration Approved';
            item.body = `Your team "${team.name || 'Team'}" has been approved for ${comp.name || 'this competition'}.`;
          } else if (liveTeamStatus === 'rejected') {
            item.status = 'rejected';
            item.title = '✖ Team Registration Rejected';
            item.body = `Your team "${team.name || 'Team'}" was rejected for ${comp.name || 'this competition'}.`;
          } else if (liveTeamStatus === 'banned') {
            item.status = 'rejected';
            item.title = '🚫 Team Banned from Competition';
            item.body = `Your team "${team.name || 'Team'}" was banned from ${comp.name || 'this competition'} due to a dispute.`;
          }
        }

 // Resolve join requests
        if (item.meta.requestId && Array.isArray(team.joinRequests)) {
          const req = team.joinRequests.find(r => r && r.id === item.meta.requestId);
          if (req && req.status && !['pending', 'awaiting_payment', 'paid'].includes(req.status)) {
            const reqStatus = req.status === 'accepted' ? 'approved' : 'rejected';
            item.status = reqStatus;
            item.title = 'Join request ' + (reqStatus === 'approved' ? 'accepted' : 'declined');
            item.body = 'Your request to join ' + team.name + ' was ' + req.status + '.';
          }
        }

 // Resolve invites
        if (item.meta.inviteId && Array.isArray(team.invites)) {
          const inv = team.invites.find(i => i && i.id === item.meta.inviteId);
          if (inv && inv.status && inv.status !== 'pending') {
            const invStatus = inv.status === 'accepted' ? 'approved' : 'rejected';
            item.status = invStatus;
            item.title = 'Team invitation ' + (invStatus === 'approved' ? 'accepted' : 'declined');
            item.body = 'Invitation to join ' + team.name + ' was ' + inv.status + '.';
          }
        }
      });
    } catch (e) {
 // Safe fallback — don't break notification rendering
    }

    return notifications;
  }

  // Copies this user's backend-issued team notices into the local store, so they
  // arrive on any device, and closes invite notices that were handled elsewhere.
  // Resolves true if anything changed.
  const SERVER_NOTIFICATION_TYPES = ['team-disbanded', 'team-member-removed', 'team-invite', 'team-invite-result', 'team-join-request', 'team-join-payment', 'team-join-paid', 'join-request-approved', 'join-request-updated'];
  // Final outcomes: older records were saved as pending, but nothing is awaiting an answer.
  const CLOSED_NOTIFICATION_TYPES = ['team-disbanded', 'team-member-removed'];
  const INVITE_STATUS_TO_NOTIFICATION = { accepted: 'approved', declined: 'rejected', revoked: 'rejected' };

  async function syncServerNotifications(username) {
    const api = window.NexusAPI;
    if (!username || !api || !api.Notifications) return false;
    try {
      const [notifRes, inviteRes] = await Promise.all([
        api.Notifications.getForUser(username),
        api.Teams.getInvites(username)
      ]);
      const incoming = notifRes && notifRes.ok && Array.isArray(notifRes.data)
        ? notifRes.data.filter(item => SERVER_NOTIFICATION_TYPES.includes(item.type))
        : [];
      // Older removal notices made in this browser have no reason; the backend's copy replaces them.
      const removals = incoming.filter(item => item.type === 'team-member-removed').map(item => String(item.body || ''));
      const stored = loadNotifications();
      const all = stored.filter(item => !(
        item.type === 'team-roster-update'
        && normalize(item.toUsername) === normalize(username)
        && !(item.meta && item.meta.reason)
        && removals.some(body => body.includes('"' + String(item.title || '').replace('Removed from ', '') + '"'))
      ));
      const known = new Set(all.map(item => item.id));
      const merged = incoming
        .filter(item => !known.has(item.id))
        .map(item => (CLOSED_NOTIFICATION_TYPES.includes(item.type) ? { ...item, status: 'rejected' } : item))
        .concat(all);
      let changed = merged.length !== stored.length;

      // Copies saved earlier can hold a wrong time; the backend's is authoritative.
      const serverTimes = new Map(incoming.map(item => [item.id, item.createdAt]));
      merged.forEach(item => {
        const serverTime = serverTimes.get(item.id);
        if (serverTime && serverTime !== item.createdAt) {
          item.createdAt = serverTime;
          changed = true;
        }
      });

      const invites = inviteRes && inviteRes.ok && Array.isArray(inviteRes.data) ? inviteRes.data : [];
      invites.forEach(invite => {
        const status = INVITE_STATUS_TO_NOTIFICATION[invite.status];
        if (!status) return;
        merged.forEach(item => {
          if (item.type === 'team-invite' && item.status === 'pending' && item.meta && item.meta.inviteId === invite.id) {
            item.status = status;
            item.body = (item.body || '') + ' (This invitation was ' + invite.status + '.)';
            changed = true;
          }
        });
      });

      if (changed) saveNotifications(merged);
      return changed;
    } catch (e) {
      return false;
    }
  }

  function getNotificationById(notificationId, username) {
    const user = normalize(username || (getSession() || {}).username);
    if (!notificationId) return null;

    const all = loadNotifications();
    return all.find(item => {
      if (item.id !== notificationId) return false;
      if (!user) return true;
      return normalize(item.toUsername) === user;
    }) || null;
  }

  function updateNotification(notificationId, updates, username) {
    const user = normalize(username || (getSession() || {}).username);
    if (!notificationId) return null;

    const all = loadNotifications();
    let updated = null;

    all.forEach(item => {
      if (item.id !== notificationId) return;
      if (user && normalize(item.toUsername) !== user) return;

      const patch = updates || {};
      item.status = patch.status || item.status;
      item.read = typeof patch.read === 'boolean' ? patch.read : item.read;
      item.title = patch.title || item.title;
      item.body = patch.body || item.body;
      if (patch.meta && typeof patch.meta === 'object') {
        item.meta = Object.assign({}, item.meta || {}, patch.meta);
      }
      updated = item;
    });

    if (updated) {
      saveNotifications(all);
    }

    return updated;
  }

  function markAllNotificationsRead(username) {
    const user = normalize(username);
    const all = loadNotifications();
    let changed = false;

    all.forEach(item => {
      if (normalize(item.toUsername) === user && !item.read) {
        item.read = true;
        changed = true;
      }
    });

    if (changed) {
      saveNotifications(all);
    }
  }

  function getCompetitionById(compId) {
    if (window.NexusData && typeof window.NexusData.getCompetitionById === 'function') {
      return window.NexusData.getCompetitionById(compId);
    }

    const all = parseJson(localStorage.getItem(COMPETITIONS_KEY), []);
    if (!Array.isArray(all)) return null;
    return all.find(comp => comp && comp.id === compId) || null;
  }

  function saveCompetition(comp) {
    if (window.NexusData && typeof window.NexusData.updateCompetition === 'function') {
      window.NexusData.updateCompetition(comp);
      return true;
    }

    const all = parseJson(localStorage.getItem(COMPETITIONS_KEY), []);
    if (!Array.isArray(all)) return false;

    const idx = all.findIndex(item => item && item.id === comp.id);
    if (idx >= 0) all[idx] = comp;
    else all.push(comp);

    localStorage.setItem(COMPETITIONS_KEY, JSON.stringify(all));
    return true;
  }

  function ensureTeamShape(team, compId) {
    if (!team || typeof team !== 'object') return null;

    const safeTeam = team;
    safeTeam.competitionId = safeTeam.competitionId || compId || null;
    safeTeam.createdBy = safeTeam.createdBy || safeTeam.leaderUsername || null;
    safeTeam.members = Array.isArray(safeTeam.members) ? safeTeam.members : [];
    safeTeam.invites = Array.isArray(safeTeam.invites) ? safeTeam.invites : [];
    safeTeam.joinRequests = Array.isArray(safeTeam.joinRequests) ? safeTeam.joinRequests : [];

    if (safeTeam.members.length === 0) {
      const leaderUsername = safeTeam.createdBy || safeTeam.leaderUsername || safeTeam.leader || 'captain';
      safeTeam.members.push({
        username: leaderUsername,
        displayName: safeTeam.leader || leaderUsername,
        role: 'captain',
        joinedAt: safeTeam.created || isoNow()
      });
      safeTeam.createdBy = leaderUsername;
    }

    safeTeam.players = safeTeam.members.length;
    return safeTeam;
  }

  function ensureCompetitionTeams(comp) {
    if (!comp) return;
    if (!Array.isArray(comp.teams)) comp.teams = [];
    comp.teams.forEach(team => ensureTeamShape(team, comp.id));
  }

  function setActiveTeamContext(context) {
    if (!context || !context.compId || !context.teamId) return;
    localStorage.setItem(TEAM_CONTEXT_KEY, JSON.stringify({ compId: context.compId, teamId: context.teamId }));
  }

  function getActiveTeamContext() {
    return parseJson(localStorage.getItem(TEAM_CONTEXT_KEY), null);
  }

  function getContextFromQuery() {
    const params = new URLSearchParams(window.location.search);
    const compId = params.get('compId') || params.get('id');
    const teamId = params.get('teamId');
    if (!compId || !teamId) return null;
    return { compId, teamId };
  }

  function findTeam(comp, teamId) {
    if (!comp || !Array.isArray(comp.teams)) return null;
    const team = comp.teams.find(item => item.id === teamId || (item.dbId && item.dbId === teamId));
    return team ? ensureTeamShape(team, comp.id) : null;
  }

  function findTeamAcrossCompetitions(teamId) {
    if (!window.NexusData || typeof window.NexusData.loadCompetitions !== 'function') {
      return null;
    }

    const all = window.NexusData.loadCompetitions() || [];
    for (let i = 0; i < all.length; i += 1) {
      const comp = all[i];
      ensureCompetitionTeams(comp);
      const team = (comp.teams || []).find(item => item.id === teamId);
      if (team) {
        return {
          comp,
          team: ensureTeamShape(team, comp.id)
        };
      }
    }

    return null;
  }

  function findUserTeamInCompetition(compId, username, includeRejected) {
    const session = getSession();
    const userKey = normalize(username || (session && session.username));
    if (!userKey) return null;

    const comp = getCompetitionById(compId);
    if (!comp) return null;
    ensureCompetitionTeams(comp);

    const team = (comp.teams || []).find(item => {
      if (!includeRejected && String(item && item.status || '').toLowerCase() === 'rejected') return false;
      if (normalize(item.createdBy) === userKey) return true;
      return (item.members || []).some(member => normalize(member.username) === userKey);
    });

    if (!team) return null;

    const safeTeam = ensureTeamShape(team, comp.id);
    return {
      comp,
      team: safeTeam,
      context: {
        compId: comp.id,
        teamId: safeTeam.id
      }
    };
  }

  function resolveTeamContext() {
    const session = getSession();
    const contextCandidates = [getContextFromQuery(), getActiveTeamContext()];

    for (let i = 0; i < contextCandidates.length; i += 1) {
      const ctx = contextCandidates[i];
      if (!ctx || !ctx.compId || !ctx.teamId) continue;
      const comp = getCompetitionById(ctx.compId);
      if (!comp) continue;
      ensureCompetitionTeams(comp);
      const team = findTeam(comp, ctx.teamId);
      if (!team) continue;
      setActiveTeamContext(ctx);
      return { comp, team, context: ctx, session };
    }

    if (!session || !window.NexusData || typeof window.NexusData.loadCompetitions !== 'function') {
      return { comp: null, team: null, context: null, session };
    }

    const all = window.NexusData.loadCompetitions() || [];
    const userKey = normalize(session.username);

    for (let i = 0; i < all.length; i += 1) {
      const comp = all[i];
      ensureCompetitionTeams(comp);
      const found = (comp.teams || []).find(team => normalize(team.createdBy) === userKey);
      if (found) {
        const ctx = { compId: comp.id, teamId: found.id };
        setActiveTeamContext(ctx);
        return { comp, team: ensureTeamShape(found, comp.id), context: ctx, session };
      }
    }

    return { comp: null, team: null, context: null, session };
  }

  function userCanManageTeam(team, session) {
    if (!team || !session) return false;
    return !['banned', 'disbanded', 'rejected'].includes(normalize(team.status))
      && normalize(team.leaderId || team.createdBy) === normalize(session.username)
      && (team.members || []).some(member => normalize(member.username) === normalize(session.username));
  }

  function createTeam(options) {
    const opts = options || {};
    const session = getSession();
    if (!session) {
      return { ok: false, error: 'Please log in to create a team.' };
    }

    const compId = String(opts.compId || '').trim();
    const comp = getCompetitionById(compId);
    if (!comp) {
      return { ok: false, error: 'Tournament context missing.' };
    }

    if (hasCompetitionStarted(comp)) {
      return { ok: false, error: 'The competition has started: new teams can no longer be created.' };
    }

    const codeError = privateJoinCodeError(comp, opts.joinCode);
    if (codeError) return { ok: false, error: codeError };

    ensureCompetitionTeams(comp);

    const name = String(opts.name || '').trim();
    const tag = String(opts.tag || '').trim().toUpperCase();
    if (!name || !tag) {
      return { ok: false, error: 'Team name and tag are required.' };
    }

    const userKey = normalize(session.username);
    const alreadyInComp = (comp.teams || []).some(team => {
      if (String(team && team.status || '').toLowerCase() === 'rejected') return false;
      const isCaptain = normalize(team.createdBy) === userKey;
      const isMember = (team.members || []).some(member => normalize(member.username) === userKey);
      return isCaptain || isMember;
    });
    if (alreadyInComp) {
      return { ok: false, error: 'You are already part of a team in this competition.' };
    }

    const entryFeeAmount = comp.entryFeeAmount || 0;
    const feeType = comp.feeType || 'free';
    const isTeamPaid = feeType === 'per_team' && entryFeeAmount > 0;

    const team = {
      id: makeId('team'),
      dbId: opts.dbId || null,
      backendSynced: !!opts.backendSynced,
      name,
      tag,
      avatar: opts.avatar || 'SHIELD',
      // §4.1 — automatic team approval: new teams are eligible to join (and
      // visible in the competition team listing) immediately after creation.
      // No organizer approval step. The organizer still gets an FYI notification.
      status: 'approved',
      createdBy: session.username,
      leader: session.displayName || session.username,
      leaderUsername: session.username,
      competitionId: comp.id,
      created: isoNow(),
      paymentStatus: isTeamPaid ? 'paid' : 'free',
      feePaid: isTeamPaid ? entryFeeAmount : 0,
      feeType: feeType,
      members: [
        {
          username: session.username,
          displayName: session.displayName || session.username,
          role: 'captain',
          joinedAt: isoNow(),
          feePaid: (feeType === 'per_player') ? entryFeeAmount : 0
        }
      ],
      invites: [],
      joinRequests: [],
      players: 1
    };

    comp.teams.unshift(team);
    saveCompetition(comp);
    setActiveTeamContext({ compId: comp.id, teamId: team.id });

    if (window.NexusAPI && window.NexusAPI.Teams && !team.backendSynced) {
      window.NexusAPI.Teams.create({
        name: team.name,
        competitionId: comp.dbId || comp.id,
        members: [session.username],
        joinCode: String(opts.joinCode || '').trim(),
      }).then(res => {
        if (res && res.ok && res.data && res.data.id) {
          const latest = getCompetitionById(comp.id);
          if (latest) {
            ensureCompetitionTeams(latest);
            const storedTeam = latest.teams.find(t => t.id === team.id);
            if (storedTeam) {
              storedTeam.dbId = res.data.id;
              storedTeam.backendSynced = true;
              saveCompetition(latest);
            }
          }
        }
      }).catch(() => {});
    }

    // §4.1 — organizer is informed; no approval is required anymore.
    const organiserUsername = String(comp.createdBy || comp.organizerId || '').trim();
    if (organiserUsername) {
      pushNotification({
        toUsername: organiserUsername,
        type: 'team-registered',
        status: 'approved',
        title: 'New team registered',
        body: '"' + team.name + '" (captain: ' + session.username + ') has joined ' + (comp.name || 'this competition') + '.',
        createdAt: isoNow(),
        read: false,
        meta: { compId: comp.id, teamId: team.id, teamStatus: 'approved' }
      });
    }

    // §4.1 — the team is immediately available; no pending-approval copy.
    pushNotification({
      toUsername: session.username,
      type: 'team-created',
      status: 'approved',
      title: 'Team created — ready to play',
      body: 'Your team "' + team.name + '" is registered for ' + (comp.name || 'this competition') + ' and can be managed from the Team dashboard.',
      createdAt: isoNow(),
      read: false,
      meta: { compId: comp.id, teamId: team.id }
    });

    return { ok: true, team, competition: comp };
  }

  function findCompetitionByAnyId(compId) {
    const direct = getCompetitionById(compId);
    if (direct) return direct;
    const all = (window.NexusData && typeof window.NexusData.loadCompetitions === 'function')
      ? window.NexusData.loadCompetitions()
      : [];
    return (all || []).find(comp => comp && comp.dbId === compId) || null;
  }

  const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

  function playerFeeDue(comp) {
    const amount = Number(comp && comp.entryFeeAmount) || 0;
    return comp && comp.feeType === 'per_player' && amount > 0 ? amount : 0;
  }

  // Finds the local copies of a competition and team, creating them from the backend
  // when this browser has never seen them.
  async function ensureLocalTeam(compId, teamId, serverTeam) {
    let comp = findCompetitionByAnyId(compId);
    if (!comp && serverTeam && window.NexusData) {
      const compRes = await window.NexusAPI.Competitions.getById(compId);
      if (compRes.ok && compRes.data) {
        window.NexusData.updateCompetition(window.NexusData.mapApiCompetition(compRes.data));
        comp = findCompetitionByAnyId(compId);
      }
    }
    if (!comp) return { comp: null, team: null };
    ensureCompetitionTeams(comp);
    let team = findTeam(comp, teamId);
    if (!team && serverTeam) {
      const leader = serverTeam.leaderId;
      team = ensureTeamShape({
        id: serverTeam.id,
        dbId: serverTeam.id,
        backendSynced: true,
        name: serverTeam.name,
        tag: '',
        avatar: 'SHIELD',
        status: serverTeam.status,
        createdBy: serverTeam.createdBy || leader,
        leader,
        leaderUsername: leader,
        created: serverTeam.createdAt,
        members: [{ username: leader, displayName: leader, role: 'captain', joinedAt: serverTeam.createdAt }],
        invites: [],
        joinRequests: []
      }, comp.id);
      comp.teams.unshift(team);
    }
    return { comp, team };
  }

  function setMemberFee(team, username, amount) {
    const member = team.members.find(item => normalize(item.username) === normalize(username));
    if (member) {
      member.feePaid = amount;
      member.paymentStatus = amount > 0 ? 'paid' : 'free';
    }
  }

  function backendTeamId(team) {
    return (team && (team.dbId || team.id)) || null;
  }

  function toLocalInvite(serverInvite, existing) {
    return {
      id: serverInvite.id,
      toUsername: serverInvite.toUsername,
      roleOffered: (existing && existing.roleOffered) || 'Player',
      message: (existing && existing.message) || '',
      sentBy: serverInvite.fromUsername,
      sentAt: serverInvite.createdAt,
      status: serverInvite.status
    };
  }

  // Adds backend roster entries the local copy is missing. Local-only members are
  // kept because other join paths still only record them in this browser.
  function mergeBackendRoster(team, serverTeam) {
    const before = JSON.stringify(team);
    const existing = new Map((team.members || []).map(member => [normalize(member.username), member]));
    team.members = (serverTeam.memberUsernames || []).map(username => ({
      ...(existing.get(normalize(username)) || { joinedAt: isoNow() }),
      username, displayName: existing.get(normalize(username))?.displayName || username,
      role: normalize(username) === normalize(serverTeam.leaderId) ? 'captain' : 'player',
    }));
    team.leaderId = serverTeam.leaderId;
    team.createdBy = serverTeam.leaderId;
    team.status = serverTeam.status;
    team.name = serverTeam.name;
    team.players = team.members.length;
    return before !== JSON.stringify(team);
  }

  async function sendInvite(options) {
    const opts = options || {};
    const session = getSession();
    if (!session) return { ok: false, error: 'Please log in first.' };

    const comp = getCompetitionById(opts.compId);
    if (!comp) return { ok: false, error: 'Competition not found.' };
    ensureCompetitionTeams(comp);

    const team = findTeam(comp, opts.teamId);
    if (!team) return { ok: false, error: 'Team not found.' };
    if (!userCanManageTeam(team, session)) return { ok: false, error: 'Only team captain can send invites.' };

    const toUsername = String(opts.toUsername || '').trim();
    if (!toUsername) return { ok: false, error: 'Username is required.' };

    // The backend validates the invite and notifies the player on any device.
    const res = await window.NexusAPI.Teams.createInvite(backendTeamId(team), comp.dbId || comp.id, toUsername, session.username);
    if (!res.ok) return { ok: false, error: res.error || 'Failed to send invite.' };

    const invite = toLocalInvite(res.data, {
      roleOffered: String(opts.roleOffered || 'Player').trim(),
      message: String(opts.message || '').trim()
    });
    team.invites.unshift(invite);
    saveCompetition(comp);

    return { ok: true, invite };
  }

  async function revokeInvite(options) {
    const opts = options || {};
    const session = getSession();
    if (!session) return { ok: false, error: 'Please log in first.' };

    const comp = getCompetitionById(opts.compId);
    if (!comp) return { ok: false, error: 'Competition not found.' };
    ensureCompetitionTeams(comp);

    const team = findTeam(comp, opts.teamId);
    if (!team) return { ok: false, error: 'Team not found.' };
    if (!userCanManageTeam(team, session)) return { ok: false, error: 'Only team captain can revoke invites.' };

    const res = await window.NexusAPI.Teams.revokeInvite(backendTeamId(team), opts.inviteId);
    if (!res.ok) return { ok: false, error: res.error || 'Failed to revoke invite.' };

    team.invites = team.invites.filter(inv => inv.id !== opts.inviteId);
    saveCompetition(comp);

    return { ok: true };
  }

  // Pulls the team's roster and sent invites from the backend into the local copy.
  // Resolves true if anything changed.
  async function syncTeamFromBackend(compId, teamId) {
    const comp = getCompetitionById(compId);
    if (!comp || !window.NexusAPI) return false;
    ensureCompetitionTeams(comp);
    const team = findTeam(comp, teamId);
    const id = backendTeamId(team);
    if (!id) return false;

    // Sent invites are only visible to whoever manages the team.
    const [teamRes, inviteRes, joinRes] = await Promise.all([
      window.NexusAPI.Teams.getById(id),
      userCanManageTeam(team, getSession()) ? window.NexusAPI.Teams.getTeamInvites(id) : null,
      userCanManageTeam(team, getSession()) ? window.NexusAPI.Teams.getJoinRequests(id) : null
    ]);

    const before = JSON.stringify(team);
    if (teamRes.ok && teamRes.data) mergeBackendRoster(team, teamRes.data);
    if (inviteRes && inviteRes.ok && Array.isArray(inviteRes.data)) {
      const existing = new Map(team.invites.map(inv => [inv.id, inv]));
      team.invites = inviteRes.data.map(inv => toLocalInvite(inv, existing.get(inv.id)));
    }
    if (joinRes && joinRes.ok && Array.isArray(joinRes.data)) {
      const LOCAL_STATUS = { approved: 'accepted', rejected: 'declined' };
      joinRes.data.forEach(serverReq => {
        const status = LOCAL_STATUS[serverReq.status] || serverReq.status;
        let local = team.joinRequests.find(req => req.backendId === serverReq.id || req.id === serverReq.id);
        if (!local) {
          // Requests from before they were linked to their backend record match by player.
          local = team.joinRequests.find(req => !req.backendId && req.status === 'pending' && normalize(req.username) === normalize(serverReq.fromUsername));
        }
        if (local) {
          local.backendId = serverReq.id;
          local.status = status;
        } else {
          team.joinRequests.unshift({
            id: serverReq.id,
            backendId: serverReq.id,
            username: serverReq.fromUsername,
            displayName: serverReq.fromUsername,
            message: serverReq.message || '',
            requestedAt: serverReq.createdAt,
            status,
            feePaid: 0,
            paymentStatus: playerFeeDue(comp) ? 'unpaid' : 'free'
          });
        }
        if (serverReq.status === 'paid') setMemberFee(team, serverReq.fromUsername, playerFeeDue(comp));
      });
    }
    if (JSON.stringify(team) === before) return false;
    saveCompetition(comp);
    return true;
  }

  function submitJoinRequest(options) {
    const opts = options || {};
    const session = getSession();
    if (!session) return { ok: false, error: 'Please log in first.' };
    if (!accountEligibleForTeam(session.username)) return { ok: false, error: STAFF_TEAM_ERROR };

    const comp = getCompetitionById(opts.compId);
    if (!comp) return { ok: false, error: 'Competition not found.' };
    if (hasCompetitionStarted(comp)) {
      return { ok: false, error: 'The competition has started: join requests are closed.' };
    }
    const codeError = privateJoinCodeError(comp, opts.joinCode);
    if (codeError) return { ok: false, error: codeError };
    ensureCompetitionTeams(comp);

    const team = findTeam(comp, opts.teamId);
    if (!team) return { ok: false, error: 'Team not found.' };

    if (team.members.length >= maxPlayers(comp)) {
      return { ok: false, error: 'Team is full — maximum ' + maxPlayers(comp) + ' player(s) per team.' };
    }

    if (normalize(team.createdBy) === normalize(session.username)) {
      return { ok: false, error: 'You are already the captain of this team.' };
    }

    const alreadyMember = team.members.some(member => normalize(member.username) === normalize(session.username));
    if (alreadyMember) {
      return { ok: false, error: 'You are already in this team.' };
    }

    const inAnotherTeam = (comp.teams || []).some(item => {
      if (item.id === team.id) return false;
      if (String(item && item.status || '').toLowerCase() === 'rejected') return false;
      return (item.members || []).some(member => normalize(member.username) === normalize(session.username));
    });

    if (inAnotherTeam) {
      return { ok: false, error: 'You are already registered in another team for this competition.' };
    }

    const existingPending = team.joinRequests.find(req => normalize(req.username) === normalize(session.username) && (req.status === 'pending' || req.status === 'awaiting_payment'));
    if (existingPending) {
      return { ok: false, error: 'You already sent a join request to this team.' };
    }

    // Where each player pays, payment comes after the team lead accepts.
    const request = {
      id: makeId('joinreq'),
      backendId: opts.backendId || null,
      username: session.username,
      displayName: session.displayName || session.username,
      message: String(opts.message || '').trim(),
      requestedAt: isoNow(),
      status: 'pending',
      feePaid: 0,
      paymentStatus: playerFeeDue(comp) ? 'unpaid' : 'free'
    };

    team.joinRequests.unshift(request);
    saveCompetition(comp);

    // The backend tells the team lead when it holds the request.
    if (!request.backendId) {
      pushNotification({
        toUsername: team.createdBy,
        type: 'team-join-request',
        status: 'pending',
        title: 'New join request for ' + team.name,
        body: (session.displayName || session.username) + ' requested to join your team.',
        createdAt: request.requestedAt,
        read: false,
        meta: {
          compId: comp.id,
          teamId: team.id,
          requestId: request.id
        }
      });
    }

    return { ok: true, request };
  }

  async function decideJoinRequest(options) {
    const opts = options || {};
    const action = opts.action === 'accepted' ? 'accepted' : 'declined';
    const session = getSession();
    if (!session) return { ok: false, error: 'Please log in first.' };

    const comp = findCompetitionByAnyId(opts.compId);
    if (!comp) return { ok: false, error: 'Competition not found.' };
    ensureCompetitionTeams(comp);

    const team = findTeam(comp, opts.teamId);
    if (!team) return { ok: false, error: 'Team not found.' };
    if (!userCanManageTeam(team, session)) return { ok: false, error: 'Only team captain can review requests.' };

    let request = team.joinRequests.find(item => item.id === opts.requestId || item.backendId === opts.requestId);
    const backendId = request ? request.backendId : (UUID_PATTERN.test(String(opts.requestId || '')) ? opts.requestId : null);
    if (!request && !backendId) return { ok: false, error: 'Request not found.' };
    if (request && request.status !== 'pending') return { ok: false, error: 'This request was already handled.' };

    if (action === 'accepted') {
      if (hasCompetitionStarted(comp)) {
        return { ok: false, error: 'The competition has started: rosters are locked.' };
      }
      if (team.members.length >= maxPlayers(comp)) {
        return { ok: false, error: 'Team is already full (' + team.members.length + ' / ' + maxPlayers(comp) + ').' };
      }
    }

    // Requests paid under the earlier pay-first flow don't pay a second time.
    const feeAlreadyPaid = !!(request && Number(request.feePaid) > 0);
    if (backendId) {
      const res = await window.NexusAPI.Teams.updateJoinRequest(backendId, action, session.username, feeAlreadyPaid);
      if (!res.ok) return { ok: false, error: res.error || 'Unable to update the request.' };
    }
    if (!request) {
      request = {
        id: backendId,
        backendId,
        username: opts.username || '',
        status: 'pending',
        feePaid: 0
      };
      team.joinRequests.unshift(request);
    }

    const feeDue = action === 'accepted' && !feeAlreadyPaid ? playerFeeDue(comp) : 0;
    if (action === 'accepted' && !feeDue) {
      const exists = team.members.some(member => normalize(member.username) === normalize(request.username));
      if (!exists && request.username) {
        team.members.push({
          username: request.username,
          displayName: request.displayName || request.username,
          role: 'player',
          joinedAt: isoNow(),
          feePaid: Number(request.feePaid) || 0,
          paymentStatus: request.paymentStatus || 'free',
          localOnly: !backendId
        });
      }
    }

    request.status = feeDue ? 'awaiting_payment' : action;
    request.handledAt = isoNow();
    team.players = team.members.length;

    saveCompetition(comp);

 // Update any stale pending notifications for this join request
    try {
      const notifItems = JSON.parse(localStorage.getItem(NOTIFICATIONS_KEY) || '[]');
      let notifModified = false;
      notifItems.forEach(n => {
        if (n && n.type === 'team-join-request' && n.meta && (n.meta.requestId === request.id || n.meta.requestId === backendId) && n.status === 'pending') {
          n.status = action === 'accepted' ? 'approved' : 'rejected';
          n.body = (n.body || '') + ' (' + (feeDue ? 'Accepted: waiting for the player to pay.' : 'You ' + action + ' this.') + ')';
          notifModified = true;
        }
      });
      if (notifModified) saveNotifications(notifItems);
    } catch (e) {}

    // The backend notifies the player when it holds the request.
    if (!backendId) {
      pushNotification({
        toUsername: request.username,
        type: feeDue ? 'team-join-payment' : 'team-join-request-result',
        status: feeDue ? 'pending' : (action === 'accepted' ? 'approved' : 'rejected'),
        title: feeDue ? '✅ Join request accepted: payment needed' : 'Join request ' + (action === 'accepted' ? 'accepted' : 'declined'),
        body: feeDue
          ? 'The lead of "' + team.name + '" accepted your request. Pay the ₹' + feeDue + ' entry fee to join the team.'
          : 'Your request to join ' + team.name + ' was ' + action + '.',
        createdAt: isoNow(),
        read: false,
        meta: {
          compId: comp.id,
          teamId: team.id,
          requestId: request.id,
          amount: feeDue,
          teamName: team.name
        }
      });
    }

    return { ok: true, action, request, feeDue };
  }

  // The player pays after the team lead accepted; this is what puts them on the roster.
  async function payJoinRequest(options) {
    const opts = options || {};
    const session = getSession();
    if (!session) return { ok: false, error: 'Please log in first.' };

    const localComp = findCompetitionByAnyId(opts.compId);
    if (localComp) ensureCompetitionTeams(localComp);
    const localTeam = localComp ? findTeam(localComp, opts.teamId) : null;
    const localRequest = localTeam
      ? localTeam.joinRequests.find(item => item.id === opts.requestId || item.backendId === opts.requestId)
      : null;
    const backendId = localRequest ? localRequest.backendId : (UUID_PATTERN.test(String(opts.requestId || '')) ? opts.requestId : null);

    let serverTeam = null;
    let amount = playerFeeDue(localComp);
    if (backendId) {
      const res = await window.NexusAPI.Teams.payJoinRequest(backendId);
      if (!res.ok) return { ok: false, error: res.error || 'Payment could not be completed.' };
      serverTeam = res.data && res.data.team;
      amount = (res.data && res.data.amount) || amount;
    } else {
      if (!localRequest) return { ok: false, error: 'Request not found.' };
      if (localRequest.status !== 'awaiting_payment') return { ok: false, error: 'This request is not waiting for payment.' };
      if (hasCompetitionStarted(localComp)) return { ok: false, error: 'The competition has started: rosters are locked.' };
      if (localTeam.members.length >= maxPlayers(localComp)) {
        return { ok: false, error: 'Team is already full (' + localTeam.members.length + ' / ' + maxPlayers(localComp) + ').' };
      }
    }

    const { comp, team } = await ensureLocalTeam(opts.compId, opts.teamId, serverTeam);
    if (comp && team) {
      if (serverTeam) mergeBackendRoster(team, serverTeam);
      if (!team.members.some(member => normalize(member.username) === normalize(session.username))) {
        team.members.push({
          username: session.username,
          displayName: session.displayName || session.username,
          role: 'player',
          joinedAt: isoNow()
        });
      }
      setMemberFee(team, session.username, amount);
      const request = team.joinRequests.find(item => item.id === opts.requestId || item.backendId === opts.requestId);
      if (request) {
        request.status = 'paid';
        request.feePaid = amount;
        request.paymentStatus = 'paid';
        request.paidAt = isoNow();
      }
      team.players = team.members.length;
      saveCompetition(comp);
      setActiveTeamContext({ compId: comp.id, teamId: team.id });

      if (!backendId) {
        pushNotification({
          toUsername: team.createdBy,
          type: 'team-join-paid',
          status: 'approved',
          title: 'Player paid and joined',
          body: session.username + ' paid the ₹' + amount + ' entry fee and joined ' + team.name + '.',
          createdAt: isoNow(),
          read: false,
          meta: { compId: comp.id, teamId: team.id, requestId: opts.requestId }
        });
      }
    }

    return { ok: true, amount };
  }

  function decideCoOrganizerInvite(options) {
    const opts = options || {};
    const action = opts.action === 'accepted' ? 'accepted' : 'declined';
    const session = getSession();
    if (!session) return { ok: false, error: 'Please log in first.' };

    const comp = getCompetitionById(opts.compId);
    if (!comp) return { ok: false, error: 'Competition not found.' };

    if (!Array.isArray(comp.organizers)) {
      comp.organizers = Array.from(new Set([comp.createdBy, comp.organizerId].filter(Boolean)));
    }
    if (!Array.isArray(comp.pendingCoOrganizers)) {
      comp.pendingCoOrganizers = [];
    }

    const userKey = normalize(session.username);

    if (action === 'accepted') {
      if (!comp.organizers.some(u => normalize(u) === userKey)) {
        comp.organizers.push(session.username);
      }
      comp.pendingCoOrganizers = comp.pendingCoOrganizers.filter(u => normalize(u) !== userKey);
      saveCompetition(comp);

 // Resolve pending co-organizer-invite notifications for this user in localStorage
      try {
        const notifItems = loadNotifications();
        let notifModified = false;
        notifItems.forEach(n => {
          if (n && n.meta && (n.meta.compId === comp.id || n.meta.compId === opts.compId) && n.type === 'co-organizer-invite' && normalize(n.toUsername) === userKey && n.status === 'pending') {
            n.status = 'approved';
            n.read = true;
            n.title = 'Co-Organizer Invitation Accepted';
            n.body = `You accepted the invitation to be a co-organizer for "${comp.name}".`;
            notifModified = true;
          }
        });
        if (notifModified) saveNotifications(notifItems);
      } catch (e) {}

      const creator = comp.createdBy || comp.organizerId;
      if (creator) {
        pushNotification({
          toUsername: creator,
          type: 'co-organizer-result',
          status: 'approved',
          title: 'Co-Organizer Accepted',
          body: `@${session.username} accepted your co-organizer invitation for "${comp.name}".`,
          createdAt: isoNow(),
          read: false,
          meta: { compId: comp.id }
        });
      }

      return { ok: true, message: `You are now a co-organizer for "${comp.name}"!` };
    } else {
      comp.pendingCoOrganizers = comp.pendingCoOrganizers.filter(u => normalize(u) !== userKey);
      saveCompetition(comp);

 // Resolve pending co-organizer-invite notifications for this user in localStorage
      try {
        const notifItems = loadNotifications();
        let notifModified = false;
        notifItems.forEach(n => {
          if (n && n.meta && (n.meta.compId === comp.id || n.meta.compId === opts.compId) && n.type === 'co-organizer-invite' && normalize(n.toUsername) === userKey && n.status === 'pending') {
            n.status = 'rejected';
            n.read = true;
            n.title = 'Co-Organizer Invitation Declined';
            n.body = `You declined the invitation to be a co-organizer for "${comp.name}".`;
            notifModified = true;
          }
        });
        if (notifModified) saveNotifications(notifItems);
      } catch (e) {}

      const creator = comp.createdBy || comp.organizerId;
      if (creator) {
        pushNotification({
          toUsername: creator,
          type: 'co-organizer-result',
          status: 'rejected',
          title: 'Co-Organizer Declined',
          body: `@${session.username} declined your co-organizer invitation for "${comp.name}".`,
          createdAt: isoNow(),
          read: false,
          meta: { compId: comp.id }
        });
      }

      return { ok: true, message: 'Co-organizer invitation declined.' };
    }
  }

  async function decideInvite(options) {
    const opts = options || {};
    const action = opts.action === 'accepted' ? 'accepted' : 'declined';
    const session = getSession();
    if (!session) return { ok: false, error: 'Please log in first.' };

    const res = await window.NexusAPI.Teams.updateInvite(opts.inviteId, action);
    if (!res.ok) return { ok: false, error: res.error || 'Unable to update the invitation.' };

    // Mirror the backend result locally; this browser may never have seen the team.
    const serverTeam = res.data && res.data.team;
    const { comp, team } = await ensureLocalTeam(opts.compId, opts.teamId, serverTeam);
    if (comp && team) {
      if (serverTeam) mergeBackendRoster(team, serverTeam);
      const invite = team.invites.find(item => item.id === opts.inviteId);
      if (invite) {
        invite.status = action;
        invite.handledAt = isoNow();
      }
      saveCompetition(comp);
      if (action === 'accepted') setActiveTeamContext({ compId: comp.id, teamId: team.id });
    }

    return { ok: true, action, invite: res.data };
  }

  function directJoinTeam(options) {
    const opts = options || {};
    const session = getSession();
    if (!session) return { ok: false, error: 'Please log in first.' };
    if (!accountEligibleForTeam(session.username)) return { ok: false, error: STAFF_TEAM_ERROR };

    let comp = opts.compId ? getCompetitionById(opts.compId) : null;
    let team = comp ? findTeam(comp, opts.teamId) : null;

    if (!team) {
      const resolved = findTeamAcrossCompetitions(opts.teamId);
      if (!resolved) return { ok: false, error: 'Team not found.' };
      comp = resolved.comp;
      team = resolved.team;
    }

    if (!comp) return { ok: false, error: 'Competition not found.' };
    if (hasCompetitionStarted(comp)) {
      return { ok: false, error: 'The competition has started: membership is locked.' };
    }
    const codeError = privateJoinCodeError(comp, opts.joinCode);
    if (codeError) return { ok: false, error: codeError };
    ensureCompetitionTeams(comp);

    if (String(team.status || '').toLowerCase() !== 'approved') {
      return { ok: false, error: 'This team is not approved yet.' };
    }

    const isMember = (team.members || []).some(member => normalize(member.username) === normalize(session.username));
    if (isMember) return { ok: true, team, competition: comp, alreadyMember: true };

    const inAnotherTeam = (comp.teams || []).some(item => {
      if (item.id === team.id) return false;
      if (String(item.status || '').toLowerCase() === 'rejected') return false;
      return (item.members || []).some(member => normalize(member.username) === normalize(session.username));
    });

    if (inAnotherTeam) {
      return { ok: false, error: 'You are already in another team for this competition.' };
    }

    if (team.members.length >= maxPlayers(comp)) {
      return { ok: false, error: 'Team is already full (' + team.members.length + ' / ' + maxPlayers(comp) + ').' };
    }

    team.members.push({
      username: session.username,
      displayName: session.displayName || session.username,
      role: 'player',
      joinedAt: isoNow(),
      localOnly: true
    });
    team.players = team.members.length;

    saveCompetition(comp);

    pushNotification({
      toUsername: team.createdBy,
      type: 'team-join-link',
      status: 'approved',
      title: 'Player joined via invite link',
      body: (session.displayName || session.username) + ' joined ' + team.name + ' via a shared link.',
      createdAt: isoNow(),
      read: false,
      meta: { compId: comp.id, teamId: team.id }
    });

    setActiveTeamContext({ compId: comp.id, teamId: team.id });
    return { ok: true, team, competition: comp };
  }

  function removePlayer(options) {
    const opts = options || {};
    const session = getSession();
    if (!session) return { ok: false, error: 'Please log in first.' };

    const comp = getCompetitionById(opts.compId);
    if (!comp) return { ok: false, error: 'Competition not found.' };
    ensureCompetitionTeams(comp);

    if (hasCompetitionStarted(comp)) {
      return { ok: false, error: 'The competition has started: players can no longer be removed. Use the dispute/report workflow instead.' };
    }

    const team = findTeam(comp, opts.teamId);
    if (!team) return { ok: false, error: 'Team not found.' };
    if (!userCanManageTeam(team, session)) return { ok: false, error: 'Only team captain can remove players.' };

    const username = String(opts.username || '').trim();
    if (!username) return { ok: false, error: 'Player username missing.' };

    if (String(opts.reason || '').trim().length < 5) {
      return { ok: false, error: 'A meaningful removal reason (at least 5 characters) is required.' };
    }

    if (normalize(username) === normalize(team.createdBy)) {
      return { ok: false, error: 'Captain cannot be removed.' };
    }

    // §6.1 — participants who paid an individual entry fee cannot be removed directly.
    const memberRecord = (team.members || []).find(member => normalize(member.username) === normalize(username));
    if (memberRecord && Number(memberRecord.feePaid) > 0) {
      return { ok: false, error: 'This participant has paid the entry fee and cannot be removed directly. Use the dispute/report workflow instead.' };
    }

    const before = team.members.length;
    team.members = team.members.filter(member => normalize(member.username) !== normalize(username));
    if (team.members.length === before) {
      return { ok: false, error: 'Player not found in roster.' };
    }

    team.players = team.members.length;
    saveCompetition(comp);

    // The backend notifies the player when it is reachable; this covers offline removals.
    if (!opts.backendNotified) {
      const reason = String(opts.reason).trim();
      pushNotification({
        toUsername: username,
        type: 'team-roster-update',
        status: 'rejected',
        title: 'Removed from ' + team.name,
        body: 'You were removed from team "' + team.name + '". Reason: ' + reason,
        createdAt: isoNow(),
        read: false,
        meta: {
          compId: comp.id,
          teamId: team.id,
          reason
        }
      });
    }

    return { ok: true };
  }

  function getTeamRoster(compId, teamId) {
    const comp = getCompetitionById(compId);
    if (!comp) return [];
    ensureCompetitionTeams(comp);
    const team = findTeam(comp, teamId);
    if (!team) return [];
    return team.members.slice();
  }

  function getInvites(compId, teamId) {
    const comp = getCompetitionById(compId);
    if (!comp) return [];
    ensureCompetitionTeams(comp);
    const team = findTeam(comp, teamId);
    if (!team) return [];
    return team.invites.slice();
  }

  function getJoinRequests(compId, teamId) {
    const comp = getCompetitionById(compId);
    if (!comp) return [];
    ensureCompetitionTeams(comp);
    const team = findTeam(comp, teamId);
    if (!team) return [];
    return team.joinRequests.slice();
  }

  function refreshTeamManagementUI(compId, teamId) {
    if (!compId || !teamId) return;
    const comp = getCompetitionById(compId);
    if (!comp) return;
    ensureCompetitionTeams(comp);
    const team = findTeam(comp, teamId);
    if (!team) return;

    const pendingRequests = (team.joinRequests || []).filter(r => r.status === 'pending').length;
    const pendingInvites = (team.invites || []).filter(i => i.status === 'pending').length;
    const currentPlayers = (team.members || []).length;

 // Update tab badges
    const joinReqTab = document.querySelector('.team-tab[href*="join-requests.html"]');
    if (joinReqTab) {
      let badge = joinReqTab.querySelector('.notif-badge-sm');
      if (pendingRequests > 0) {
        if (!badge) {
          badge = document.createElement('span');
          badge.className = 'notif-badge-sm';
          joinReqTab.appendChild(badge);
        }
        badge.textContent = String(pendingRequests);
      } else if (badge) {
        badge.remove();
      }
    }

 // Update sidebar counts if present
    const pendingEl = document.getElementById('pending-count');
    if (pendingEl) pendingEl.textContent = String(pendingInvites);

    const sidebarRows = document.querySelectorAll('.comp-sidebar-block .info-row');
    sidebarRows.forEach(row => {
      const key = (row.querySelector('.key') || {}).textContent || '';
      const val = row.querySelector('.val');
      if (!val) return;
      const limit = maxPlayers(comp);
      if (key.indexOf('Current Players') >= 0) val.textContent = currentPlayers + ' / ' + limit;
      if (key.indexOf('Open Slots') >= 0) val.textContent = String(Math.max(0, limit - currentPlayers));
      if (key.indexOf('Join Requests') >= 0) val.textContent = String(pendingRequests);
      if (key.indexOf('Pending Invites') >= 0) val.textContent = String(pendingInvites);
    });

 // Update "Review Join Requests" button count if present
    const reviewBtn = document.querySelector('.btn-sidebar-full[href*="join-requests.html"]');
    if (reviewBtn) {
      reviewBtn.textContent = 'Review Join Requests (' + pendingRequests + ')';
    }
  }

  function appendContextToTeamTabs(context) {
    if (!context || !context.compId || !context.teamId) return;
    const tabs = document.querySelectorAll('.team-tabs-nav .team-tab');
    tabs.forEach(tab => {
      const href = tab.getAttribute('href');
      if (!href || href.indexOf('http') === 0) return;
      const basePath = href.split('?')[0];
      tab.setAttribute(
        'href',
        basePath + '?compId=' + encodeURIComponent(context.compId) + '&teamId=' + encodeURIComponent(context.teamId)
      );
    });
  }

  function appendContextToTeamLinks(context) {
    if (!context || !context.compId || !context.teamId) return;

    const teamPages = [
      'team-roster.html',
      'add-players.html',
      'join-requests.html',
      'invitations-sent.html',
      'team-settings.html',
      'invite-player.html'
    ];

    document.querySelectorAll('a[href]').forEach(link => {
      const href = link.getAttribute('href');
      if (!href || href.indexOf('http') === 0 || href.charAt(0) === '#') return;
      const basePath = href.split('?')[0];
      const isTeamPage = teamPages.some(name => basePath.endsWith(name));
      if (!isTeamPage) return;

      link.setAttribute(
        'href',
        basePath + '?compId=' + encodeURIComponent(context.compId) + '&teamId=' + encodeURIComponent(context.teamId)
      );
    });
  }

  window.NexusTeamWorkflow = {
    MAX_TEAM_PLAYERS,
    getSession,
    createTeam,
    setActiveTeamContext,
    getActiveTeamContext,
    resolveTeamContext,
    appendContextToTeamTabs,
    appendContextToTeamLinks,
    sendInvite,
    revokeInvite,
    submitJoinRequest,
    decideJoinRequest,
    payJoinRequest,
    pushNotification,
    decideCoOrganizerInvite,
    decideInvite,
    directJoinTeam,
    removePlayer,
    getTeamRoster,
    getInvites,
    getJoinRequests,
    syncTeamFromBackend,
    refreshTeamManagementUI,
    getNotificationsForUser,
    syncServerNotifications,
    getNotificationById,
    updateNotification,
    markAllNotificationsRead,
    findTeamAcrossCompetitions,
    findUserTeamInCompetition
  };
})(window);


