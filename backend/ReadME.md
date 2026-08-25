# Competition Management API - Nest.js Backend

A robust REST API backend for the Competition Management System built with Nest.js, featuring header-based role authorization and comprehensive Swagger documentation.

## 🏗️ Architecture & Structure

The backend follows a modular Nest.js architecture with clear separation of concerns:

```
src/
├── common/
│   ├── decorators/
│   │   ├── roles.decorator.ts      # Role-based decorator
│   │   ├── roles.guard.ts          # Role validation guard
│   │   ├── header-auth.guard.ts    # Header-based authorization guard
│   │   └── current-user.decorator.ts # Current user decorator
│   └── interfaces.ts               # TypeScript interfaces
├── modules/
│   ├── auth/                       # User Registration Module
│   ├── competitions/               # Competitions Module
│   ├── teams/                      # Teams Module
│   └── disputes/                   # Disputes Module
├── app.module.ts                   # Main application module
└── main.ts                         # Entry point with Swagger setup
```

### Module Structure

Each module follows this pattern:

- **DTOs**: Data Transfer Objects with validation using `class-validator`
- **Repository**: In-memory data storage and retrieval using Repository Pattern
- **Service**: Business logic layer
- **Controller**: API endpoints with Swagger documentation
- **Module**: Dependency injection configuration

## 🔑 Key Features

### 1. **Repository Pattern (No Database Connection)**

All modules use the Repository Pattern with in-memory storage, making the system:

- Completely testable without database dependencies
- Easy to swap implementations later (add real database)
- Independent of any specific database technology

### 3. **Role-Based Access Control (RBAC)**

Four user roles supported:

- `admin`: Can manage competitions and disputes
- `super_admin`: Full system access
- `team_lead`: Can create and manage teams
- `participant`: Can participate in competitions

Example route protection:

```typescript
@Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
@UseGuards(JwtAuthGuard, RolesGuard)
async createCompetition(...) { ... }
```

### 4. **Complete Swagger Documentation**

- All endpoints documented with descriptions
- Request/Response schemas with examples
- Bearer token authentication integration
- Organized by tags (Auth, Competitions, Teams, Disputes)

Access Swagger UI: `http://localhost:3000/api`

### 5. **Data Validation**

All DTOs include validation decorators:

```typescript
@IsEmail()
@IsString()
@MinLength(6)
@IsDateString()
```

## 🚀 Getting Started

### Installation

```bash
cd backend
npm install
```

### Environment Setup

Create a `.env` file (or copy from `.env.example`):

```env
NODE_ENV=development
PORT=3000
JWT_SECRET=your_secret_key_here
JWT_EXPIRATION=7d
```

### Running the Server

```bash
# Development (with watch mode)
npm run start:dev

# Production
npm run build
npm run start:prod
```

The API will be available at `http://localhost:3000`
Swagger docs at `http://localhost:3000/api`

## 📚 API Endpoints

### Authentication

```
POST /auth/register      - Register a new user (no authentication required)
```

### Competitions

```
POST   /competitions              - Create competition (Admin)
GET    /competitions              - Get all competitions
GET    /competitions/active       - Get active competitions
GET    /competitions/:id          - Get competition details
PATCH  /competitions/:id          - Update competition (Admin)
DELETE /competitions/:id          - Delete competition (Super Admin)
```

### Teams

```
POST   /teams                          - Create team (Team Lead, Admin)
GET    /teams                          - Get all teams
GET    /teams/competition/:competitionId - Get teams in competition
GET    /teams/:id                      - Get team details
PATCH  /teams/:id                      - Update team (Team Lead, Admin)
POST   /teams/:id/members              - Add team member (Team Lead, Admin)
DELETE /teams/:id/members/:memberId    - Remove team member (Team Lead, Admin)
DELETE /teams/:id                      - Delete team (Admin)
```

### Disputes

```
POST   /disputes                   - Create dispute/report
GET    /disputes                   - Get all disputes (filter by ?status=)
GET    /disputes/open              - Get open disputes
GET    /disputes/escalated         - Get escalated disputes (Admin)
GET    /disputes/competition/:id   - Get disputes in competition
GET    /disputes/:id               - Get dispute details
PATCH  /disputes/:id               - Update dispute status (Admin)
DELETE /disputes/:id               - Delete dispute (Super Admin)
```

## 🔐 Authentication

### Register

```bash
curl -X POST http://localhost:3000/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "username": "john_doe",
    "password": "SecurePass123!",
    "firstName": "John",
    "lastName": "Doe",
    "role": "participant"
  }'
```

### Login

```bash
curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "emailOrUsername": "user@example.com",
    "password": "SecurePass123!"
  }'
```

