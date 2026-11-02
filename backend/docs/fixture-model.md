# Single-elimination fixtures

The registered eligible teams determine the bracket size. Generation requires at least two teams. Seeds are unique and strongest-first. Without an explicit seed order, registration order is used; organizers can reorder seeds under **Teams → Tournament seeding** before play starts. The saved opening slots preserve seeds across reloads.

For `N` teams, `B = 2 ** ceil(log2(N))`. The database stores all `B - 1` positions over `log2(B)` rounds. Mirrored seeding separates stronger seeds and awards `B - N` byes to the strongest seeds. There are `N - 1` played matches. A bye has an automatic winner, no scheduled time, no score.

Each match's `bracket` JSON stores:

- `version`, `bracketSize`, `roundCount`, numeric `round` and `position`.
- Two `slots`, each containing its team, seed, optional source match, and bye flag.
- `nextMatchId` and `nextSlot` (1 or 2); both are null for the final.

Round labels are derived from the bracket size and round. The UI orders columns and cards by the stored numeric values and draws connectors to the stored destination IDs. Names, dates, and score order never determine progression.

States: `bye` advances automatically; `pending` awaits a participant; `ready` has both participants; `completed` has a verified played result. Scheduled dates are separate from readiness. Saving a result fills exactly one destination slot. The destination becomes ready only when both slots contain teams. The terminal position's winner is champion. Competition-scoped PostgreSQL locks serialize fixture writes.

`POST /matches/competition/:id/generate-schedule` and `complete-bracket` accept optional `seedOrder: [teamId, ...]`. The order must contain every eligible team exactly once. A started bracket cannot be reseeded. Compatible unplayed legacy fixtures are upgraded while retaining their IDs and dates; incompatible or started legacy structures are rejected without modifying results.

After an initial bracket exists, successful team registration automatically rebuilds an unstarted single-elimination bracket. Existing seeds retain their order and the new team receives the next seed. The bracket expands to the next power of two when required, recalculates its byes and destinations, and saves the complete structure before the registration request returns. Registration checks the bracket before writing the team; live or completed play locks the roster. No page visit or organizer button is required.

## Match results

Enter one final score per team. Match scoring is independent of bracket generation; there are no question-round inputs or totals to calculate.

`PATCH /matches/:id/result` accepts `score` (for example `20-10`), `winnerId`, and `winnerName`. Scores must be non-negative whole numbers. The winner must be the higher-scoring participant. Tied knockout scores require the host's offline winner choice, recorded through the same winner fields. League draws use empty winner fields. Saving advances the winner through the stored bracket destination.

Existing unplayed fixtures accept this same result format regardless of their previous result rule. Previously recorded scores and history are preserved.

Run `npm test` in backend and frontend, then `npm run build` in both. Backend migrations add the bracket metadata, reserved duration, result rule, and result details columns on startup.
