/**
 * NEXUS ESPORTS — local report / dispute management engine.
 *
 * All report, evidence, discussion, decision and moderation data is persisted
 * in browser localStorage (see ./storage.js). The module mirrors the previous
 * backend API surface so the existing pages keep their contracts:
 *   { ok, status, data } | { ok: false, status, error }
 *
 * Business rules enforced here:
 * - a report is an allegation, never proof; submission never punishes anyone
 * - reports against organisers go to the Community Moderator
 * - organisers can never review a report against themselves
 * - a player is limited to 3 discarded (baseless) reports per competition
 * - discussions are participant-scoped and become read-only when ended
 * - reputation changes only follow recorded reviewer decisions
 */
import { LEVEL_META, REPORT_REASONS } from '../../lib/reporting.js';
import {
  KEYS, read, write, asArray, asObject, uid, now, norm, sameUser, withLock,
} from './storage.js';
import {
  profileOf, historyOf, sanctionsOf, warningsOf, getGlobalMax,
  addSanction, downgrade, mutateProfile, effectiveLimit,
  setGlobalCeiling, requestException, myExceptions, allExceptions, reviewException,
  recordRecoverySanction,
} from './reputation.js';

const COMPETITIONS_KEY = 'nexus_competitions';
const ACCOUNTS_KEY = 'nexus.auth.accounts';
const SESSION_KEY = 'nexus.auth.session';
const NOTIFICATIONS_KEY = 'nexus.notifications.items';

const MAX_EVIDENCE_FILES = 5;
const MAX_EVIDENCE_TOTAL_BYTES = 4 * 1024 * 1024;
const BASELESS_LIMIT = 3;
const REASON_BY_CODE = new Map(REPORT_REASONS.map((reason) => [reason.code, reason]));
const FINDING_VALUES = new Set(['substantiated', 'partially_substantiated', 'unsubstantiated']);
const PLAYER_ACTIONS = new Set(['formal_warning', 'final_warning', 'remove_from_competition', 'no_action']);
const MODERATOR_ACTIONS = new Set([
  'formal_warning', 'final_warning', 'reputation_downgrade',
  'creation_restriction', 'competition_suspension', 'no_action',
]);
const DISCARD_REASONS = new Set([
  'duplicate_report', 'incorrect_reported_person', 'outside_competition_scope',
  'insufficient_information', 'not_covered_by_rules', 'other',
]);

const ok = (data, status = 200) => ({ ok: true, status, data });
const fail = (error, status = 400) => ({ ok: false, status, error });

// ── Existing application data ───────────────────────────────────────────────

function loadCompetitions() {
  try {
    if (typeof window !== 'undefined' && window.NexusData?.loadCompetitions) {
      const rows = window.NexusData.loadCompetitions();
      if (Array.isArray(rows)) return rows;
    }
  } catch (err) { /* fall through to raw storage */ }
  return asArray(read(COMPETITIONS_KEY, []));
}

function getCompetition(id) {
  if (!id) return null;
  try {
    if (typeof window !== 'undefined' && window.NexusData?.getCompetitionById) {
      const comp = window.NexusData.getCompetitionById(id);
      if (comp) return comp;
    }
  } catch (err) { /* fall through */ }
  return loadCompetitions().find((comp) => comp && String(comp.id) === String(id)) || null;
}

function saveCompetition(comp) {
  if (!comp) return;
  try {
    if (typeof window !== 'undefined' && window.NexusData?.updateCompetition) {
      window.NexusData.updateCompetition(comp);
      return;
    }
  } catch (err) { /* fall through */ }
  const rows = asArray(read(COMPETITIONS_KEY, []));
  const index = rows.findIndex((row) => row && String(row.id) === String(comp.id));
  if (index >= 0) rows[index] = comp; else rows.push(comp);
  write(COMPETITIONS_KEY, rows);
}

function loadAccounts() {
  const map = new Map();
  if (typeof window !== 'undefined' && Array.isArray(window.NEXUS_DEMO_ACCOUNTS)) {
    window.NEXUS_DEMO_ACCOUNTS.forEach((account) => map.set(norm(account.username), account));
  }
  asArray(read(ACCOUNTS_KEY, [])).forEach((account) => {
    const key = norm(account.username);
    map.set(key, { ...(map.get(key) || {}), ...account });
  });
  return Array.from(map.values());
}

function accountOf(username) {
  return loadAccounts().find((account) => sameUser(account.username, username)) || null;
}

function session() {
  const stored = read(SESSION_KEY, null);
  if (stored && typeof stored === 'object') return stored;
  return null;
}

function roleKey(value) {
  return String(value || '').trim().toLowerCase().replace(/[\s-]+/g, '_');
}

function isModerator(user) {
  return !!user && roleKey(user.role) === 'community_moderator';
}

function isAdmin(user) {
  return !!user && ['admin', 'comp_admin', 'dispute_admin', 'revenue_admin', 'super_admin'].includes(roleKey(user.role));
}

function moderatorUsernames() {
  const names = loadAccounts()
    .filter((account) => roleKey(account.role) === 'community_moderator')
    .map((account) => account.username);
  return names.length ? names : ['communitymod'];
}

function organiserOf(comp) {
  if (!comp) return '';
  return comp.createdBy || comp.organizerId || comp.owner || asArray(comp.organizers)[0] || '';
}

function isOrganiserOf(comp, username) {
  if (!comp || !username) return false;
  const key = norm(username);
  return norm(organiserOf(comp)) === key
    || asArray(comp.organizers).some((value) => norm(value) === key);
}

function teamsOf(comp) {
  return asArray(comp?.teams);
}

function findMemberTeam(comp, username) {
  for (const team of teamsOf(comp)) {
    const member = asArray(team.members).find((row) => sameUser(row.username, username));
    if (member) return { team, member };
  }
  return null;
}

function isParticipant(comp, username) {
  return !!findMemberTeam(comp, username);
}

function isTeamLeader(team, username) {
  return !!team && (sameUser(team.createdBy, username) || sameUser(team.leaderUsername, username));
}

function wasRemovedFromCompetition(compId, username) {
  return asArray(read(KEYS.audit, [])).some((row) => (
    row.type === 'player_removed'
    && String(row.competitionId || '') === String(compId || '')
    && sameUser(row.username, username)
  ));
}