Response includes JWT token:

```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "1",
    "email": "user@example.com",
    "username": "john_doe",
    "firstName": "John",
    "lastName": "Doe",
    "role": "participant"
  }
}
```

### Using JWT Token

Include the token in the Authorization header:

```bash
curl http://localhost:3000/competitions \
  -H "Authorization: Bearer <your_token_here>"
```

## 🏭 Module Details

### Auth Module

- **File**: `src/modules/auth/`
- **Features**:
  - User registration with email and username validation
  - Login with email or username
  - Password hashing with bcrypt
  - JWT token generation and validation
  - User lookup and validation

### Competitions Module

- **File**: `src/modules/competitions/`
- **Repository**: In-memory storage with competition index
- **Features**:
  - Create competitions (Admin only)
  - Get all/active competitions
  - Update competition status
  - Delete competitions (Super Admin only)
  - Filter competitions by creator

### Teams Module

- **File**: `src/modules/teams/`
- **Repository**: In-memory storage with competition index
- **Features**:
  - Create teams for competitions
  - Add/remove team members
  - Get teams by competition or leader
  - Update team information
  - Prevent removal of team leader

### Disputes Module

- **File**: `src/modules/disputes/`
- **Repository**: In-memory storage with competition index
- **Features**:
  - Create disputes/reports
  - Get disputes by various filters (competition, team, status)
  - Update dispute status (open → under_review → resolved/escalated)
  - View escalated disputes (Admin only)

## 🧪 Testing Guide

### Create a Competition

1. Register as Admin:

```json
{
  "email": "admin@example.com",
  "username": "admin",
  "password": "Admin123!",
  "firstName": "Admin",
  "lastName": "User",
  "role": "admin"
}
```

2. Login to get JWT token

3. Create competition:

```bash
curl -X POST http://localhost:3000/competitions \
  -H "Authorization: Bearer <admin_token>" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Football Championship 2024",
    "description": "Annual championship",
    "startDate": "2024-06-01T00:00:00Z",
    "endDate": "2024-12-31T23:59:59Z"
  }'
```

### Create and Manage Teams

1. Register as Team Lead
2. Create a team:

```bash
curl -X POST http://localhost:3000/teams \
  -H "Authorization: Bearer <team_lead_token>" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Team Alpha",
    "competitionId": "1",
    "members": ["2", "3"]
  }'
```

3. Add member to team:

```bash
curl -X POST http://localhost:3000/teams/1/members \
  -H "Authorization: Bearer <team_lead_token>" \
  -H "Content-Type: application/json" \
  -d '{
    "memberId": "4"
  }'
```

### Create and Manage Disputes

```bash
curl -X POST http://localhost:3000/disputes \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "competitionId": "1",
    "teamId": "1",
    "description": "Team violated rules in match 5"
  }'
```

## 📋 Data Models

### User (from auth-accounts.js inspired)

```typescript
{
  id: string;
  email: string;
  username: string;
  password: string(hashed);
  firstName: string;
  lastName: string;
  role: UserRole;
  createdAt: Date;
}
```

### Competition

```typescript
{
  id: string
  name: string
  description: string
  startDate: Date
  endDate: Date
  status: 'draft' | 'active' | 'completed'
  createdBy: string (user ID)
  createdAt: Date
}
```

### Team

```typescript
{
  id: string
  name: string
  competitionId: string
  leaderId: string
  members: string[] (user IDs)
  createdAt: Date
}
```

### Dispute

```typescript
{
  id: string
  competitionId: string
  teamId: string
  reportedBy: string (user ID)
  description: string
  status: 'open' | 'under_review' | 'resolved' | 'escalated'
  createdAt: Date
}
```

## 🔄 Transitioning to a Real Database

To switch from in-memory repository to a real database (e.g., PostgreSQL):

1. Install TypeORM: `npm install @nestjs/typeorm typeorm pg`
2. Replace repository implementations with TypeORM entities
3. Connect DTOs to entities
4. Update services if needed

The API endpoints and controllers will remain unchanged!

## 🛠️ Development Commands

```bash
npm run start:dev      # Development with hot reload
npm run build          # Compile TypeScript
npm run start:prod     # Run compiled code
npm run lint           # Run ESLint
npm run format         # Format code with Prettier
```

## 📝 Notes

- In-memory repositories store data only during runtime
- Data is lost when server restarts
- Perfect for development and testing
- Replace repositories with database implementations for production
- All endpoints are fully documented in Swagger at `/api`

## 📧 Support

For questions or issues with the API, refer to the Swagger documentation at `http://localhost:3000/api` when the server is running.
