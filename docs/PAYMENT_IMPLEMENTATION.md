# Payment architecture implementation

Implements `Payment_Architecture.md` end to end in **mock mode** (the default). No Razorpay account is needed: every charge, refund, payout and email is a database record, clearly labelled MOCK in the UI. Mock mode refuses to run with `NODE_ENV=production`.

## Money lifecycle

| Step | Who | What happens | UI |
|---|---|---|---|
| Create competition | Organizer | Saved as a private draft (`AWAITING_PLATFORM_FEE`). Fee = `max(minCost, prize × percentage%)`, computed on the server. | Create competition → Payments & Escrow |
| Platform fee | Organizer | Publishes the competition. Non-refundable. Optionally deposits the prize pool in the same step. A ₹0 prize pool counts as funded. | `/pages/competition-payment.html?id=` |
| Prize pool | Organizer | Locked in escrow any time before the funding deadline (`start − AUTO_CANCEL_HOURS_BEFORE_START`). Reminders at T‑48h and T‑24h. | same |
| Registration | Players | Entry fee goes straight to escrow, not to the organizer. Per-team or per-player (invites/join requests). | Create team / join flows |
| Team disband | Captain | Team's fees are refunded in full before start. | Team settings |
| End competition | Organizer (or finance, if overdue) | Needs a funded prize pool (otherwise **402**), a started competition and genuine fixtures: every active team scheduled, exactly one completed final, both finalists active teams. Then `COMPLETED`, and a dispute window of `DISPUTE_WINDOW_HOURS` opens. The organizer can no longer cancel or remove teams. | Payments & Escrow |
| Settlement | Finance (neutral) | Requires the dispute window closed, no hold, all disputes resolved, and no organizer on a winning team. Ranking: knockout = final winner, runner-up, then each earlier round's losers tied; league = standings (3 pts win, 1 draw, then wins); league with playoffs = playoffs for the top places, table for the rest. Tied teams share the prizes for the places they occupy; prize places no team can fill are returned to the organizer (PRIZE_RETURN). Each team prize is split equally between its players. The payment pages preview the payout (or the reason it can't end yet) before anyone clicks. Fees of removed teams are refunded; only fees of teams still in the competition go to the organizer. Ledger must reconcile to 0. | Finance console |
| Cancel | Organizer or finance | Unpaid draft: discarded, no penalty. Otherwise every player is refunded and the platform fee is forfeited (trust −10). The prize pool is returned if nobody registered; if anyone did, it is **held** for finance. | both |
| Unfunded prize | System | At the deadline the competition is auto-cancelled with refunds. Unpaid drafts expire after `DRAFT_EXPIRY_HOURS`. | — |
| Held prize funds | Finance | Distributed equally to the affected players as compensation. | Finance console |
| Fraud reversal | Finance | After settlement: claws back released registration revenue and refunds every player. Winner payouts are untouched. Trust −25. | Finance console |

| Team removed by organizer | Organizer / competition admin | Banning or rejecting a team refunds its fees in full; a removed team cannot be reinstated. Only that competition's organizers (or competition admins) may change a team's status or create matches. | Manage teams |

Finance moderators cannot act on competitions they organize or play in. Registered players cannot be added as co-organizers.

Organizers whose trust score drops below `MIN_ORGANIZER_TRUST_SCORE` (default 50) cannot create competitions.

## Finance moderator

Assign the role through Super Admin → Add Administrator → **Finance Moderator**. Login lands on `/pages/admin/finance.html`; revenue admins and super admins can use it too.

- **Action queue** — competitions ready to settle, with open disputes, on hold, with held prize funds, an unfunded prize near its deadline, or a low-trust organizer.
- **Case view** (`?id=`) — escrow totals, lifecycle, settlement checklist, and actions: approve and release, place or remove a hold, force-cancel and refund, compensate players from a held prize, fraud reversal. Every action requires a reason, which is written to `admin_activity_logs`.
- **Ledger** — all transactions, paginated, with reconciliation notes.
- **Mailbox** — every simulated email.

Finance cannot edit revenue policy, assign roles or forge payment confirmations.

## Player view

`/pages/my-payments.html` (sidebar → Payments): totals paid, held in escrow, refunded and won; the user's transactions; their payment emails; and the new-competition alert opt-in.

