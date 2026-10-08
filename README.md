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
DB_PORT=5433
DB_USER=postgres
DB_PASSWORD=postgres
DB_NAME=postgres
DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:5433/postgres
PORT=3001
JWT_SECRET=change_me
JWT_EXPIRATION=7d
NODE_ENV=development
```

`frontend/.env` (optional):

```env
VITE_API_URL=http://localhost:3001
```

### 3.2 Run it (two terminals)

```bash
# Terminal 1 — API  (http://localhost:3001, docs at http://localhost:3001/api)
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
| Backend API | `http://localhost:3001` | `PORT` from `backend/.env`; code fallback is 3000 |
| Swagger docs | `http://localhost:3001/api` | |
| Frontend (dev) | `http://localhost:5173` | `vite` dev server |
| Frontend (preview) | `http://localhost:4173` | serves the production build |

---

## 4. About the users

Eight accounts are created automatically. **Every account uses the password `nexus`.**

| Username | Email | Role | Lands on after login |
|---|---|---|---|
| `superadmin1` | superadmin1@nexus.gg | `super-admin` | `/pages/super-admin/super-dashboard.html` |
| `superadmin2` | superadmin2@nexus.gg | `super-admin` | `/pages/super-admin/super-dashboard.html` |
| `compadmin` | compadmin@nexus.gg | `comp_admin` | `/pages/admin/dashboard.html` |
| `revenueadmin` | revenueadmin@nexus.gg | `revenue_admin` | `/pages/admin/revenue-transactions.html` |
| `disputeadmin` | disputeadmin@nexus.gg | `dispute_admin` | `/pages/admin/disputes.html` |
| `regular1` | regular1@nexus.gg | `participant` | `/pages/profile.html` |
| `regular2` | regular2@nexus.gg | `participant` | `/pages/profile.html` |
| `regular3` | regular3@nexus.gg | `participant` | `/pages/profile.html` |

You can sign in with **either the username or the email**.

How the accounts exist in two places (so login works online *and* offline):

1. **PostgreSQL** — `backend/src/modules/auth/repositories/user.repository.ts` → `seedDemoAccounts()`,
   executed on boot by `backend/src/database/seeder.service.ts`. Passwords are stored bcrypt-hashed.
2. **Browser** — `frontend/src/vendor/auth-accounts.js` (`window.NEXUS_DEMO_ACCOUNTS`) and
   `frontend/src/services/auth.js` (`DEMO_ACCOUNTS`) power the local fallback login used when the
   API is unreachable.

