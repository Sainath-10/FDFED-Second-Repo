/**
 * NEXUS ESPORTS — dispute display helpers
 *
 * The player "Disputes" page was merged into Reports (/pages/my-reports.html).
 * These helpers stay for the dispute escalation page.
 */

export const DISPUTE_STATUS = {
  open_organizer: { label: 'Waiting for organizer', pill: 'pending' },
  under_review: { label: 'Under review', pill: 'pending' },
  open_admin: { label: 'With platform staff', pill: 'pending' },
  escalated_to_admin: { label: 'Escalated to staff', pill: 'pending' },
  resolved: { label: 'Resolved', pill: 'approved' },
};

export function canEscalate(d, username) {
  if (String(d.reportedBy).toLowerCase() !== String(username || '').toLowerCase()) return false;
  const waiting = ['open_organizer', 'under_review'].includes(d.status) && Date.now() - +new Date(d.createdAt) >= 24 * 3600000;
  const organizerDecided = d.status === 'resolved' && !!d.organizerNotes && !d.adminNotes;
  return waiting || organizerDecided;
}
