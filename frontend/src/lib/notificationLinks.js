/**
 * NEXUS ESPORTS — where a notification leads
 *
 * Shared by the Notifications page and the unread pop-up shown at sign-in, so
 * both open the same page for the same notification.
 */

export const ACTIONABLE = [
  'team-join-request', 'team-invite', 'co-organizer-invite', 'team-join-payment', 'password-reset-request',
  'large-prize-request', 'early-end-request',
];

export const MONEY_TYPES = [
  'winner-payout', 'organizer-revenue-released', 'refund-apology', 'registration-refunded', 'settlement-reversed-organizer',
  'held-prize-distributed', 'registration-confirmed', 'prize-pool-confirmed', 'competition-cancelled-player',
  'competition-cancelled-organizer', 'refund-status', 'unregistered-no-refund',
];

export const ORGANIZER_TYPES = [
  'competition-live', 'new-team-joined', 'prize-pool-confirmed', 'prize-pool-reminder', 'prize-pool-urgent',
  'organizer-revenue-released', 'competition-cancelled-organizer', 'settlement-reversed-organizer', 'held-prize-distributed',
  'competition-ended-early', 'early-end-rejected', 'large-prize-approved', 'large-prize-rejected',
];

export function linkOf(item) {
  const m = item?.meta || {};
  if (m.link) return { to: m.link, label: 'Open' };
  if (item.type === 'password-reset-request') return { to: '/pages/admin/users.html', label: 'Open Users' };
  if (m.disputeId) return { to: '/pages/my-reports.html', label: 'View reports' };
  if (m.reportId) return { to: '/pages/my-reports.html', label: 'View reports' };
  if (ORGANIZER_TYPES.includes(item.type) && m.compId) return { to: `/pages/competition-payment.html?id=${encodeURIComponent(m.compId)}`, label: 'Open payments and escrow' };
  if (MONEY_TYPES.includes(item.type)) return { to: '/pages/my-payments.html', label: 'View my payments' };
  if (m.teamId && m.compId) return { to: `/pages/team/team-roster.html?compId=${encodeURIComponent(m.compId)}&teamId=${encodeURIComponent(m.teamId)}`, label: 'Open team' };
  if (m.compId) return { to: `/pages/comp-info.html?id=${encodeURIComponent(m.compId)}`, label: 'View competition' };
  return null;
}
