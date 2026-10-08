/**
 * NEXUS ESPORTS — shared policy store
 *
 * Mirrors the `nexus_policies` store used by the super-admin policy pages
 * (localStorage + sessionStorage) and the four built-in default policies.
 */

export const POLICY_STORE_KEY = 'nexus_policies';

export const normalizePolicyStatus = (status) => {
  const s = String(status || '').trim().toLowerCase();
  return s === 'active' || s === 'draft' || s === 'archived' ? s : 'draft';
};

const safeParse = (json, fallback) => { try { const p = JSON.parse(json); return p ?? fallback; } catch (e) { return fallback; } };

export const DEFAULT_POLICIES = [
  {
    id: 'pol-001',
    title: 'Fair Play & Anti-Cheat Policy',
    version: 'v2.1',
    status: 'active',
    scope: 'All Competitions',
    category: 'Conduct',
    effectiveDate: '2026-03-01',
    reviewDate: '2027-03-01',
    updatedBy: 'RohanDev',
    updatedAt: 'Mar 1, 2026',
    summary: 'Defines fair play standards, prohibited software, and enforcement procedures for all NEXUS Esports competitions.',
    clauses: [
      'All participants must compete using only officially sanctioned game clients and peripherals.',
      'Use of third-party software that modifies game behaviour, provides unfair advantages, or circumvents anti-cheat systems is strictly prohibited.',
      'Anti-cheat software (VAC, FACEIT AC, or NEXUS AC) must be active throughout all matches. Failure to comply results in immediate forfeit.',
      'Exploiting known bugs or glitches intentionally is prohibited. Players must report bugs to admins immediately upon discovery.',
      'Match-fixing, collusion, or deliberate underperformance is a permanent ban offence.',
      'Impersonating another player, team, or official constitutes fraud and results in account termination.',
      'Violations are reviewed by admins within 48 hours. Penalties range from match forfeit to permanent platform ban depending on severity.',
    ],
    tags: ['anti-cheat', 'fair-play', 'conduct', 'all-competitions'],
    changelog: [
      { ver: 'v2.1', date: 'Mar 1, 2026', desc: 'Added clause 3 regarding NEXUS AC mandatory compliance.' },
      { ver: 'v2.0', date: 'Jan 15, 2026', desc: 'Revised exploitation clause; added match-fixing penalties.' },
      { ver: 'v1.2', date: 'Sep 10, 2025', desc: 'Minor wording clarifications in clauses 1–2.' },
    ],
  },
  {
    id: 'pol-002',
    title: 'Team Registration Requirements',
    version: 'v1.4',
    status: 'active',
    scope: 'Team Competitions',
    category: 'Registration',
    effectiveDate: '2026-02-15',
    reviewDate: '2027-02-15',
    updatedBy: 'PriyaS_Admin',
    updatedAt: 'Feb 15, 2026',
    summary: 'Outlines eligibility criteria, roster rules, and registration deadlines for all team-based competitions.',
    clauses: [
      'Teams must consist of exactly 5 registered players with verified NEXUS accounts in good standing.',
      'All players must be 16 years of age or older at the time of registration.',
      'Each team may register a maximum of 1 substitute player who must also hold a verified NEXUS account.',
      'Team registration must be completed at least 72 hours before competition start. Late registrations are not accepted.',
      'A player may only be registered to one team per competition. Dual-registration is grounds for disqualification of both teams.',
      'Teams must designate a captain who acts as the official point of contact with administrators.',
      'Roster changes after registration deadline are prohibited unless approved by a platform admin in writing.',
    ],
    tags: ['registration', 'roster', 'eligibility', 'teams'],
    changelog: [
      { ver: 'v1.4', date: 'Feb 15, 2026', desc: 'Added clause 5 prohibiting dual-registration.' },
      { ver: 'v1.3', date: 'Nov 5, 2025', desc: 'Minimum age raised from 14 to 16 years.' },
    ],
  },
  {
    id: 'pol-003',
    title: 'Dispute Resolution Policy',
    version: 'v3.0',
    status: 'active',
    scope: 'All Competitions',
    category: 'Disputes',
    effectiveDate: '2026-01-10',
    reviewDate: '2027-01-10',
    updatedBy: 'RohanDev',
    updatedAt: 'Jan 10, 2026',
    summary: 'Governs the process for filing, reviewing, and resolving match disputes and escalations.',
    clauses: [
      "Disputes must be filed within 24 hours of the relevant match's conclusion. Late submissions will not be reviewed.",
      'The disputing team must submit supporting evidence (screenshots, video, demo files) at the time of filing.',
      'Admins will acknowledge all disputes within 6 hours and complete initial review within 48 hours.',
      'Admin decisions are final at the competition level unless formally escalated to a Super Admin.',
      'Escalations to Super Admin must be filed within 48 hours of the admin decision and require new evidence or a documented procedural error.',
      'Super Admin decisions are binding, non-appealable, and will be issued within 72 hours of escalation.',
      'Filing a false or malicious dispute may result in warnings, score penalties, or account suspension.',
    ],
    tags: ['disputes', 'escalation', 'super-admin', 'resolution'],
    changelog: [
      { ver: 'v3.0', date: 'Jan 10, 2026', desc: 'Complete rewrite; added Super Admin escalation pathway and timelines.' },
      { ver: 'v2.1', date: 'Aug 22, 2025', desc: 'Reduced admin review window from 72h to 48h.' },
    ],
  },
  {
    id: 'pol-004',
    title: 'Prize Distribution Policy',
    version: 'v1.1',
    status: 'draft',
    scope: 'All Competitions',
    category: 'Finance',
    effectiveDate: '',
    reviewDate: '',
    updatedBy: 'AryanX99',
    updatedAt: 'Mar 20, 2026',
    summary: 'Describes how prize money is calculated, verified, and distributed to winning teams and players.',
    clauses: [
      'Prize money will be distributed to team captains within 14 business days of tournament conclusion.',
      'All prize recipients must have valid bank account details or a registered UPI ID on file before the tournament ends.',
      "Prizes may be withheld indefinitely if the recipient's account is under investigation for Fair Play violations.",
      'Tax liabilities arising from prize winnings are the sole responsibility of the recipient.',
      "In cases of team disputes regarding prize splits, NEXUS Esports follows the captain's declared split on file at registration.",
    ],
    tags: ['prizes', 'finance', 'payment', 'distribution'],
    changelog: [
      { ver: 'v1.1', date: 'Mar 20, 2026', desc: 'Added clause 5 covering internal team prize disputes.' },
      { ver: 'v1.0', date: 'Feb 1, 2026', desc: 'Initial draft created.' },
    ],
  },
];

