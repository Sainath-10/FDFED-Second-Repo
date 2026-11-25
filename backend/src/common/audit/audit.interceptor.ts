import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Observable, tap } from 'rxjs';
import { AuditLogService } from './audit.service';

/**
 * Central activity recording for successful API actions.
 *
 * Services record the actions they understand best (with before/after values
 * and richer detail) by calling AuditLogService directly. This interceptor
 * covers every other important action from one route table, so the activity
 * log reflects what really happened across the platform instead of a few
 * hand-picked events. Routes whose service already writes the event are NOT
 * listed here, so nothing is recorded twice.
 *
 * Only successful requests are recorded (failed ones change nothing). Bodies
 * are reduced to a small allow-list of fields — never passwords, tokens or
 * file contents.
 */

type Ctx = { body: any; params: Record<string, string>; data: any };
type Rule = {
  /** Action type, or a function; returning null skips (e.g. the service already records that case). */
  action: string | ((ctx: Ctx) => string | null);
  entity: string;
  /** Route param holding the entity id; defaults to 'id'. */
  idParam?: string;
  /** The route's :id is a competition id. */
  idIsCompetition?: boolean;
  /** The route's :id is a team id. */
  idIsTeam?: boolean;
  details: (ctx: Ctx) => string;
};

const outcome = (ok: string, failed: string) => ({ body }: Ctx) => (String(body?.outcome || 'success').toLowerCase() === 'success' ? ok : failed);

