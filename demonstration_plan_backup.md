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


