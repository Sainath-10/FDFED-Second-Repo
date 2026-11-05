# NEXUS ESPORTS — Competition Management System

A full-stack esports competition management platform. Users register and sign in, team leads
create and manage teams, organizers run competitions and matches, and administrators handle
disputes, platform policies, revenue, and users.

The repository contains two independent applications:

| App | Stack | Location | Default URL |
| --- | --- | --- | --- |
| Backend API | NestJS 10 + TypeORM + PostgreSQL | `backend/` | http://localhost:3000 |
| Frontend | Static HTML/CSS/vanilla JS | `frontend/` | http://localhost:8080 |

There is **no root `package.json`**. Each app is run separately.

---

## Default Test Accounts

Eight accounts are seeded, **all with the password `nexus`**. They exist in both places the app can
authenticate against, so login works whether or not the backend is reachable:

| Username | Email | Role | Lands on |
|---|---|---|---|
| `superadmin1` | superadmin1@nexus.gg | super-admin | /pages/super-admin/super-dashboard.html |
| `superadmin2` | superadmin2@nexus.gg | super-admin | /pages/super-admin/super-dashboard.html |
| `compadmin` | compadmin@nexus.gg | comp_admin | /pages/admin/dashboard.html |
| `revenueadmin` | revenueadmin@nexus.gg | revenue_admin | /pages/admin/revenue-transactions.html |
| `disputeadmin` | disputeadmin@nexus.gg | dispute_admin | /pages/admin/disputes.html |
| `regular1` | regular1@nexus.gg | participant | /pages/profile.html |
| `regular2` | regular2@nexus.gg | participant | /pages/profile.html |
| `regular3` | regular3@nexus.gg | participant | /pages/profile.html |

Seeded in:
- `backend/src/modules/auth/repositories/user.repository.ts` -> `seedDemoAccounts()` (runs on boot
  via the seeder; creates the rows in PostgreSQL with a bcrypt hash of `nexus`).
- `frontend/src/vendor/auth-accounts.js` (`window.NEXUS_DEMO_ACCOUNTS`) and
  `frontend/src/services/auth.js` (`DEMO_ACCOUNTS`) -> the offline/local fallback login.

Notes: sign-in accepts either the username or the email (`authenticate` matches both). Seeding is
idempotent and only sets a password when an account has none, so admin-changed passwords survive
restarts. Accounts created by the previous seed (`regular@nexus.gg`, `admin@nexus.gg`,
`dispute_admin@nexus.gg`, `revenue_admin@nexus.gg`, `superadmin@nexus.gg`) are not removed from an
existing database — delete those rows (or clear `users`) for a clean roster.

## Super Admin "Add Administrator" fix

Bug: creating an admin from the Super Admin area failed. `POST /auth/add-admin` looked the user up
and threw `400 "Username not present"` when the account did not exist — even though the endpoint's
own Swagger summary reads *"Add or elevate an administrator with specified adminType"*. Only
elevation of a pre-existing account worked.

Fix (backend, `auth.service.ts addAdmin`): it now does what it documents — when the account does not
exist it is created (`createWithPassword`) with the requested admin role and the supplied password
(default `nexus`); otherwise the existing account is elevated as before, still rejecting users who
are already admins. A create-then-register workaround was rejected because `/auth/register` enforces
`MinLength(6)` and `nexus` is 5 characters.

Fix (frontend, `pages/AddAdmin.jsx`): accepts a username **or** email (derives `@nexus.gg` when
needed), adds a password field defaulting to `nexus`, keeps the local accounts cache in sync with
the real password instead of the old hardcoded `admin123`, and surfaces the backend message verbatim
(including "User is already an admin") plus a clear message when the backend is unreachable.

Verification: frontend build PASS (236 modules); all 8 account names + the `nexus` password are in
the built bundle; 67/67 routes serve 200. The backend could not be compiled in this environment
(no `backend/node_modules`), so the two backend files are type-consistent but not compiler-checked —
run `npm install && npm run build` in `backend/` (or just start it) to confirm and to trigger seeding.

## Post-Migration Cleanup

### Redundant React Components

Reviewed: every `*.jsx`/`*.js` module under `src/` (69 page components + components/lib/services/hooks).
Suspected duplicates from the brief were checked against the *current* app, not their deleted
legacy originals: `AdminCompetitionDetail2`, `AdminDisputeReview2`, `AdminEditCompetition2`,
`AdminManageMatches2`, `AdminManageTeams2`, `AdminMatchResults2`, `PolicyManagement`,
`CompReports`, `DisputeEscalation`. `EscalateSuperAdmin` / `FixResolve` / `ResolveDisputes`
were also searched for — no such React components exist (their legacy pages were removed
before porting), so there was nothing to delete for them.

Deleted: **none**.

Kept: all of them, because the deletion checklist failed on its first condition for every
candidate.

Reason (evidence per candidate):
- The six `*2` admin pages are **actively imported** in `src/pages/registry.js` and **actively
  routed** in `src/routes.js` (`/pages/admin/{competition-detail,dispute-review,edit-competition,
  manage-matches,manage-teams,match-results}2.html`, all `ADMIN_ROLES`). They are reachable by
  URL and cross-link each other as a tab group. Their content is *not* the same as the non-`2`
  counterparts: the `2` pages are static "Spring Invitational" showcase variants, while the
  non-`2` pages load live competition data by `?id=`.
- Reachability parity verified against git (deleted legacy files): in the legacy app those six
  pages were also linked **only from within the `2` group** (6/2/3/6/6/6 referencing files), so
  the current wiring matches legacy exactly.
- `PolicyManagement` (routed + 9 inbound links), `DisputeEscalation` (routed + 2 links) are
  clearly active. `CompReports` is routed and has 0 component links — verified identical to the
  legacy app (legacy `comp-reports.html` also had 0 inbound links), so this is parity, not dead code.
- A whole-repo import graph check found **0 orphan modules** (every `src` module is referenced).

### Scroll Restoration

Status: FIXED

Implementation: a single central `src/components/ScrollToTop.jsx` rendered once inside
`<BrowserRouter>` in `src/App.jsx` (before `<Routes>`). It reads `useLocation()` +
`useNavigationType()` and calls `window.scrollTo(0, 0)` when `pathname`/`search` change, and
deliberately **skips** `POP` (browser back/forward) so the browser's own history scroll
restoration is preserved. No per-page scroll handlers were added.

### Layout Width Issue

Status: FIXED

Root Cause: the fixed sidebar offset was applied **twice** on several pages. `styles.css` sets
the canonical offset once — `.page-with-sidebar { padding-left: calc(var(--sidebar-w) + 20px) }`
(`--sidebar-w: 83px` → 103px) — but five page stylesheets *additionally* reserved a second
sidebar width, so the content started ~186–246px from the left against an 83px sidebar, leaving
a large dead gap and a visibly narrower content column:
- `pages/about.css` → `.page-with-sidebar { margin-left: calc(var(--sidebar-w) + 60px) }` (+143px → 246px)
- `pages/comp-participant.css` → `.page-with-sidebar { margin-left: var(--sidebar-w, 83px) }` (+83px → 186px)
- `pages/subpage.css` → `.sub-main { margin-left: 100px }` (+100px → 203px) — 6 pages
- `pages/competition-detail.css` → `.comp-main { margin-left: 100px }` → 203px
- `pages/edit-competition.css` → `.edit-main { margin-left: 100px }` → 203px
- plus `#footer-mount { margin-left: 100px; width: calc(100% - 100px) }` in the last three, which
  stacked on the global `.page-with-sidebar #footer-mount { padding-left: 103px }`.
A related case: `pages/admin/users.css` page used `.sa-main-v2`'s default `margin-left: 260px`
(meant for the retired wide `.sa-sidebar-v2` shell) against the 83px classic sidebar → a 177px gap.

Diagnosis note: these offsets are **byte-identical to the legacy CSS** and the legacy markup used
`.page-with-sidebar` on the same 54 pages, so this is a pre-existing design defect faithfully
carried over by the migration — not a regression introduced by the port.

Fix: removed the duplicated offsets so exactly one authoritative offset applies, and left each
page's own layout (max-widths, padding, grid) untouched:
- dropped `margin-left` from `.page-with-sidebar` in `about.css` and `comp-participant.css`
- dropped `margin-left: 100px` from `.sub-main` / `.comp-main` / `.edit-main`
- replaced the duplicated `#footer-mount { margin-left: 100px; width: calc(100% - 100px) }` in
  `subpage.css` / `competition-detail.css` / `edit-competition.css` with `width: 100%` (the global
  `.page-with-sidebar #footer-mount` rule now supplies the single offset)
- aligned `admin/users` with the real sidebar: `.sa-main-v2 { margin-left: calc(var(--sidebar-w) + 20px) }`
No colours, typography, component hierarchy, spacing or responsive rules were changed; the
`@media (max-width: 1100px)` resets were left in place (they are now no-ops).

### Source Comment Cleanup (production code)

Status: COMPLETE — 0 migration/phase references left in application source.

Removed from every `*.js`, `*.jsx` and `*.css` under `src/` (plus `vite.config.js`):
`(Phase N)` markers, "Phase 3/4/5 of the migration", "React port of …", "Faithful port of …",
"Port of pages/…", "interim bridge", "deferred to a phase", "old frontend", "previous frontend",
"legacy" prose, and the `Phase 15 NOTE` / `React Migration Status` blocks. Two migration-era
identifiers in `services/api.js` were renamed for consistency: `LEGACY_SESSION_KEY` ->
`SESSION_KEY`, `getLegacySession` -> `getStoredSession` (behaviour unchanged).

Deliberately preserved: behavioural documentation that is still meaningful (contract notes,
same-observable-behaviour explanations, why a module is executed as-is), and `project.md`, which
intentionally keeps the full migration record.

Method note: the first scripted pass was too aggressive (it stripped comment terminators and
truncated sentences) and was rolled back from a pre-cleanup backup; the final pass used explicit
UTF-8 I/O (PowerShell 5.1 otherwise reads non-BOM files as Windows-1252, which is also why the
first attempt failed to match any non-ASCII pattern) with exact string replacements and no line
deletion.

### Asset Audit and Favicon

Status: FIXED (one real defect found; the rest of the pipeline verified working).

Audit results:
- 54 files in `src/assets/`: **all 54 resolve** via `assetUrl()` — 23 are emitted as files
  (each HTTP **200 with content**, `image/png`) and 31 are inlined by Vite as `data:` URIs
  because they are under the 4 kB `assetsInlineLimit`. Both forms are valid image URLs.
- Every `<img>` in the app is produced by `assetUrl(...)`, a direct import, `URL.createObjectURL`
  or a `FileReader` data URL; **0 raw/hardcoded asset paths**; **0 referenced-but-missing assets**.