function reportedRoleInComp(comp, username) {
  if (isOrganiserOf(comp, username)) return 'organiser';
  const found = findMemberTeam(comp, username);
  if (found && isTeamLeader(found.team, username)) return 'team_leader';
  return 'player';
}

function compName(comp) {
  return comp?.name || 'Competition';
}

// ── Notifications / audit ───────────────────────────────────────────────────

function notify(toUsername, entry) {
  if (!toUsername) return;
  const payload = {
    id: uid('notif'),
    toUsername,
    type: entry.type || 'report',
    status: entry.status || 'pending',
    title: entry.title || 'Report update',
    body: entry.body || '',
    createdAt: now(),
    read: false,
    meta: entry.meta || {},
  };
  try {
    if (typeof window !== 'undefined' && window.NexusTeamWorkflow?.pushNotification) {
      window.NexusTeamWorkflow.pushNotification(payload);
      return;
    }
  } catch (err) { /* fall through */ }
  const items = asArray(read(NOTIFICATIONS_KEY, []));
  items.unshift(payload);
  write(NOTIFICATIONS_KEY, items);
}

function pushAudit(entry) {
  const row = {
    id: uid('audit'),
    at: now(),
    actor: entry.actor || 'system',
    type: entry.type || 'event',
    details: entry.details || '',
    reportId: entry.reportId || null,
    competitionId: entry.competitionId || null,
    username: entry.username || null,
    meta: entry.meta || {},
  };
  const rows = asArray(read(KEYS.audit, []));
  rows.unshift(row);
  write(KEYS.audit, rows);
  return row;
}

// ── Report records ──────────────────────────────────────────────────────────

function allReports() {
  return asArray(read(KEYS.reports, []));
}

function saveReports(rows) {
  return write(KEYS.reports, rows);
}

function codeFor(id) {
  return `RPT-${String(id).replace(/[^a-zA-Z0-9]/g, '').slice(-8).toUpperCase()}`;
}

function pushStatus(report, toStatus, actor, note) {
  report.statusHistory = asArray(report.statusHistory);
  report.statusHistory.push({
    id: uid('status'),
    fromStatus: report.status || null,
    toStatus,
    note: note || '',
    actor: actor || 'system',
    createdAt: now(),
  });
  report.status = toStatus;
  report.updatedAt = now();
}

function substantiatedCount(username) {
  return allReports().filter((row) => (
    sameUser(row.reportedUsername, username)
    && row.status === 'resolved'
    && ['substantiated', 'partially_substantiated'].includes(row.finding)
  )).length;
}

function discardedCount(competitionId, reporter) {
  return allReports().filter((row) => (
    row.status === 'discarded'
    && sameUser(row.reporterUsername, reporter)
    && String(row.competitionId || '') === String(competitionId || '')
  )).length;
}

function persistRestriction(competitionId, reporter, count) {
  const map = asObject(read(KEYS.restrictions, {}));
  const key = `${competitionId}|${norm(reporter)}`;
  // Only write on change: a read path that rewrites the same value would emit
  // an event, wake its own subscribers, and loop forever.
  if (map[key] === count) return;
  map[key] = count;
  write(KEYS.restrictions, map);
}

function decorate(report) {
  return {
    ...report,
    code: report.code || codeFor(report.id),
    reporterPriorSubstantiated: substantiatedCount(report.reporterUsername),
    accusedPriorSubstantiated: substantiatedCount(report.reportedUsername),
  };
}

function canReview(report, user) {
  if (!report || !user) return false;
  if (sameUser(report.reportedUsername, user.username)) return false;
  if (report.queue === 'moderator') return isModerator(user);
  const comp = getCompetition(report.competitionId);
  return isOrganiserOf(comp, user.username);
}

function canView(report, user) {
  if (!report || !user) return false;
  if (sameUser(report.reporterUsername, user.username)) return true;
  if (sameUser(report.reportedUsername, user.username)) return true;
  if (isModerator(user)) return true;
  return canReview(report, user);
}

function validateEvidence(evidence) {
  const rows = asArray(evidence);
  if (rows.length > MAX_EVIDENCE_FILES) return { ok: false, error: `Attach at most ${MAX_EVIDENCE_FILES} files.` };
  let total = 0;
  for (const row of rows) {
    const url = String(row?.url || '');
    if (!/^data:image\/(png|jpeg|webp);base64,/i.test(url)) {
      return { ok: false, error: 'Evidence must be PNG, JPEG or WEBP images.' };
    }
    const size = Number(row?.size) || Math.round(url.length * 0.75);
    total += size;
  }
  if (total > MAX_EVIDENCE_TOTAL_BYTES) {
    return { ok: false, error: 'Attached evidence is too large. Remove a file or try again.' };
  }
  return {
    ok: true,
    rows: rows.map((row) => ({
      id: row.id || uid('ev'),
      url: row.url,
      filename: String(row.filename || 'Evidence').slice(0, 200),
      mimetype: String(row.mimetype || 'image/jpeg'),
      size: Number(row.size) || Math.round(String(row.url).length * 0.75),
      uploadedAt: row.uploadedAt || now(),
    })),
  };
}

export async function prepareEvidenceFile(file) {
  if (!file) throw new Error('No file selected.');
  if (!/^image\/(png|jpeg|webp)$/.test(file.type)) {
    throw new Error('Only PNG, JPEG or WEBP images are accepted.');
  }
  if (file.size > 8 * 1024 * 1024) throw new Error('Images must be 8 MB or smaller before compression.');

  const dataUrl = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('Unable to read the selected file.'));
    reader.readAsDataURL(file);
  });

  const compressed = await compressImage(dataUrl);
  return {
    url: compressed,
    filename: file.name,
    mimetype: compressed.slice(5, compressed.indexOf(';')) || 'image/jpeg',
    size: Math.round(compressed.length * 0.75),
  };
}

function compressImage(dataUrl, maxDimension = 1400, quality = 0.72) {
  if (typeof document === 'undefined' || typeof Image === 'undefined') return Promise.resolve(dataUrl);
  return new Promise((resolve) => {
    const image = new Image();
    image.onload = () => {
      try {
        const scale = Math.min(1, maxDimension / Math.max(image.width, image.height));
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(image.width * scale));
        canvas.height = Math.max(1, Math.round(image.height * scale));
        const context = canvas.getContext('2d');
        context.drawImage(image, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/jpeg', quality));
      } catch (err) {
        resolve(dataUrl);
      }
    };
    image.onerror = () => resolve(dataUrl);
    image.src = dataUrl;
  });
}

