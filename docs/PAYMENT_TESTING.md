# Testing the payment workflow (mock mode)

Every step happens in the browser. Nothing costs money.

## 0. Setup (once)

### 0.1 Start the app

```bash
cd backend && npm run start:dev          # runs the pending payment migrations on startup
cd frontend && npm run dev -- --host     # --host makes the app answer on both localhost AND 127.0.0.1
```

`backend/.env` must have `PAYMENT_PROVIDER=mock` (also the default).

### 0.2 Create the test users (one command)

```bash
node backend/scripts/setup-payment-test-users.mjs
```

This creates, verifies (simulated Aadhaar) and assigns roles for everyone below. Running it again is safe. Every password is **`test1234`**; the super admin is `superadmin1` / `nexus`.

| Account | Plays the part of |
|---|---|
| `org_arjun` | Organizer: creates and runs competitions |
| `cap_meera` | Captain of team 1 |
| `cap_kabir` | Captain of team 2 |
| `cap_zoya` | Captain of team 3 (the one who gets banned in the cheat tests) |
| `player_dev` | Teammate invited into team 1 (prize split check) |
| `fin_ravi` | Finance moderator |
| `priya_dual` | Player who is later promoted to finance (conflict-of-interest check) |

### 0.3 Be several people at once

The login lives in the browser's storage, which is separate per **site address** and per **normal/incognito**. So one Chrome gives you four independent people:

| Window | Address | Log in as |
|---|---|---|
| 1. Chrome, normal | `http://localhost:5173` | `org_arjun` (organizer) |
| 2. Chrome, normal | `http://127.0.0.1:5173` | `cap_meera` (captain 1) |
| 3. Chrome, incognito | `http://localhost:5173` | `cap_kabir` (captain 2) |
| 4. Chrome, incognito | `http://127.0.0.1:5173` | `fin_ravi` (finance) |

Need a fifth or sixth person (`cap_zoya`, `player_dev`)? Use Safari/Firefox, or another Chrome profile. Rules of thumb:
- Tabs in the same window type + same address share **one** login. Logging in there replaces the previous user.
- Put the username in each window's title bar: the sidebar shows who is logged in (Profile).
- Login/sign-up is limited to **15 attempts per minute** from your machine. If you get "Too many authentication attempts", wait the number of seconds it says.

Where to look at any time:
- **Organizer:** competition page → **Payments & prize pool** tab, or My Activity → the competition.
- **Players:** sidebar → **Payments** (transactions and emails); also Notifications.
- **Finance:** Finance Moderation → Action queue / Competitions / Ledger / Mailbox. Click a competition name to open its case.

---

## A. Happy path: create → pay → register → play → settle