Roles in this app: `participant`, `team_lead`, `comp_admin`, `dispute_admin`, `revenue_admin`,
`super-admin` (the UI name for the backend's `super_admin`).

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
    ├── components/     Sidebar, SiteFooter, CompCard, TeamTabs, RoutePlaceholder,
    │                   ProtectedRoute, RoleGuard, ScrollToTop, PolicyEditor, icons
    ├── context/        AuthContext (session + login/logout)
    ├── config/         nav.js — sidebar navigation per role
    ├── hooks/          useTeamContext
    ├── lib/            toast.js, assets.js (image resolver), policies.js (policy store)
    ├── services/
    │   ├── api.js            the HTTP client (8 namespaces, one per backend module)
    │   ├── auth.js           session/accounts, login/signup, local fallback
    │   ├── data.js           competitions data layer -> src/vendor/competitions-data.js
    │   └── teamWorkflow.js   team operations      -> src/vendor/team-workflow.js
    ├── styles/
    │   ├── styles.css        global tokens + shared components
    │   ├── pages/*.css       one stylesheet per page (51 total)
    │   └── pages/{admin,super-admin,team}/
    ├── assets/         54 images (logos, banners, avatars)
    ├── vendor/         three modules executed as-is (see §5.4)
    └── utils/
```

### 5.3 Routing and the SPA fallback

Every route mirrors the original site (`/` and `/pages/**.html`), so old deep links, query
parameters (`?id=`, `?compId=`, `?teamId=`, `?admin=`) and bookmarks still work. Because the app is
an SPA, `vite.config.js` rewrites exactly `/`, `/index.html` and `/pages/**` to `index.html` on both
the dev and preview servers — nothing else is touched, so Vite's own asset requests are unaffected.

Access control: `ProtectedRoute` requires a session, `RoleGuard` enforces the per-route `roles` from
`routes.js` (team-lead, admin roles, super-admin). Anything else is viewable by any signed-in user.

### 5.4 `src/vendor/` — modules executed as-is

Three large, previously browser-only modules are bundled unchanged and re-exported by the `services/`
bridges, so their behaviour (including the exact localStorage keys and seed data) is preserved:

| File | Re-exported as | Used by |
|---|---|---|
| `vendor/competitions-data.js` | `window.NexusData` (via `services/data.js`) | competitions, organizer, admin pages |
| `vendor/team-workflow.js` | `window.NexusTeamWorkflow` (via `services/teamWorkflow.js`) | team pages |
| `vendor/auth-accounts.js` | `window.NEXUS_DEMO_ACCOUNTS` | offline account seeding |

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

Both `localStorage` and `sessionStorage` are used. The full set:

| Key | Purpose |
|---|---|
| `nexus.auth.session` | the signed-in session (read by guards, stored by auth) |
| `nexus.auth.accounts` | local accounts cache (seeded from `NEXUS_DEMO_ACCOUNTS`) |
| `nexus.auth.token` / `nexus.auth.user` | JWT + user object from the API |
| `nexus_competitions` | competitions store (used when the API is unavailable) |
| `nexus.deleted.competitionIds` | ids deleted locally so seeding cannot resurrect them |
| `nexus_comp_draft` | in-progress "create competition" draft |
| `nexus.team.context` / `nexus.team.activeContext` | active competition/team context |
| `nexus.disputes` | disputes filed from the app |
| `nexus.disputes.evidence` | uploaded evidence metadata (names, sizes, image data URLs) |
| `nexus_admin_disputes` | admin dispute queue |
| `nexus.notifications.items` | notification feed |
| `nexus_policies` | platform policies (also mirrored to `sessionStorage`) |
| `nexus.admin.activity` | admin activity feed |
| `nexus.superadmin.dashboard.state` | platform settings (formats, max teams, security) |
| `nexus.banned.users` | locally banned accounts |
| `nexus.profile.email` / `nexus.profile.language` | profile preferences |
| `last_comp_id` / `last_admin_comp_id` (sessionStorage) | last viewed competition, for tab links |

### 6.3 Images and styles

- **Images** — `frontend/src/assets/` (54 files). They are resolved by
  `frontend/src/lib/assets.js` → `assetUrl(name)`, which maps a legacy reference (a bare filename or
  `../assets/<name>`) to the URL Vite emits. Small files are inlined as `data:` URIs by the bundler.
- **Styles** — `frontend/src/styles/styles.css` holds the shared design tokens
  (`--accent: #c6ff33`, `--sidebar-w`, fonts, buttons, tables) and one file per page lives under
  `frontend/src/styles/pages/`. Each page component imports its own stylesheet.
- **Favicon** — `frontend/public/favicon.png`, referenced from `index.html`.

---

## 7. Scripts reference

| Location | Command | Does |
|---|---|---|
| backend | `npm run start:dev` | run API with watch |
| backend | `npm run build` / `start:prod` | compile to `dist/` / run compiled |
| backend | `npm run lint` / `format` | eslint / prettier |
| frontend | `npm run dev` | Vite dev server (5173) |
| frontend | `npm run build` | production build to `frontend/dist` |
| frontend | `npm run preview` | serve the production build |

---

## 8. Notes

- The backend must be running for login, data sync and admin actions; the app degrades to its local
  storage store otherwise (`data.js` / `auth.js` fallbacks).
- `backend/.env` is git-ignored — never commit real credentials.
- If the frontend's API URL differs from the backend port, set `VITE_API_URL` in `frontend/.env`.
