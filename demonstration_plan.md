## Deliverable 1: Executive demonstration brief

This document prepares a technically accurate, executable demonstration plan for a Microsoft Teams meeting with the Womb Atlas owner. The investigation is based on a read-only analysis of the current repository state (Next.js 16.2.9, Prisma ORM, PostgreSQL, NextAuth, Google GenAI).

### Overview of Verified Issues

#### 1. API Reports Success When Database Projection Fails [CRITICAL]
- **Location**: `src/app/api/observation/route.ts`, lines 219-226
- **Problem**: The `projectResponses()` function is wrapped in try/catch, but on failure, the API still returns `{ success: true }`. The canonical observation responses are saved, but the spec-aligned domain tables (observation_consents, reproductive_history, bleeding_patterns, etc.) are NOT updated.
- **Impact**: Intelligence generation may lack complete data; admin dashboard shows incomplete participant data; governance checks may not have full evidence.
- **Evidence**: Lines 219-226 show projection failure is caught and logged, but the function returns success regardless.

#### 2. Cross-Device Resume Authentication Edge Case [CRITICAL]
- **Location**: `src/app/api/observation/route.ts`, lines 15-25 and 31-75
- **Problem**: The `resolveUserId()` function checks if the JWT session userId exists in the User table. If the session carries a userId from a deleted account, the function returns null and the participant is prompted to sign in again, losing their in-progress observation draft.
- **Impact**: Participant may lose access to their in-progress observation across devices/logins.
- **Evidence**: Code comment explicitly states: "The JWT session can outlive its User row — e.g. after a DB reset the cookie still carries a userId that no longer exists."

#### 3. Atlas Intelligence Generation - Missing Google Cloud Configuration [HIGH]
- **Location**: `src/lib/gemini.ts` and `.env` configuration
- **Problem**: The `.env` file has `GOOGLE_CLOUD_PROJECT=""` (empty), required for Vertex AI initialization. The `isVertexConfigured()` function returns false when the project is empty, and `generateContent()` throws an error. The application may not properly handle this failure.
- **Impact**: Participants never receive their Atlas Intelligence/Reflections/Records; the most valuable output is missing.
- **Evidence**: `.env` shows `GOOGLE_CLOUD_PROJECT=""` and `GEMINI_MODEL="gemini-2.5-flash"` - model configured but project ID missing.

#### 4. Form Flow Routing - hideForReproductiveState Case Sensitivity [MEDIUM]
- **Location**: `src/lib/observation/router.ts` line 25 and `conditions.ts` line 25-36
- **Problem**: The condition evaluator reads `ctx.answers["reproductive_state"]` (lowercase), but legacy data may use `REPRODUCTIVE_STATE` (uppercase). The code comment: "never matched and every hideForReproductiveState rule silently passed through as visible."
- **Impact**: Screens that should be hidden based on reproductive state may always be visible, causing participants to see irrelevant questions.

#### 5. Observation Finalisation - completedAt Frozen Logic [MEDIUM]
- **Location**: `src/app/api/observation/route.ts`, lines 188-201
- **Problem**: `completedAt` is intentionally frozen at first completion (`in_progress -> record_saved`). Re-completing an already-saved observation logs to AuditLog instead of updating completedAt. The logic is correct but complex.
- **Impact**: Participants may be confused when re-editing and seeing the completion timestamp didn't change.

## Deliverable 2: Demonstration register

### Demonstration ID: WA-DEMO-001
**Title**: Application reports success when database projection of observation responses fails

**What I will show the owner**: The API endpoint `/api/observation` (POST) returns `{ success: true }` even when the projection of answers into spec-aligned domain tables fails. The canonical answers are saved, but the domain tables that feed intelligence and admin dashboards remain stale.

**Starting point**: Participant observation page, answer questions mapped to domain tables.

**Exact actions**:
1. Navigate to participant observation page (`/observation`)
2. Answer questions targeting domain tables (reproductive history, bleeding patterns, care access)
3. Save responses incrementally
4. Observe the API response

**Expected behaviour**: All answers projected into corresponding domain tables.