| # | As | Do | Expect |
|---|---|---|---|
| A1 | org_arjun | Create competition: start **tomorrow**, Single Elimination, prize **₹10,000** (1st ₹6,000 / 2nd ₹4,000), entry fee **₹500 per team**, max teams 8. Click **Save draft & continue to payment**. | Payments page, status *Awaiting platform fee*. Fee **₹700** (7% of the prize, minimum ₹50). The competition is **not** in the public list yet. |
| A2 | org_arjun | Click **Simulate failed payment**. | Warning shown; still a draft; nothing in the ledger is confirmed. |
| A3 | org_arjun | Keep "Also deposit the prize pool now" ticked → **Simulate payment · ₹10,700**. | Steps 1–2 turn green. Escrow balance ₹10,000. Ledger: Platform fee CONFIRMED, Prize pool ESCROWED. Emails: *is live*, *Prize pool locked*. |
| A4 | cap_meera | Open the competition → **Register team** → name "Alpha" → **Mock pay ₹500 & Register Team**. | Payments page: ₹500 held in escrow. Email: *Registration confirmed*. |
| A5 | cap_kabir | Same, team "Bravo". | The organizer's page shows escrow **₹11,000**, registrations 2. The organizer gets *New team registered* emails. |
| A5b | cap_meera → player_dev | Team page → **Invite player** → `player_dev`. Then as `player_dev` (5th browser) accept it in **Notifications**. | `player_dev` joins team Alpha (per-team fee, so nothing more to pay). |
| A6 | org_arjun | Try to register a team in your own competition. | Rejected: organizers cannot register. |
| A7 | org_arjun | Payments page → **Testing tools** → **Start competition now** → confirm. | Step 3 green. Registration is now closed. |
| A8 | org_arjun | Competition page → **Fixtures** → **Create fixtures** → open the match → **Enter result** (e.g. Alpha wins) → **Save result**. | The final is completed. |
| A9 | org_arjun | Payments page → **End competition & request payout** → confirm. | Status *Awaiting finance review*. The Cancel card disappears (organizer can't cancel now). All players get *has been completed* with the dispute deadline. |
| A10 | fin_ravi | Action queue → the competition shows **Dispute window until …** → open it → **Close dispute window now (testing)**. | Players normally have `DISPUTE_WINDOW_HOURS` (24h) to dispute results. After closing it, the settlement checklist is all ✓. |
| A11 | fin_ravi | **Approve & release payouts** → confirm. | Status *Settled*, escrow ₹0 / RELEASED. Ledger: PAYOUT ₹3,000 → cap_meera and ₹3,000 → player_dev (team prize split equally), PAYOUT ₹4,000 → cap_kabir, Revenue release ₹1,000 → org_arjun. A team with several players gets its prize split equally between them. |
| A12 | cap_meera | Sidebar → **Payments**. | Prize winnings ₹3,000; email *Prize released*. |

## B. Organizer cancels after players registered

1. org_arjun: create a second competition (prize ₹5,000, fee ₹200). Pay the fee **with** the prize pool.
2. cap_meera registers a team.
3. org_arjun: Payments page → **Cancel & refund players** → write a reason → confirm.
4. Expect:
   - Status *Cancelled · refunded*.
   - cap_meera gets a REFUND of ₹200 and the *Apology: … has been cancelled* email with a refund reference.
   - The organizer's email says the platform fee is forfeited.
   - org_arjun's trust score drops to **90** (visible in the finance case).
   - The prize pool is **held** (escrow HELD ₹5,000), because players were affected.
5. fin_ravi: the queue shows **Held prize ₹5,000** → open the case → **Compensate registered players** → reason → confirm.
6. Expect: cap_meera receives a ₹5,000 payout and escrow goes to ₹0.

Variation: cancel a competition that **nobody** registered for. The prize pool is returned to the organizer (PRIZE_RETURN).

## C. Organizer never funds the prize pool → auto-cancel

1. org_arjun: create a competition and **untick** "Also deposit the prize pool" → simulate payment (platform fee only).
2. cap_kabir registers a team.
3. org_arjun: **Start competition now**. The card warns that the competition will be auto-cancelled.
4. fin_ravi: **Run deadline check now**, or wait up to a minute.
5. Expect:
   - Cancelled with reason *Prize pool was not funded before the deadline*.
   - cap_kabir refunded in full.
   - Trust score −10.

Reminder emails: a competition whose start is under 48h / 24h away with an unfunded prize gets *Reminder* / *URGENT* emails after a deadline check.

## D. Finance hold and disputes block payout

1. Repeat A1–A9 with a new competition.
2. fin_ravi → case → **Place hold** (with a reason). **Approve & release** is disabled and the checklist shows the hold. The organizer's page shows *Finance hold*.
3. **Remove hold** → approval is enabled again.
4. If a dispute is still open for the competition, the checklist shows it and settlement is refused until it is resolved.

## E. Fraud reversal after settlement

1. On the settled competition from A: fin_ravi → case → **Reverse settlement** → reason (at least 15 characters) → confirm.
2. Expect:
   - Status *Reversed (fraud)*.
   - Ledger: CLAWBACK ₹1,000 from org_arjun, and REFUND ₹500 each to cap_meera and cap_kabir.
   - The winners' payouts stay untouched.
   - org_arjun's trust score drops by 25.

## F. Drafts

- Create a competition and leave on the payment page → My Activity shows **Payment pending — resume checkout**.
- **Discard draft** → cancelled with no penalty (trust unchanged).
- Unpaid drafts expire after `DRAFT_EXPIRY_HOURS` (24h) once a deadline check runs.

## G. Trust gate

After B (−10), C (−10) and E (−25), org_arjun is at 55. One more paid cancellation brings it to 45. Creating a competition is then refused: *trust score … is below 50*.

## H. Cheating attempts (each must be blocked)

| Who cheats | Try this | Expected |
|---|---|---|
| Organizer | Ban or reject a paying team (Manage teams) before results | Team removed **and refunded in full**; its fee is never released to the organizer. It can't be reinstated; the players can register again. |
| Organizer | Ban a team after ending the competition | Refused: "Results are final. Raise a dispute…" |
| Rival captain | Ban or reject a team in someone else's competition (`PATCH /teams/:id/ban`) | 403: only that competition's organizers or competition admins |
| Anyone not organizing | Create a match / fake "Final" in a competition (`POST /matches`) | 403: only organizers of that competition |
| Organizer | Leave a paying team out of the fixtures, then End | Refused: "*Team* never appeared in the fixtures" |
| Organizer | Two completed "Final" matches | Refused: "Exactly one completed final is required" |
| Organizer | Add a registered player as co-organizer (so they can enter results) | Refused: "already play in this competition and cannot also organize it" |
| Organizer | Enter a wrong winner | Players see the dispute deadline in their email and raise a dispute. Settlement is blocked while the window is open or any dispute is unresolved. If fraud is proven after payout, finance reverses it (scenario E). |
| Organizer | Cancel after ending, to stop winners being paid | Refused: only finance can cancel a completed competition |
| Organizer | Never click End after the end date | Finance queue shows **Past end date · not ended**; finance clicks **End on organizer's behalf** (or force-cancels to refund) |
| Organizer | Change the prize amount or entry fee after publishing | Refused by the edit endpoint |
| Captain | Keep the whole team prize | Not possible: each team prize is split equally between its players |
| Finance moderator | Settle, hold, cancel or reverse a competition they play in or organize | Refused: "Conflict of interest… Another finance moderator must handle it" |

To test the finance conflict rule: `priya_dual` registers a team in a competition, then `superadmin1` → Admins → **Add Administrator** → `priya_dual`, **Finance Moderator**. Log in as `priya_dual` again and try **Approve & release payouts** (or Place hold) on that competition: refused with *Conflict of interest*. `fin_ravi` can still do it.

## Checking the database directly (optional)

```sql
select name, "paymentStatus", "prizePoolPaid" from competitions where "paymentStatus" <> 'LEGACY';
select type, direction, "amountMinor"/100.0 as rupees, status, "userUsername" from payment_transactions order by "createdAt";
select c.name, e.* from escrow_accounts e join competitions c on c.id = e."competitionId";
select username, "organizerTrustScore" from users where username in ('org_arjun','cap_meera','cap_kabir','cap_zoya','player_dev','priya_dual');
select "actionType", "adminUsername", details from admin_activity_logs order by "createdAt" desc limit 20;
```

After a settlement or full refund, every competition's escrow `balanceMinor` must be 0. A cancelled competition with players keeps the prize pool balance as HELD until finance compensates the players.