// ── Report API ──────────────────────────────────────────────────────────────

export const LocalReportsAPI = {
  async create(payload = {}) {
    const user = session();
    if (!user) return fail('Please log in to submit a report.', 401);
    const competitionId = String(payload.competitionId || '');
    const reportedUsername = String(payload.reportedUsername || '').trim();
    const description = String(payload.description || '').trim();
    const reasonCode = String(payload.reasonCode || '').trim();

    if (!competitionId) return fail('A competition is required.');
    if (!reportedUsername) return fail('The reported person is required.');
    if (description.length < 15) return fail('Describe what happened (at least 15 characters).');
    if (!REASON_BY_CODE.has(reasonCode)) return fail('Select a valid report reason.');

    const comp = getCompetition(competitionId);
    if (!comp) return fail('That competition could not be found.');

    if (sameUser(reportedUsername, user.username)) return fail('You cannot report yourself.');

    const reportedRole = reportedRoleInComp(comp, reportedUsername);
    const queue = reportedRole === 'organiser' ? 'moderator' : 'organiser';

    // Eligibility. A removed participant may still report the organiser.
    if (queue === 'moderator') {
      const eligible = isParticipant(comp, user.username)
        || wasRemovedFromCompetition(competitionId, user.username)
        || isOrganiserOf(comp, user.username);
      if (!eligible) return fail('Only participants of this competition can report its organiser.', 403);
    } else {
      if (!isParticipant(comp, user.username)) {
        return fail('Only registered participants of this competition can report a player.', 403);
      }
      if (!findMemberTeam(comp, reportedUsername)) {
        return fail('That person is not a participant of this competition.');
      }
    }

    const evidence = validateEvidence(payload.evidence);
    if (!evidence.ok) return fail(evidence.error);

    return withLock(`report-create:${competitionId}:${norm(user.username)}`, () => {
      const count = discardedCount(competitionId, user.username);
      if (count >= BASELESS_LIMIT) {
        persistRestriction(competitionId, user.username, count);
        return fail(
          `You reached the limit of ${BASELESS_LIMIT} baseless reports in this competition, so reporting is locked here.`,
          429,
        );
      }

      const related = allReports().find((row) => (
        sameUser(row.reporterUsername, user.username)
        && sameUser(row.reportedUsername, reportedUsername)
        && String(row.competitionId || '') === competitionId
        && row.reasonCode === reasonCode
        && Date.now() - new Date(row.createdAt).getTime() < 24 * 60 * 60 * 1000
      ));

      const reason = REASON_BY_CODE.get(reasonCode);
      const id = uid('report');
      const team = findMemberTeam(comp, user.username)?.team || null;
      const reportedTeam = findMemberTeam(comp, reportedUsername)?.team || null;
      const report = {
        id,
        code: codeFor(id),
        competitionId,
        competitionName: compName(comp),
        organiserUsername: organiserOf(comp),
        reporterUsername: user.username,
        reportedUsername,
        reportedRole,
        queue,
        reasonCode,
        priority: reason.priority,
        priorityHistory: [{ id: uid('prio'), from: null, to: reason.priority, actor: user.username, note: 'Initial priority assigned automatically.', createdAt: now() }],
        description,
        incidentAt: payload.incidentAt || null,
        matchId: payload.matchId || null,
        sourcePage: payload.sourcePage || 'report-button',
        reporterTeamId: team?.id || null,
        reportedTeamId: reportedTeam?.id || null,
        sameTeam: !!(team && reportedTeam && team.id === reportedTeam.id),
        relatedReportId: related?.id || null,
        evidence: evidence.rows,
        status: 'new',
        statusHistory: [{
          id: uid('status'),
          fromStatus: null,
          toStatus: 'new',
          note: 'Report submitted.',
          actor: user.username,
          createdAt: now(),
        }],
        finding: null,
        action: null,
        conclusion: null,
        resolvedBy: null,
        resolvedAt: null,
        discardReason: null,
        discardNote: '',
        discardedBy: null,
        discardedAt: null,
        createdAt: now(),
        updatedAt: now(),
      };

      const rows = allReports();
      rows.unshift(report);
      const saved = saveReports(rows);
      if (!saved.ok) return fail(saved.error, 507);

      pushAudit({
        type: 'report_submitted',
        actor: user.username,
        reportId: id,
        competitionId,
        username: reportedUsername,
        details: `${reason.label} against @${reportedUsername}`,
      });

      if (queue === 'moderator') {
        moderatorUsernames().forEach((name) => notify(name, {
          type: 'report',
          title: 'New organiser report',
          body: `@${user.username} reported organiser @${reportedUsername} in "${compName(comp)}".`,
          meta: { reportId: id, competitionId, queue },
        }));
      } else {
        const recipients = new Set([organiserOf(comp), ...asArray(comp.organizers)].filter(Boolean));
        recipients.forEach((name) => notify(name, {
          type: 'report',
          title: reason.priority === 'high' ? 'High-priority report received' : 'New report received',
          body: `@${user.username} reported @${reportedUsername} in "${compName(comp)}".`,
          meta: { reportId: id, competitionId, queue },
        }));
      }

      return ok({ id, code: report.code, queue, status: 'new', priority: reason.priority, relatedReportId: report.relatedReportId });
    });
  },

  async mine() {
    const user = session();
    if (!user) return fail('Please log in.', 401);
    const rows = allReports()
      .filter((row) => sameUser(row.reporterUsername, user.username) || sameUser(row.reportedUsername, user.username))
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .map(decorate);
    return ok(rows);
  },

  async organiser(status) {
    const user = session();
    if (!user) return fail('Please log in.', 401);
    const rows = allReports()
      .filter((row) => {
        if (row.queue !== 'organiser') return false;
        if (sameUser(row.reportedUsername, user.username)) return false;
        const comp = getCompetition(row.competitionId);
        return isOrganiserOf(comp, user.username) || sameUser(row.organiserUsername, user.username);
      })
      .filter((row) => !status || row.status === status)
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .map(decorate);
    return ok(rows);
  },

  async moderation(status) {
    const user = session();
    if (!isModerator(user)) return fail('Community Moderator access is required.', 403);
    const rows = allReports()
      .filter((row) => row.queue === 'moderator')
      .filter((row) => !status || row.status === status)
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .map(decorate);
    return ok(rows);
  },

  async moderationCounts() {
    const user = session();
    if (!isModerator(user)) return fail('Community Moderator access is required.', 403);
    const rows = allReports().filter((row) => row.queue === 'moderator');
    const counts = { new: 0, under_review: 0, awaiting_response: 0, resolved: 0, discarded: 0 };
    rows.forEach((row) => { counts[row.status] = (counts[row.status] || 0) + 1; });
    return ok(counts);
  },

  /**
   * Resolved/discarded moderator-queue reports handled by one Community
   * Moderator. A moderator may only read their own activity; a Super Admin may
   * open any Community Moderator's activity from the Administration Directory.
   */
  async moderatorActivity(username) {
    const user = session();
    if (!user) return fail('Please log in.', 401);

    const target = String(username || user.username || '').trim();
    const targetAccount = accountOf(target);
    const targetIsModerator = roleKey(targetAccount?.role) === 'community_moderator'
      || roleKey(targetAccount?.adminType) === 'community_moderator';
    const viewerIsSuper = roleKey(user.role) === 'super_admin';
    const viewerIsModerator = isModerator(user);

    if (!viewerIsSuper && !(viewerIsModerator && sameUser(target, user.username))) {
      return fail('You cannot access another moderator’s activity.', 403);
    }
    if (!targetIsModerator) return fail('That account is not a Community Moderator.', 404);

    const rows = allReports()
      .filter((row) => (
        row.queue === 'moderator'
        && ['resolved', 'discarded'].includes(row.status)
        && (sameUser(row.resolvedBy, target) || sameUser(row.discardedBy, target))
      ))
      .sort((a, b) => new Date(b.resolvedAt || b.discardedAt || b.updatedAt) - new Date(a.resolvedAt || a.discardedAt || a.updatedAt))
      .map(decorate);
    return ok(rows);
  },

  async restrictions(competitionId) {
    const user = session();
    if (!user) return ok({ restricted: false, discardedCount: 0, limit: BASELESS_LIMIT });
    const count = discardedCount(competitionId, user.username);
    persistRestriction(competitionId, user.username, count);
    return ok({ restricted: count >= BASELESS_LIMIT, discardedCount: count, limit: BASELESS_LIMIT });
  },

  async get(id) {
    const user = session();
    if (!user) return fail('Please log in.', 401);
    const report = allReports().find((row) => String(row.id) === String(id));
    if (!report) return fail('Report not found.', 404);
    if (!canView(report, user)) return fail('You cannot access this report.', 403);
    return ok(decorate(report));
  },

  async priority(id, priority, note) {
    const user = session();
    if (!['high', 'medium', 'low'].includes(priority)) return fail('Invalid priority.');
    const rows = allReports();
    const index = rows.findIndex((row) => String(row.id) === String(id));
    if (index < 0) return fail('Report not found.', 404);
    const report = rows[index];
    if (!canReview(report, user)) return fail('Only the assigned reviewer can change priority.', 403);

    report.priorityHistory = asArray(report.priorityHistory);
    report.priorityHistory.unshift({
      id: uid('prio'), from: report.priority, to: priority, actor: user.username, note: note || '', createdAt: now(),
    });
    report.priority = priority;
    report.updatedAt = now();
    rows[index] = report;
    const saved = saveReports(rows);
    if (!saved.ok) return fail(saved.error, 507);
    pushAudit({ type: 'priority_changed', actor: user.username, reportId: id, details: `Priority → ${priority}` });
    return ok(decorate(report));
  },

  async discard(id, reason, note) {
    const user = session();
    if (!DISCARD_REASONS.has(reason)) return fail('Select a valid discard reason.');
    if (reason === 'other' && String(note || '').trim().length < 10) {
      return fail('Explain the reason for discarding this report (at least 10 characters).');
    }
    return withLock(`report-discard:${id}`, () => {
      const rows = allReports();
      const index = rows.findIndex((row) => String(row.id) === String(id));
      if (index < 0) return fail('Report not found.', 404);
      const report = rows[index];
      if (!canReview(report, user)) return fail('Only the assigned reviewer can discard this report.', 403);
      if (['resolved', 'discarded'].includes(report.status)) return fail('This report is already closed.', 409);

      report.discardReason = reason;
      report.discardNote = String(note || '').trim();
      report.discardedBy = user.username;
      report.discardedAt = now();
      pushStatus(report, 'discarded', user.username, `Discarded: ${reason}`);
      rows[index] = report;
      const saved = saveReports(rows);
      if (!saved.ok) return fail(saved.error, 507);

      const count = discardedCount(report.competitionId, report.reporterUsername);
      persistRestriction(report.competitionId, report.reporterUsername, count);

      notify(report.reporterUsername, {
        type: 'report',
        title: 'Report discarded',
        body: `Your report ${report.code} was discarded (${reason.replace(/_/g, ' ')}).`,
        meta: { reportId: report.id, competitionId: report.competitionId },
      });
      pushAudit({
        type: 'report_discarded', actor: user.username, reportId: report.id,
        competitionId: report.competitionId, username: report.reporterUsername,
        details: `Reason: ${reason}${note ? ` — ${note}` : ''}`,
      });
      return ok(decorate(report));
    });
  },

  async startDiscussion(id) {
    const user = session();
    const reports = allReports();
    const report = reports.find((row) => String(row.id) === String(id));
    if (!report) return fail('Report not found.', 404);
    if (!canReview(report, user)) return fail('Only the assigned reviewer can open a discussion.', 403);

    const rooms = asArray(read(KEYS.discussions, []));
    const existing = rooms.find((room) => String(room.reportId) === String(id) && room.status === 'open');
    if (existing) return ok({ discussion: existing });

    const reviewerRole = report.queue === 'moderator' ? 'community_moderator' : 'organiser';
    const discussion = {
      id: uid('disc'),
      reportId: report.id,
      code: report.code,
      status: 'open',
      reviewerUsername: user.username,
      reviewerRole,
      participants: [
        { id: uid('part'), username: user.username, role: 'reviewer' },
        { id: uid('part'), username: report.reporterUsername, role: 'reporter' },
        { id: uid('part'), username: report.reportedUsername, role: 'accused' },
      ].filter((row, index, list) => list.findIndex((x) => sameUser(x.username, row.username)) === index),
      createdAt: now(),
      endedAt: null,
      endedBy: null,
    };
    rooms.unshift(discussion);
    write(KEYS.discussions, rooms);

    const index = reports.findIndex((row) => row.id === report.id);
    if (index >= 0 && ['new', 'awaiting_response'].includes(report.status)) {
      pushStatus(reports[index], 'under_review', user.username, 'Case discussion opened.');
      saveReports(reports);
    }

    discussion.participants
      .filter((person) => !sameUser(person.username, user.username))
      .forEach((person) => notify(person.username, {
        type: 'discussion',
        title: 'Case discussion opened',
        body: `A case discussion for ${report.code} is open. You can respond from Reports.`,
        meta: { reportId: report.id, discussionId: discussion.id },
      }));
    pushAudit({ type: 'discussion_opened', actor: user.username, reportId: report.id, details: report.code });
    return ok({ discussion });
  },

  async requestResponse(id) {
    const user = session();
    const reports = allReports();
    const index = reports.findIndex((row) => String(row.id) === String(id));
    if (index < 0) return fail('Report not found.', 404);
    const report = reports[index];
    if (!canReview(report, user)) return fail('Only the assigned reviewer can request a response.', 403);
    pushStatus(report, 'awaiting_response', user.username, 'Additional response requested.');
    reports[index] = report;
    saveReports(reports);
    [report.reporterUsername, report.reportedUsername].forEach((name) => notify(name, {
      type: 'report',
      title: 'Response requested',
      body: `A reviewer requested more information about ${report.code}.`,
      meta: { reportId: report.id, discussionId: null },
    }));
    pushAudit({ type: 'response_requested', actor: user.username, reportId: id });
    return ok(decorate(report));
  },

  async actPlayer(id, payload = {}) {
    const user = session();
    const { finding, action, conclusion } = payload;
    if (!FINDING_VALUES.has(finding)) return fail('Select a valid finding.');
    if (!PLAYER_ACTIONS.has(action)) return fail('Select a valid action.');
    if (String(conclusion || '').trim().length < 15) {
      return fail('Write a conclusion explaining what happened and why this decision was reached.');
    }
    if (finding === 'unsubstantiated' && action !== 'no_action') {
      return fail('An unsubstantiated finding cannot justify a punitive action.');
    }

    return withLock(`report-act:${id}`, () => {
      const reports = allReports();
      const index = reports.findIndex((row) => String(row.id) === String(id));
      if (index < 0) return fail('Report not found.', 404);
      const report = reports[index];
      if (report.queue !== 'organiser') return fail('This report is not in an organiser queue.', 409);
      if (!canReview(report, user)) return fail('Only the assigned organiser can act on this report.', 403);
      if (['resolved', 'discarded'].includes(report.status)) return fail('This report is already closed.', 409);

      const removal = action === 'remove_from_competition'
        ? removePlayerFromCompetition(report.competitionId, report.reportedUsername, conclusion, user.username, report.id)
        : null;
      if (action === 'remove_from_competition' && !removal) {
        return fail('That player is no longer in a team for this competition.');
      }

      if (action === 'formal_warning' || action === 'final_warning') {
        recordPlayerWarning(report.reportedUsername, action, report.id, user.username, conclusion);
      }

      report.finding = finding;
      report.action = action;
      report.conclusion = String(conclusion).trim();
      report.resolvedBy = user.username;
      report.resolvedAt = now();
      pushStatus(report, 'resolved', user.username, `Finding: ${finding} · Action: ${action}`);
      reports[index] = report;
      const saved = saveReports(reports);
      if (!saved.ok) return fail(saved.error, 507);

      notify(report.reportedUsername, {
        type: 'report',
        title: action === 'no_action' ? 'Report closed' : 'Decision recorded',
        body: `A decision was recorded for ${report.code}: ${finding.replace(/_/g, ' ')} · ${action.replace(/_/g, ' ')}.`,
        meta: { reportId: report.id, competitionId: report.competitionId },
      });
      pushAudit({
        type: 'player_decision', actor: user.username, reportId: report.id,
        competitionId: report.competitionId, username: report.reportedUsername,
        details: `${finding} · ${action}${removal ? ` · leadership → @${removal.promoted || 'none'}` : ''}`,
      });
      closeDiscussions(report.id, user.username);
      return ok(decorate(report));
    });
  },

  async actOrganiser(id, payload = {}) {
    const user = session();
    if (!isModerator(user)) return fail('Community Moderator access is required.', 403);
    const { finding, action, conclusion, level, days } = payload;
    if (!FINDING_VALUES.has(finding)) return fail('Select a valid finding.');
    if (!MODERATOR_ACTIONS.has(action)) return fail('Select a valid action.');
    if (String(conclusion || '').trim().length < 15) {
      return fail('A recorded conclusion explaining the decision is required.');
    }
    if (finding === 'unsubstantiated' && !['no_action', 'formal_warning'].includes(action)) {
      return fail('An unsubstantiated finding cannot justify a punitive action.');
    }

    return withLock(`report-act-mod:${id}`, () => {
      const reports = allReports();
      const index = reports.findIndex((row) => String(row.id) === String(id));
      if (index < 0) return fail('Report not found.', 404);
      const report = reports[index];
      if (report.queue !== 'moderator') return fail('This report is not in the moderator queue.', 409);
      if (['resolved', 'discarded'].includes(report.status)) return fail('This report is already closed.', 409);

      const organiser = report.reportedUsername;
      const reason = String(conclusion).trim();
      let sanction = null;

      if (action === 'formal_warning' || action === 'final_warning') {
        sanction = addSanction(organiser, { type: action, reason, reportId: report.id }, user.username);
      } else if (action === 'reputation_downgrade') {
        const result = downgrade(organiser, level, reason, report.id, user.username);
        if (!result.ok) return fail(result.error);
      } else if (action === 'creation_restriction' || action === 'competition_suspension') {
        sanction = addSanction(organiser, { type: action, days: Number(days) || 30, reason, reportId: report.id }, user.username);
      }

      if (['substantiated', 'partially_substantiated'].includes(finding)) {
        // Record the substantiated violation. Reputation never changes here:
        // a downgrade is a separate, explicit moderator action with its own
        // recorded reason and policy reference.
        mutateProfile(organiser, (profile) => {
          profile.counters.substantiatedReports = (Number(profile.counters.substantiatedReports) || 0) + 1;
          profile.counters.mediumViolationCount = (Number(profile.counters.mediumViolationCount) || 0) + 1;
          return null;
        });

        // Red-level recovery sanction: a substantiated medium/high violation
        // during recovery triggers a one-month organising ban; a repeat after
        // that ban escalates to a lifetime ban.
        const current = profileOf(organiser);
        if (current?.level === 'red' && ['medium', 'high'].includes(report.priority)) {
          recordRecoverySanction(organiser, {
            reason: `Recovery violation while Red: ${reason}`,
            reportId: report.id,
          }, user.username);
        }
      }

      report.finding = finding;
      report.action = action;
      report.conclusion = reason;
      report.resolvedBy = user.username;
      report.resolvedAt = now();
      pushStatus(report, 'resolved', user.username, `Finding: ${finding} · Action: ${action}`);
      reports[index] = report;
      const saved = saveReports(reports);
      if (!saved.ok) return fail(saved.error, 507);

      notify(organiser, {
        type: 'report',
        title: 'Moderator decision recorded',
        body: `A decision was recorded for ${report.code}: ${finding.replace(/_/g, ' ')} · ${action.replace(/_/g, ' ')}.`,
        meta: { reportId: report.id, competitionId: report.competitionId },
      });
      pushAudit({
        type: 'organiser_decision', actor: user.username, reportId: report.id,
        competitionId: report.competitionId, username: organiser,
        details: `${finding} · ${action}${sanction?.ok ? ` · ${sanction.sanction.type}` : ''}`,
      });
      closeDiscussions(report.id, user.username);
      return ok(decorate(report));
    });
  },

  async investigation(id) {
    const user = session();
    if (!isModerator(user)) return fail('Community Moderator access is required.', 403);
    const report = allReports().find((row) => String(row.id) === String(id));
    if (!report) return fail('Report not found.', 404);

    const comp = getCompetition(report.competitionId);
    const organiser = report.reportedUsername;
    const profile = profileOf(organiser);
    const related = allReports().filter((row) => (
      row.id !== report.id
      && String(row.competitionId || '') === String(report.competitionId || '')
      && (sameUser(row.reportedUsername, organiser) || row.reasonCode === report.reasonCode)
    ));

    return ok({
      report: decorate(report),
      organiser: {
        username: organiser,
        profile,
        substantiatedReports: substantiatedCount(organiser),
        warnings: warningsOf(organiser).total,
        activeRestrictions: sanctionsOf(organiser, { activeOnly: true }),
        reputationHistory: historyOf(organiser),
        allSanctions: sanctionsOf(organiser),
      },
      competition: comp ? {
        ...comp,
        registrationOpenAt: comp.registrationOpenAt || comp.registrationDates?.open || comp.regOpen || null,
        registrationCloseAt: comp.registrationCloseAt || comp.registrationDates?.close || comp.regClose || null,
      } : null,
      teams: teamsOf(comp).map((team) => ({
        id: team.id,
        name: team.name,
        leaderUsername: team.createdBy || team.leaderUsername || '',
        status: team.status || 'active',
      })),
      matches: asArray(comp?.matches),
      chat: [],
      financial: [],
      relatedReports: related.map(decorate),
      timeline: buildTimeline(report, comp),
      evidence: asArray(report.evidence),
    });
  },

  async myDiscussions() {
    const user = session();
    if (!user) return fail('Please log in.', 401);
    const reports = allReports();
    const rows = asArray(read(KEYS.discussions, []))
      .filter((room) => asArray(room.participants).some((person) => sameUser(person.username, user.username))
        || sameUser(room.reviewerUsername, user.username))
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .map((room) => {
        const person = asArray(room.participants).find((row) => sameUser(row.username, user.username));
        const report = reports.find((row) => String(row.id) === String(room.reportId));
        return {
          discussionId: room.id,
          code: room.code,
          status: room.status,
          as: person?.role || (sameUser(room.reviewerUsername, user.username) ? 'reviewer' : 'participant'),
          reasonCode: report?.reasonCode || '',
          createdAt: room.createdAt,
        };
      });
    return ok(rows);
  },

  async discussion(discussionId) {
    const user = session();
    if (!user) return fail('Please log in.', 401);
    const room = asArray(read(KEYS.discussions, [])).find((row) => String(row.id) === String(discussionId));
    if (!room) return fail('Discussion not found.', 404);
    const isParticipant = asArray(room.participants).some((person) => sameUser(person.username, user.username));
    const isReviewer = sameUser(room.reviewerUsername, user.username);
    if (!isParticipant && !isReviewer && !isModerator(user)) {
      return fail('You are not authorised to view this discussion.', 403);
    }
    const report = allReports().find((row) => String(row.id) === String(room.reportId));
    if (!report) return fail('The report for this discussion is missing.', 404);

    return ok({
      discussion: room,
      report: decorate(report),
      participants: asArray(room.participants),
      messages: asArray(read(KEYS.messages, []))
        .filter((message) => String(message.discussionId) === String(discussionId))
        .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt)),
      evidence: asArray(report.evidence),
      canModerate: isReviewer || isModerator(user),
      readOnly: room.status === 'ended',
    });
  },

  async postMessage(discussionId, body, evidence) {
    const user = session();
    if (!user) return fail('Please log in.', 401);
    const rooms = asArray(read(KEYS.discussions, []));
    const index = rooms.findIndex((row) => String(row.id) === String(discussionId));
    if (index < 0) return fail('Discussion not found.', 404);
    const room = rooms[index];
    if (room.status === 'ended') return fail('This discussion has ended and is read-only.', 409);
    const isParticipant = asArray(room.participants).some((person) => sameUser(person.username, user.username));
    const isReviewer = sameUser(room.reviewerUsername, user.username);
    if (!isParticipant && !isReviewer) return fail('Only participants can post in this discussion.', 403);
    const text = String(body || '').trim();
    if (!text) return fail('Write a message first.');
    const cleaned = validateEvidence(evidence);
    if (!cleaned.ok) return fail(cleaned.error);

    const message = {
      id: uid('msg'),
      discussionId,
      authorUsername: user.username,
      body: text.slice(0, 2000),
      evidenceUrls: cleaned.rows.map((row) => row.url),
      evidence: cleaned.rows,
      createdAt: now(),
    };
    const messages = asArray(read(KEYS.messages, []));
    messages.push(message);
    const saved = write(KEYS.messages, messages);
    if (!saved.ok) return fail(saved.error, 507);

    asArray(room.participants)
      .filter((person) => !sameUser(person.username, user.username))
      .forEach((person) => notify(person.username, {
        type: 'discussion',
        title: 'New case message',
        body: `@${user.username} posted in case ${room.code}.`,
        meta: { discussionId, reportId: room.reportId },
      }));
    pushAudit({ type: 'discussion_message', actor: user.username, reportId: room.reportId, details: 'Message posted.' });
    return ok(message);
  },

  async endDiscussion(discussionId) {
    const user = session();
    const rooms = asArray(read(KEYS.discussions, []));
    const index = rooms.findIndex((row) => String(row.id) === String(discussionId));
    if (index < 0) return fail('Discussion not found.', 404);
    const room = rooms[index];
    if (!sameUser(room.reviewerUsername, user?.username) && !isModerator(user)) {
      return fail('Only the reviewer can end this discussion.', 403);
    }
    if (room.status === 'ended') return ok(room);
    room.status = 'ended';
    room.endedAt = now();
    room.endedBy = user.username;
    rooms[index] = room;
    write(KEYS.discussions, rooms);

    asArray(room.participants).forEach((person) => notify(person.username, {
      type: 'discussion',
      title: 'Case discussion ended',
      body: `The discussion for ${room.code} is now read-only.`,
      meta: { discussionId, reportId: room.reportId },
    }));
    pushAudit({ type: 'discussion_ended', actor: user.username, reportId: room.reportId, details: room.code });
    return ok(room);
  },

  async addParticipant(discussionId, username, role) {
    const user = session();
    const key = String(username || '').trim();
    if (!key) return fail('Enter a username.');
    const rooms = asArray(read(KEYS.discussions, []));
    const index = rooms.findIndex((row) => String(row.id) === String(discussionId));
    if (index < 0) return fail('Discussion not found.', 404);
    const room = rooms[index];
    if (!sameUser(room.reviewerUsername, user?.username) && !isModerator(user)) {
      return fail('Only the reviewer can add participants.', 403);
    }
    if (room.status === 'ended') return fail('This discussion has ended.', 409);
    if (!accountOf(key) && !isParticipant(getCompetitionByReport(room.reportId), key)) {
      return fail('That account does not exist.');
    }
    if (asArray(room.participants).some((person) => sameUser(person.username, key))) {
      return fail('That person is already a participant.');
    }
    room.participants = asArray(room.participants);
    room.participants.push({ id: uid('part'), username: key, role: role || 'witness' });
    rooms[index] = room;
    write(KEYS.discussions, rooms);
    notify(key, {
      type: 'discussion',
      title: 'Added to a case discussion',
      body: `You were added to case ${room.code}.`,
      meta: { discussionId, reportId: room.reportId },
    });
    return ok(room);
  },

  async removeParticipant(discussionId, username) {
    const user = session();
    const rooms = asArray(read(KEYS.discussions, []));
    const index = rooms.findIndex((row) => String(row.id) === String(discussionId));
    if (index < 0) return fail('Discussion not found.', 404);
    const room = rooms[index];
    if (!sameUser(room.reviewerUsername, user?.username) && !isModerator(user)) {
      return fail('Only the reviewer can remove participants.', 403);
    }
    room.participants = asArray(room.participants).filter((person) => !sameUser(person.username, username));
    rooms[index] = room;
    write(KEYS.discussions, rooms);
    return ok(room);
  },

  async escalate() {
    return sweepDeadlines();
  },
};