const RULES: Record<string, Rule> = {
  // ── Account

  // ── Competition organisers and approval
  'POST /competitions/:id/organizers': { action: 'ORGANIZER_INVITED', entity: 'competition', idIsCompetition: true, details: ({ body }) => `Co-organizer invitation sent to @${body?.username || body?.organizerUsername || 'a user'}.` },
  'POST /competitions/:id/organizer-invite/accept': { action: 'ORGANIZER_INVITE_ACCEPTED', entity: 'competition', idIsCompetition: true, details: () => 'Co-organizer invitation accepted.' },
  'POST /competitions/:id/organizer-invite/decline': { action: 'ORGANIZER_INVITE_DECLINED', entity: 'competition', idIsCompetition: true, details: () => 'Co-organizer invitation declined.' },
  'DELETE /competitions/:id/organizers/:organizerId': { action: 'ORGANIZER_REMOVED', entity: 'competition', idIsCompetition: true, details: ({ params }) => `Co-organizer @${params.organizerId} removed.` },
  'PATCH /competitions/:id/approval': { action: 'COMPETITION_APPROVAL_CHANGED', entity: 'competition', idIsCompetition: true, details: ({ body }) => `Approval set to ${body?.status || body?.approvalStatus || 'updated'}.` },

  // ── Payments and competition lifecycle
  'POST /payments/competitions/:id/initiate-platform-fee': { action: 'PAYMENT_INITIATED', entity: 'competition', idIsCompetition: true, details: () => 'Platform fee payment initiated.' },
  'POST /payments/competitions/:id/mock-payment': { action: outcome('PAYMENT_CONFIRMED', 'PAYMENT_FAILED'), entity: 'competition', idIsCompetition: true, details: ({ body }) => `Platform fee payment ${String(body?.outcome || 'success') === 'success' ? 'confirmed — competition published' : `failed (${body?.outcome})`}.` },
  'POST /payments/competitions/:id/pay-prize-pool': { action: outcome('PRIZE_POOL_FUNDED', 'PRIZE_POOL_PAYMENT_FAILED'), entity: 'competition', idIsCompetition: true, details: ({ body }) => `Prize pool ${String(body?.outcome || 'success') === 'success' ? 'deposited into escrow' : `payment failed (${body?.outcome})`}.` },
  'POST /payments/transactions/:id/review': { action: 'TRANSACTION_REVIEWED', entity: 'payment_transaction', details: ({ body }) => `Transaction reviewed${body?.note ? `: ${body.note}` : '.'}` },
  'POST /payments/competitions/:id/end': { action: 'COMPETITION_COMPLETED', entity: 'competition', idIsCompetition: true, details: () => 'Competition ended; the dispute window opened before payouts.' },
  'POST /payments/competitions/:id/cancel': { action: 'COMPETITION_CANCELLED', entity: 'competition', idIsCompetition: true, details: ({ body }) => `Competition cancelled; registered players are refunded${body?.note ? `. ${body.note}` : '.'}` },
  'POST /payments/competitions/:id/early-end-request': { action: 'EARLY_END_REQUESTED', entity: 'competition', idIsCompetition: true, details: ({ body }) => `Early end requested${body?.reason ? `: ${body.reason}` : '.'}` },
  'POST /payments/competitions/:id/early-end-review': { action: 'EARLY_END_REVIEWED', entity: 'competition', idIsCompetition: true, details: ({ body }) => `Early end request ${body?.approve === false || body?.decision === 'reject' ? 'rejected' : 'reviewed'}.` },
  'POST /payments/competitions/:id/settle': { action: 'PRIZES_PAID_OUT', entity: 'competition', idIsCompetition: true, details: () => 'Settlement approved: prizes paid out and registration revenue released.' },
  'POST /payments/competitions/:id/hold': { action: 'FINANCE_HOLD_CHANGED', entity: 'competition', idIsCompetition: true, details: ({ body }) => `Finance hold ${body?.held ? 'placed' : 'removed'}${body?.reason ? `: ${body.reason}` : '.'}` },
  'POST /payments/competitions/:id/release-held-prize': { action: 'HELD_PRIZE_RELEASED', entity: 'competition', idIsCompetition: true, details: () => 'Held prize funds distributed to the affected players.' },
  'POST /payments/competitions/:id/reverse': { action: 'PAYMENT_REVERSED', entity: 'competition', idIsCompetition: true, details: () => 'Fraud reversal: registration revenue clawed back and players refunded.' },
  'POST /payments/competitions/:id/organizer-trust': { action: 'ORGANIZER_TRUST_CHANGED', entity: 'competition', idIsCompetition: true, details: () => 'Organizer trust score adjusted.' },

  // ── Platform policy and revenue configuration
  'POST /policies': { action: 'POLICY_CREATED', entity: 'policy', details: ({ body }) => `Policy "${body?.title || 'untitled'}" created.` },
  'PATCH /policies/:id': { action: 'POLICY_UPDATED', entity: 'policy', details: () => 'Policy updated.' },
  'PATCH /policies/:id/archive': { action: 'POLICY_ARCHIVED', entity: 'policy', details: () => 'Policy archived.' },
  'DELETE /policies/:id': { action: 'POLICY_DELETED', entity: 'policy', details: () => 'Policy deleted.' },
  'POST /revenue/config': { action: 'REVENUE_CONFIG_UPDATED', entity: 'revenue_config', details: ({ body }) => `Platform fee set to ${body?.percentage ?? '?'}% (minimum ₹${body?.minCost ?? '?'}).` },
  'POST /revenue/transactions': { action: 'REVENUE_TRANSACTION_RECORDED', entity: 'revenue_transaction', details: () => 'Revenue transaction recorded.' },
  'PUT /reputation/config': { action: 'REPUTATION_CONFIG_UPDATED', entity: 'platform_setting', details: () => 'Reputation and prize-pool settings updated.' },
  'POST /reputation/prize-pool-exceptions/:id/review': { action: 'PRIZE_EXCEPTION_REVIEWED', entity: 'prize_pool_exception', details: ({ body }) => `Prize-pool exception ${body?.status || body?.decision || 'reviewed'}.` },
  'POST /reputation/evaluate': { action: 'REPUTATION_EVALUATED', entity: 'organiser_reputation', details: ({ body }) => `Reputation evaluated for @${body?.username || 'an organiser'}.` },

  // ── Reports and discussions (decisions and appeals are recorded by the service)
  'POST /reports': { action: 'REPORT_SUBMITTED', entity: 'report', details: ({ data }) => `Report ${data?.code || ''} submitted and routed to ${data?.queue === 'moderator' ? 'the Community Moderator' : 'the organiser'}.` },
  'POST /reports/:id/discussion': { action: 'DISCUSSION_OPENED', entity: 'report', details: () => 'Case discussion opened.' },
  'POST /reports/discussions/:discussionId/messages': { action: 'DISCUSSION_MESSAGE', entity: 'report_discussion', idParam: 'discussionId', details: () => 'Message posted in a case discussion.' },
  'POST /reports/discussions/:discussionId/end': { action: 'DISCUSSION_CLOSED', entity: 'report_discussion', idParam: 'discussionId', details: () => 'Case discussion closed (read-only).' },
  'POST /reports/discussions/:discussionId/participants': { action: 'DISCUSSION_PARTICIPANT_ADDED', entity: 'report_discussion', idParam: 'discussionId', details: ({ body }) => `@${body?.username || 'a user'} added to a case discussion.` },
  'DELETE /reports/discussions/:discussionId/participants/:username': { action: 'DISCUSSION_PARTICIPANT_REMOVED', entity: 'report_discussion', idParam: 'discussionId', details: ({ params }) => `@${params.username} removed from a case discussion.` },
  'PATCH /reports/:id/priority': { action: 'REPORT_PRIORITY_CHANGED', entity: 'report', details: ({ body }) => `Priority set to ${body?.priority}.` },
  'POST /reports/:id/discard': { action: 'REPORT_DISCARDED', entity: 'report', details: ({ body }) => `Report discarded (${String(body?.reason || 'no reason').replace(/_/g, ' ')}).` },
  'POST /reports/:id/request-response': { action: 'RESPONSE_REQUESTED', entity: 'report', details: () => 'Reviewer requested a response in the case discussion.' },
  'POST /reports/:id/act-organiser': { action: 'REPORT_DECIDED', entity: 'report', details: ({ body }) => `Community Moderator decision: ${body?.finding} / ${String(body?.action || '').replace(/_/g, ' ')}.` },

  // ── Disputes
  'DELETE /disputes/:id': { action: 'DISPUTE_DELETED', entity: 'dispute', details: () => 'Dispute deleted by a Super Admin.' },

  // ── Teams (creation, members, leave, invites accepted, disband and deletion are recorded by the service)
  'PATCH /teams/:id': { action: 'TEAM_UPDATED', entity: 'team', idIsTeam: true, details: ({ body }) => `Team details updated (${Object.keys(body || {}).filter((k) => !['img', 'avatar'].includes(k)).join(', ') || 'details'}).` },
  'PATCH /teams/:id/status': { action: 'TEAM_STATUS_CHANGED', entity: 'team', idIsTeam: true, details: ({ body }) => `Team status set to ${body?.status}.` },
  'POST /teams/:id/warnings': { action: 'TEAM_WARNED', entity: 'team', idIsTeam: true, details: ({ body }) => `Team warned${body?.reason ? `: ${body.reason}` : '.'}` },
  'PATCH /teams/:id/ban': { action: 'TEAM_BANNED', entity: 'team', idIsTeam: true, details: ({ body }) => `Team banned${body?.reason ? `: ${body.reason}` : '.'}` },
  'POST /teams/:id/join-requests': { action: 'JOIN_REQUEST_SENT', entity: 'team', idIsTeam: true, details: () => 'Join request sent to the team captain.' },
  'PATCH /teams/join-requests/:reqId': { action: ({ body }) => (String(body?.status || '').toLowerCase() === 'approved' ? null : 'JOIN_REQUEST_DECIDED'), entity: 'team_join_request', idParam: 'reqId', details: ({ body }) => `Join request ${body?.status || 'updated'}.` },
  'POST /teams/join-requests/:reqId/pay': { action: 'JOIN_FEE_PAID', entity: 'team_join_request', idParam: 'reqId', details: () => 'Player entry fee paid; player joined the team.' },
  'POST /teams/:id/invites': { action: 'TEAM_INVITE_SENT', entity: 'team', idIsTeam: true, details: ({ body }) => `Invitation sent to @${body?.username || body?.invitedUsername || 'a player'}.` },
  'DELETE /teams/:id/invites/:inviteId': { action: 'TEAM_INVITE_CANCELLED', entity: 'team', idIsTeam: true, details: () => 'Invitation cancelled.' },
  'PATCH /teams/invites/:inviteId': { action: ({ body }) => (String(body?.status || '').toLowerCase() === 'accepted' ? null : 'TEAM_INVITE_DECLINED'), entity: 'team_invite', idParam: 'inviteId', details: () => 'Invitation declined.' },

  // ── Communication
  'POST /chat/competitions/:competitionId/announcements': { action: 'ANNOUNCEMENT_POSTED', entity: 'competition', idParam: 'competitionId', details: () => 'Announcement posted to the competition.' },
};