**Actual behaviour**: API returns `{ success: true }` even when projection fails. Domain tables not updated.

**Evidence**:
- **Exact source file**: `src/app/api/observation/route.ts`
- **Exact line numbers**: lines 219-226
- **Relevant code excerpt**: See demonstration plan for full code excerpt

**Technical explanation**: See demonstration plan for full technical explanation.

**Business impact**: See demonstration plan for full business impact.

**Recommended correction**: See demonstration plan for recommended correction.

**Verification after correction**: See demonstration plan for verification approach.

**Safety classification**: Safe to demonstrate via source code and API response inspection.

### Demonstration ID: WA-DEMO-002
**Title**: Cross-device resume may prompt re-sign-in or lose participant draft

**What I will show the owner**: The observation resume endpoint has an authentication edge case where if the JWT session carries a userId that no longer exists in the User table, the participant is prompted to sign in again - potentially losing their in-progress draft.

**Starting point**: Participant has started an observation but not completed it.

**Exact actions**:
1. Have a participant begin the first observation and answer a few questions (but not complete it)
2. Simulate a session with a non-existent userId (or log out/in)
3. Navigate back to the observation page
4. Observe the behavior when the system tries to resume the draft

**Expected behaviour**: Participant should resume their in-progress observation without losing answers.

**Actual behaviour**: If the session carries a userId that no longer exists in the User table, `resolveUserId()` returns null, and the API returns `{ observation: null }` - the participant sees no draft and must start over.

**Evidence**:
- **Exact source file**: `src/app/api/observation/route.ts`
- **Exact line numbers**: lines 15-25 (resolveUserId function) and lines 31-34 (GET handler)
- **Relevant code excerpt**: See demonstration plan for full code excerpt

**Technical explanation**: See demonstration plan for full technical explanation.

**Business impact**: See demonstration plan for full business impact.

**Recommended correction**: See demonstration plan for recommended correction.

**Verification after correction**: See demonstration plan for verification approach.

**Safety classification**: Safe to demonstrate via source code analysis. Runtime verification would require removing a user from the database while keeping their session active, which is destructive.

**Demonstration ID: WA-DEMO-003**
**Title**: Atlas Intelligence generation fails without proper Google Cloud configuration

**What I will show the owner**: The Atlas Intelligence pipeline depends on Google Vertex AI, but `GOOGLE_CLOUD_PROJECT` is empty in the `.env` file.

**Starting point**: Participant completed an observation, navigating to Atlas Record/reflection screens.

**Exact actions**:
1. Complete a first observation with sufficient answers
2. Navigate to the Reflections or Atlas Record screen
3. Observe the loading behavior

**Expected behaviour**: Fully generated Atlas Record with dominant pattern, reflection, observed patterns, signal landscape, strengths, narrative themes.

**Actual behaviour**: Vertex AI client cannot be initialized. Screen shows "Preparing your record…" loader that never resolves.

**Evidence**:
- **Exact source file**: `src/lib/gemini.ts`
- **Exact line numbers**: lines 17-35
- **Relevant code**: `isVertexConfigured()` returns `!!project`; `getAi()` throws if `!project`

**Technical explanation**: The `getAi()` function throws when `GOOGLE_CLOUD_PROJECT` is empty. The `.env` has `GOOGLE_CLOUD_PROJECT=""` despite `GEMINI_MODEL="gemini-2.5-flash"`. Intelligence generation fails silently or shows empty state.

**Business impact**: Participants receive no Atlas Record or Reflection - the primary value output is missing, leading to participant dropout.

**Recommended correction**: Set `GOOGLE_CLOUD_PROJECT` to a valid project ID with Vertex AI API enabled. Add proper error handling and fallback UI.

**Safety classification**: Safe to demonstrate via source code analysis.

## Deliverable 5: Meeting script

### System Architecture — 3 minutes

"Womb Atlas is a Next.js 16.2.9 application with the App Router pattern. It uses Prisma ORM version 7.8.0 targeting PostgreSQL for the database. Participant authentication is handled by NextAuth 5 beta, and the application includes Google Vertex AI integration for generating Atlas Intelligence reflections and patterns.