function getCompetitionByReport(reportId) {
  const report = allReports().find((row) => String(row.id) === String(reportId));
  return report ? getCompetition(report.competitionId) : null;
}

function recordPlayerWarning(username, action, reportId, reviewer, reason) {
  const warnings = asObject(read(KEYS.warnings, {}));
  const key = norm(username);
  const row = asObject(warnings[key]);
  if (action === 'final_warning') row.final = (Number(row.final) || 0) + 1;
  else row.formal = (Number(row.formal) || 0) + 1;
  row.updatedAt = now();
  warnings[key] = row;
  write(KEYS.warnings, warnings);
  pushAudit({ type: 'player_warning', actor: reviewer, reportId, username, details: `${action}: ${reason}` });
}

function removePlayerFromCompetition(competitionId, username, reason, actor, reportId) {
  const comp = getCompetition(competitionId);
  if (!comp) return null;
  const teams = teamsOf(comp);
  for (const team of teams) {
    const members = asArray(team.members);
    const idx = members.findIndex((member) => sameUser(member.username, username));
    if (idx < 0) continue;

    const removed = members.splice(idx, 1)[0];
    const wasLeader = isTeamLeader(team, username)
      || ['captain', 'leader'].includes(String(removed?.role || '').toLowerCase());
    team.members = members;
    team.players = members.length;

    let promoted = null;
    if (wasLeader) {
      const next = members.find((member) => (
        member
        && member.active !== false
        && !member.banned
        && !['inactive', 'removed', 'rejected'].includes(String(member.status || '').toLowerCase())
      ));
      if (next) {
        next.role = 'captain';
        team.createdBy = next.username;
        team.leaderUsername = next.username;
        promoted = next.username;
      }
    }
    saveCompetition(comp);

    pushAudit({
      type: 'player_removed',
      actor,
      reportId,
      competitionId,
      username,
      details: `Removed from ${team.name}.${promoted ? ` Leadership transferred to @${promoted}.` : ' No eligible member to promote.'}`,
    });

    const recipients = new Set([...members.map((member) => member.username), promoted].filter(Boolean));
    recipients.forEach((name) => notify(name, {
      type: 'team-roster-update',
      title: 'Team roster updated',
      body: `@${username} was removed from ${team.name}.${promoted ? ` @${promoted} is now team leader.` : ''}`,
      meta: { competitionId, teamId: team.id, reason },
    }));
    return { teamId: team.id, teamName: team.name, promoted, removed };
  }
  return null;
}

