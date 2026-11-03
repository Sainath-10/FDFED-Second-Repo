/**
 * NEXUS ESPORTS — reporting & organiser reputation domain constants
 *
 * Shared by the reputation/report services, DTO validation and the frontend
 * mirrors (frontend/src/lib/reporting.js). Pure data, no dependencies.
 */

// ─── Organiser reputation ────────────────────────────────────────────────────
export type ReputationLevel = 'blue' | 'green' | 'orange' | 'red';

export const REPUTATION_LEVELS: ReputationLevel[] = ['blue', 'green', 'orange', 'red'];

/** Maximum prize pool per reputation level (INR). The platform ceiling applies on top. */
export const REPUTATION_LEVEL_LIMITS: Record<ReputationLevel, number> = {
  blue: 300000,
  green: 300000,
  orange: 20000,
  red: 10000,
};

export const REPUTATION_LEVEL_LABELS: Record<ReputationLevel, string> = {
  blue: 'Blue — new organiser (insufficient history)',
  green: 'Green — established, reliable organiser',
  orange: 'Orange — repeated lower-severity issues',
  red: 'Red — serious misconduct / unresolved financial issues',
};

/** Platform-wide hard ceiling. Configurable through platform_settings (never bypassable). */
export const DEFAULT_GLOBAL_MAX_PRIZE_POOL = 300000;

/** Thresholds used by the transition rules (INR). */
export const QUALIFYING_THRESHOLDS = {
  blueToGreen: 50000,
  orangeToBlue: 7000,
  redToOrange: 5000,
} as const;

/** Additional qualifying tournaments required for each recovery step. */
export const RECOVERY_COMPETITIONS_REQUIRED = 3;
export const RED_BAN_DAYS = 30;

export const SANCTION_TYPES = [
  'formal_warning',
  'final_warning',
  'creation_restriction',
  'competition_suspension',
  'one_month_ban',
  'lifetime_ban',
] as const;
export type SanctionType = (typeof SANCTION_TYPES)[number];

// ─── Reports ─────────────────────────────────────────────────────────────────
export type ReportStatus = 'new' | 'under_review' | 'awaiting_response' | 'resolved' | 'discarded';
export const REPORT_STATUSES: ReportStatus[] = ['new', 'under_review', 'awaiting_response', 'resolved', 'discarded'];

export type ReportQueue = 'organiser' | 'moderator';
export type ReportPriority = 'high' | 'medium' | 'low';
export const REPORT_PRIORITIES: ReportPriority[] = ['high', 'medium', 'low'];

export type ReportFinding = 'substantiated' | 'partially_substantiated' | 'unsubstantiated';
export const REPORT_FINDINGS: ReportFinding[] = ['substantiated', 'partially_substantiated', 'unsubstantiated'];

export type ReportAction =
  | 'formal_warning'
  | 'final_warning'
  | 'remove_from_competition'
  | 'no_action'
  | 'reputation_downgrade'
  | 'creation_restriction'
  | 'competition_suspension';
export const ORGANISER_ACTIONS: ReportAction[] = ['formal_warning', 'final_warning', 'remove_from_competition', 'no_action'];
export const MODERATOR_ACTIONS: ReportAction[] = [
  'formal_warning',
  'final_warning',
  'reputation_downgrade',
  'creation_restriction',
  'competition_suspension',
  'no_action',
];

/**
 * Predefined reasons. The backend assigns the initial priority from this
 * catalogue — priority is urgency of review, never proof of wrongdoing.
 */
export const REPORT_REASONS: Record<
  string,
  { label: string; category: string; priority: ReportPriority; against: 'participant' | 'organiser' | 'any' }
> = {
  cheating: { label: 'Cheating', category: 'competition_integrity', priority: 'high', against: 'participant' },
  match_fixing: { label: 'Match fixing', category: 'competition_integrity', priority: 'high', against: 'participant' },
  team_sabotage: { label: 'Team sabotage', category: 'competition_integrity', priority: 'high', against: 'participant' },
  serious_misconduct: { label: 'Serious misconduct', category: 'misconduct', priority: 'high', against: 'any' },
  credible_threats: { label: 'Credible threats', category: 'safety', priority: 'high', against: 'any' },
  hate_speech: { label: 'Targeted hate speech / discrimination', category: 'safety', priority: 'high', against: 'any' },
  harassment: { label: 'Harassment', category: 'misconduct', priority: 'medium', against: 'any' },
  discrimination: { label: 'Discrimination', category: 'misconduct', priority: 'medium', against: 'any' },
  repeated_abuse: { label: 'Repeated abusive behaviour', category: 'misconduct', priority: 'medium', against: 'any' },
  non_responsiveness: { label: 'Repeated non-responsiveness', category: 'organisation', priority: 'medium', against: 'organiser' },
  unfair_removal: { label: 'Unfair removal from competition', category: 'organisation', priority: 'medium', against: 'organiser' },
  prize_not_received: { label: 'Prize not received', category: 'financial', priority: 'high', against: 'organiser' },
  offensive_name: { label: 'Offensive display name', category: 'minor', priority: 'low', against: 'participant' },
  minor_insult: { label: 'Isolated minor insult', category: 'minor', priority: 'low', against: 'participant' },
  unsportsmanlike: { label: 'Minor unsportsmanlike behaviour', category: 'minor', priority: 'low', against: 'participant' },
  bullying: { label: 'Low-severity bullying', category: 'minor', priority: 'low', against: 'participant' },
  other: { label: 'Other (explain below)', category: 'other', priority: 'medium', against: 'any' },
};

export const DISCARD_REASONS = [
  'duplicate_report',
  'incorrect_reported_person',
  'outside_competition_scope',
  'insufficient_information',
  'not_covered_by_rules',
  'other',
] as const;
export type DiscardReason = (typeof DISCARD_REASONS)[number];

/** Three baseless (discarded) reports per player per competition, then reporting is locked. */
export const MAX_DISCARDED_REPORTS = 3;

/** Deadlines (minutes) — overridable through platform settings. */
export const DEFAULT_REPORT_REMINDER_MINUTES = 24 * 60;
export const DEFAULT_HIGH_PRIORITY_MINUTES = 60;

export function isReputationLevel(value: unknown): value is ReputationLevel {
  return typeof value === 'string' && (REPUTATION_LEVELS as string[]).includes(value);
}