- Emitted image content-hashes are unchanged from the previous build, so no image changed.
- **The one real defect: no favicon** — the browser requested `/favicon.ico` and got a **404**
  (the legacy site had none either). Fixed by adding `public/favicon.png` (the brand mark, copied
  byte-identically from `src/assets/`) and a `<link rel="icon">` in `index.html` -> now **200**.

No path hacks, no assets deleted, no mock data introduced.

### Watch Live Page

Status: FIXED — rebuilt presentation, same data and behaviour.

What was wrong: the page was a flat featured image plus an unstyled grid; its CSS referenced a
`@keyframes pulse` animation that **did not exist anywhere**, and it defined a **global**
`.main-content { padding: … 100px }` that leaked to every page (see below). There was no
match/score presentation and no explicit state for the fact that no stream source exists.

Changes (`pages/WatchLive.jsx`, `styles/pages/watch-live.css`):
- Clear hierarchy: header (title + live count) -> player -> match bar -> "All Live Streams" ->
  "Coming Up".
- The player is now a real `<button>` (keyboard accessible) with LIVE + viewer badges, a play
  affordance and a caption overlay; the match bar below shows Team A / VS / Team B plus a
  Status / Viewers / Elapsed / Stage stat row.
- Same data and the same `showToast('Opening stream...')` behaviour on every card; stream data was
  only *refined* (the existing title split into `home`/`away` + `stage`) — nothing was invented.
- Because there is no real stream URL, an explicit line states that no embedded player is
  available rather than faking one.
- The stylesheet is now scoped to `.watch-live-page` (no global selectors), adds the missing
  `@keyframes wlPulse`, and is responsive (3 -> 2 -> 1 column grid, stacking match bar, 2-column
  stats, reduced-motion support). It reuses the existing design tokens only.

### Layout Follow-up: global `.main-content` padding leak

Status: FIXED (this was the dominant cause of the app-wide right-side squeeze).

Root cause: **23 page stylesheets** each set a *global* `.main-content { padding: 40px 60px 80px
100px }`. Because Vite bundles all imported CSS together, that 100px left padding applied to every
page and stacked on top of `.page-with-sidebar`'s own 103px offset -> **203px total**. Additionally
`team-settings.css` leaked `.main-content { max-width: 1200px; margin: 0 auto }`, centring and
narrowing every page's content.

Fix: removed the left (4th) padding value from all 23 rules so the sidebar offset comes solely
from `.page-with-sidebar`, and dropped the leaking `max-width` / `margin: 0 auto` from the Team
Settings rule. Verified in the built CSS: **0** remaining `padding: 40px 60px 80px 100px`; the
only two surviving `max-width: 1200px` declarations are page-scoped and intentional
(`.search-inner`, `.create-team-page`).

### Verification

```text
Build:              PASS  (236 modules — +1 for ScrollToTop; entry dist/index.html)
Broken Imports:     0      (whole-repo relative-import resolution check)
Broken Routes:      0      (route coverage 67/67 — 0 missing, 0 extra)
Routes Serve:       67/67  (200 + #root on the built SPA)
Scroll Navigation:  PASS   (static: ScrollToTop mounted inside BrowserRouter; scrollTo +
                            navigation-type logic present in the bundle)
Layout:             PASS   (built CSS verified: `.sub-main`/`.comp-main`/`.edit-main` no longer
                            carry margin-left; `calc(var(--sidebar-w) + 60px)` is gone; the single
                            `.page-with-sidebar { padding-left: calc(var(--sidebar-w) + 20px) }`
                            offset remains; all 7 remaining `#footer-mount{margin-left:…}` rules are
                            media resets, inert `.super-admin-body` rules, or the intentional
                            `.super-admin-classic-shell` 110px rule)
Backend:            UNCHANGED  (`git status -- backend` empty)
```

Not completed / caveats:
- No live browser click-through was possible: `agent-browser` is not installed in this environment
  (the skill requires `npm i -g agent-browser && agent-browser install`; a global install plus a
  browser download is a system change I did not make unilaterally). Scroll restoration and the
  layout fix were therefore verified statically (code wiring + built-output inspection) plus the
  67-route HTTP sweep rather than by measuring rendered geometry. Install agent-browser to get a
  pixel-level confirmation.
- Known cosmetic divergence left unfixed (out of scope for the reported symptom): the
  super-admin-family and `admin/users` footers are full-width because React never sets the legacy
  `super-admin-body` body class, so `.super-admin-body #footer-mount { margin-left: 100px }` is
  inert. This affects footer alignment only, not page content.

---

## Old vs React Parity Verification

Status: **COMPLETE** — performed before any deletion (VERIFY FIRST → DELETE SECOND).

Method: scripted inventory of the legacy frontend (`pages/**/*.html`, `js/**/*.js`,
`css/**/*.css`, `assets/*`) diffed against `src/routes.js`, `src/pages/registry.js`,
`src/services/*` and every `import` statement under `src/`.

```text
Pages Verified:                 67 / 67   (index + 66 pages, each has a registry component)
JavaScript Logic Verified:      68 / 68   (3 bridged + 65 ported into components or chrome-only)
API Integrations Verified:      17 / 17   (endpoints in js/api.js vs src/services/api.js — exact match)
Links Verified:                 46 / 47   (46 distinct targets -> React routes; 1 legacy-only quirk)
Routes Verified:                67 / 67   (registry keys 67 = routes.js 67, 0 missing / 0 extra)
Roles Verified:                  7 / 7    (participant, team_lead + 5 admin roles vs 9 legacy guards)
Forms Verified:                 67 / 67   (all pages render; forms/submits ported or bridged)
Assets Verified:                54 / 54   (all retained; src/lib/assets.js globs assets/*)
Uploads Verified:                3 / 3    (create-competition banner, edit-competition banner, submit-report evidence)
CSS Verified:                   51 / 51   (every legacy stylesheet is imported by a component; styles.css once in main.jsx)
localStorage/Session Verified:  14 / 14   (all legacy keys preserved; +1 new)
Build:                          PASS      (235 modules)
Runtime:                        PASS      (all 67 routes serve the React app: 200 + #root)
```

Evidence highlights:
- **Link audit**: every internal `.html` target in the legacy HTML *and* JS maps to a
  React route (0 gaps). The single exception is `pages/profile.html` written without a
  `base` in `js/script.js`'s logged-out topbar — already broken in the legacy app itself
  when rendered from a subpage; the React sidebar links correctly to `/pages/profile.html`.
- **API audit**: 17 legacy endpoints, 17 React endpoints, **0 lost, 0 added** — the backend
  contract is unchanged (no backend edits).
- **Auth audit**: `src/services/auth.js` is a superset of `js/auth.js` (adds `login`,
  `createAccount`, `isAuthenticated`); `nexus.auth.token|user|account|session|accounts`
  all preserved.
- **Role audit**: 9 legacy pages had blocking `window.location.replace(...)` guards; each
  maps to a role-restricted route (39 `RoleGuard` usages in `src/routes.js`), so no role
  gains or loses access.
- **Pagination audit**: the 4 legacy paginated pages (comp-manage-matches, comp-manage-teams,
  comp-match-results, admin/revenue-transactions) all have React counterparts with pagination.

Known Differences (deliberate, documented):
- `js/pages/competitions-data.js`, `js/pages/team/team-workflow.js` and
  `js/data/auth-accounts.js` are **bridged** (imported as-is) rather than rewritten, so their
  behaviour is identical by construction. They therefore still live under `frontend/js/`.
- The entire `frontend/css/` tree and `frontend/assets/` are still consumed by the React app.
- Super-admin/profile pages that shipped their own hard-coded sidebar/footer now use the
  shared `AppLayout` chrome (avoids a duplicated sidebar).
- `frontend/index.html` is retained: Vite builds only `app.html`, and the entry rename is the
  planned Phase 15 step.

Known Issues:
- `frontend/serve.js` (the legacy static server) was a no-op once pages/ was removed; it and its
  `serve:legacy` npm script were deleted in Phase 15.

Safe To Delete Old Frontend: **YES — completed in Phase 15**
The report below captured the state during the parity phase (only the unreferenced files had been
removed at that point). Phases 14–15 then migrated the CSS, images and bridges into src/ and removed
the legacy tree, so `frontend/` now holds only src/, public/, index.html, package.json,
package-lock.json, vite.config.js, .env.example and .vscode/.

```text
DELETED (proven unreferenced):   131 files
  pages/**/*.html                 66   (shadowed by the SPA fallback; nothing imports HTML)
  js/**/*.js (orphans)            65   (not imported anywhere under src/)

KEPT (still referenced — deleting breaks npm run build):  109 files
  css/**/*.css                    51   (every one imported by a component)
  js/data/auth-accounts.js         1   (imported by AdminUsers + SuperUsers)
  js/pages/competitions-data.js    1   (bridged by src/services/data.js)
  js/pages/team/team-workflow.js   1   (bridged by src/services/teamWorkflow.js)
  assets/*                        54   (globs by src/lib/assets.js)
  frontend/index.html              1   (legacy landing; Phase 15 entry rename)
```

Verification AFTER deletion:
```text
npm run build              PASS  (235 modules, unchanged)
All 67 routes              PASS  (200 + #root, served by the SPA fallback with no HTML files present)
Dangling imports           PASS  (0 broken relative imports across the repo)
```

Conclusion: **a complete removal of the legacy frontend is NOT yet safe.** Remaining blockers
are the 3 bridged JS modules and the `css/` + `assets/` trees that React imports. Phase 15
must therefore first inline the bridge into `src/`, then migrate `css/` into `src/`, and only
then drop `frontend/js/`, `frontend/css/`, `frontend/assets/` and rename `app.html` ->
`index.html`.

---