function closeDiscussions(reportId, actor) {
  const rooms = asArray(read(KEYS.discussions, []));
  let changed = false;
  rooms.forEach((room) => {
    if (String(room.reportId) === String(reportId) && room.status === 'open') {
      room.status = 'ended';
      room.endedAt = now();
      room.endedBy = actor;
      changed = true;
    }
  });
  if (changed) write(KEYS.discussions, rooms);
}

function buildTimeline(report, comp) {
  const events = [];
  const push = (type, at, actor, details) => {
    if (!at) return;
    events.push({ type, at, actor: actor || 'system', details: details || '' });
  };

  if (comp?.createdAt) push('competition_created', comp.createdAt, organiserOf(comp), compName(comp));
  teamsOf(comp).forEach((team) => {
    asArray(team.members).forEach((member) => push('team_registered', member.joinedAt, member.username, team.name));
  });
  asArray(comp?.matches).forEach((match) => {
    push('match_scheduled', match.scheduledAt || match.createdAt, 'organiser', `${match.team1Name || '—'} vs ${match.team2Name || '—'}`);
  });
  asArray(report.statusHistory).forEach((entry) => {
    push(entry.toStatus, entry.createdAt, entry.actor, entry.note);
  });
  asArray(read(KEYS.audit, []))
    .filter((row) => String(row.reportId || '') === String(report.id)
      || (comp && String(row.competitionId || '') === String(comp.id)))
    .forEach((row) => push(row.type, row.at, row.actor, row.details));

  return events.sort((a, b) => new Date(a.at) - new Date(b.at));
}

