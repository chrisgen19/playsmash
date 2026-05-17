# 🏓 Playsmash

Pickleball group management, partner stacking, court rotation, and scoring — built so **not every player needs an account**.

Spin up a group, invite registered users or add temporary players on the spot, run play sessions, generate fair doubles court rotations, and track scores and history.

---

## Table of contents

- [Core concept](#core-concept)
- [Tech stack](#tech-stack)
- [Getting started](#getting-started)
- [Environment variables](#environment-variables)
- [Scripts](#scripts)
- [Project structure](#project-structure)
- [Data model](#data-model)
- [Roles & permissions](#roles--permissions)
- [Authorization model](#authorization-model)
- [Testing](#testing)
- [Development phases & checklist](#development-phases--checklist)

---

## Core concept

Playsmash deliberately separates four concepts so that temporary, walk-in players are first-class from day one:

| Concept | What it is |
|---|---|
| **User Account** | A real registered login identity (`User`). |
| **Player Profile** | A person who plays in a group (`PlayerProfile`). May or may not be linked to a `User` — temporary players have `userId = null`. |
| **Group Membership** | The relationship between a `User` and a `Group`, carrying their role (`GroupMember`). |
| **Session Player** | A player participating in one specific play session (`SessionPlayer`, Phase 3+). |

A temporary player is **not a role** — it is a `PlayerProfile` with no `userId`. It can be added to sessions and matches, can't log in, and can later be linked to a real account without losing match history.

---

## Tech stack

| Concern | Choice |
|---|---|
| Framework | Next.js 16 (App Router, Turbopack) |
| Language | TypeScript (strict) |
| Runtime | Node 20+ |
| Database | PostgreSQL 17 |
| ORM | Prisma 7 (`@prisma/adapter-pg` driver adapter) |
| Auth | Auth.js v5 (NextAuth) — Credentials + optional Google OAuth |
| UI | shadcn/ui + Radix + Tailwind CSS v4 |
| Forms | React Hook Form + Zod |
| Tests | Vitest |
| Package manager | pnpm |

> **Note on Next.js 16** — middleware is now `proxy.ts`; the connection string lives in `prisma.config.ts` (Prisma 7 no longer allows `datasource.url` in the schema); the generated Prisma client is project-local at `lib/db/generated/` and gitignored (regenerated via `postinstall`).

---

## Getting started

### Prerequisites

- Node 20+ and pnpm
- PostgreSQL 17 running locally

### 1. Create the database

```bash
createdb playsmash
# or, with an explicit role:
psql -d postgres -c "CREATE DATABASE playsmash OWNER myuser;"
```

### 2. Install dependencies

```bash
pnpm install
```

`postinstall` runs `prisma generate` automatically, so the typed client is ready.

### 3. Configure environment

```bash
cp .env.example .env
# then edit .env — see the next section
```

### 4. Apply migrations

```bash
pnpm db:migrate
```

### 5. Run the dev server

```bash
pnpm dev
# http://localhost:3000
```

> If you change `prisma/schema.prisma`, run `pnpm db:migrate` **and restart the dev server** — a running process keeps the old generated client in memory. `pnpm dev:reset` clears `.next`, regenerates, and restarts in one go.

---

## Environment variables

| Variable | Required | Purpose |
|---|---|---|
| `DATABASE_URL` | ✅ | Postgres connection string (used by Prisma runtime + CLI). |
| `AUTH_SECRET` | ✅ | Auth.js session/JWT secret. Generate with `openssl rand -base64 32`. |
| `AUTH_URL` | ✅ | App origin, e.g. `http://localhost:3000`. |
| `AUTH_GOOGLE_ID` | ➖ | Google OAuth client ID. Leave blank to hide the Google button. |
| `AUTH_GOOGLE_SECRET` | ➖ | Google OAuth client secret. |

`.env` is gitignored. See `.env.example` for the template.

---

## Scripts

| Script | Does |
|---|---|
| `pnpm dev` | Start the dev server. |
| `pnpm dev:reset` | Clear `.next`, regenerate Prisma client, start dev. |
| `pnpm build` | Production build. |
| `pnpm start` | Serve the production build. |
| `pnpm lint` | ESLint. |
| `pnpm typecheck` | `tsc --noEmit`. |
| `pnpm test` | Run Vitest once. |
| `pnpm test:watch` | Vitest in watch mode. |
| `pnpm db:migrate` | `prisma migrate dev`. |
| `pnpm db:generate` | Regenerate the Prisma client. |
| `pnpm db:studio` | Open Prisma Studio. |
| `pnpm format` | Prettier write. |

---

## Project structure

```
app/
  (auth)/                  login, register, sign-out (route group)
  api/auth/[...nextauth]/   Auth.js route handler
  dashboard/                user's groups + join form
  groups/
    new/                    create group
    [groupId]/
      page.tsx              group overview
      layout.tsx            membership guard + sub-nav tabs
      members/              roster, promote/demote, remove
      players/              players, temp players, edit/status/link
      settings/             join code regeneration (admin)
  join/[code]/              public invite landing
components/
  auth/                     login/register forms
  groups/                   group/member/player UI
  shared/                   header, providers, role badge, sign-out
  ui/                        shadcn primitives
lib/
  activity/                 ActivityLog writer
  auth/                     Auth.js config, password hashing, session helpers
  db/                        Prisma client singleton + generated client
  groups/                    create-group, join-group, members, join-code services
  players/                   player profile services
  permissions/               role helpers + requireGroupRole
  validations/               Zod schemas
prisma/
  schema.prisma              data model
  migrations/                migration history
tests/                       Vitest unit tests
proxy.ts                     Auth.js edge guard (Next 16 middleware)
```

### Architecture rules

- **Business logic lives in `lib/`, not in components.** Server Actions are thin wrappers around `lib/` services.
- **Every group-scoped Server Action starts with `requireGroupRole(groupId, [...])`.** No exceptions.
- **Soft delete, never hard delete** for records that match history depends on — statuses (`REMOVED`, `INACTIVE`) instead of row deletion.
- **Pure functions are unit-tested in isolation** (`lib/permissions/roles.ts`, `lib/groups/join-code.ts`, the stacking algorithm in Phase 4).
- Client components import enums from `@/lib/db/generated/enums` — never the `@/lib/db` barrel, which pulls the Node-only `pg` driver.

---

## Data model

Implemented so far (Phases 1–2):

| Model | Purpose |
|---|---|
| `User` | Registered account (Auth.js). |
| `Account`, `Session`, `VerificationToken` | Auth.js adapter tables. |
| `Group` | A pickleball group; has a unique join code + visibility. |
| `GroupMember` | User ↔ Group link, with role + status. Unique on `(groupId, userId)`. |
| `PlayerProfile` | A player in a group; `userId` nullable for temporary players. Unique on `(groupId, userId)`. |
| `Invite` | A join code with optional expiry / max uses. |
| `JoinRequest` | Pending request to join (workflow lands in Phase 8). |
| `ActivityLog` | Audit trail of group changes (UI in Phase 8). |
| `PlaySession` | A scheduled play day — courts, scoring rules, status. Named `PlaySession` because Auth.js owns `Session`. |
| `Court` | A court within a session. |
| `SessionPlayer` | A player checked in to a session. Unique on `(sessionId, playerProfileId)`. |
| `Match` | A generated doubles match — `sessionId`, `courtId?`, `roundNumber`, four team slots, scores, `winningTeam?`, `status`. Unique on `(sessionId, roundNumber, courtId)` to prevent any duplicate court schedule per round. |

Planned (Phase 5+): `ScoreEvent`.

---

## Roles & permissions

| | OWNER | ADMIN | PLAYER | VIEWER |
|---|:---:|:---:|:---:|:---:|
| View group, players, sessions, scores, history | ✅ | ✅ | ✅ | ✅ (if allowed) |
| Create temporary players | ✅ | ✅ | ❌ | ❌ |
| Invite users / regenerate join code | ✅ | ✅ | ❌ | ❌ |
| Manage players (edit, status, link, remove) | ✅ | ✅ | ❌ | ❌ |
| Approve join requests | ✅ | ✅ | ❌ | ❌ |
| Create sessions, configure courts, generate stacking | ✅ | ✅ | ❌ | ❌ |
| Enter / edit scores | ✅ | ✅ | ❌ | ❌ |
| Promote / demote members | ✅ | partial¹ | ❌ | ❌ |
| Remove members | ✅ | partial¹ | ❌ | ❌ |
| Delete group / transfer ownership | ✅ | ❌ | ❌ | ❌ |

¹ Admins can manage PLAYER/VIEWER members but **cannot** demote or remove another ADMIN or the OWNER — only the OWNER can act on admins. The OWNER can never be demoted or removed (ownership transfer arrives in Phase 8).

Role hierarchy: **OWNER ⊇ ADMIN ⊇ PLAYER ⊇ VIEWER**. A check for `[PLAYER]` is satisfied by any higher role.

---

## Authorization model

Every protected Server Action and server-side data fetch goes through `requireGroupRole(groupId, allowedRoles[])`, which verifies, in order:

1. The user is authenticated.
2. The group exists.
3. The user is an **ACTIVE** member of that group.
4. The user's role satisfies the allowed set.

`groupId`, `playerId`, and `memberId` coming from the client are **never trusted** — services re-fetch each target and confirm it belongs to the same group before mutating. Frontend permission hiding is a UX nicety only; the server is the source of truth.

---

## Testing

```bash
pnpm test
```

Unit tests (Vitest) cover the critical pure logic and services:

- **Permissions** — role hierarchy + `roleSatisfiesAny`.
- **Join codes** — format, ambiguity-free alphabet, uniqueness, retry/exhaustion.
- **Create group** — atomic Group + Owner + PlayerProfile + Invite composition.
- **Join group** — invalid/disabled/expired/max-used codes, idempotency, member/profile revival, banned users, `FOR UPDATE` lock + P2002 fallback.
- **Members** — role-change and removal rules (owner protection, admin-vs-admin).
- **Players** — temp creation, status changes, temp→user linking guards, TEMPORARY transition guard.
- **Sessions** — atomic create + courts + check-in order, eligibility filter (`ACTIVE`/`TEMPORARY`), `FOR UPDATE` locked status checks, no-players + non-PLANNED guards.
- **Stacking** (Phase 4) — 4/1, 8/2, 9/2-with-rest invariants; repeated-partner & replay penalties; fair rotation (`max − min ≤ 1` over 9 rounds with 9 players / 2 courts); no duplicate player per round; determinism with fixed seed.
- **Scoring** (Phase 5) — pure `validateScore` rule matrix (non-integer / negative / tied / below-points-to-win / win-by-two); service tests for start/complete/cancel/edit with locked status re-check.
- **Stats** (Phase 6) — `computePlayerStats` (no division-by-zero); leaderboard ranking with winPct + gamesPlayed + differential tiebreak + stable id ordering; partner history counts + wins-together; zero-game players in the roster.
- **Activity log** — writer payload + transaction passthrough.
- **OAuth** — `email_verified` gate; **callback URLs** — open-redirect prevention.

---

## Development phases & checklist

Playsmash is built phase by phase. Each phase ends with type-check + lint + tests + build all green.

> **🎉 MVP cutoff reached at the end of Phase 6.** Every requirement from the [MVP definition of done](#mvp-definition-of-done) is shipped. Phases 7–8 are polish: realtime UX, ownership transfer, activity log UI, and a deployment checklist.

### ✅ Phase 1 — Authentication & base schema

- [x] Auth.js v5 (Credentials + Google OAuth) with Prisma adapter
- [x] `User`, `Account`, `Session`, `VerificationToken`
- [x] `Group`, `GroupMember`, `PlayerProfile`, `Invite`, `JoinRequest` + enums
- [x] Initial migration
- [x] Permission helpers (`requireUser`, `requireGroupRole`, role hierarchy)
- [x] Zod validation schemas
- [x] Dashboard shell + create-group flow (atomic Group + OWNER + PlayerProfile + Invite)
- [x] Tests for permission helpers + join-code generator

### ✅ Phase 2 — Joining, invites, members & temporary players

- [x] `ActivityLog` model + write-side logger
- [x] Join group by code (`/join/[code]` + dashboard form)
- [x] Group settings page — display & regenerate join code
- [x] Members page — list, promote/demote, remove (role rules enforced)
- [x] Players page — roster of all profiles incl. temporary
- [x] Create temporary players (admin)
- [x] Edit player display name, skill level, status
- [x] Remove / deactivate players (soft delete)
- [x] Link a temporary player to a registered user
- [x] Group sub-navigation tabs
- [x] Server-side permission checks on every action
- [x] Activity logs for player/member changes
- [x] Tests for join, members, players, activity services

### ✅ Phase 3 — Sessions, attendance & courts

- [x] `PlaySession`, `SessionPlayer`, `Court` models + enums (named `PlaySession` to avoid the Auth.js `Session` clash)
- [x] Create a session (date, location, scoring type, points to win, win-by-two, court count)
- [x] Select available `PlayerProfile`s for a session (temporary players included)
- [x] Session list + dashboard with player attendance states
- [x] Court list auto-created per session
- [x] Edit attendance / start session (PLANNED → ACTIVE)
- [x] Validation, server-side authorization, activity logs
- [x] Tests for session services

### ✅ Phase 4 — Stacking & shuffle generation

- [x] `Match` model (+ `WinningTeam`, `MatchStatus` enums) + migration
- [x] Stacking algorithm as pure functions in `lib/stacking/` — `generateRoundMatches`, `selectPlayersForRound`, `assignPlayersToCourts`, `scoreCandidateMatch`, `buildPairingHistory`, `getSessionPlayerStats`, seedable `mulberry32` RNG
- [x] Generate round matches from available players + court count
- [x] Assign matches to courts, track round numbers
- [x] Mark players PLAYING / WAITING / RESTING in one transaction
- [x] Court cards UI + waiting / resting lists at `/sessions/[sessionId]/stacking`
- [x] Unit tests: 4/1, 8/2, 9/2-with-rest, repeated-partner & replay penalties, fair rotation, no duplicate per round, deterministic seed

### ✅ Phase 5 — Scoring & match lifecycle

- [x] Start match (QUEUED → ACTIVE) under a row lock
- [x] Complete match (ACTIVE → COMPLETED) with full score validation
- [x] Cancel match (QUEUED/ACTIVE → CANCELLED)
- [x] Winner determination — pure `validateScore` for `pointsToWin` + `winByTwo`
- [x] Update player statuses after match (PLAYING → WAITING); free the court
- [x] `/scores` page with active / queued / completed sections
- [x] Admin score editing with activity log (idempotent, validated)
- [x] Scoring validation + service tests, including concurrency abort

### ✅ Phase 6 — Player stats & history

- [x] Pure stats algorithm (`lib/stats/`) — `computePlayerStats`, `computeGroupLeaderboard`, `computePartnerHistory`
- [x] Per-player match history page at `/groups/[groupId]/players/[playerId]` (header stats, partner table, last 20 matches with W/L)
- [x] Group leaderboard at `/groups/[groupId]/stats` (rank, GP, W–L, Win %, PF, PA, ±)
- [x] Session leaderboard surfaced on the session dashboard
- [x] Temporary players included in stats (no `userId` required)
- [x] Zero-game players sort to the bottom with `winPct = 0`

### ✅ Phase 7 — Realtime / live session UX

- [x] Auto-refresh / realtime stacking & score updates
- [x] Mobile-friendly court assignment display
- [x] Clear visual match/player states

### ⬜ Phase 8 — Admin polish, audit & deployment

- [ ] Activity log page
- [ ] Ownership transfer
- [ ] Group settings (edit name/visibility) + soft-delete behavior
- [ ] Join request approval workflow
- [ ] Duplicate temporary-player linking helper
- [ ] Production deployment checklist + demo seed script
- [ ] Final QA pass

### MVP definition of done

The MVP is complete when a user can register/login, create a group, invite or add players (including temporary ones), create a session, select players, set courts, generate doubles court assignments, view stacking, enter scores, view scores, and see basic player stats — all with server-side permissions enforced. ✅ **Reached at the end of Phase 6.**

| Requirement | Phase |
|---|---|
| Register / log in | 1 |
| Create a group | 1 |
| Invite or add players | 2 |
| Create temporary players | 2 |
| Create a session | 3 |
| Select available players | 3 |
| Set number of courts | 3 |
| Generate doubles court assignments | 4 |
| Players can view stacking | 4 |
| Enter scores | 5 |
| Players can view scores | 5 |
| Basic player stats | 6 |
| Server-side permissions enforced | every phase |
