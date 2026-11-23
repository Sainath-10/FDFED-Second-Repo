# NEXUS ESPORTS

Esports tournament platform: a **NestJS + PostgreSQL** REST API (`backend/`) and a **React + Vite**
single-page app (`frontend/`) that consumes it.

The frontend was migrated from a static HTML/CSS/vanilla-JS site to React; it keeps the original
routes (`.html`-style URLs), the original backing store in the browser, and the same API contract.

---

## 1. Tech stack

| Layer | Technology |
|---|---|
| Frontend | React 18, Vite 5, react-router-dom 6 |
| Backend | NestJS 10, TypeORM, PostgreSQL, Passport/JWT |
| API docs | Swagger UI at `/api` |
| Styling | Plain CSS (design tokens in `styles.css`), no UI framework |

---

## 2. Prerequisites

- **Node.js 18+** and npm
- **PostgreSQL** running locally

---

## 3. How to use this repo

### 3.1 One-time setup

```bash
# 1. Backend
cd backend
npm install
cp .env.example .env          # then edit .env (see below)

# 2. Frontend
cd ../frontend
npm install
cp .env.example .env          # optional; defaults already work
```

`backend/.env` values that matter:

```env
DB_HOST=127.0.0.1
DB_PORT=5432
DB_USERNAME=postgres
DB_PASSWORD=postgres
DB_DATABASE=nexus_db
PORT=3000
JWT_SECRET=replace-with-a-long-random-string   # required: the API refuses to start without it
JWT_EXPIRES_IN=7d
NODE_ENV=development
PAYMENT_PROVIDER=mock
```

`DATABASE_URL=postgresql://user:password@host:5432/db` can be used instead of the `DB_*` values.
On a brand-new empty database the migrations create every table on first start; no
`DB_SYNCHRONIZE` is needed.

`frontend/.env` (optional):

```env
VITE_API_URL=http://localhost:3000
```

### 3.2 Run it (two terminals)

```bash
# Terminal 1 — API  (http://localhost:3000, docs at http://localhost:3000/api)
cd backend
npm run start:dev

# Terminal 2 — app  (http://localhost:5173)
cd frontend
npm run dev
```

Open **http://localhost:5173**. On first backend start the database is **seeded automatically**
(users, competitions, policies, revenue config) — see §4.

### 3.3 Production build

```bash
cd backend  && npm run build && npm run start:prod   # dist/main.js
cd frontend && npm run build                         # -> dist/ (index.html + hashed assets)
npm run preview                                      # serve the built app locally
```

| Service | URL | Notes |
|---|---|---|
| Backend API | `http://localhost:3000` | `PORT` from `backend/.env`; code fallback is 3000 |
| Swagger docs | `http://localhost:3000/api` | |
| Frontend (dev) | `http://localhost:5173` | `vite` dev server |
| Frontend (preview) | `http://localhost:4173` | serves the production build |

---

## 4. About the users

These accounts are created automatically in a development database. Change their passwords
before exposing the app to anyone.

| Username | Password | Role | Lands on after login |
|---|---|---|---|
| `superadmin` | `super123` | `super-admin` | `/pages/super-admin/super-dashboard.html` |
| `superadmin1`, `superadmin2` | `nexus` | `super-admin` | `/pages/super-admin/super-dashboard.html` |
| `finance` | `nexus` | `finance_moderator` | `/pages/admin/finance.html` |
| `communitymod` | `nexus` | `community_moderator` | `/pages/moderator/reports.html` |
| `regular` | `regular123` | `participant` (organizes the demo competitions) | `/pages/profile.html` |
| `regular1`, `regular2`, `regular3` | `nexus` | `participant` | `/pages/profile.html` |

Emails are `<username>@nexus.gg`. You can sign in with **either the username or the email**.

Accounts live only in PostgreSQL (`seedDemoAccounts()` in
`backend/src/modules/auth/repositories/user.repository.ts`, run on boot by
`backend/src/database/seeder.service.ts`), with bcrypt-hashed passwords. The browser never stores
passwords or an account list; when the API is unreachable, login fails with a clear message.

Four demo competitions are seeded as free, public and upcoming (registration open today, play in
two to three weeks), so team registration can be tried straight away.

**Forgot password:** the login page sends a reset request to the administrators. A Super Admin
opens **Users**, picks the account and chooses **Reset password**, which shows a
one-time password to pass on to the user.