/**
 * Deadline sweep. Runs on app load and when the escalation endpoint is hit.
 * It creates one notification per report/stage so repeated loads cannot spam.
 */
export function sweepDeadlines() {
  const reports = allReports();
  const seen = asObject(read(KEYS.deadlines, {}));
  let created = 0;
  const nowMs = Date.now();

  reports.forEach((report) => {
    if (!['new', 'awaiting_response', 'under_review'].includes(report.status)) return;
    const age = nowMs - new Date(report.createdAt).getTime();
    const high = report.priority === 'high';

    if (report.status === 'new' && age > 24 * 60 * 60 * 1000) {
      const key = `${report.id}:new-reminder`;
      if (!seen[key]) {
        const recipients = report.queue === 'moderator'
          ? moderatorUsernames()
          : [organiserOf(getCompetition(report.competitionId))].filter(Boolean);
        recipients.forEach((name) => notify(name, {
          type: 'report',
          title: 'Overdue report',
          body: `${report.code} has waited more than 24 hours for a first review.`,
          meta: { reportId: report.id, competitionId: report.competitionId },
        }));
        seen[key] = now();
        created += 1;
      }
    }

    if (high && age > 2 * 60 * 60 * 1000 && report.status === 'new') {
      const key = `${report.id}:high-escalation`;
      if (!seen[key]) {
        const recipients = report.queue === 'moderator'
          ? moderatorUsernames()
          : [organiserOf(getCompetition(report.competitionId))].filter(Boolean);
        recipients.forEach((name) => notify(name, {
          type: 'report',
          title: 'High-priority report needs review',
          body: `${report.code} is high priority and still unreviewed.`,
          meta: { reportId: report.id, competitionId: report.competitionId },
        }));
        seen[key] = now();
        created += 1;
      }
    }

    if (report.status === 'awaiting_response' && report.updatedAt) {
      const waiting = nowMs - new Date(report.updatedAt).getTime();
      if (waiting > 48 * 60 * 60 * 1000) {
        const key = `${report.id}:response-reminder`;
        if (!seen[key]) {
          [report.reporterUsername, report.reportedUsername].forEach((name) => notify(name, {
            type: 'report',
            title: 'Response overdue',
            body: `A response is still pending for ${report.code}.`,
            meta: { reportId: report.id },
          }));
          seen[key] = now();
          created += 1;
        }
      }
    }
  });

  if (created > 0) write(KEYS.deadlines, seen);
  return ok({ created });
}