const SAFE_FIELDS = ['status', 'outcome', 'note', 'reason', 'held', 'username', 'action', 'finding', 'priority', 'decision', 'approve', 'level', 'days', 'title'];

function pick(body: any): Record<string, any> {
  const out: Record<string, any> = {};
  if (!body || typeof body !== 'object') return out;
  for (const key of SAFE_FIELDS) {
    const value = body[key];
    if (value === undefined || value === null) continue;
    out[key] = typeof value === 'string' ? value.slice(0, 300) : value;
  }
  return out;
}

function firstString(...values: any[]): string | undefined {
  for (const value of values) if (typeof value === 'string' && value) return value;
  return undefined;
}

@Injectable()
export class AuditInterceptor implements NestInterceptor {
  constructor(private readonly audit: AuditLogService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    if (context.getType() !== 'http') return next.handle();
    const req = context.switchToHttp().getRequest();
    const method = String(req.method || '').toUpperCase();
    if (!['POST', 'PATCH', 'PUT', 'DELETE'].includes(method)) return next.handle();
    const routePath = String(req.route?.path || '').replace(/\/+$/, '') || '/';
    const rule = RULES[`${method} ${routePath}`];
    if (!rule) return next.handle();

    return next.handle().pipe(
      tap((data) => {
        try {
          const ctx: Ctx = { body: req.body || {}, params: req.params || {}, data };
          const action = typeof rule.action === 'function' ? rule.action(ctx) : rule.action;
          if (!action) return;
          const params = ctx.params;
          const entityId = firstString(params[rule.idParam || 'id'], data?.id) || undefined;
          const competitionId = firstString(
            rule.idIsCompetition ? params.id : undefined,
            params.competitionId, ctx.body?.competitionId, ctx.body?.compId, data?.competitionId,
          );
          const teamId = firstString(rule.idIsTeam ? params.id : undefined, ctx.body?.teamId, data?.teamId);
          const actor = req.user?.username || 'anonymous';
          this.audit.record(action, {
            actor,
            entityType: rule.entity,
            entityId,
            details: rule.details(ctx),
            metadata: {
              ...(competitionId ? { competitionId } : {}),
              ...(teamId ? { teamId } : {}),
              ...(rule.entity === 'report' && entityId ? { reportId: entityId } : {}),
              ...(actor !== 'anonymous' ? { username: actor } : {}),
              route: `${method} ${routePath}`,
              input: pick(ctx.body),
            },
          }).catch(() => undefined);
        } catch {
          // Recording must never affect the response.
        }
      }),
    );
  }
}