## React Migration Status
```text
Current Phase: 16 — Regression   (MASTER PROMPT phase numbering)
Status: COMPLETE — the React migration is finished and the legacy static frontend is gone

Completed (Phase 13):
- Migrated 51 CSS files into the React source tree (frontend/css/** -> frontend/src/styles/**)
- Updated React CSS imports (67 import sites; src/ no longer references frontend/css/)
- Preserved CSS behaviour: all 51 files copied byte-identical (51/51 verified, 0 byte diffs)
  and the built CSS bundle is content-hash identical to the pre-migration build
- Verified asset references: CSS contains no local asset paths (only Google-Fonts @imports
  and inline data: URIs), so no path rewrites were required
- Non-ASCII repair: the bulk import rewrite initially mojibaked non-ASCII characters
  (Windows-1252 read / UTF-8 write) in the 67 rewritten files; all 67 were repaired and a
  repo-wide scan confirms zero residual mojibake

Build:  PASS (235 modules; dist/assets/app-DMWao7gq.css 242.14 kB — unchanged hash)
Runtime: PASS (all 67 routes 200 + #root; 12/12 probe selectors from the migrated
                stylesheets present in the served CSS bundle; 0 local ../assets refs in CSS)

Legacy CSS References: 0   (no React dependency on frontend/css/ any more)
Legacy CSS Directory:  KEPT (51 files) — SAFE TO REMOVE once Phase 15 lands; not deleted here

Known Issues:
- frontend/css/ is now a duplicate of src/styles/ and is retained deliberately this phase.
- src/styles/pages/team-lead-dashboard.css keeps its internal `Path: css/pages/...` comment
  (CSS content is preserved byte-identical on purpose).
- src/index.css (a 17-line Phase-13 base-reset placeholder) stays in src/ and is unrelated to
  the 51 migrated stylesheets; it is imported before src/styles/styles.css to keep cascade order.

Completed (Phase 14 — Asset Migration):
- Copied all 54 assets byte-identically from frontend/assets/ -> frontend/src/assets/ (54/54
  verified, 0 byte diffs); no asset was lost or altered
- Repointed the 4 reference sites: the `import.meta.glob('../assets/*.{…}')` in src/lib/assets.js
  plus the 3 direct Nexus-logo imports in components/Sidebar.jsx, components/SiteFooter.jsx and
  pages/auth/AuthCard.jsx
- Correctness check: all 11 assets named anywhere in code are emitted by the build; the other 43
  are unreferenced legacy leftovers that are still retained on disk (nothing deleted)
- Emitted image filenames/content-hashes are unchanged (e.g. logo-Cs4pfwh4.png), and every
  image, the CSS bundle and the JS bundle serve 200

Completed (Phase 15 — Remove obsolete static frontend):
- Relocated the three bridged modules byte-identically into src/vendor/ — competitions-data.js
  (60,708 B), team-workflow.js (44,445 B), auth-accounts.js (421 B) — and repointed the 4 import
  sites (src/services/data.js, src/services/teamWorkflow.js, pages/AdminUsers.jsx,
  pages/SuperUsers.jsx). Behaviour is unchanged: the modules are still executed as-is
- Renamed the entry `app.html` -> `index.html` and updated vite.config.js (`APP_ENTRY`,
  `build.rollupOptions.input`, `server.open`)
- Removed frontend/css/, frontend/js/, frontend/assets/, frontend/index.html (legacy landing)
  and frontend/serve.js, plus the now-dead `serve:legacy` script in package.json
- Guarded deletion: a pre-delete scan confirmed 0 real import specifiers and 0 CSS `url()`
  references pointed outside src/ before anything was removed

Completed (Phase 16 — Full regression):
- `npm run build`: PASS (235 modules; entry dist/index.html; CSS chunk index-DMWao7gQ.css
  content-hash identical to the pre-migration build)
- Runtime: 67/67 routes → 200 + `#root`; `/` and `/index.html` both serve the app; the old
  `/app.html` is no longer served; asset/CSS/JS bundles all 200
- Route coverage 67/67 (0 missing, 0 extra); dangling relative imports: 0
- Bundled bundle markers confirm the bridged modules survived the move: nexus_competitions,
  nexus_policies, NexusData, NexusTeamWorkflow, NEXUS_DEMO_ACCOUNTS
- All 8 legacy localStorage/sessionStorage keys still present in the bundle
- Backend untouched: `git status -- backend` is empty

Phase map (master prompt):
- Phase 0  Audit ........................ DONE
- Phase 1  Safe unused-file cleanup ...... DONE (8 files deleted; assets retained)
- Phase 2  React/Vite foundation ......... DONE (entry: app.html; config: vite.config.js)
- Phase 3  API client ................... DONE
- Phase 4  Authentication ............... DONE
- Phase 5  Routing + protected routes ... DONE
- Phase 6  Shared components ............ DONE (layout/sidebar/footer/icons/toast)
- Phase 7  Auth / public pages .......... DONE (login, signup, index, about, competitions,
                                          comp-info, competition-detail, view-team, watch-live)