## Data

- `payment_transactions` — append-only ledger in integer paise. Types: `PLATFORM_FEE, PRIZE_POOL, REGISTRATION, REFUND, PAYOUT, REG_FEE_RELEASED, PRIZE_RETURN, CLAWBACK`. Unique on `(competitionId, type, subjectKey)`, so retries never double-charge or double-refund.
- `escrow_accounts` — per-competition totals and balance (`CHECK balance >= 0`).
- `payment_mail` — simulated emails, idempotent per event key. Each also creates an in-app notification (`status: info`, `meta.category: payment`) that appears on the Notifications page under **Payments & updates**: registrations, prize funding, payouts to every winning player, registration revenue and unfilled-place returns to the organizer, refunds, cancellations, reversals and held-prize compensation.
- Competition columns: `paymentStatus, prizePoolPaid, prizeDistributionMinor, financeHold, abandonedReason, endedAt`. User columns: `organizerTrustScore, competitionAlerts`.
- Migrations: `1793750400000-payment-foundation`, `1793750401000-mock-payment-lifecycle`, `1793750402000-payment-reversals`. They run on backend startup unless `DB_MIGRATIONS_RUN=false`. Pre-existing competitions are `LEGACY` and keep their old flow.

Every lifecycle operation runs in one DB transaction under a per-competition advisory lock.

## API (`/payments`)

| Route | Access |
|---|---|
| `POST competitions/:id/initiate-platform-fee`, `POST competitions/:id/mock-payment {outcome}` | Organizers |
| `POST competitions/:id/pay-prize-pool {outcome}` | Organizers |
| `POST competitions/:id/end` | Organizers or finance |
| `POST competitions/:id/cancel {note}` | Organizers (not after completion) or finance |
| `GET competitions/:id/status`, `GET competitions/:id/ledger` | Organizers and finance; players see only their own rows in the ledger |
| `POST competitions/:id/settle`, `/hold {held, reason}`, `/release-held-prize {note}`, `/reverse {note}` | Finance |
| `GET competitions`, `GET transactions?page=`, `POST transactions/:id/review {note}` | Finance |
| `GET me`, `GET mail`, `GET/POST subscriptions` | Any signed-in user |
| `POST webhook/razorpay` | Razorpay signature (razorpay mode only) |

## Environment (backend/.env)

```env
PAYMENT_PROVIDER=mock               # or razorpay
AUTO_CANCEL_HOURS_BEFORE_START=0    # prize funding deadline, hours before start
DRAFT_EXPIRY_HOURS=24
MIN_ORGANIZER_TRUST_SCORE=50
DISPUTE_WINDOW_HOURS=24            # time players have to dispute results before payout
```

## Switching to Razorpay later

Only the platform fee has a real gateway path today: Orders API, checkout, and an HMAC-verified `payment.captured` webhook. Set `PAYMENT_PROVIDER=razorpay` and `RAZORPAY_KEY_ID/KEY_SECRET/WEBHOOK_SECRET` (backend only), and point the webhook at `/payments/webhook/razorpay`. The rest of the lifecycle (`LifecycleService`) deliberately refuses to run outside mock mode. Before going live, each mock step needs a gateway equivalent:

1. Registration and prize-pool orders, confirmed by webhook rather than immediately.
2. Refunds API for refunds and reversals; mark `REFUNDED` only on `refund.processed`.
3. Payouts API with KYC-verified beneficiaries for winners and organizers.
4. A real mail transport (Nodemailer/SendGrid) reading from `payment_mail` as an outbox, with retries.
5. Reconciliation of orphaned gateway orders before draft expiry runs.

A database ledger does not by itself create a legal escrow or custody arrangement; that needs the gateway's escrow or marketplace product.

## Tests

`backend/test/lifecycle-tests.ts` runs the full escrow lifecycle against an in-memory entity manager: registration retries, the 402 end gate, holds, settlement reconciliation, fraud reversal, draft cancellation without penalty, held-prize compensation, funding deadlines and the production lock. `payment-tests.ts` covers fees, webhook signatures, capture matching, ownership and role isolation. `run-tests.ts` covers the creation gates, including the trust score.