The architecture follows a data-driven approach: the form structure (screens, questions, routing, validation) is stored in the database via Prisma models (FormFlow, FormScreen, FormQuestion) and seeded from the Master Screen Register specification. This means changing the form doesn't require a code deploy - it's configured via the database.

The core workflow participants experience is: choose language -> begin first observation -> answer questions across multiple screens (routed by conditions) -> save answers incrementally -> finalize the observation -> receive an Atlas Record with reflection, dominant pattern, observed patterns, and signal landscape.

On the administrator side, there's a dashboard for accessing participant records, managing users, and viewing audit logs.

Key components I examined:
- **Participant flow**: ObservationWizard, ScreenRenderer, QuestionFields, NarrativePromptCard
- **API routes**: GET/POST /api/observation for draft resume and response saving
- **Intelligence pipeline**: atlas-intelligence-service.ts generating the Atlas Record
- **State management**: Zustand ParticipantDataProvider for answer persistence

Now let me demonstrate the first issue."
### Opening — 2 minutes
## Deliverable 4: Command reference

### Safe Commands for the Meeting

| Command | What it does | Changes anything? | Successful output | Failure output |
|---------|-------------|-------------------|-------------------|----------------|
| `npm run dev` | Start the development server (Next.js) | Starts the app on http://localhost:3000 | Server running message, app accessible | Error if port occupied or dependencies missing |
| `npm run lint` | Run ESLint type checks | No changes | Lint results or error list | Lint errors in code |
| `npm run build` | Build the Next.js application | Creates production build in .next/ | Build completes | Build errors from TypeScript or ESLint |
| `npm start` | Start production server | Starts production server | Server running on port 3000 | Error if port occupied |
| `npx prisma generate` | Generate Prisma client | Regenerates client from schema | Prisma client updated | Error if schema changed without update |
| `node scripts/verify-loer-v7.mjs` | Run LOER v7 verification script | May output findings | Verification report | Script errors |
| `psql "postgresql://womb_atlas_user:womb_atlas_password@127.0.0.1:5432/wombatlas_db?schema=public"` | Connect to PostgreSQL database | No changes (read-only) | psql prompt, `\dt` lists tables | Connection fails if DB not running |

### Application Startup

```powershell
# From the repository root
npm install  # (already installed based on package-lock.json)
npm run dev  # Start development server
```

The application will be available at `http://localhost:3000`. Participant flow starts at `/choose-language` -> `/observation` (first_observation flow).

### Database Inspection (read-only)

```powershell
# Connect to the database
psql "postgresql://womb_atlas_user:womb_atlas_password@127.0.0.1:5432/wombatlas_db?schema=public"

# List tables
\dt

# Sample data - observations
SELECT id, userId, status, flowKey, currentScreenId, completedAt FROM observation LIMIT 5;

# Sample data - form questions
SELECT fieldId, fieldType, targetTable, targetColumn FROM form_question LIMIT 10;
```
## Deliverable 3: Source-code reference guide

### Key Files and Line Numbers for Demonstrations

| Demo ID | File | Lines | Function/Component |
|---------|------|-------|-------------------|
| WA-DEMO-001 | `src/app/api/observation/route.ts` | 219-226 | Projection failure - API returns success |
| WA-DEMO-002 | `src/app/api/observation/route.ts` | 15-25, 31-34 | resolveUserId - cross-device resume |
| WA-DEMO-003 | `src/lib/gemini.ts` | 17-35 | Vertex AI configuration check |
| WA-DEMO-004 | `src/lib/observation/router.ts` | 22-36 | hideForReproductiveState matching |
| WA-DEMO-005 | `src/app/api/observation/route.ts` | 188-201 | completedAt frozen logic |

### Architecture Walkthrough

The application follows a Next.js 16 App Router pattern with the following flow:

