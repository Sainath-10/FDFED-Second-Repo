/**
 * NEXUS ESPORTS — reporting/reputation UI metadata
 *
 * Mirrors the backend catalogue (backend/src/common/reporting.ts). Priority is
 * assigned by the backend; this file only renders it.
 */

export const REPORT_REASONS = [
  { code: 'cheating', label: 'Cheating', priority: 'high', against: 'participant' },
  { code: 'match_fixing', label: 'Match fixing', priority: 'high', against: 'participant' },
  { code: 'team_sabotage', label: 'Team sabotage', priority: 'high', against: 'participant' },
  { code: 'serious_misconduct', label: 'Serious misconduct', priority: 'high', against: 'any' },
  { code: 'credible_threats', label: 'Credible threats', priority: 'high', against: 'any' },
  { code: 'hate_speech', label: 'Targeted hate speech / discrimination', priority: 'high', against: 'any' },
  { code: 'harassment', label: 'Harassment', priority: 'medium', against: 'any' },
  { code: 'discrimination', label: 'Discrimination', priority: 'medium', against: 'any' },
  { code: 'repeated_abuse', label: 'Repeated abusive behaviour', priority: 'medium', against: 'any' },
  { code: 'non_responsiveness', label: 'Repeated non-responsiveness', priority: 'medium', against: 'organiser' },
  { code: 'unfair_removal', label: 'Unfair removal from competition', priority: 'medium', against: 'organiser' },
  { code: 'prize_not_received', label: 'Prize not received', priority: 'high', against: 'organiser' },
  { code: 'offensive_name', label: 'Offensive display name', priority: 'low', against: 'participant' },
  { code: 'minor_insult', label: 'Isolated minor insult', priority: 'low', against: 'participant' },
  { code: 'unsportsmanlike', label: 'Minor unsportsmanlike behaviour', priority: 'low', against: 'participant' },
  { code: 'bullying', label: 'Low-severity bullying', priority: 'low', against: 'participant' },
  { code: 'other', label: 'Other (explain below)', priority: 'medium', against: 'any' },
];

export const reasonsFor = (targetRole) =>
  REPORT_REASONS.filter((reason) => !targetRole || reason.against === 'any' || reason.against === targetRole);

export const STATUS_TABS = [
  { key: 'new', label: 'New' },
  { key: 'under_review', label: 'Under Review' },
  { key: 'awaiting_response', label: 'Awaiting Response' },
  { key: 'resolved', label: 'Resolved' },
  { key: 'discarded', label: 'Discarded' },
];

export const PRIORITY_META = {
  high: { label: 'High priority', color: '#f87171', bg: 'rgba(239,68,68,0.14)', border: 'rgba(239,68,68,0.4)' },
  medium: { label: 'Medium priority', color: '#fb923c', bg: 'rgba(251,146,60,0.14)', border: 'rgba(251,146,60,0.4)' },
  low: { label: 'Low priority', color: '#60a5fa', bg: 'rgba(96,165,250,0.14)', border: 'rgba(96,165,250,0.4)' },
};

export const LEVEL_META = {
  blue: {
    label: 'Blue',
    color: '#60a5fa',
    bg: 'rgba(96,165,250,0.14)',
    limit: 300000,
    description: 'New organiser — insufficient history to establish reliability.',
  },
  green: {
    label: 'Green',
    color: '#22c55e',
    bg: 'rgba(34,197,94,0.14)',
    limit: 300000,
    description: 'Established organiser with a reliable track record.',
  },
  orange: {
    label: 'Orange',
    color: '#fb923c',
    bg: 'rgba(251,146,60,0.14)',
    limit: 20000,
    description: 'Repeated payment delays or substantiated lower-severity misconduct.',
  },
  red: {
    label: 'Red',
    color: '#f87171',
    bg: 'rgba(239,68,68,0.14)',
    limit: 10000,
    description: 'Serious misconduct, confirmed prize non-payment or significant unresolved financial issues.',
  },
};

export const FINDINGS = [
  { value: 'substantiated', label: 'Substantiated' },
  { value: 'partially_substantiated', label: 'Partially substantiated' },
  { value: 'unsubstantiated', label: 'Unsubstantiated' },
];

export const ORGANISER_ACTIONS = [
  { value: 'formal_warning', label: 'Formal Warning' },
  { value: 'final_warning', label: 'Final Warning' },
  { value: 'remove_from_competition', label: 'Remove from Competition' },
  { value: 'no_action', label: 'No Action' },
];

export const MODERATOR_ACTIONS = [
  { value: 'formal_warning', label: 'Formal Warning' },
  { value: 'final_warning', label: 'Final Warning' },
  { value: 'reputation_downgrade', label: 'Reputation Downgrade' },
  { value: 'creation_restriction', label: 'Temporary Competition Creation Restriction' },
  { value: 'competition_suspension', label: 'Competition Suspension' },
  { value: 'no_action', label: 'No Action' },
];

export const DISCARD_REASONS = [
  { value: 'duplicate_report', label: 'Duplicate report' },
  { value: 'incorrect_reported_person', label: 'Incorrect reported person' },
  { value: 'outside_competition_scope', label: 'Outside competition scope' },
  { value: 'insufficient_information', label: 'Insufficient information to investigate' },
  { value: 'not_covered_by_rules', label: 'Not covered by platform rules' },
  { value: 'other', label: 'Other — explanation required' },
];

export const capitalise = (value) =>
  String(value || '')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());

export const formatINR = (value) => `₹${Number(value || 0).toLocaleString('en-IN')}`;

export const formatDate = (value) => {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });
};

export const reportCode = (report) =>
  report?.code || (report?.id ? `RPT-${String(report.id).slice(0, 8).toUpperCase()}` : '—');

export const STATUS_LABEL = {
  new: 'New',
  under_review: 'Under Review',
  awaiting_response: 'Awaiting Response',
  resolved: 'Resolved',
  discarded: 'Discarded',
};
