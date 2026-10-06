# NEXUS ESPORTS — Platform Documentation

NEXUS Esports is an enterprise-grade esports tournament and competitive gaming platform. It features a modern **React 18 + Vite** single-page application frontend and a modular **NestJS + TypeScript** REST API backend.

---

## 1. How to Run This Codebase

### 1.1 Prerequisites
- **Node.js**: v18.0.0 or v20+ recommended
- **npm**: v9+ (or **yarn** / **pnpm**)
- **Git**

---

### 1.2 Running the Frontend (React 18 + Vite)

The frontend is located in the [`frontend/`](file:///frontend) directory.

```bash
# 1. Navigate to the frontend directory
cd frontend

# 2. Install all dependencies
npm install

# 3. Start the development server
npm run dev
```

- **Development URL**: `http://localhost:5173`
- **Hot Module Replacement (HMR)**: Enabled out of the box via `@vitejs/plugin-react`.

#### Production Build & Preview
```bash
# Build production-optimized bundles into /dist
npm run build

# Preview the production build locally
npm run preview
```

---

### 1.3 Running the Backend (NestJS API)

The backend is located in the [`backend/`](file:///backend) directory.

```bash
# 1. Navigate to the backend directory
cd backend

# 2. Install dependencies
npm install

# 3. Configure environment variables (optional for in-memory mode)
cp .env.example .env

# 4. Start the development server with live reload
npm run start:dev
```

- **API Base URL**: `http://localhost:3001` (or `http://localhost:3000` depending on `PORT` in `.env`)
- **Interactive Swagger Documentation**: `http://localhost:3001/api`

---

### 1.4 Running Full-Stack Simultaneously

Open two terminal sessions:

```bash
# Terminal 1 — Backend
cd backend && npm run start:dev

# Terminal 2 — Frontend
cd frontend && npm run dev
```

---

### 1.5 Demo Accounts & Credentials

The application includes pre-configured demo credentials and role accounts for instant testing:

| Role | Username / Email | Password | Access Level |
| :--- | :--- | :--- | :--- |
| **Player** | `player1` / `player@nexus.gg` | `password123` | Competitions, team discovery, rosters, profile |
| **Team Captain** | `captain1` / `captain@nexus.gg` | `password123` | Team roster management, player invites, join requests |
| **Organizer** | `org1` / `organizer@nexus.gg` | `password123` | Competition creation, match schedules, results, payouts |
| **Admin** | `admin` / `admin@nexus.gg` | `password123` | Global user directory, match dispute resolution, financial ledger |
| **Super Admin** | `superadmin` / `super@nexus.gg` | `password123` | Full system control, admin role delegation, policy authoring |

---

## 2. Architecture & Technology Stack

```
┌─────────────────────────────────────────────────────────────┐
│                    NEXUS ESPORTS CLIENT                     │
│  React 18 • React Router v6 • Vite • Pure Static CSS Tokens │
└──────────────┬──────────────────────────────▲───────────────┘
               │ HTTP Requests                │
               │ (Headers: x-user-role, Auth) │ JSON Responses
               ▼                              │
┌─────────────────────────────────────────────┴───────────────┐
│                    NESTJS REST API                          │
│  TypeScript • Controllers • Services • DTO Validation       │
│  Role Guards (RBAC) • Swagger Documentation UI              │
└──────────────┬──────────────────────────────▲───────────────┘
               │ Storage Abstraction          │
               ▼                              │
┌─────────────────────────────────────────────┴───────────────┐
│                    PERSISTENCE LAYER                        │
│  Repository Pattern (In-Memory + PostgreSQL Ready)          │
└─────────────────────────────────────────────────────────────┘
```

### 2.1 Frontend Architecture
- **Framework**: React 18 with modern functional components and Hooks (`useState`, `useEffect`, `useMemo`, `useCallback`).
- **Routing**: `react-router-dom` v6 with dynamic routing, parameter parsing (`useSearchParams`), and backward-compatible redirects.
- **Styling**: Pure vanilla CSS design system in [`frontend/src/styles/`](file:///frontend/src/styles). Avoids CSS runtime bloat and third-party utility frameworks while leveraging CSS custom properties (`--bg-primary`, `--neon-cyan`, `--glass-bg`, etc.).
- **Service Bridge Pattern**:
  - [`src/services/api.js`](file:///frontend/src/services/api.js) / `NexusAPI`: Standardized fetch wrapper handling authentication tokens, backend synchronization, and error handling.
  - [`src/services/authService.js`](file:///frontend/src/services/authService.js) / `NexusAuth`: Client-side authentication state, session storage, and role-based permissions.
  - [`src/services/competitionService.js`](file:///frontend/src/services/competitionService.js) / `NexusData`: Offline-first tournament, bracket, match, and team store with fallback mock data.

### 2.2 Backend Architecture
- **Framework**: NestJS (Node.js framework for scalable server-side applications).
- **Language**: TypeScript with strict typing and class decorators.
- **API Documentation**: OpenAPI / Swagger configured automatically at `/api`.
- **Validation**: Request body payloads validated using `class-validator` and `class-transformer` via a global `ValidationPipe`.
- **Security & Authorization**: Header-based and Bearer JWT authentication with role guards (`RolesGuard`, `HeaderAuthGuard`).

---

## 3. Core Features & Platform Capabilities

### 3.1 Tournament Lifecycle & Bracket Management
- **Creation Wizard**: Organizers can configure tournament formats (Single Elimination, Double Elimination, Round Robin, Swiss), entry fees, prize pools, and game titles (Valorant, CS2, League of Legends, Rocket League).
- **Dynamic Platform Fee Estimation**: Automatic platform fee calculations based on prize pool brackets and participant capacity.
- **Match Scheduling & Fixtures**: Set match dates, times, server locations, and streaming links.
- **Score Reporting & Validation**: Submit scores with screenshot proof, track map wins, and compute real-time tournament standings.

### 3.2 Team Recruitment & Roster Operations
- **Team Creation**: Register team names, tags, logos, and game divisions.
- **Roster Management**: Assign starting lineups, substitute benches, and team captains.
- **Recruitment Pipeline**: Browse free agents, send invitations, and approve or decline incoming join requests.
- **Captain Operations**: Dedicated Team Lead dashboard to control team visibility and competitive registrations.

### 3.3 Dispute Moderation & Fair Play Governance
- **Misconduct Reporting**: Players can submit match disputes and report misconduct (cheating, toxicity, no-show) with attachments.
- **Admin Evidence Reviewer**: Tournament administrators review logs, match chat, screenshots, and video evidence.
- **3-Strike Warning & Auto-Ban**: Built-in fairness system tracking player warnings; accounts that accumulate three strikes are automatically suspended.

### 3.4 Financial Ledger & Organizer Revenue
- **Platform Financial Ledger**: Detailed transaction logs tracking entry fee collections, platform cuts, and prize payouts.
- **Revenue Configuration**: Admins can fine-tune platform fee percentages and payout thresholds.
- **Organizer Analytics**: Revenue breakdown charts showing net earnings, platform commissions, and payout statuses.

### 3.5 Super Admin Governance & Policy Management
- **Role Delegation**: Super Admins can promote users to granular admin sub-roles (`comp_admin`, `dispute_admin`, `revenue_admin`) or revoke permissions with audit justification.
- **Policy Authoring Suite**: Create and publish versioned rulebooks, terms of service, and fair play codes with dynamic clause numbering and keyword tagging.
- **Document Print & Export**: Dedicated print stylesheets for legal rulebook exports.

---

## 4. Complete Codebase Structure & Route Map

### 4.1 Directory Structure
```
FDFED-Second-Repo/
├── backend/
│   ├── src/
│   │   ├── common/              # Decorators, filters, guards, and interfaces
│   │   ├── modules/
│   │   │   ├── auth/            # Authentication & user registration
│   │   │   ├── competitions/    # Competition management & brackets
│   │   │   ├── teams/           # Team rosters & membership
│   │   │   └── disputes/        # Dispute filing & resolution
│   │   ├── app.module.ts        # Root NestJS module
│   │   └── main.ts              # NestJS entry point & Swagger bootstrapper
│   ├── package.json
│   └── tsconfig.json
│
├── frontend/
│   ├── public/
│   │   └── assets/              # Logos, banners, hero graphics, game thumbnails
│   ├── src/
│   │   ├── components/
│   │   │   └── Layout/          # Reusable UI shells (Header, Sidebar, Footer, Shell)
│   │   ├── pages/               # 57 React Page Components
│   │   │   ├── team/            # Team roster, invites, join requests, settings
│   │   │   ├── admin/           # Platform & tournament admin console pages
│   │   │   └── super-admin/     # Super admin system governance & policy pages
│   │   ├── services/            # API bridges, Auth session, and Competition data
│   │   ├── styles/              # Pure vanilla modular CSS stylesheets
│   │   ├── App.jsx              # Master application router & legacy redirects
│   │   ├── index.css            # Platform-wide CSS design tokens and base styles
│   │   └── main.jsx             # React 18 DOM mount point
│   ├── index.html               # Single HTML entry point
│   ├── package.json
│   └── vite.config.js           # Vite build configuration with React plugin
└── README.md
```

### 4.2 Master Route Matrix (57 Pages)

#### Group 1: Public & Authentication (4 Pages)
| Route | Legacy Route | Component | Purpose |
| :--- | :--- | :--- | :--- |
| `/` | `/index.html` | `LandingPage.jsx` | Platform homepage, hero, live matches, game directory |
| `/about` | `/pages/about.html` | `AboutPage.jsx` | Platform mission, scope, stats, and key capabilities |
| `/login` | `/pages/login.html` | `LoginPage.jsx` | Player and administrator authentication |
| `/signup` | `/pages/signup.html` | `SignupPage.jsx` | Account registration and role onboarding |

#### Group 2: Player & Competition Discovery (7 Pages)
| Route | Legacy Route | Component | Purpose |
| :--- | :--- | :--- | :--- |
| `/competitions` | `/pages/competitions.html` | `CompetitionsPage.jsx` | Tournament catalog, game filters, search |
| `/competition-detail` | `/pages/competition-detail.html` | `CompetitionDetailPage.jsx` | Tournament overview, format, schedule, rules |
| `/comp-info` | `/pages/comp-info.html` | `CompInfoPage.jsx` | Deep tournament briefing and participant overview |
| `/comp-participant` | `/pages/comp-participant.html` | `CompParticipantPage.jsx` | Registered participant lobby and status board |
| `/join-teams` | `/pages/join-teams.html` | `JoinTeamsPage.jsx` | Find open teams looking for players |
| `/create-competition` | `/pages/create-competition.html` | `CreateCompetitionPage.jsx` | Organizer tournament creation suite |
| `/edit-competition` | `/pages/edit-competition.html` | `EditCompetitionPage.jsx` | Tournament parameter modifier |

#### Group 3: Team Management & Roster (6 Pages)
| Route | Legacy Route | Component | Purpose |
| :--- | :--- | :--- | :--- |
| `/create-team` | `/pages/create-team.html` | `CreateTeamPage.jsx` | Team registration and tag generator |
| `/team/team-roster` | `/pages/team/team-roster.html` | `TeamRosterPage.jsx` | Active lineup and player roles |
| `/team/add-players` | `/pages/team/add-players.html` | `TeamFindPlayersPage.jsx` | Search and invite free agents |
| `/team/invitations-sent` | `/pages/team/invitations-sent.html` | `TeamInvitesPage.jsx` | Outgoing player invite tracking |
| `/team/join-requests` | `/pages/team/join-requests.html` | `TeamJoinRequestsPage.jsx` | Incoming player join applications |
| `/team/team-settings` | `/pages/team/team-settings.html` | `TeamSettingsPage.jsx` | Team privacy, bio, and disband controls |

#### Group 4: Competition Management & Organizer (7 Pages)
| Route | Legacy Route | Component | Purpose |
| :--- | :--- | :--- | :--- |
| `/comp-manage-teams` | `/pages/comp-manage-teams.html` | `CompManageTeamsPage.jsx` | Team registration approval & verification |
| `/comp-manage-matches` | `/pages/comp-manage-matches.html` | `CompManageMatchesPage.jsx` | Match scheduling, rounds, and bracket fixtures |
| `/comp-match-results` | `/pages/comp-match-results.html` | `CompMatchResultsPage.jsx` | Match score recording and verification |
| `/comp-standings` | `/pages/comp-standings.html` | `CompStandingsPage.jsx` | Live tournament ladder and point tables |
| `/comp-manage-organizers` | `/pages/comp-manage-organizers.html` | `CompManageOrganizersPage.jsx` | Co-organizer staff management |
| `/comp-dispute-review` | `/pages/comp-dispute-review.html` | `CompDisputeReviewPage.jsx` | Organizer match dispute mediation |
| `/organizer-revenue` | `/pages/organizer-revenue.html` | `OrganizerRevenuePage.jsx` | Financial earnings, fee cuts, and payout logs |

#### Group 5: User Activity, Team Lead & Public Views (9 Pages)
| Route | Legacy Route | Component | Purpose |
| :--- | :--- | :--- | :--- |
| `/profile` | `/pages/profile.html` | `ProfilePage.jsx` | Player statistics, tier rank, and match history |
| `/my-activity` | `/pages/my-activity.html` | `MyActivityPage.jsx` | User audit log (tournaments, teams, disputes) |
| `/notifications` | `/pages/notifications.html` | `NotificationsPage.jsx` | In-app alerts, invites, and match notices |
| `/competitions-participated` | `/pages/competitions-participated.html` | `CompetitionsParticipatedPage.jsx` | Completed and ongoing tournament history |
| `/team-lead-dashboard` | `/pages/team-lead-dashboard.html` | `TeamLeadDashboardPage.jsx` | Team captain operational center |
| `/view-team` | `/pages/view-team.html` | `ViewTeamPage.jsx` | Public team profile and active lineup |
| `/watch-live` | `/pages/watch-live.html` | `WatchLivePage.jsx` | Live stream viewing and match chat |
| `/submit-report` | `/pages/submit-report.html` | `SubmitReportPage.jsx` | Misconduct and violation submission form |
| `/disputes` | `/pages/disputes.html` | `DisputesPage.jsx` | User dispute tracking and resolutions |

#### Group 6: Admin & Super Admin Sections (24 Pages)
##### Admin Management Console (14 Pages)
| Route | Legacy Route | Component | Purpose |
| :--- | :--- | :--- | :--- |
| `/admin/dashboard` | `/pages/admin/dashboard.html` | `AdminDashboardPage.jsx` | Platform health, active counts, and quick actions |
| `/admin/users` | `/pages/admin/users.html` | `AdminUsersPage.jsx` | User directory, role promotion, ban controls |
| `/admin/admin-activity` | `/pages/admin/admin-activity.html` | `AdminActivityPage.jsx` | Administrator audit trail |
| `/admin/admin-profile` | `/pages/admin/admin-profile.html` | `AdminProfilePage.jsx` | Admin account details and permission scopes |
| `/admin/disputes` | `/pages/admin/disputes.html` | `AdminDisputesPage.jsx` | Escalated disputes queue with 3-strike warnings |
| `/admin/dispute-review` | `/pages/admin/dispute-review.html` | `AdminDisputeReviewPage.jsx` | In-depth evidence investigation console |
| `/admin/revenue-transactions` | `/pages/admin/revenue-transactions.html` | `AdminRevenueTransactionsPage.jsx` | Global financial transactions and fees |
| `/admin/revenue-config` | `/pages/admin/revenue-config.html` | `AdminRevenueConfigPage.jsx` | Fee rate adjustments and commission bounds |
| `/admin/competition-detail` | `/pages/admin/competition-detail.html` | `AdminCompDetailPage.jsx` | Administrative tournament inspector |
| `/admin/manage-teams` | `/pages/admin/manage-teams.html` | `AdminManageTeamsPage.jsx` | Administrative team moderation |
| `/admin/manage-matches` | `/pages/admin/manage-matches.html` | `AdminManageMatchesPage.jsx` | Tournament fixtures and referee match controls |
| `/admin/match-results` | `/pages/admin/match-results.html` | `AdminMatchResultsPage.jsx` | Verified match records and override logs |
| `/admin/view-standings` | `/pages/admin/view-standings.html` | `AdminViewStandingsPage.jsx` | Tournament standings and tiebreakers |
| `/admin/edit-competition` | `/pages/admin/edit-competition.html` | `AdminEditCompPage.jsx` | Administrative tournament parameter editor |

##### Super Admin Governance Suite (10 Pages)
| Route | Legacy Route | Component | Purpose |
| :--- | :--- | :--- | :--- |
| `/super-dashboard` | `/pages/super-admin/super-dashboard.html` | `SuperDashboardPage.jsx` | System vitals, server metrics, format breakdown |
| `/super-admin/users` | `/pages/super-admin/users.html` | `SuperAdminUsersPage.jsx` | Complete user database and active state overrides |
| `/super-admin/admins` | `/pages/super-admin/admins.html` | `SuperAdminAdminsPage.jsx` | Admin roster with sub-role classifications |
| `/super-admin/add-admin` | `/pages/super-admin/add-admin.html` | `SuperAdminAddAdminPage.jsx` | Elevation wizard for administrative permissions |
| `/super-admin/revoke-admin` | `/pages/super-admin/revoke-admin.html` | `SuperAdminRevokeAdminPage.jsx` | Admin demotion with audit justification |
| `/super-admin/policy-management` | `/pages/super-admin/policy-management.html` | `SuperAdminPolicyManagementPage.jsx` | Active, draft, and archived rulebook hub |
| `/super-admin/create-policy` | `/pages/super-admin/create-policy.html` | `SuperAdminCreatePolicyPage.jsx` | Clause-by-clause legal policy authoring |
| `/super-admin/edit-policy` | `/pages/super-admin/edit-policy.html` | `SuperAdminEditPolicyPage.jsx` | Semantic version incrementing and amendment |
| `/super-admin/view-policy` | `/pages/super-admin/view-policy.html` | `SuperAdminViewPolicyPage.jsx` | Formatted policy reader with print support |
| `/super-admin/profile` | `/pages/super-admin/profile.html` | `SuperAdminProfilePage.jsx` | Super Admin security keys and 2FA credentials |

---

## 5. Security, Roles & Permission Model

### 5.1 Multi-Tier Role-Based Access Control (RBAC)
The platform enforces role-based privilege boundaries across both frontend routes and backend controllers:

```
[Super Admin] ──► Full system control, role elevation, policy authoring, server vitals
      │
[Administrator] ──► Global dispute resolution, user bans, financial ledger, fee sliders
      │
[Organizer] ──► Competition creation, match fixtures, score approval, payout analytics
      │
[Team Captain] ──► Team roster creation, player invites, join request approvals
      │
[Player / User] ──► Profile management, team recruitment, tournament participation, dispute filing
```

### 5.2 Granular Administrator Sub-Roles
Super Administrators can delegate specific administrative privileges:
- `comp_admin`: Can manage, modify, and referee tournament brackets.
- `dispute_admin`: Specialized in hearing match appeals, reviewing evidence, and issuing strikes.
- `revenue_admin`: Access to financial ledgers, payout releases, and fee rate bounds.
- `super_admin`: Unrestricted platform authority.

### 5.3 Dispute Escalation & Fair Play Chain
1. **Filing**: Players file dispute reports with evidence tags (screenshots, match logs).
2. **First-Tier Review**: Tournament organizers attempt initial mediation during live competition rounds.
3. **Escalation**: Unresolved issues are escalated to Platform Administrators (`/admin/disputes`).
4. **Investigation**: Admins review evidence, interview team captains, and issue rulings.
5. **Enforcement**: Ruling records an infraction strike. Accumulating **3 strikes** triggers automatic platform ban status.

### 5.4 Legacy Route Compatibility
All legacy `.html` URLs redirect seamlessly to their modern React equivalents using the `RedirectWithSearch` component. Query parameters (e.g., `?id=comp-101`, `?admin=true`) are preserved:
- `/pages/admin/competition-detail.html?id=123` ➔ `/admin/competition-detail?id=123`
- `/pages/competitions.html?game=valorant` ➔ `/competitions?game=valorant`