1. **Frontend**: React components in `src/app/(participant)/observation/` - ObservationWizard, ScreenRenderer, QuestionFields, NarrativePromptCard
2. **API Routes**: `src/app/api/observation/route.ts` - GET (resume draft) and POST (save responses)
3. **Server Actions/Handlers**: `src/actions/admin.ts` - Admin user management
4. **Prisma ORM**: `prisma/schema.prisma` - Database models (User, Observation, FormScreen, FormQuestion, AtlasIntelligenceRun, etc.)
5. **Database**: PostgreSQL via `@prisma/adapter-pg`
6. **Form Definition**: Data-driven from `FormFlow`, `FormScreen`, `FormQuestion` tables (seeded from Master Screen Register spec)
7. **Intelligence Pipeline**: Google GenAI (Vertex AI) via `src/lib/gemini.ts` -> `atlas-intelligence-service.ts` - generates reflections, archetypes, observed patterns
8. **State Management**: Zustand via `ParticipantDataProvider` - persists answers across page reloads
9. **Routing**: Data-driven from `FormScreen.routes` and conditions evaluated in `src/lib/observation/router.ts` and `conditions.ts`

### Data Flow - Observation Save

```
Participant answers questions
     ↓
ScreenRenderer onChange -> onChange handler in ObservationWizard
     ↓
useState answers updated client-side
     ↓
Continue/Next button -> finalize() or onContinue()
     ↓
POST /api/observation with { observationId, answers, flowKey, currentScreenId, completed }
     ↓
API handler:
  1. Resolve user from session (auth check)
  2. Find or create observation record
  3. Save observationResponses (incremental upsert)
  4. Update observation status and completedAt
  5. Project answers to domain tables (try/catch, but returns success regardless)
  6. Save narrative audio/text if present
  7. Return { success: true, observationId }
     ↓
Client redirects to next screen or shows record
```
### Demonstration ID: WA-DEMO-004
**Title**: Form flow routing - hideForReproductiveState rules may silently fail

**What I will show the owner**: Visibility rules for hiding/showing screens based on reproductive state may silently pass through without matching.

**Starting point**: Participant begins the first observation and answers reproductive state questions.

**Exact actions**:
1. Log in as a participant and begin the first observation
2. When reaching the reproductive state question, answer selecting an option that should trigger screen hiding
3. Observe whether subsequent screens related to reproductive content are hidden or still visible

**Expected behaviour**: Screens with `visibilityRule.hideForReproductiveState` should be hidden when the participant's reproductive state matches the rule's inclusion list.

**Actual behaviour**: As documented in the code comment in `src/lib/observation/router.ts` line 23-25: "The field id is lowercase `reproductive_state`. This previously read 'REPRODUCTIVE_STATE' (the legacy id), so it never matched and every hideForReproductiveState rule silently passed through as visible." The condition evaluator looks for `ctx.answers["reproductive_state"]` (lowercase), but if the data uses a different case, the rule never matches and all screens remain visible.

**Evidence**:
- **Exact source file**: `src/lib/observation/router.ts`
- **Exact line numbers**: lines 22-36 (isScreenVisible function)
- **Relevant code**: `const reproductiveState = ctx.answers["reproductive_state"];`

**Technical explanation**: The `isScreenVisible()` function evaluates `visibilityRule.hideForReproductiveState` by checking if the participant's `reproductive_state` answer (looked up as `ctx.answers["reproductive_state"]`) is included in the rule's exclusion list. However, the field identifier was previously `REPRODUCTIVE_STATE` (uppercase), but was changed to lowercase `reproductive_state`. If legacy data still uses the uppercase format, the lookup would be undefined, the `typeof` check would fail, and the rule would silently pass through (return true - screen visible).

**Business impact**: Participants may see screens not appropriate for their life stage. For example, a participant who answers "pregnant" may still see bleeding-related questions that should be hidden. This creates a poor user experience and may expose participants to clinically irrelevant questions, corrupting data quality.

**Recommended correction**: Ensure consistent casing of the `reproductive_state` field identifier across all layers. Add a normalization step when answers are stored or retrieved so the field is always lowercase. Test the visibility rules with various reproductive state answers to confirm the matching works correctly.

**Safety classification**: Safe to demonstrate via source code analysis. Runtime verification would need a participant session with specific answers.