// ── Reputation API (local) ──────────────────────────────────────────────────

export const LocalReputationAPI = {
  async config() {
    return ok({ maxPrizePool: getGlobalMax(), currency: 'INR' });
  },

  async setCeiling(maxPrizePool) {
    const user = session();
    if (!isAdmin(user)) return fail('An administrative role is required.', 403);
    const result = setGlobalCeiling(maxPrizePool, user.username);
    if (!result.ok) return fail(result.error);
    return ok(result.config);
  },

  async me() {
    const user = session();
    if (!user) return fail('Please log in.', 401);
    if (!['team_lead', 'teamlead', 'organizer', 'organiser'].includes(roleKey(user.role))) {
      // Profiles exist for everyone; the limit still applies to whoever creates.
    }
    return ok(profileOf(user.username));
  },

  async profile(username) {
    const key = String(username || '').trim();
    if (!key) return fail('A username is required.');
    return ok(profileOf(key));
  },

  async history(username) {
    return ok(historyOf(username));
  },

  async evaluate(username, facts) {
    const user = session();
    if (!isModerator(user)) return fail('Community Moderator access is required.', 403);
    const result = evaluate(username, facts || {}, { reviewer: user.username, reason: 'Reviewed organiser record.' });
    if (!result.ok) return fail(result.error);
    return ok(result.profile);
  },

  async downgrade(username, level, reason, reportId) {
    const user = session();
    if (!isModerator(user)) return fail('Community Moderator access is required.', 403);
    const result = downgrade(username, level, reason, reportId, user.username);
    if (!result.ok) return fail(result.error);
    return ok(result.profile);
  },

  async sanction(username, payload = {}) {
    const user = session();
    if (!isModerator(user)) return fail('Community Moderator access is required.', 403);
    const result = addSanction(username, { ...payload, reason: payload.reason || 'Recorded by a Community Moderator.' }, user.username);
    if (!result.ok) return fail(result.error);
    return ok(result.sanction);
  },

  async requestException(requestedAmount, reason) {
    const user = session();
    if (!user) return fail('Please log in.', 401);
    const result = requestException(user.username, requestedAmount, reason);
    if (!result.ok) return fail(result.error);
    return ok(result.exception);
  },

  async myExceptions() {
    const user = session();
    if (!user) return ok([]);
    return ok(myExceptions(user.username));
  },

  async exceptions(status) {
    const user = session();
    if (!isAdmin(user)) return fail('An administrative role is required.', 403);
    return ok(allExceptions(status));
  },

  async reviewException(id, status, note) {
    const user = session();
    if (!isAdmin(user)) return fail('An administrative role is required.', 403);
    const result = reviewException(id, status, note, user.username);
    if (!result.ok) return fail(result.error);
    return ok(result.exception);
  },
};

export { effectiveLimit, LEVEL_META };
