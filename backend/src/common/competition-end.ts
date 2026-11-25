import { EntityManager } from 'typeorm';
import { DisputeEntity } from '../entities/dispute.entity';
import { ReportEntity } from '../entities/report.entity';
import { CompetitionEntity } from '../entities/competition.entity';
import { DisputeStatus, DisputeTargetType } from './interfaces';

/** Report statuses that still need a Community Moderator decision. */
const OPEN_REPORT_STATUSES = ['new', 'under_review', 'awaiting_response'];

/**
 * Unresolved disputes against a competition's organiser. While any exist, the
 * organiser cannot end the competition (ending pays out the prizes):
 *  - disputes raised against the organiser that staff have not resolved;
 *  - reports against the organiser still open in the Community Moderator queue.
 */
export async function organiserEndBlockers(m: EntityManager, competitionId: string) {
  const [disputeRows, reportRows] = await Promise.all([
    m.find(DisputeEntity, { where: { competitionId } as any }),
    m.find(ReportEntity, { where: { competitionId } as any }),
  ]);
  const disputes = disputeRows.filter((d) => d.targetType === DisputeTargetType.ORGANIZER && d.status !== DisputeStatus.RESOLVED).length;
  const reports = reportRows.filter((r) => r.queue === 'moderator' && OPEN_REPORT_STATUSES.includes(String(r.status))).length;
  return { disputes, reports, total: disputes + reports };
}

/**
 * Called after a dispute or report against an organiser is resolved: when the
 * last one is cleared on a competition that has started but not ended, the
 * organiser is told they can now end it. Returns whether a notice was sent.
 */
export async function notifyIfEndUnblocked(
  m: EntityManager,
  competitionId: string,
  notify: (data: { toUsername: string; type: string; status: string; title: string; body: string; meta: Record<string, any> }) => Promise<unknown>,
): Promise<boolean> {
  if (!competitionId) return false;
  const comp = await m.findOne(CompetitionEntity, { where: { id: competitionId } });
  if (!comp) return false;
  const ended = comp.status === 'completed' || comp.status === 'cancelled'
    || ['COMPLETED', 'PRIZE_RELEASED', 'REVERSED', 'REFUND_ISSUED', 'CANCELLED', 'EXPIRED', 'ABANDONED'].includes(String(comp.paymentStatus));
  if (ended || !comp.startDate || +new Date(comp.startDate) > Date.now()) return false;
  if ((await organiserEndBlockers(m, competitionId)).total > 0) return false;
  await notify({
    toUsername: comp.createdBy,
    type: 'competition-end-unblocked',
    status: 'info',
    title: `You can now end "${comp.name}"`,
    body: `Every dispute against you in "${comp.name}" has been resolved. Once all fixtures are complete, end the competition from its settings: the prizes are paid to the winners automatically.`,
    meta: { compId: comp.id, link: `/pages/edit-competition.html?id=${comp.id}` },
  });
  return true;
}