export function readPolicies() {
  const local = safeParse(localStorage.getItem(POLICY_STORE_KEY), null);
  if (Array.isArray(local) && local.length) return local;
  const session = safeParse(sessionStorage.getItem(POLICY_STORE_KEY), null);
  if (Array.isArray(session) && session.length) {
    localStorage.setItem(POLICY_STORE_KEY, JSON.stringify(session));
    return session;
  }
  return DEFAULT_POLICIES;
}

export function savePolicies(policies) {
  const serialized = JSON.stringify(policies);
  localStorage.setItem(POLICY_STORE_KEY, serialized);
  sessionStorage.setItem(POLICY_STORE_KEY, serialized);
}

export const getPolicyById = (id) => readPolicies().find((p) => p.id === id);

export const bumpMinorVersion = (version) => {
  const [maj, min] = String(version || 'v1.0').replace('v', '').split('.').map(Number);
  return `v${maj || 1}.${(min || 0) + 1}`;
};

export const todayLabel = () => new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

const toISO = (date) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};
export const addDays = (isoDate, days) => {
  const base = new Date(`${isoDate}T00:00:00`);
  base.setDate(base.getDate() + days);
  return toISO(base);
};
export const todayISO = () => toISO(new Date());

export function validatePolicyForm(data) {
  if (!data.title) return 'Please enter a policy title.';
  if (data.clauses.length === 0) return 'Please add at least one rule clause.';
  if (!data.effectiveDate) return 'Please choose an effective date.';
  if (!data.reviewDate) return 'Please choose a next review date.';

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const effective = new Date(data.effectiveDate);
  const review = new Date(data.reviewDate);
  effective.setHours(0, 0, 0, 0);
  review.setHours(0, 0, 0, 0);

  if (effective < today) return 'Effective date cannot be earlier than today.';
  const minReview = new Date(effective);
  minReview.setDate(minReview.getDate() + 1);
  if (review < minReview) return 'Next review date must be at least one day after effective date.';
  return null;
}


