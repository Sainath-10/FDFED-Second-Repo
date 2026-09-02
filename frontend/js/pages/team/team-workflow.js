(function (window) {
  const SESSION_KEY = 'nexus.auth.session';
  const ACCOUNTS_KEY = 'nexus.auth.accounts';
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
    return loadNotifications()
      .filter(item => normalize(item.toUsername) === user)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
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

  function getAllAccounts() {
    const defaults = [
      { username: 'regular@nexus.gg', role: 'regular' },
      { username: 'admin@nexus.gg', role: 'admin' },
      { username: 'superadmin@nexus.gg', role: 'super-admin' }
    ];

    const stored = parseJson(localStorage.getItem(ACCOUNTS_KEY), []);
    const merged = [].concat(defaults, stored || []);
    const seen = new Set();

    return merged.filter(account => {
      const username = String(account && account.username || '').trim();
      if (!username) return false;
      const key = normalize(username);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  function isRegularAccount(account) {
    if (!account) return false;
    const role = normalize(account.role || 'regular');
    return role === 'regular' || role === 'participant';
  }

  function findAccountByUsername(username) {
    const userKey = normalize(username);
    if (!userKey) return null;
    return getAllAccounts().find(account => normalize(account.username) === userKey) || null;
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
    const team = comp.teams.find(item => item.id === teamId);
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
    return normalize(team.createdBy) === normalize(session.username);
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

    const team = {
      id: makeId('team'),
      name,
      tag,
      avatar: opts.avatar || 'SHIELD',
      status: 'pending',
      createdBy: session.username,
      leader: session.displayName || session.username,
      leaderUsername: session.username,
      competitionId: comp.id,
      created: isoNow(),
      members: [
        {
          username: session.username,
          displayName: session.displayName || session.username,
          role: 'captain',
          joinedAt: isoNow()
        }
      ],
      invites: [],
      joinRequests: [],
      players: 1
    };

    comp.teams.unshift(team);
    saveCompetition(comp);
    setActiveTeamContext({ compId: comp.id, teamId: team.id });

    // Notify organiser that a new team registration needs approval.
    const organiserUsername = String(comp.createdBy || comp.organizerId || '').trim();
    if (organiserUsername) {
      pushNotification({
        toUsername: organiserUsername,
        type: 'team-registration',
        status: 'pending',
        title: 'Team registration pending approval',
        body: 'A new team "' + team.name + '" requested to join ' + (comp.name || 'this competition') + '.',
        createdAt: isoNow(),
        read: false,
        meta: { compId: comp.id, teamId: team.id, teamStatus: 'pending' }
      });
    }

    pushNotification({
      toUsername: session.username,
      type: 'team-created',
      status: 'pending',
      title: 'Team created — pending organiser approval',
      body: 'Your team "' + team.name + '" is pending approval for ' + (comp.name || 'this competition') + '.',
      createdAt: isoNow(),
      read: false,
      meta: { compId: comp.id, teamId: team.id }
    });

    return { ok: true, team, competition: comp };
  }

  function sendInvite(options) {
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

    const targetAccount = findAccountByUsername(toUsername);
    if (!targetAccount) {
      return { ok: false, error: 'User not found. Enter a registered username.' };
    }

    if (!isRegularAccount(targetAccount)) {
      return { ok: false, error: 'Invitations can only be sent to regular users.' };
    }

    if (normalize(toUsername) === normalize(session.username)) {
      return { ok: false, error: 'You cannot invite yourself.' };
    }

    const alreadyMember = team.members.some(member => normalize(member.username) === normalize(toUsername));
    if (alreadyMember) {
      return { ok: false, error: toUsername + ' is already in this team.' };
    }

    const pendingInvite = team.invites.find(inv => normalize(inv.toUsername) === normalize(toUsername) && inv.status === 'pending');
    if (pendingInvite) {
      return { ok: false, error: 'Pending invite already exists for this user.' };
    }

    const invite = {
      id: makeId('invite'),
      toUsername,
      roleOffered: String(opts.roleOffered || 'Player').trim(),
      message: String(opts.message || '').trim(),
      sentBy: session.username,
      sentAt: isoNow(),
      status: 'pending'
    };

    team.invites.unshift(invite);
    saveCompetition(comp);

    pushNotification({
      toUsername,
      type: 'team-invite',
      status: 'pending',
      title: 'Team invitation from ' + team.name,
      body: (session.displayName || session.username) + ' invited you to join ' + team.name + '.',
      createdAt: invite.sentAt,
      read: false,
      meta: {
        compId: comp.id,
        teamId: team.id,
        inviteId: invite.id,
        roleOffered: invite.roleOffered
      }
    });

    return { ok: true, invite };
  }

  function revokeInvite(options) {
    const opts = options || {};
    const session = getSession();
    if (!session) return { ok: false, error: 'Please log in first.' };

    const comp = getCompetitionById(opts.compId);
    if (!comp) return { ok: false, error: 'Competition not found.' };
    ensureCompetitionTeams(comp);

    const team = findTeam(comp, opts.teamId);
    if (!team) return { ok: false, error: 'Team not found.' };
    if (!userCanManageTeam(team, session)) return { ok: false, error: 'Only team captain can revoke invites.' };

    const inviteIndex = team.invites.findIndex(inv => inv.id === opts.inviteId);
    if (inviteIndex < 0) return { ok: false, error: 'Invitation not found.' };

    team.invites.splice(inviteIndex, 1);
    saveCompetition(comp);

    return { ok: true };
  }

  function submitJoinRequest(options) {
    const opts = options || {};
    const session = getSession();
    if (!session) return { ok: false, error: 'Please log in first.' };

    const comp = getCompetitionById(opts.compId);
    if (!comp) return { ok: false, error: 'Competition not found.' };
    ensureCompetitionTeams(comp);

    const team = findTeam(comp, opts.teamId);
    if (!team) return { ok: false, error: 'Team not found.' };

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

    const existingPending = team.joinRequests.find(req => normalize(req.username) === normalize(session.username) && req.status === 'pending');
    if (existingPending) {
      return { ok: false, error: 'You already sent a join request to this team.' };
    }

    const request = {
      id: makeId('joinreq'),
      username: session.username,
      displayName: session.displayName || session.username,
      message: String(opts.message || '').trim(),
      requestedAt: isoNow(),
      status: 'pending'
    };

    team.joinRequests.unshift(request);
    saveCompetition(comp);

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

    return { ok: true, request };
  }

  function decideJoinRequest(options) {
    const opts = options || {};
    const action = opts.action === 'accepted' ? 'accepted' : 'declined';
    const session = getSession();
    if (!session) return { ok: false, error: 'Please log in first.' };

    const comp = getCompetitionById(opts.compId);
    if (!comp) return { ok: false, error: 'Competition not found.' };
    ensureCompetitionTeams(comp);

    const team = findTeam(comp, opts.teamId);
    if (!team) return { ok: false, error: 'Team not found.' };
    if (!userCanManageTeam(team, session)) return { ok: false, error: 'Only team captain can review requests.' };

    const request = team.joinRequests.find(item => item.id === opts.requestId);
    if (!request) return { ok: false, error: 'Request not found.' };
    if (request.status !== 'pending') return { ok: false, error: 'This request was already handled.' };

    if (action === 'accepted') {
      if (team.members.length >= MAX_TEAM_PLAYERS) {
        return { ok: false, error: 'Team is already full.' };
      }

      const exists = team.members.some(member => normalize(member.username) === normalize(request.username));
      if (!exists) {
        team.members.push({
          username: request.username,
          displayName: request.displayName || request.username,
          role: 'player',
          joinedAt: isoNow()
        });
      }
    }

    request.status = action;
    request.handledAt = isoNow();
    team.players = team.members.length;

    saveCompetition(comp);

    pushNotification({
      toUsername: request.username,
      type: 'team-join-request-result',
      status: action === 'accepted' ? 'approved' : 'rejected',
      title: 'Join request ' + (action === 'accepted' ? 'accepted' : 'declined'),
      body: 'Your request to join ' + team.name + ' was ' + action + '.',
      createdAt: isoNow(),
      read: false,
      meta: {
        compId: comp.id,
        teamId: team.id,
        requestId: request.id
      }
    });

    return { ok: true, action, request };
  }

  function decideInvite(options) {
    const opts = options || {};
    const action = opts.action === 'accepted' ? 'accepted' : 'declined';
    const session = getSession();
    if (!session) return { ok: false, error: 'Please log in first.' };

    const comp = getCompetitionById(opts.compId);
    if (!comp) return { ok: false, error: 'Competition not found.' };
    ensureCompetitionTeams(comp);

    const team = findTeam(comp, opts.teamId);
    if (!team) return { ok: false, error: 'Team not found.' };

    const invite = team.invites.find(item => item.id === opts.inviteId);
    if (!invite) return { ok: false, error: 'Invitation not found.' };

    if (normalize(invite.toUsername) !== normalize(session.username)) {
      return { ok: false, error: 'This invitation is not assigned to your account.' };
    }

    if (invite.status !== 'pending') {
      return { ok: false, error: 'This invitation was already handled.' };
    }

    if (action === 'accepted') {
      if (team.members.length >= MAX_TEAM_PLAYERS) {
        return { ok: false, error: 'Team is already full.' };
      }

      const inAnotherTeam = (comp.teams || []).some(item => {
        if (item.id === team.id) return false;
        if (String(item && item.status || '').toLowerCase() === 'rejected') return false;
        return (item.members || []).some(member => normalize(member.username) === normalize(session.username));
      });

      if (inAnotherTeam) {
        return { ok: false, error: 'You are already in another team for this competition.' };
      }

      const alreadyMember = team.members.some(member => normalize(member.username) === normalize(session.username));
      if (!alreadyMember) {
        team.members.push({
          username: session.username,
          displayName: session.displayName || session.username,
          role: 'player',
          joinedAt: isoNow()
        });
      }
    }

    invite.status = action;
    invite.handledAt = isoNow();
    team.players = team.members.length;
    saveCompetition(comp);

    pushNotification({
      toUsername: team.createdBy,
      type: 'team-invite-result',
      status: action === 'accepted' ? 'approved' : 'rejected',
      title: 'Invitation ' + (action === 'accepted' ? 'accepted' : 'declined'),
      body: (session.displayName || session.username) + ' ' + action + ' your invitation to join ' + team.name + '.',
      createdAt: isoNow(),
      read: false,
      meta: {
        compId: comp.id,
        teamId: team.id,
        inviteId: invite.id
      }
    });

    setActiveTeamContext({ compId: comp.id, teamId: team.id });
    return { ok: true, action, invite };
  }

  function directJoinTeam(options) {
    const opts = options || {};
    const session = getSession();
    if (!session) return { ok: false, error: 'Please log in first.' };

    let comp = opts.compId ? getCompetitionById(opts.compId) : null;
    let team = comp ? findTeam(comp, opts.teamId) : null;

    if (!team) {
      const resolved = findTeamAcrossCompetitions(opts.teamId);
      if (!resolved) return { ok: false, error: 'Team not found.' };
      comp = resolved.comp;
      team = resolved.team;
    }

    if (!comp) return { ok: false, error: 'Competition not found.' };
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

    if (team.members.length >= MAX_TEAM_PLAYERS) {
      return { ok: false, error: 'Team is already full.' };
    }

    team.members.push({
      username: session.username,
      displayName: session.displayName || session.username,
      role: 'player',
      joinedAt: isoNow()
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

    const team = findTeam(comp, opts.teamId);
    if (!team) return { ok: false, error: 'Team not found.' };
    if (!userCanManageTeam(team, session)) return { ok: false, error: 'Only team captain can remove players.' };

    const username = String(opts.username || '').trim();
    if (!username) return { ok: false, error: 'Player username missing.' };

    if (normalize(username) === normalize(team.createdBy)) {
      return { ok: false, error: 'Captain cannot be removed.' };
    }

    const before = team.members.length;
    team.members = team.members.filter(member => normalize(member.username) !== normalize(username));
    if (team.members.length === before) {
      return { ok: false, error: 'Player not found in roster.' };
    }

    team.players = team.members.length;
    saveCompetition(comp);

    pushNotification({
      toUsername: username,
      type: 'team-roster-update',
      status: 'rejected',
      title: 'Removed from ' + team.name,
      body: 'You were removed from the team roster.',
      createdAt: isoNow(),
      read: false,
      meta: {
        compId: comp.id,
        teamId: team.id
      }
    });

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

  function getAvailablePlayers(compId, teamId) {
    const comp = getCompetitionById(compId);
    if (!comp) return [];
    ensureCompetitionTeams(comp);
    const team = findTeam(comp, teamId);
    if (!team) return [];

    const taken = new Set(team.members.map(member => normalize(member.username)));
    const pendingInvites = new Set(team.invites.filter(inv => inv.status === 'pending').map(inv => normalize(inv.toUsername)));
    const inOtherTeams = new Set();
    const organizer = normalize(comp.createdBy || comp.organizerId || '');

    (comp.teams || []).forEach(otherTeam => {
      if (!otherTeam || otherTeam.id === team.id) return;
      if (String(otherTeam.status || '').toLowerCase() === 'rejected') return;
      (otherTeam.members || []).forEach(member => {
        inOtherTeams.add(normalize(member.username));
      });
    });

    // Build set of banned usernames for dynamic filtering
    const banned = new Set();
    try {
      const accounts = JSON.parse(localStorage.getItem('nexus.auth.accounts') || '[]');
      accounts.forEach(a => { if (a && a.banned) banned.add(normalize(a.username)); });
    } catch (e) {}

    return getAllAccounts()
      .filter(account => isRegularAccount(account) && !account.banned && !banned.has(normalize(account.username)))
      .map(account => account.username)
      .filter(username => {
        const key = normalize(username);
        return key !== organizer && !taken.has(key) && !pendingInvites.has(key) && !inOtherTeams.has(key);
      })
      .map(username => ({
        username,
        displayName: username
      }));
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
      if (key.indexOf('Current Players') >= 0) val.textContent = currentPlayers + ' / 5';
      if (key.indexOf('Open Slots') >= 0) val.textContent = String(Math.max(0, 5 - currentPlayers));
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
    decideInvite,
    directJoinTeam,
    removePlayer,
    getTeamRoster,
    getInvites,
    getJoinRequests,
    getAvailablePlayers,
    refreshTeamManagementUI,
    getNotificationsForUser,
    getNotificationById,
    updateNotification,
    markAllNotificationsRead,
    findTeamAcrossCompetitions,
    findUserTeamInCompetition
  };
})(window);