Roles in this app: `participant`, `team_lead`, `finance_moderator`, `community_moderator` and
`super-admin` (the UI name for the backend's `super_admin`). The retired `admin` role and the
`comp_admin`, `dispute_admin` and `revenue_admin` roles it replaced no longer exist: they cannot be
assigned, and a startup migration deletes any account that still holds one.

**After pulling this change:** restart the backend. Pending migrations run automatically on
startup (unless `DB_MIGRATIONS_RUN=false` is set in your `.env`), and one of them removes the
old `admin` / Dispute / Competition / Revenue Admin accounts from your local database, recording
their usernames in the activity log. Those logins stop working, so sign in as `superadmin` and use
**Admins → Add administrator** to give anyone who still needs access a Finance Moderator,
Community Moderator or Super Admin role. If your browser was signed in as one of the removed
accounts, you are signed out on the next request.

> Seeding is idempotent and only writes a password when an account has none, so a password you
> change in the UI survives restarts. To reset the roster, clear the `users` table and restart the
> backend.

New accounts can be registered from `/pages/signup.html`. A **Super Admin** can also grant admin
access from **Super Admin → Admins → Add Admin**, which creates the account if it does not exist.

---

## 5. Codebase structure

```text
FDFED-Second-Repo/
├── backend/            NestJS API
├── frontend/           React + Vite app
├── .gitignore
├── README.md           you are here
├── project.md          migration log / status (git-ignored)
└── package-lock.json
```

### 5.1 Backend (`backend/`)

```text
backend/
├── .env                DB + PORT + JWT (git-ignored)
├── .env.example
├── src/
│   ├── main.ts                     bootstrap: CORS, ValidationPipe, Swagger at /api
│   ├── app.module.ts               TypeORM + all modules + SeederService
│   ├── entities/                   the 12 database tables (see §6.1)
│   ├── database/
│   │   └── seeder.service.ts       seeds users/competitions/policies/revenue on boot
│   ├── common/                     guards (JWT), filters, decorators, logger, middleware
│   └── modules/
│       ├── auth/                   register, login, /me, users, add-admin, revoke-admin,
│       │                           ban, warn, profile, password  (+ dto/, repositories/)
│       ├── competitions/           CRUD, approval, organizers
│       ├── teams/                  teams, rosters, invites, join requests
│       ├── matches/               schedule, update, results
│       ├── disputes/              file, organizer review, admin resolve, queues
│       ├── notifications/         create, list, unread count, mark read
│       ├── policies/              platform policies CRUD + archive
│       ├── revenue/               config + transactions
│       ├── admin/                 admin stats + activity log
│       └── upload/                file upload + serving
└── docs/ , ReadME.md
```

All routes are served at the **root** (no global prefix), e.g. `POST /auth/login`,
`GET /competitions`, `GET /revenue/transactions`. Role/permission data is passed via headers
(`x-user-role`, `x-user-name`, `x-user-id`) plus a JWT bearer token.

### 5.2 Frontend (`frontend/`)

```text
frontend/
├── index.html          SPA entry (loads /src/main.jsx) + favicon
├── vite.config.js      dev/preview server + a narrow SPA fallback (see §5.3)
├── package.json
├── public/             copied verbatim to the build (favicon.png)
└── src/
    ├── main.jsx        mounts <App/>; imports index.css + styles/styles.css
    ├── App.jsx         BrowserRouter + AuthProvider + ScrollToTop + <Routes>
    ├── routes.js       the 67 routes: path, label, group, allowed roles, ROLE_ROUTES
    ├── index.css       base resets
    ├── pages/
    │   ├── registry.js        route path -> page component map (all 67)
    │   ├── *.jsx              one file per page (Index, Competitions, Profile, …)
    │   ├── auth/              Login, Signup, AuthCard
    │   ├── team/              TeamRoster, AddPlayers, InvitePlayer, JoinRequests, …
    │   ├── admin/  (21 pages) super-admin/ (10 pages)
    ├── layouts/        AppLayout (sidebar + content + footer), AuthLayout
    ├── components/     Sidebar, SiteFooter, CompCard, TeamTabs, ui.jsx (shared states/dialogs),
    │                   UserDirectory, StaffProfile, AccountSettings, ProtectedRoute, RoleGuard, …
    ├── context/        AuthContext (session from the server; refreshed on focus)
    ├── config/         nav.js — sidebar navigation per role
    ├── hooks/          useTeamContext (team from the API), useReportSync (focus + polling refresh)
    ├── lib/            toast.js, assets.js, competitionForm.js (shared create/edit rules), evidence.js
    ├── services/
    │   ├── api.js            the HTTP client (one namespace per backend module)
    │   ├── auth.js           session handling around the backend login (no local accounts)
    │   ├── competitions.js   competition/team fetching, display state, registration rules
    │   └── payments.js       escrow ledger client and formatters
    ├── styles/
    │   ├── styles.css        global tokens + shared components
    │   ├── pages/*.css       one stylesheet per page (51 total)
    │   └── pages/{admin,super-admin,team}/
    ├── assets/         54 images (logos, banners, avatars)
    └── utils/
```

### 5.3 Routing and the SPA fallback

Every route mirrors the original site (`/` and `/pages/**.html`), so old deep links, query
parameters (`?id=`, `?compId=`, `?teamId=`, `?admin=`) and bookmarks still work. Because the app is
an SPA, `vite.config.js` rewrites exactly `/`, `/index.html` and `/pages/**` to `index.html` on both
the dev and preview servers — nothing else is touched, so Vite's own asset requests are unaffected.

Access control: `ProtectedRoute` requires a session, `RoleGuard` enforces the per-route `roles` from
`routes.js` (team-lead, admin roles, super-admin). Anything else is viewable by any signed-in user.

### 5.4 The backend is the only source of data

Every page reads and writes through `services/api.js`. Nothing about competitions, teams,
disputes, reports, accounts or settings is kept in the browser, so every user and device sees
the same data. Pages that show other people's activity refresh when the tab regains focus and
every 15–20 seconds while visible.

### 5.5 Competition rules worth knowing

| Situation | What happens |
|---|---|
| Prize pool up to ₹10,00,000 | Published after the platform fee (organiser reputation limits still apply). |
| Prize pool above ₹10,00,000 (max ₹1,00,00,000) | The organiser adds contact details; the draft waits in **Finance → Organiser requests** until a finance moderator approves it, then the platform fee can be paid. |
| Who can play | Only player accounts. Staff, the competition's organisers and invited co-organisers can never join a team. |
| Player unregisters before the start | Leaves the roster; a per-player fee is refunded. |
| Player unregisters after the start | Leaves the roster; nothing is refunded. |
| Captain unregisters the team | Before the start only; every fee paid for the team is refunded. |
| Wrong result entered | The organiser can edit it until the competition ends. The winner can't change once the next round has been played. |
| Ending with fixtures still to play | The organiser gives a reason; a finance moderator approves or rejects. If approved, every player is refunded, 10% of the deposited prize pool is kept as a penalty, the rest goes back to the organiser, and their trust score drops. |
| Cancelling | Allowed directly only before the start. |
| Report against an organiser | A Community Moderator can choose **End competition & refund players** (same refunds and penalty; cannot be uplifted). |
| Competition finished | Final placings, prizes and players appear as a podium on the competition and team pages. |

---

## 6. Where everything is stored

### 6.1 PostgreSQL (backend)

Tables are defined as TypeORM entities in `backend/src/entities/`:

| Entity | Table contents |
|---|---|
| `user.entity.ts` | accounts: username, email, bcrypt password hash, role, adminType, banned, warnings |
| `competition.entity.ts` | tournaments: dates, format, prize pool, approval status, organizers |
| `team.entity.ts` | teams per competition, members, status |
| `team-invite.entity.ts` | invitations sent to players |
| `team-join-request.entity.ts` | requests to join a team |
| `match.entity.ts` | scheduled matches, scores, stage |
| `dispute.entity.ts` | disputes, escalation state, resolution notes, warnings/ban flags |
| `notification.entity.ts` | per-user notifications |
| `platform-policy.entity.ts` | platform policies + versions |
| `revenue-config.entity.ts` | platform fee percentage + minimum cost |
| `revenue-transaction.entity.ts` | organizer platform-fee payments |
| `admin-activity-log.entity.ts` | audit trail of admin actions |

### 6.2 Browser storage (frontend)

Only the sign-in is kept in the browser:

| Key | Purpose |
|---|---|
| `nexus.auth.token` / `nexus.auth.user` | JWT and the user object from the login response |
| `nexus.auth.session` | the UI session derived from that user |
| `nexus.verifiedJoinCode.<id>` (sessionStorage) | a private join code already verified this session |

Older builds stored accounts (with plain-text passwords), competitions and disputes in
`localStorage`; those keys are deleted automatically on load.

### 6.3 Images and styles

- **Images** — `frontend/src/assets/` (54 files). They are resolved by
  `frontend/src/lib/assets.js` → `assetUrl(name)`, which maps a legacy reference (a bare filename or
  `../assets/<name>`) to the URL Vite emits. Small files are inlined as `data:` URIs by the bundler.
- **Styles** — `frontend/src/styles/styles.css` holds the design tokens, one file per page lives
  under `frontend/src/styles/pages/`, and `frontend/src/styles/system.css` (imported last) defines
  the shared page frame, buttons, dialogs, states and responsive sidebar so every page looks the same.
- **Favicon** — `frontend/public/favicon.png`, referenced from `index.html`.

---

## 7. Scripts reference

| Location | Command | Does |
|---|---|---|
| backend | `npm run start:dev` | run API with watch |
| backend | `npm run build` / `start:prod` | compile to `dist/` / run compiled |
| backend | `npm test` | business-rule, payment, lifecycle, chat and report tests |
| backend | `npm run lint` / `format` | eslint / prettier |
| frontend | `npm run dev` | Vite dev server (5173) |
| frontend | `npm run build` | production build to `frontend/dist` |
| frontend | `npm run preview` | serve the production build |
| frontend | `npm test` | component and rule tests (run `npm install` first) |

---

## 8. Notes

- The backend must be running for login, data sync and admin actions; the app degrades to its local
  storage store otherwise (`data.js` / `auth.js` fallbacks).
- `backend/.env` is git-ignored — never commit real credentials.
- If the frontend's API URL differs from the backend port, set `VITE_API_URL` in `frontend/.env`.