- Phase 8  Participant + team features .. DONE (notifications, create-team, join-teams,
                                          competitions-participated, profile, my-activity, team/*)
- Phase 9  Competition + organizer ...... DONE (11 pages)
- Phase 10 Disputes ..................... DONE (3 pages)
- Phase 11 Admin ........................ DONE (21 pages)
- Phase 12 Super admin .................. DONE (10 pages + team-lead dashboard)
- Phase 13 CSS migration ................ DONE (51 stylesheets -> src/styles/; 0 legacy refs)
- Phase 14 Asset migration .............. DONE (54 assets -> src/assets/; 4 ref sites repointed)
- Phase 15 Remove old static frontend ... DONE (bridges -> src/vendor/; app.html -> index.html;
                                          css/js/assets/serve.js + legacy index.html removed)
- Phase 16 Regression test .............. DONE (build + 67/67 routes + coverage + bundle audit)

Completed:
- Phase 0 audit; Phase 1 deletion of 8 files (assets retained, not deleted)
- React 18 + Vite 5 scaffolded under frontend/ (package.json, package-lock.json,
  vite.config.js (originally .mjs), app.html, src/**, public/**)
- src/ skeleton: components, layouts, pages/{auth,admin,super-admin,team},
  services, context, hooks, utils, assets
- npm install: OK (63 packages)
- npm run build: PASS (exit 0, no warnings) → dist/app.html + hashed CSS/JS
- Built SPA served at :4173/app.html = 200; legacy serve.js still 200 at :8080
- Frontend dispute-model cleanup (frontend-only): deleted the Super Admin dispute page +
  the orphan escalation page (6 files), removed 2 Super Admin nav links, rewired the
  organizer escalation text from "Super Admin" to "Dispute Admin"
- Phase 3: frontend/js/api.js ported to frontend/src/services/api.js (ES module),
  preserving all 8 namespaces, 43 methods, 50 endpoints and 8 storage helpers, plus
  headers, response/error shapes and localStorage keys
- API base URL configurable via VITE_API_URL (fallback = the legacy http://localhost:3001)
- frontend/.env.example added; the service is wired into App.jsx so the build bundles it
- Phase 4: frontend/js/auth.js ported to frontend/src/services/auth.js, plus a React provider
  at frontend/src/context/AuthContext.jsx (useAuth hook). Preserves accounts, session keys,
  login/signup/logout, the offline localStorage fallback, role normalization and role-redirect
  resolution. Navigation is returned (redirectPath) instead of performed via window.location so
  the router owns it in Phase 5 — same observable behaviour, and existing sessions stay valid
- Phase 5: react-router-dom v6 added. frontend/src/routes.js is the single route table — all 66
  legacy pages plus '/' (index.html) mapped 1:1, paths kept in the legacy .html form so deep
  links and query params (?id=, ?compId=, ?teamId=, ?admin=, ?redirect=) are preserved.
  Guards: ProtectedRoute.jsx (session required; decision delegated to requireProfileAccess)
  and RoleGuard.jsx (array-capable role check; mismatched role -> its own home). team-lead (1),
  admin (21) and super-admin (10) routes are role-restricted; other signed-in areas are
  auth-only. App.jsx now renders BrowserRouter + Routes; each route renders RoutePlaceholder
  until its page is ported. Added a NotFound (404) route and an /index.html -> / redirect.
- Phase 5: vite.config.js gains a narrow SPA fallback (appType 'mpa' + middleware) so '/',
  '/index.html' and '/pages/**' are served by app.html in dev and preview (deep links + refresh
  work); Vite's own module/asset requests are left untouched.
- Phase 6: shared chrome ported. frontend/src/components/icons.jsx (sidebar SVGs),
  frontend/src/config/nav.js (role-based nav — main / team-lead / per-admin-type / super-admin,
  faithful to getSidebar / getAdminSidebar / getSuperAdminSidebar), components/Sidebar.jsx
  (NavLink active state; adds the legacy super-admin-classic-shell body class),
  components/SiteFooter.jsx, and lib/toast.js (imperative showToast). layouts/AppLayout.jsx
  reproduces the legacy DOM contract (#sidebar-mount, .page-with-sidebar, #footer-mount) and
  now wraps every non-bare route.
- Phase 6: frontend/css/styles.css is imported in main.jsx so the shell is styled by the shared
  legacy CSS. Landing/login/signup render bare (no sidebar).
- Phase 7: login + signup ported to React. src/pages/auth/{Login,Signup,AuthCard}.jsx, auth
  chrome in src/layouts/AuthLayout.jsx (back header + footer, no sidebar), a page registry at
  src/pages/registry.js, and eye/eye-off icons. Same validation, role-based redirect via
  ROLE_ROUTES, revoked-admin notice (login), and createAccount + auto-login (signup). Per-page
  CSS (css/pages/login.css, signup.css) imported directly.
- Phase 7: deliberate change — the legacy signup page never redirected after its auto-login
  succeeded; the React page navigates to the role home (otherwise signup appeared to hang).
- Phase 7/8 shared prerequisite: src/services/data.js bridges the legacy competitions data layer
  (frontend/js/pages/competitions-data.js) so its localStorage behaviour is preserved exactly,
  re-exporting window.NexusData as an ES module. src/lib/assets.js resolves legacy image refs
  to emitted asset URLs (import.meta.glob). src/components/CompCard.jsx ports compCard;
  src/pages/Competitions.jsx ports competitions.html + competitions.js (instant local render,
  2s API refresh, badge/type filters, search, guest Join -> login).
- Phase 8 note: the ~1,500-line data layer is BRIDGED, not rewritten. A blind conversion with
  no runtime test harness would risk silent behaviour changes; the rewrite is deferred to a
  phase where it can be exercised at runtime.
- Phase 7 (public pages): ported pages/ViewTeam.jsx, pages/WatchLive.jsx, pages/About.jsx and
  pages/Index.jsx (landing). The landing keeps the auth-aware buttons/redirects, seeds the
  showcase competitions via NexusData.seedShowcaseCompetitions, and uses an AppLayout
  `offset={false}` variant (no .page-with-sidebar) to match its full-bleed hero.
- Phase 7 (cont.): ported pages/CompInfo.jsx — 5 tabs, computed standings, owner/team-aware CTA
  block, share link, raise-dispute modal with target routing, pending-approval banner.
- Phase 8 prerequisite: src/services/teamWorkflow.js bridges the legacy team workflow
  (frontend/js/pages/team/team-workflow.js) as an ES module (window.NexusTeamWorkflow), same
  approach as the data layer — unblocks the team pages and the comp-info CTA logic.
- Phase 7 (cont. 3): ported pages/CompetitionDetail.jsx — organizer view: hero + ended-aware
  actions, stats row, teams table with approve/reject, paginated match schedule,
  league/tournament bracket, organizers modal, ended-guard. The legacy dead `renderStandings`
  is not ported; the modal's add/remove endpoints were hardcoded to :3000 in the legacy file (kept).
- Phase 8 (participant, started): ported pages/CompetitionsParticipated.jsx (filter tabs via
  React state), pages/Notifications.jsx (status tabs + search + counts, accept/reject actions,
  mark-all-read) and pages/CreateTeam.jsx (name/tag, logo picker storing the SVG as the team
  avatar, invite link + copy, per-team checkout modal, 1.5s redirect to my-activity).
- Phase 8 (cont.): ported pages/JoinTeams.jsx — context header, create-team CTA, approved-team
  list with join states (Your Team / Full / In Another Team / Requested), pending requests,
  per-player checkout modal, ?teamId= direct join, ended lock.
- Phase 8 (cont. 3): ported the six team pages under src/pages/team/ (TeamRoster, AddPlayers,
  InvitePlayer, InvitationsSent, JoinRequests, TeamSettings) with a shared useTeamContext hook
  and a TeamTabs component (context-carrying tab links; permission + ended gating).
- Phase 8 (cont. 4): ported pages/Profile.jsx (header/bio, 5 tabs, live my-teams + upcoming
  matches, edit/email/password modals) and pages/MyActivity.jsx (organized/participated/team-lead
  buckets, per-role card clicks, search, background API refresh). Phase 8 complete.
- Phase 9 (started): ported pages/CompStandings.jsx (summary + computed standings with ±1
  customPoints adjusters) and pages/CompReports.jsx (report form -> shared dispute store).
- Phase 9 (cont.): ported pages/CompManageTeams.jsx (paginated team table, approve/reject row +
  bulk, ended lock) and pages/CompManageMatches.jsx (type-aware match scheduling, match table
  with ENTER RESULT links, ended lock).
- Phase 9 (cont. 3): ported pages/CompMatchResults.jsx (results table, start-live / enter-result,
  result modal, league standings rebuild) and pages/CompDisputeReview.jsx (organizer queue +
  detail with warn / resolve / escalate-to-admin).
- Phase 9 (cont. 4): ported pages/CompParticipant.jsx (hero/about + live My Team / Match Schedule
  / Standings with 3s polling, banned redirect, dispute modal), pages/CompManageOrganizers.jsx and
  pages/OrganizerRevenue.jsx (both legacy pages carried inline scripts, now React). The inline CSS
  of the latter two is rendered via a component <style> tag.
- Phase 9 (cont. 5): ported pages/CreateCompetition.jsx (full form: live summary, co-organizer
  rows, banner upload, the 10 QA validation rules, Super-Admin format/limit gating, platform-fee
  checkout modal, co-organizer invite notifications) and pages/EditCompetition.jsx (populate
  form, live status panel, save / end / delete). Phase 9 complete.
- Phase 10: ported pages/Disputes.jsx (filter tabs, the 4 static demo cards + dynamic disputes
  from the API / admin store, evidence modal), pages/SubmitReport.jsx (report form + evidence
  file list, the full dispute record + evidence metadata, API Disputes.create, ended-comp lock)
  and pages/DisputeEscalation.jsx (reference select, reason/summary, escalating the stored
  dispute, ended-comp lock). Phase 10 complete.
- Phase 11: ported all 21 admin pages — dashboard, users, admin-activity, admin-profile,
  revenue-config, revenue-transactions, manage-competition, disputes, competition-detail(+2),
  manage-teams(+2), manage-matches(+2), match-results(+2), view-standings, dispute-review(+2),
  edit-competition(+2). Added a `footerClassName` prop to AppLayout plus a BARE_PATHS set in
  App.jsx so super-admin-style pages (admin/users, .sa-main-v2) render full-bleed with a plain
  footer. manage-competition keeps its legacy inline CSS via a component <style> tag.
  Phase 11 complete.
- Phase 12: ported all 10 super-admin pages — super-dashboard, users, admins, add-admin,
  revoke-admin, policy-management, create-policy, edit-policy, view-policy, profile — plus the
  previously-missed pages/team-lead-dashboard.html (67th route). Added a shared policy store
  (src/lib/policies.js) and a shared PolicyEditor component; the *2/policy/profile pages that
  embedded their own sidebar/footer now use the shared AppLayout chrome (documented deviation).
  Also fixed the admin profile route key (`/pages/admin/admin-profile.html`, not `profile.html`).
  ALL 67 routes are now ported — 0 remain as RoutePlaceholder.
- Phase 13: migrated all 51 legacy stylesheets from frontend/css/** to frontend/src/styles/**
  (structure preserved: styles.css + pages/{admin,super-admin,team}/...). All 51 copied
  byte-identical; the 67 CSS import sites under src/ were rewritten to the new relative paths
  (longest-path-first so `../../css/` was not partially matched). No CSS rules, values, media
  queries, keyframes or variables were changed, and no asset paths needed rewriting because the
  CSS references only Google-Fonts @imports and inline data: URIs. frontend/css/ is retained
  unchanged for now (deleted in Phase 15).
- Phase 14: copied all 54 assets byte-identically from frontend/assets/ to frontend/src/assets/
  and repointed the 4 reference sites (src/lib/assets.js glob + the 3 direct logo imports).
  Nothing was deleted; emitted image hashes are unchanged.
- Phase 15: relocated the 3 bridged modules byte-identically to src/vendor/ (competitions-data.js,
  team-workflow.js, auth-accounts.js) and repointed the 4 import sites; renamed the entry
  app.html -> index.html (vite.config.js APP_ENTRY/input/server.open) and removed the legacy
  tree (frontend/css/, frontend/js/, frontend/assets/, frontend/index.html, frontend/serve.js)
  plus the dead `serve:legacy` npm script. A pre-delete scan proved 0 real imports/url() refs
  pointed outside src/ before removal.
- Phase 16: full regression — build PASS, 67/67 routes 200 + #root, coverage 67/67, 0 dangling
  imports, bridged modules + all 8 storage keys present in the bundle, backend untouched.
- Layout: AppLayout no longer wraps children in a <main> — each page supplies its own
  <main class="…">, matching the legacy DOM/CSS.

Reverted:
- The 42 asset deletions were restored. Assets must NOT be deleted (see Business Rules).

Files Changed:
- project.md (status block + "Business Rules" section)
- New (untracked): frontend/package.json, frontend/package-lock.json,
  frontend/vite.config.js, frontend/app.html, frontend/src/**, frontend/public/**
- Phase 3 (untracked): frontend/src/services/api.js, frontend/.env.example;
  modified frontend/src/App.jsx (imports the service and renders API_URL)
- Phase 4 (untracked): frontend/src/services/auth.js, frontend/src/context/AuthContext.jsx;
  modified frontend/src/App.jsx (wrapped in AuthProvider, renders session state)
- Phase 5 (untracked): frontend/src/routes.js; frontend/src/components/{ProtectedRoute,
  RoleGuard,RoutePlaceholder,NotFound}.jsx; rewrote frontend/src/App.jsx (BrowserRouter +
  Routes); modified frontend/vite.config.js (appType 'mpa' + SPA fallback) and
  frontend/package.json (added react-router-dom)
- Local dev: backend/.env created with PORT=3001 (git-ignored, not committed)
- Phase 6 (untracked): frontend/src/components/{icons,Sidebar,SiteFooter}.jsx,
  frontend/src/config/nav.js, frontend/src/layouts/AppLayout.jsx, frontend/src/lib/toast.js;
  modified frontend/src/App.jsx (wraps routes in AppLayout) and frontend/src/main.jsx
  (imports the legacy styles.css)
- Phase 7 (untracked): frontend/src/pages/auth/{Login,Signup,AuthCard}.jsx,
  frontend/src/layouts/AuthLayout.jsx, frontend/src/pages/registry.js; modified
  frontend/src/App.jsx (page registry + AuthLayout) and frontend/src/components/icons.jsx
  (eye/eye-off)
- Phase 7/8 (untracked): frontend/src/services/data.js, frontend/src/lib/assets.js,
  frontend/src/components/CompCard.jsx, frontend/src/pages/Competitions.jsx,
  frontend/src/pages/{ViewTeam,WatchLive,About,CompetitionsParticipated}.jsx; modified
  frontend/src/pages/registry.js, frontend/src/layouts/AppLayout.jsx; renamed
  frontend/vite.config.mjs -> frontend/vite.config.js
- Phase 7 (cont.): frontend/src/pages/Index.jsx; modified frontend/src/pages/registry.js,
  frontend/src/App.jsx (full-width route) and frontend/src/layouts/AppLayout.jsx (offset prop)
- Phase 7 (cont. 2): frontend/src/pages/CompInfo.jsx, frontend/src/services/teamWorkflow.js;
  modified frontend/src/pages/registry.js
- Phase 7 (cont. 3): frontend/src/pages/CompetitionDetail.jsx; modified
  frontend/src/pages/registry.js
- Phase 8 (cont.): frontend/src/pages/Notifications.jsx, frontend/src/pages/CreateTeam.jsx;
  modified frontend/src/pages/registry.js
- Phase 8 (cont. 2): frontend/src/pages/JoinTeams.jsx; modified frontend/src/pages/registry.js
- Phase 8 (cont. 3): frontend/src/pages/team/{TeamRoster,AddPlayers,InvitePlayer,InvitationsSent,
  JoinRequests,TeamSettings}.jsx, frontend/src/hooks/useTeamContext.js,
  frontend/src/components/TeamTabs.jsx; modified frontend/src/pages/registry.js
- Phase 8 (cont. 4): frontend/src/pages/Profile.jsx, frontend/src/pages/MyActivity.jsx;
  modified frontend/src/pages/registry.js
- Phase 9 (cont.): frontend/src/pages/CompStandings.jsx, frontend/src/pages/CompReports.jsx;
  modified frontend/src/pages/registry.js
- Phase 9 (cont. 2): frontend/src/pages/CompManageTeams.jsx,
  frontend/src/pages/CompManageMatches.jsx; modified frontend/src/pages/registry.js
- Phase 9 (cont. 3): frontend/src/pages/CompMatchResults.jsx,
  frontend/src/pages/CompDisputeReview.jsx; modified frontend/src/pages/registry.js
- Phase 9 (cont. 4): frontend/src/pages/CompParticipant.jsx,
  frontend/src/pages/CompManageOrganizers.jsx, frontend/src/pages/OrganizerRevenue.jsx;
  modified frontend/src/pages/registry.js
- Phase 9 (cont. 5): frontend/src/pages/CreateCompetition.jsx,
  frontend/src/pages/EditCompetition.jsx; modified frontend/src/pages/registry.js
- Phase 10: frontend/src/pages/Disputes.jsx, frontend/src/pages/SubmitReport.jsx,
  frontend/src/pages/DisputeEscalation.jsx; modified frontend/src/pages/registry.js
- Phase 11 (21 pages): frontend/src/pages/Admin{Dashboard,Users,Activity,Profile,RevenueConfig,
  RevenueTransactions,ManageCompetition,Disputes,CompetitionDetail,CompetitionDetail2,ManageTeams,
  ManageTeams2,ManageMatches,ManageMatches2,MatchResults,MatchResults2,ViewStandings,DisputeReview,
  DisputeReview2,EditCompetition,EditCompetition2}.jsx; modified frontend/src/pages/registry.js,
  frontend/src/layouts/AppLayout.jsx, frontend/src/App.jsx
- Phase 12 (11 pages + shared): frontend/src/pages/{SuperDashboard,SuperUsers,Admins,AddAdmin,
  RevokeAdmin,PolicyManagement,CreatePolicy,EditPolicy,ViewPolicy,SuperProfile,TeamLeadDashboard}.jsx;
  frontend/src/components/PolicyEditor.jsx; frontend/src/lib/policies.js; modified
  frontend/src/pages/registry.js, frontend/src/App.jsx
- Phase 13 (CSS migration): added frontend/src/styles/** (51 files copied byte-identical from
  frontend/css/**); modified the CSS import specifiers in frontend/src/main.jsx and 66 page
  components under frontend/src/pages/**; comment-only touch-ups in frontend/src/main.jsx and
  frontend/src/layouts/AuthLayout.jsx
- Phase 14 (asset migration): added frontend/src/assets/** (54 files copied byte-identical from
  frontend/assets/**); modified frontend/src/lib/assets.js and the logo imports in
  frontend/src/components/{Sidebar,SiteFooter}.jsx, frontend/src/pages/auth/AuthCard.jsx
- Phase 15 (legacy removal): added frontend/src/vendor/{competitions-data,team-workflow,
  auth-accounts}.js (byte-identical to the former frontend/js files); modified
  frontend/src/services/{data,teamWorkflow}.js, frontend/src/pages/{AdminUsers,SuperUsers}.jsx,
  frontend/vite.config.js, frontend/package.json; renamed frontend/app.html -> frontend/index.html

Files Deleted (14 total — 8 Phase 1 + 6 dispute cleanup):
- Phase 1 (8): js/pages/admin/policy-management.js, js/pages/super-admin/fix-resolve.js;
  CSS: admin/competition-detail2.css, admin/manage-matches2.css, admin/manage-teams2.css,
  admin/match-results2.css, admin/policy-management.css, super-admin/style.css
- Dispute cleanup (6): pages/super-admin/resolve-disputes.html,
  css/pages/super-admin/resolve-disputes.css, js/pages/super-admin/resolve-disputes.js,
  pages/admin/escalate-super-admin.html, css/pages/admin/escalate-super-admin.css,
  js/pages/admin/escalate-super-admin.js
- Parity-cleanup (131, after verification — proven unreferenced only):
  all 66 pages/**/*.html (shadowed by the SPA fallback) and 65 orphan js/**/*.js files.
  Kept (still imported by src/): css/** (51), assets/** (54), js/data/auth-accounts.js,
  js/pages/competitions-data.js, js/pages/team/team-workflow.js, frontend/index.html.
- Assets: 0 deleted (all 54 retained)
- Phase 14/15 legacy removal (after the parity + migration verification): frontend/css/ (51),
  frontend/js/ (3 bridging files relocated to src/vendor/, then the directory removed),
  frontend/assets/ (all 54 already copied to src/assets/), frontend/index.html (legacy landing)
  and frontend/serve.js. No asset content was lost — every image is preserved under src/assets/.

Files Remaining:
- None — all 16 phases are complete. The legacy static frontend no longer exists; `frontend/`
  contains only src/ (React + src/styles CSS + src/assets images + src/vendor bridges),
  public/, index.html (the React entry), package.json, package-lock.json, vite.config.js,
  .env.example and .vscode/
- Routes remaining: 0 (all 67 ported and served 200)
- Ported so far (67): login, signup, index (landing), about, competitions, comp-info,
  competition-detail, competitions-participated, notifications, create-team, join-teams,
  team/{team-roster,add-players,invite-player,invitations-sent,join-requests,team-settings},
  profile, my-activity, comp-standings, comp-reports, comp-manage-teams, comp-manage-matches,
  comp-match-results, comp-dispute-review, comp-participant, comp-manage-organizers,
  organizer-revenue, create-competition, edit-competition, view-team, watch-live, team-lead-dashboard,
  disputes, submit-report, dispute-escalation, all 21 admin/* and all 10 super-admin/* pages.
- Legacy static: 67 HTML (index + 66 pages), 68 JS, 51 CSS, 54 assets (all assets kept)

Known Issues:
- Backend still reflects the OLD dispute model in places — `escalate_to_admin` flow and the
  generic "Platform Admin" wording in the disputes controller/service. The frontend is already
  rewired to the Dispute Admin; the backend change was out of scope (see Business Rules).
- API port: RESOLVED for local dev — `backend/.env` sets `PORT=3001` (git-ignored), matching
  the React client's fallback. Override via `frontend/.env` (`VITE_API_URL`) if needed.
- Large part of the "data layer" is localStorage-backed (competitions-data.js)
- Route guards are coarse: most signed-in areas are auth-only; per-page role rules land with
  the pages themselves (Phases 7–13)
- Every migrated route renders a placeholder until its page is ported
- competition-detail's organizer add/remove calls hardcode :3000 (a legacy inconsistency). The
  legacy data layer also calls the revenue endpoints on a hardcoded :3001 rather than via
  VITE_API_URL — both preserved verbatim, flagged for the final cleanup pass.
- No test suite exists; no root build script

Verification:
- npm run build: PASS (exit 0, 235 modules; data layer + team-workflow + page CSS + assets bundled)
- Built SPA at http://localhost:4173/app.html → 200 (bundle + #root present)
- Legacy frontend: serve.js → 200 (still CommonJS; package.json has no "type":"module")
- Phase 5 route parity: 67 declared routes vs 67 legacy pages (index + 66 pages) → 0 missing,
  0 orphan (checked against the file tree)
- Phase 5 preview smoke test (vite preview): /app.html, /, /index.html, /pages/login.html,
  /pages/admin/dashboard.html, /pages/nope.html and a hashed asset all → 200; the body served
  for a page route is app.html (#root + bundle) — the SPA fallback works
- Phase 5 bundle check: key route strings (/pages/login.html, /pages/admin/dashboard.html,
  /pages/team-lead-dashboard.html, /pages/super-admin/super-dashboard.html, labels) present
- Phase 6 preview smoke test: /app.html, /, /pages/competitions.html, /pages/admin/dashboard.html,
  the CSS bundle and the emitted logo PNG all → 200; the CSS bundle contains
  .page-with-sidebar / .sidebar / .nav-item (legacy chrome CSS is applied)
- Phase 7 preview smoke test: /pages/login.html and /pages/signup.html → 200; the JS bundle
  contains the login/signup headings and the CSS bundle contains .auth-card / .auth-feedback
- Phase 8 preview smoke test: /pages/competitions.html, /pages/comp-info.html and
  /pages/join-teams.html → 200; the JS bundle contains the data layer (nexus_competitions,
  getCompetitionsForPublic) and the page heading; the CSS bundle contains .comp-card; an
  emitted card image resolves (200)
- Phase 9 preview smoke test: /pages/view-team.html, /pages/watch-live.html and
  /pages/competitions-participated.html → 200; the JS bundle contains the page headings and
  the CSS bundle contains .stream-card / .comp-participation-card / .team-header-row
- Phase 7 about smoke test: /pages/about.html → 200; the JS bundle contains the About
  headings/policies and the CSS bundle contains .section-purpose / .scope-card / .cta-btn
- Phase 7 landing smoke test: / and /index.html → 200 serving the React entry (#root); the JS
  bundle contains the hero/landing content and the CSS bundle contains
  .hero-fullscreen / .stats-bar / .live-grid
- Phase 7 comp-info smoke test: /pages/comp-info.html and ?id=world-championship-2026 → 200;
  the JS bundle contains the comp-info content + the team-workflow bridge and the CSS bundle
  contains .comp-info-hero / .tabs-nav / .standings-row
- Phase 7 competition-detail smoke test: /pages/competition-detail.html and
  ?id=spring-split-finals → 200; the JS bundle contains the page content and the CSS bundle
  contains .comp-hero / .comp-panel / .bracket-match
- Phase 8 notifications/create-team smoke test: /pages/notifications.html and
  /pages/create-team.html (+?id=world-championship-2026) → 200; the CSS bundle contains
  .notif-item / .create-team-container / .logo-option
- Phase 8 join-teams smoke test: /pages/join-teams.html (+?id=world-championship-2026) → 200;
  the CSS bundle contains .join-page / .request-card / .pending-requests-section
- Phase 8 team pages smoke test: all six /pages/team/*.html → 200; the CSS bundle contains
  .team-tabs-nav / .roster-grid / .invites-stack / .requests-stack / .logo-grid
- Phase 8 profile/my-activity smoke test: /pages/profile.html and /pages/my-activity.html → 200;
  the CSS bundle contains .profile-header / .act-comp-card / .stat-bar-fill
- Phase 9 standings/reports smoke test: /pages/comp-standings.html (+?id=) and
  /pages/comp-reports.html → 200; the CSS bundle contains .standings-row / .pts-adjuster /
  .report-form-grid
- Phase 9 manage-teams/matches smoke test: /pages/comp-manage-teams.html (+?id=) and
  /pages/comp-manage-matches.html → 200; the CSS bundle contains .teams-table-row /
  .schedule-form / .sub-pagination
- Phase 9 match-results/dispute-review smoke test: /pages/comp-match-results.html (+?id=) and
  /pages/comp-dispute-review.html → 200; the CSS bundle contains .results-table-header /
  .disputes-list-panel / .modal-overlay
- Phase 9 participant/organizers/revenue smoke test: /pages/comp-participant.html (+?id=),
  /pages/comp-manage-organizers.html and /pages/organizer-revenue.html → 200; the CSS bundle
  contains .part-hero / .my-team-card
- Phase 9 create/edit competition smoke test: /pages/create-competition.html and
  /pages/edit-competition.html (+?id=) → 200; the CSS bundle contains .create-layout /
  .prize-tiers / .edit-main / .edit-banner-preview
- Phase 10 dispute smoke test: /pages/disputes.html, /pages/submit-report.html (+?compId=) and
  /pages/dispute-escalation.html (+?id=) → 200; the CSS bundle contains .dispute-card /
  .filter-tab / .evidence-upload / .guidelines-list
- Phase 11 admin smoke test: all 21 /pages/admin/*.html routes → 200
- Phase 12 super-admin smoke test: all 10 /pages/super-admin/*.html (+?id=) → 200
- Phase 12 full-route sweep: ALL 67 routes in routes.js → 200; registry coverage 67/67
  (routes.js 67 vs registry keys 67 — 0 missing, 0 extra)
- Phase 13 CSS migration:
  * CSS files copied byte-identical: 51/51 (0 byte diffs, verified via raw-byte compare)
  * import sites rewritten: 67; references to `frontend/css/` from src/: 0
  * build: PASS (235 modules); CSS bundle `app-DMWao7gq.css` 242.14 kB == pre-migration hash
    (bundler output is content-addressed, so an identical hash proves no CSS/JS output change)
  * runtime: 67/67 routes 200 + #root; 12/12 probe selectors present in the served CSS
    (.page-with-sidebar, .dash-stats, .sa-main-v2, .profile-v2-page, .dispute-card, .team-hero,
     .roster-grid, .create-layout, .filter-tab, .hero-topbar, …)
  * CSS asset dependencies: 0 local paths (8 inline data: URIs + 3 Google-Fonts @imports)
  * non-ASCII integrity: 67 files repaired after the bulk rewrite; 0 residual mojibake in src/
- Phase 14 asset migration:
  * assets copied byte-identical: 54/54 (0 byte diffs)
  * reference sites repointed: 4; emitted image hashes unchanged (logo-Cs4pfwh4.png etc.)
  * correctness: 11/11 code-named assets emitted; images/CSS/JS all serve 200
- Phase 15 legacy removal:
  * bridged modules relocated byte-identical: 3/3 (competitions-data, team-workflow, auth-accounts)
  * pre-delete scan: 0 real import specifiers / url() refs outside src/
  * entry renamed app.html -> index.html; `serve:legacy` script removed with serve.js
  * `npm run build`: PASS (235 modules; dist/index.html; CSS content-hash unchanged)
  * runtime: 67/67 routes 200 + #root; `/` + `/index.html` serve the app; `/app.html` gone
- Phase 16 regression:
  * route coverage 67/67 (0 missing, 0 extra); dangling relative imports 0
  * bundle markers present: nexus_competitions, nexus_policies, NexusData, NexusTeamWorkflow,
    NEXUS_DEMO_ACCOUNTS; all 8 legacy storage keys present
  * `git status -- backend` empty (the backend was never modified)
- Config: build passes with vite.config.js (a CJS deprecation notice is printed because
  package.json has no "type": "module" so serve.js stays CommonJS)
- Dispute cleanup: link-integrity check over all 68 pages = OK (exit 0); affected pages
  return 200; deleted pages/CSS/JS return 404; served HTML confirms "…Dispute Admin"
- Phase 3 API parity vs legacy: namespaces 8/8, async methods 43/43, endpoints 50/50,
  storage helpers 8/8, aggregate export present → exit 0
- Phase 3 runtime harness (stubbed fetch/localStorage): 24/24 checks pass — URL/method/body,
  bearer + x-user-role/x-user-name/x-user-id headers, role normalization, HTTP error and
  network error shapes, query encoding, policies ?active=true, logout
- VITE_API_URL override: building with :3000 removed :3001 from the bundle, then restored
- Phase 4 auth parity: all 11 legacy NexusAuth keys preserved → pass
- Phase 4 runtime harness (stubbed fetch/localStorage): 31/31 checks pass — demo accounts,
  authenticate, role normalization (super_admin→super-admin), createAccount validation +
  persistence + duplicate, API login (session/displayName/redirectPath), session restoration,
  offline fallback login, wrong-password mapping, clearSession, requireProfileAccess decisions

Next Phase:
- None — all 16 phases complete (0 → 16). The migration is finished.

Next Action:
- None required. Optional follow-ups, none of which block anything:
  (1) convert the three src/vendor/ bridge modules into native ES modules when a test harness
      exists (they are currently executed as-is to guarantee identical behaviour);
  (2) consider code-splitting the 945 kB JS chunk (Rollup emits a chunk-size warning);
  (3) delete `src/index.css`'s placeholder rules if `src/styles/styles.css` fully supersedes them;
  (4) remove the 43 unreferenced legacy images if disk size matters (they are intentionally kept).
```

---

## Business Rules — Admin & Dispute Model (current)

These rules supersede the earlier design. Code and docs must match them. Where the code
still reflects the old model, it is listed under "Obsolete / to clean up".

### Admin types (3)

| Admin | Role value | Responsibility |
| --- | --- | --- |
| Comp Admin | `comp_admin` | Competitions, matches, teams |
| Dispute Admin | `dispute_admin` | Disputes filed **against an organizer** |
| Revenue Admin | `revenue_admin` | Revenue configuration and transactions |

`super_admin`, `team_lead`, `participant` remain as before (legacy `admin` still exists in
the enum).

### Dispute workflow

- A dispute **against a User** (player/team) is handled by that competition's **Organiser**.
- A dispute **against an Organiser** is handled by the **Dispute Admin**.
- Disputes do **not** go to the Super Admin.

### Super Admin powers

- Add admins, remove/revoke admins.
- View every admin's activity log.
- **No dispute authority** (no review, no resolution, no escalation target).

### Assets

- **Never delete assets.** This supersedes the Phase 1 asset cleanup; those deletions were
  reverted and all 54 assets are retained.

### Frontend cleanup applied (dispute model) — DONE

Frontend-only; the backend was left untouched.

- Deleted the Super Admin dispute page: `pages/super-admin/resolve-disputes.html` +
  `css/pages/super-admin/resolve-disputes.css` + `js/pages/super-admin/resolve-disputes.js`.
- Deleted the orphan escalation page: `pages/admin/escalate-super-admin.html` + its CSS/JS
  (nothing linked to it — it was unreachable before this change).
- Removed the "Disputes" link from the Super Admin sidebars in
  `pages/super-admin/policy-management.html` and `pages/super-admin/profile.html`
  (now matches `getSuperAdminSidebar` in `script.js`, which has no Disputes entry).
- Rewired the organizer escalation flow from "Super Admin" to "Dispute Admin" in
  `pages/disputes.html`, `js/pages/disputes.js`, `pages/dispute-escalation.html`,
  `js/pages/dispute-escalation.js`.

Still present (backend — NOT changed, per "frontend only"):

- `escalate_to_admin` / `escalated_to_admin` semantics and the generic "Platform Admin"
  wording in the disputes controller/service/DTO. The frontend already surfaces the Dispute
  Admin UI at `pages/admin/disputes.html` (role `dispute_admin` is routed there by `script.js`).

---

## API Configuration (React)

- The React client lives at `frontend/src/services/api.js` (port of `frontend/js/api.js`).
- Base URL: `import.meta.env.VITE_API_URL`, falling back to the legacy
  `http://localhost:3001`. See `frontend/.env.example`.
- Local dev (Phase 5): `backend/.env` sets `PORT=3001`, so the backend and the React client
  agree on :3001 out of the box. `backend/.env` is git-ignored (the committed
  `backend/.env.example` still documents the old `PORT=3000` default). Override the client via
  `frontend/.env`.
- Verified: overriding `VITE_API_URL` changes the built bundle accordingly.

---

## Routing (React)

- Route table: `frontend/src/routes.js` — 67 routes (66 legacy pages + `/` for `index.html`).
  Paths keep the legacy `.html` form on purpose so existing links and query params (`?id=`,
  `?compId=`, `?teamId=`, `?admin=`, `?redirect=`) work unchanged. Each route declares `group`
  and an optional `roles`.
- Guards: `frontend/src/components/ProtectedRoute.jsx` (session required — delegates to the
  ported `requireProfileAccess` with `ROLE_ROUTES`) and `RoleGuard.jsx` (array-capable role
  check; a mismatched role is redirected to its own home). Role-restricted areas: team-lead (1),
  admin (21), super-admin (10).
- `frontend/src/App.jsx` renders `<BrowserRouter>` + `<Routes>`. Ported routes render
  `RoutePlaceholder` until their page UI lands; unmatched paths render `NotFound`.
- SPA fallback: because the entry is `app.html` (not `index.html`), `vite.config.js` rewrites
  `/`, `/index.html` and `/pages/**` to `app.html` in dev and preview, so deep links and
  refreshes work. Legacy `serve.js` (port 8080) is unchanged.

---

## Layout (React)

- Shared chrome lives in `frontend/src/layouts/AppLayout.jsx` (+ `components/Sidebar.jsx`,
  `components/SiteFooter.jsx`, `components/icons.jsx`, `config/nav.js`, `lib/toast.js`).
- It reproduces the legacy DOM contract — `#sidebar-mount`, `.page-with-sidebar`,
  `#footer-mount` — so `frontend/css/styles.css` (imported in `src/main.jsx`) styles it
  unchanged. Each page supplies its own `<main class="…">` (AppLayout does not add one).
  Nav is role-based (main / team-lead / per-admin-type / super-admin), matching the
  legacy sidebar builders; the Super Admin nav has no Disputes entry.
- Landing, login and signup render bare (no sidebar). `showToast(msg, type)` is available
  imperatively from `lib/toast.js`, mirroring the legacy helper.
- Interim note: importing the legacy stylesheet is a stop-gap — the full CSS migration is a
  later phase, and no per-page CSS (`css/pages/**`) is imported yet.

---

## Auth Pages (React)

- `frontend/src/pages/auth/Login.jsx` and `Signup.jsx` (shared shell `AuthCard.jsx`) sit on
  `useAuth()`. Login keeps the legacy validation, the role-based redirect (`ROLE_ROUTES`) and
  the revoked-admin notice; signup keeps the field/email/password-match validation and
  auto-login (it now also redirects — see the Phase 7 note).
- Chrome: `frontend/src/layouts/AuthLayout.jsx` (the "Back" top header + footer, no sidebar).
- `frontend/src/pages/registry.js` maps a route path to its ported component; `App.jsx` renders
  the mapped component, else `RoutePlaceholder`. Unmapped routes stay placeholders.
- Auth pages import their legacy per-page CSS (`css/pages/login.css`, `signup.css`).

---

## Data Layer (React)

- `frontend/src/services/data.js` intentionally **bridges** the legacy store
  (`frontend/js/pages/competitions-data.js`) rather than reimplementing it, so seeds, the
  localStorage keys (`nexus_competitions`, `nexus.notifications.items`, `nexus.disputes`,
  `nexus.revenue_config`, `nexus.admin.activity_logs`, …), merging and backend-sync behave
  exactly as before. It re-exports `window.NexusData` and provides the `window.NexusAPI` global
  the legacy sync paths expect.
- `frontend/src/lib/assets.js` maps legacy image refs (bare names or `../assets/<name>`) to the
  URLs Vite emits.
- The rewrite of the data layer into idiomatic React state is deferred until it can be exercised
  at runtime (this environment cannot run a browser/node harness).

---

## Repository Layout

```
.
├── backend/                 # NestJS REST API
│   ├── docs/swagger.json    # Exported OpenAPI document
│   ├── src/
│   │   ├── common/          # Decorators, guards, filters, middleware, logger, interfaces
│   │   ├── database/        # SeederService (demo data on bootstrap)
│   │   ├── entities/        # TypeORM entities (12)
│   │   ├── modules/         # Feature modules (10)
│   │   ├── app.module.ts
│   │   └── main.ts          # Bootstrap, CORS, validation, Swagger
│   ├── .env.example
│   └── package.json
└── frontend/                # Legacy static site + React (Vite) migration app
    ├── app.html             # React entry (Phase 2–15; becomes index.html in Phase 15)
    ├── vite.config.js       # Vite config (+ SPA fallback for the legacy route paths)
    ├── src/                 # React app: main.jsx, App.jsx, routes.js, services/, context/, components/
    ├── assets/              # Images / logos
    ├── css/                 # styles.css + per-page CSS under css/pages/
    ├── js/
    │   ├── api.js           # window.NexusAPI — REST client
    │   ├── auth.js          # window.NexusAuth — session/login helpers
    │   ├── script.js
    │   └── pages/           # One script per page
    ├── pages/               # Legacy HTML pages (packed under role folders)
    ├── index.html           # Legacy public landing page
    └── serve.js             # Legacy zero-dependency static file server (port 8080)
```

---

## Backend (`backend/`)

### Stack & tooling

- **NestJS 10** (`@nestjs/common`, `core`, `platform-express`, `config`, `swagger`)
- **TypeORM** with **PostgreSQL** (`pg`), `synchronize: true` in development
- **Auth**: `@nestjs/jwt`, `@nestjs/passport`, `passport-jwt`, `bcrypt`
- **Validation**: `class-validator` + `class-transformer`, global `ValidationPipe`
  (`whitelist`, `forbidNonWhitelisted`, `transform`)
- **Uploads**: `multer` disk storage, files written to `uploads/` (git-ignored)
- TypeScript, `tsconfig` `rootDir: src`, `outDir: dist`, path alias `@/* -> src/*`

### Feature modules (`backend/src/modules/`)

| Module | Route prefix | Responsibility |
| --- | --- | --- |
| `auth` | `/auth` | Register, login, profile, password, user list, ban/warn, add/revoke admin |
| `competitions` | `/competitions` | CRUD, active list, per-organizer, approval, co-organizers |
| `teams` | `/teams` | CRUD, status, members, warnings, ban, join requests, invites |
| `disputes` | `/disputes` | Create, organizer/admin queues, organizer review, admin resolve |
| `matches` | `/matches` | Per-competition matches, results, standings source data |
| `notifications` | `/notifications` | Per-user notifications, unread counts, mark-read |
| `policies` | `/policies` | Platform policy CRUD + archive |
| `revenue` | `/revenue` | Revenue config + transaction ledger (paged/filterable) |
| `admin` | `/admin` | Dashboard stats + admin activity log |
| `upload` | `/upload` | File upload (`POST /upload/file`) and retrieval |

Each module follows the same layering: **controller → service → repository** with DTOs under
`dto/` and persistence under `repositories/`.

### Cross-cutting concerns (`backend/src/common/`)

- **Guards**: `JwtAuthGuard`, `RolesGuard`; decorators `@Roles(...)`, `@CurrentUser()`
- **Middleware** (applied to `*` in `AppModule`): `SecurityMiddleware`,
  `RateLimiterMiddleware`, `LoggingMiddleware`. Additional middleware exist for
  competition audit, team validation, and dispute tracking.
- **Filters**: `GlobalExceptionFilter` (registered in `main.ts`)
- **Logger**: `FileLoggerService` via `LoggerModule`

### Data model (`backend/src/entities/`)

12 TypeORM entities: `UserEntity`, `CompetitionEntity`, `TeamEntity`, `MatchEntity`,
`DisputeEntity`, `NotificationEntity`, `TeamJoinRequestEntity`, `TeamInviteEntity`,
`PlatformPolicyEntity`, `RevenueTransactionEntity`, `RevenueConfigEntity`,
`AdminActivityLogEntity`.

### Roles (`backend/src/common/interfaces.ts`)

`UserRole` enum: `participant`, `team_lead`, `admin`, `super_admin`, **and** scoped
sub-admin roles `comp_admin`, `dispute_admin`, `revenue_admin`.
`DisputeStatus`: `open_organizer`, `open_admin`, `under_review`, `escalated_to_admin`, `resolved`.

### Database & seeding

- Connection configured via `DATABASE_URL` **or** discrete `DB_HOST` / `DB_PORT` /
  `DB_USERNAME` / `DB_PASSWORD` / `DB_DATABASE` vars (`app.module.ts`).
- `SeederService` runs on `OnApplicationBootstrap`: seeds demo accounts, demo competitions,
  default policies, revenue config, and sample revenue transactions if empty.

### Environment (`backend/.env.example`)

```env
DATABASE_URL=postgres://postgres:postgres@localhost:5432/fdfed
JWT_SECRET=nexus_super_secret_jwt_key_change_in_production_2026
JWT_EXPIRES_IN=7d
PORT=3000
NODE_ENV=development
```

### npm scripts

```bash
npm install
npm run start:dev     # watch mode
npm run start         # nest start
npm run build         # nest build
npm run start:prod    # node dist/main
npm run lint          # eslint (see note below)
npm run format        # prettier
```

> Note: the `lint` script invokes ESLint, but `eslint` is not listed in
> `devDependencies`. Prettier **is** present but has no config file committed.

### Swagger

API docs are served at `http://localhost:3000/api`. The document is also exported to
`backend/docs/swagger.json`. The `x-user-role` header is documented as an API key for
role-based access.

---

## Frontend (`frontend/`)

A **build-free, framework-free** static site: plain HTML pages that load `css/*.css` and
`js/*.js` with `<script>` tags. There is no bundler, no npm dependency, and no tests.

### Serving

`frontend/serve.js` is a small Node static file server:

```bash
node frontend/serve.js
# Serves http://localhost:8080/
# "/" redirects to /pages/login.html
```

It sets permissive MIME types and `Cache-Control: no-cache`.

### API client (`frontend/js/api.js`)

Exposes `window.NexusAPI` with namespaces: `Auth`, `Competitions`, `Teams`, `Disputes`,
`Notifications`, `Policies`, `Matches`, `Admin`. It:

- stores the JWT in `localStorage` (`nexus.auth.token`) and user in `nexus.auth.user`
- sends `Authorization: Bearer <token>` plus `x-user-role`, `x-user-name`, `x-user-id` headers
- normalizes role strings (`super-admin → super_admin`, `organizer → team_lead`, etc.)
- always resolves to `{ ok, status, data }` or `{ ok: false, error }` — callers never `try/catch`

> **API base URL mismatch:** `api.js` hardcodes `const API_URL = 'http://localhost:3001'`,
> while the backend defaults to port **3000**. Run the backend on 3001 or change `API_URL`
> for the frontend to reach it.

### Session & auth (`frontend/js/auth.js`)

`window.NexusAuth` wraps login/signup. It calls the backend first and falls back to a local
`localStorage` account list (`nexus.auth.accounts`) with seeded demo accounts when the API is
unreachable. Sessions live in `nexus.auth.session`. `requireProfileAccess` guards pages and
redirects by role using a `roleRoutes` map.

### Pages

`pages/` is organized by role area:

- root: `login`, `signup`, `competitions`, `competition-detail`, `create-competition`,
  `create-team`, `join-teams`, `disputes`, `notifications`, `profile`, etc.
- `pages/admin/` — dashboard, disputes, teams, matches, users, revenue config/transactions
- `pages/super-admin/` — dashboard, users, admins, policies, dispute resolution
- `pages/team/` — roster, invites, join requests, settings

Each page typically has a matching `js/pages/<same-path>.js` and
`css/pages/<same-path>.css`.

---

## Running Locally

1. **Start PostgreSQL** and create a database (default `fdfed` or `nexus_db`).
2. **Backend**
   ```bash
   cd backend
   npm install
   cp .env.example .env      # adjust DATABASE_URL / PORT
   npm run start:dev
   ```
   Tables are auto-created (`synchronize: true`) and demo data is seeded on startup.
3. **Legacy static frontend**
   ```bash
   node frontend/serve.js    # http://localhost:8080
   ```
4. **React frontend (migration in progress)**
   ```bash
   cd frontend
   npm install --include=dev
   npm run dev               # http://localhost:5173/app.html
   # or: npm run build && npm run preview
   ```
   Reads `VITE_API_URL` (see `frontend/.env.example`). `backend/.env` already uses port 3001.

---

## Conventions & Notes

- Backend files use **CRLF** line endings and Nest's `FeatureName`/`feature-name` naming.
- Modules keep controllers thin; business logic lives in services; repositories isolate
  persistence so the storage layer can be swapped.
- DTOs use `class-validator` decorators; unknown request fields are rejected by the global
  validation pipe.
- Frontend keeps everything global (`window.NexusAPI`, `window.NexusAuth`) — no modules or
  bundler.
- No automated tests are present in either app (no `test/` directory, no test script).
- `uploads/`, `dist/`, `node_modules/`, and `.env` are git-ignored.

---

## Frontend Migration Audit (Phase 0)

Read-only audit of `frontend/` produced a few months before the React migration.
Used to plan Phases 1–16 and to recover context if a migration session is lost.

### 1. Inventory

| Type | Count | Size |
| --- | --- | --- |
| HTML pages | 69 | — |
| JS files | 73 (~18,900 lines) | — |
| CSS files | 59 (~20,600 lines) | — |
| Assets (images) | 54 | — |

Entry points: `frontend/index.html` (public landing) and `frontend/pages/login.html`
(served as `/` by `serve.js`).

### 2. Core shared modules (migrate first — everything depends on these)

| File | Lines | Responsibility |
| --- | --- | --- |
| `js/api.js` | 533 | `window.NexusAPI` REST client (all namespaces) |
| `js/auth.js` | 402 | `window.NexusAuth` login/signup/session/role redirect |
| `js/script.js` | 1031 | Shared sidebar/header/footer HTML partials + session-gated nav |
| `js/pages/competitions-data.js` | 1519 | Shared competition/team/notification data layer + localStorage |
| `js/pages/team/team-workflow.js` | 1227 | Team workflow logic shared by team + competition pages |
| `js/data/auth-accounts.js` | 20 | `window.NEXUS_DEMO_ACCOUNTS` seed accounts |

The two "data layer" files above are the riskiest to migrate: much application state
(competitions, teams, invites, join requests, disputes, notifications, policies) is kept in
`localStorage` and only partially synced to the backend. **Preserve the localStorage keys and
behavior exactly.**

### 3. Page groups (canonical routes)

- **Public / auth**: `/`, `/pages/about.html`, `/pages/login.html`, `/pages/signup.html`,
  `/pages/competitions.html`, `/pages/competition-detail.html`, `/pages/comp-info.html`,
  `/pages/view-team.html`, `/pages/watch-live.html`
- **Participant**: `/pages/my-activity.html`, `/pages/profile.html`,
  `/pages/notifications.html`, `/pages/competitions-participated.html`,
  `/pages/create-team.html`, `/pages/join-teams.html`,
  `/pages/team/{team-roster,add-players,invite-player,invitations-sent,join-requests,team-settings}.html`
- **Team lead**: `/pages/team-lead-dashboard.html`
- **Organizer / competition management**: `/pages/create-competition.html`,
  `/pages/edit-competition.html`, `/pages/organizer-revenue.html`,
  `/pages/{comp-manage-teams,comp-manage-matches,comp-manage-organizers,comp-participant,comp-match-results,comp-standings,comp-reports,comp-dispute-review}.html`
- **Disputes**: `/pages/disputes.html`, `/pages/submit-report.html`,
  `/pages/dispute-escalation.html`
- **Admin** (`/pages/admin/`): `dashboard`, `users`, `disputes`, `dispute-review`,
  `escalate-super-admin`, `manage-competition`, `manage-teams`, `manage-matches`,
  `match-results`, `view-standings`, `edit-competition`, `competition-detail`,
  `admin-activity`, `admin-profile`, `revenue-config`, `revenue-transactions`, plus `*2` variants
- **Super Admin** (`/pages/super-admin/`): `super-dashboard`, `users`, `admins`,
  `add-admin`, `revoke-admin`, `policy-management`, `create-policy`, `edit-policy`,
  `view-policy`, `resolve-disputes`, `profile`

### 4. Route / redirect logic

- `js/script.js` builds the sidebar from `nexus.auth.session`; pages `activity`,
  `notifications`, `profile` are hidden when logged out (`protected: true`).
- `js/pages/login.js` defines the role → landing route map:

  | Role | Redirect |
  | --- | --- |
  | `regular` / `participant` | `profile.html` |
  | `team_lead` | `team-lead-dashboard.html` |
  | `admin` / `comp_admin` | `admin/dashboard.html` |
  | `dispute_admin` | `admin/disputes.html` |
  | `revenue_admin` | `admin/revenue-transactions.html` |
  | `super-admin` / `super_admin` | `super-admin/super-dashboard.html` |

- `NexusAuth.requireProfileAccess({ pageRole, roleRoutes, loginPath })` guards pages.
- `js/script.js` `clearSession()` is the logout path.
- Query params in use: `?id=`, `?compId=`, `?teamId=`, `?admin=`, `?redirect=`.

### 5. API surface actually used by the frontend (15 calls)

```text
Admin.getActivity
Auth.getCurrentUser, Auth.login, Auth.logout, Auth.register
Competitions.create, Competitions.delete, Competitions.getActive,
Competitions.getAll, Competitions.setApproval, Competitions.update
Disputes.create, Disputes.getAll
Notifications.create
Teams.create
```

`window.NexusAPI` exposes far more (Teams members/invites/join-requests, Disputes
review/resolve, Notifications read, Policies, Matches, Admin stats, Upload) but most pages
currently use the localStorage data layer instead. The React migration must port the **full**
`api.js` client (§9 of the migration brief), not only these 15 calls.

### 6. Auth / session surface

- `NexusAuth` methods used: `getSession`, `setSession`, `clearSession`, `createAccount`,
  `login`, `requireProfileAccess`, `getRoleProfilePath`, `authenticate`, `getAccounts`.
- localStorage keys in use:

  ```text
  nexus.auth.token        nexus.auth.user         nexus.auth.session
  nexus.auth.accounts     nexus.team.activeContext nexus.team.context
  nexus.banned.users      nexus.disputes          nexus.disputes.evidence
  nexus.notifications.items nexus.policies        nexus.profile.email
  nexus.superadmin.dashboard.state
  nexus_competitions      nexus_policies
  ```

### 7. Unused-File Candidates (8 files deleted; assets retained)

Determined by resolving every `<script src>`, `<link rel=stylesheet>`, `href`, and asset
reference relative to each HTML file. Each was re-verified repo-wide before deletion; the
full record is in "Phase 1 — Deletions" below.

Unused JS (no HTML loads them):

```text
js/pages/admin/policy-management.js
js/pages/super-admin/fix-resolve.js
```

Unused CSS (no HTML links them; no local `@import`):

```text
css/pages/admin/competition-detail2.css
css/pages/admin/manage-matches2.css
css/pages/admin/manage-teams2.css
css/pages/admin/match-results2.css
css/pages/admin/policy-management.css
css/pages/super-admin/style.css
```

Unused assets (42 of 54 — no textual reference anywhere in `frontend/`; a sample was manually
confirmed to have zero references). The 12 referenced assets are `logo.png` plus
`f03e2b11…` (logo), `4995f727…` (hero bg), and the live-thumb/card images.

```text
assets/03344954a1e703d6872431dea3e63d7b3ce39d12.png
assets/03c6e64e15d09caa96ad475741033020d0e8299f.png
assets/1baa35d85b97bf099e0a11569abe864b1c31c2cd.png
assets/1bbd19273e3767e2d17a7a7da565b672fae4a5c1.png
assets/238a6b2194e194cbad876c381ed6e6fa57fbbdb6.png
assets/2e461540a418affed57d0f981a58beb57bf9ea36.png
assets/4102576300ef4ef454b71c35dbc68c7d09be0b05.png
assets/50a71068e76adce5dc0a775d4b1ad7f8c4fc5210.png
assets/5d91de22d27cb193d21c816baa419a007dc12341.png
assets/66e5b97f4a7642754edf8081f9543df353bfa74a.png
assets/688c4ec6e50101c548621733bc1e8c17765352fe.png
assets/6af1d639c0a11682c968c3fb37abdf42eaf1cf38.png
assets/7050a5c67b60baf494ac23ca049099bc843d5707.png
assets/71da63ee92da0e765a3809f8ad599517dffac04d.png
assets/72681575d39650bd7d02e23bf6260a756f60a482.png
assets/741806d06ec0ff46c2b1b66399067637db8e8dfc.png
assets/773edbae625d314b122db5f4a03147ddd97e990f.png
assets/7e7f48f270be0cb448a8a04dd51dbc5f5a1f93cc.png
assets/7eb60bb87f415c29b73d6c1bfcebcaa9f3941d2d.png
assets/7ed9262c8e546fbe227a78a46691c44a7cee3c6d.png
assets/80ef64a96645bec71208be3ec7cf46b12b32f2f0.png
assets/849eafbd839d0432868a10ef10d75343c7889a4e.png
assets/8bc9ff47184543ccbe21963f16b2c8f289736786.png
assets/8bdd52edb03f6d70daaef73bfda2f6160863393f.png
assets/8c43595e8be859cacc69c1ca3a9b3d1771272cf6.png
assets/8d13c28b773583d11b1b449cbaaf1922649a16c3.png
assets/9079ebce461d64d8321089e32e00d143b400cd25.png
assets/9a95884a83c43375acb1993fe3860c278e6f9200.png
assets/a08828587a7a831a32dc27a7ba60011b5339b07b.png
assets/a4286ec260ad451fd8ce2adfd65f8b3253ba4fb7.png
assets/ab403023dc08318dd04c0278790e37d417ac5e25.png
assets/b072220a7e301ecc1d509106126ae46079cdd3ed.png
assets/bb5b7402366f706654408d34bf8c8d1b9e43e221.png
assets/c2dafca05e630cc9f2db22546e57a4bd99579f72.png
assets/c8310be54ccffeb2bde4689ded2e90fb62f73aca.png
assets/d0176c1ce00698377ed59525b83edf81ab87763c.png
assets/d1c13e94efec1f59e8d82d6fe237b06c1f2e6831.png
assets/de7ebab8ae70d12b9f727308fbd8472345de7a7d.png
assets/eca518bdfc1eec8efdb94dd4b44799166963b3f9.png
assets/f319d5cb8261af423cfefebe819e54d8a82eaccb.png
assets/f469f7401148cd3928d0a3c5e6aec1d90f952abc.png
assets/f92395ffb6757dd39bd37460edcd4c383ae9ab2b.png
```

### 8. Verified facts

- **0 broken internal `.html` links** across all 69 pages (anchors + `onclick` navigation).
- No local CSS `@import` chains — only Google Fonts imports.
- No destructured `NexusAPI` usage; all calls go through `window.NexusAPI.<Namespace>.<method>`.

### 9. Migration risks / notes

1. **Port mismatch**: `api.js` targets `:3001`, backend defaults to `:3000`. Decide the real
   port and make it configurable via `VITE_API_URL` in Phase 3 (§10 of the brief).
2. **localStorage data layer**: `competitions-data.js` and `team-workflow.js` contain the
   bulk of app behavior. Porting them to React without changing behavior is the hardest part.
3. **Duplicate "2" pages**: `admin/competition-detail2.html` (+ `dispute-review2`,
   `edit-competition2`, `manage-matches2`, `manage-teams2`, `match-results2`) are variants.
   Treat as distinct routes; do not silently merge them.
4. **HTTP cache-busting**: `serve.js` sends `Cache-Control: no-store`; irrelevant to Vite dev.
5. **No tests / no root build**: verification must rely on `npm run build` + manual checks.

---

## Phase 1 — Deletions (Safe Unused-File Cleanup)

Status: REVISED. 8 files deleted (2 JS + 6 CSS), each proven unreferenced repo-wide (not
just within `frontend/`). The 42 asset deletions were later **reverted** — all assets are
retained (see below). No application HTML/JS/CSS was modified.

### Deleted JS (2)

```text
frontend/js/pages/admin/policy-management.js      (no page loads it; super-admin variant kept)
frontend/js/pages/super-admin/fix-resolve.js      (no reference anywhere)
```

### Deleted CSS (6)

```text
frontend/css/pages/admin/competition-detail2.css  (pages link competition-detail.css)
frontend/css/pages/admin/manage-matches2.css      (pages link manage-matches.css)
frontend/css/pages/admin/manage-teams2.css        (pages link manage-teams.css)
frontend/css/pages/admin/match-results2.css       (pages link match-results.css)
frontend/css/pages/admin/policy-management.css    (no admin/policy-management page)
frontend/css/pages/super-admin/style.css          (no href/src anywhere; orphan file)
```

### Assets — RESTORED, not deleted

The 42 asset deletions were reverted by the team. **All 54 assets are retained.** Do not
delete assets (see Business Rules). The hashed-filename list in section 7 is the original
unreferenced-asset finding only.

### False positives ruled out before deleting

- `super-admin/style.css` appeared referenced by many JS files — those were all
  `.style.cssText` property writes, not stylesheet links. Verified with a regex that matches
  only real `href="…style.css"` / `src="…style.css"` attributes: zero hits.
- `admin/policy-management.js` / `.css` appeared referenced by
  `pages/super-admin/policy-management.html` — but that page loads the **super-admin**
  variants, which still exist. Verified by listing the page's real `<link>`/`<script>` srcs.

### Verification (run before the asset revert)

- Resolution-based check: every `script src`, `stylesheet href`, `img src`,
  `.html` link, CSS `url()`, and referenced asset resolves → **0 problems (exit 0)**.
  Re-run after the asset revert: **68 pages OK (exit 0)**.
- Static server (`frontend/serve.js`) smoke test: 15/15 sampled URLs returned **HTTP 200**
  (landing, login, signup, competitions, admin dashboard, super-admin dashboard, team roster,
  core CSS/JS, two assets); the deleted URLs return **404** as expected.
- `npm run build`: **N/A** — no React project exists yet.
