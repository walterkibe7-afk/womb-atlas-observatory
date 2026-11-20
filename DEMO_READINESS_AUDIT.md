# Womb Atlas — Live Demonstration Readiness Audit

**Date:** 4 November 2026
**Scope:** Read-only inspection of the current working tree at `D:\Web Designs\Womb Atlas`
**Audience:** Womb Atlas project owner (Microsoft Teams technical walkthrough)
**Rule applied:** No source, configuration, schema, migration, seed, or database state was changed. The only file this audit adds is this report.

---

## 0. How to read the evidence labels

Every finding below carries exactly one of these labels. Nothing is presented as a defect unless it has a code path or a runtime observation behind it.

| Label | Meaning |
|---|---|
| **CONFIRMED BY RUNTIME TEST** | Reproduced against the running application on 4 Nov 2026, with the observed HTTP status/body or database row recorded. |
| **CONFIRMED BY SOURCE CODE** | The behaviour follows deterministically from the cited lines; no runtime reproduction was required. |
| **STRONG INDICATION** | Code and/or stored data point to the behaviour, but at least one runtime step was not exercised (usually because it would write data). |
| **UNVERIFIED** | Plausible, but not supported by code or a test yet. Not used as a demo. |

**Runtime environment used:** Next.js 16.2.9 (App Router), React 19, Prisma 7.8.0 with `@prisma/adapter-pg`, PostgreSQL at `127.0.0.1:5432/wombatlas_db`, NextAuth v5 JWT sessions. The app was served with the webpack workaround `npx next dev --webpack -p 3200` because the documented command fails (Finding 1). Browser checks used Playwright 1.64.1 (Chromium revision 1217). Only the synthetic seed accounts were used: `participant@system.com` / `password` and `admin@system.com` / `password`.

---

## 1. Executive brief

### Bottom line

The application contains **at least ten demonstrable defects**, including two that must be treated as release blockers: a **one-line configuration fault that stops the documented start command from working at all**, and an **authorization design flaw that lets a forged cookie receive admin pages containing user and audit data**.

The codebase is otherwise coherent and the participant flow is largely functional. The defects cluster in three areas:

1. **Startup and environment drift** — CommonJS/ESM mismatch; MySQL SQL left in a PostgreSQL application.
2. **Authorization enforced in the browser instead of the server** — pages and server actions trust a cookie's presence, not its validity or the user's role.
3. **Silent failure and fake success** — saves, projections, intelligence persistence, governance and health checks all report success when they did not succeed.

### What is safe to demonstrate

- The failed start command and the module-format error (30 seconds, no data touched).
- The forged-cookie disclosure using `curl.exe` or view-source (read-only).
- The `/admin/database` crash (read-only; the error is deterministic).
- The misleading `/admin/status` page (read-only).
- The participant save/skip/completion logic as a **source walkthrough** (no writes), or as a live failure using DevTools request blocking rather than corrupting data.

### What must not be demonstrated live

- Creating users, changing roles, deleting translations.
- Submitting an observation, skipping a section, or finalising a record against the seed participant without a dedicated throw-away account and a database backup.
- Any `prisma migrate`, `db push`, `db seed` or reset command.

### Top findings

| # | Finding | Severity | Evidence |
|---|---|---|---|
| 1 | `npm run dev` returns HTTP 500 on every route — CommonJS/ESM mismatch | **CRITICAL** | RUNTIME |
| 2 | Forged session cookie yields admin pages with user/audit data | **CRITICAL** | RUNTIME |
| 3 | Unauthenticated legacy endpoint can rewrite/delete any observation's signals and record | **CRITICAL** | SOURCE + RUNTIME reachability |
| 4 | Participant can modify global translations (no role check) | **HIGH** | SOURCE + RUNTIME reachability |
| 5 | Save failures are ignored; the wizard advances and marks onboarding complete regardless | **CRITICAL** | SOURCE |
| 6 | Skipped sections never delete previously saved answers | **HIGH** | SOURCE |
| 7 | Completion is a client-supplied boolean; no required-answer validation | **HIGH** | SOURCE |
| 8 | Governance is inert: every rule is `warn`, the validator skips them all, and the route ignores the result | **HIGH** | SOURCE + RUNTIME |
| 9 | Intelligence persistence failures are swallowed and reported as success | **HIGH** | SOURCE |
| 10 | Admin database page crashes on PostgreSQL (MySQL-only SQL) | **HIGH** | RUNTIME |
| 11 | Admin status page claims 100% uptime and "All Systems Operational" with metrics unavailable | **MEDIUM** | RUNTIME |
| 12 | Duplicate intelligence runs (no idempotency) | **MEDIUM** | RUNTIME + SOURCE |
| 13 | `/api/records` returns hard-coded mock records | **LOW** | SOURCE |
| 14 | Record generated before completion; dashboard still says "continue" | **MEDIUM** | RUNTIME |

### Business impact in one paragraph

Womb Atlas handles menstrual and reproductive health narratives — special-category data in most privacy regimes. The admin disclosure is not a cosmetic UI bug: it exposes the user directory, roles, audit events and entity identifiers to anyone who can set a cookie value by hand. The silent-save and skip defects undermine the clinical usefulness of the record: the intelligence layer can reason over answers the participant believes were removed, or over a record that was never successfully saved. The startup fault means the documented delivery path cannot currently be trusted in front of a client without a workaround.

---

## 2. Demonstration register

**Core demos (fit in 25 minutes):** D1, D2, D3, D5, D6, D7, D9, D12.
**Optional/backup:** D4, D8, D10, D11, D13, D14.

Every demo lists the exact starting point, actions, expected vs actual, and the source anchor.

---

### D1 — The documented start command serves HTTP 500 on every route

- **Severity:** CRITICAL (blocks delivery)
- **Evidence:** CONFIRMED BY RUNTIME TEST
- **Time:** 2–3 minutes
- **Show:** terminal, then browser, then one file.

**Steps**
1. In the project root run `npm run dev`.
2. Wait for “Ready”.
3. Open `http://localhost:3000/`.
4. In the terminal, read the compiler error; then open `package.json` at line 79.

**Expected:** the landing page renders.
**Actual:** HTTP 500 with a module-format error naming `./proxy.ts`:

> `Specified module format (CommonJs) is not matching the module format of the source code (EcmaScript Modules)`

**Cause:** `package.json` line 79 declares `"type": "commonjs"`, while `proxy.ts` (the Next.js 16 replacement for middleware) is an ES module. Next.js 16 runs Turbopack by default, and Turbopack refuses to mix the two. Lines 72–75 (`"main": "index.js"`, `"directories": { "test": "tests" }`) are leftover `npm init` noise and confirm the field was never curated.

**Impact:** the command in `README.md`, `HANDOVER.md` and any onboarding note does not work. CI and a fresh clone fail the same way. This is the first thing a new developer or the client will hit.

**Workaround used for this audit:** `npx next dev --webpack -p 3200` renders the application (HTTP 200). This is a diagnostic workaround, **not** the fix.

**Fix direction (not applied):** remove line 79 or change it to `"module"`; delete the `main`/`directories` leftovers. Verify with a clean `npm run dev` and `npm run build`.

**Demo risk:** low. Stop the server when finished.

---

### D2 — A forged cookie is treated as a valid admin session

- **Severity:** CRITICAL (data disclosure)
- **Evidence:** CONFIRMED BY RUNTIME TEST
- **Time:** 4 minutes
- **Show:** `curl.exe` first (unambiguous), then the browser.

**Steps (read-only)**
1. With the workaround server running on port 3200:
   ```powershell
   curl.exe -i -H "Cookie: authjs.session-token=forged-not-a-real-session" http://localhost:3200/admin/access
   ```
2. Repeat for `/admin/audit`.
3. In a browser: DevTools → Application → Cookies → add `authjs.session-token` with any value → open `/admin/access` and use “View source”, or disable JavaScript for the tab.

**Expected:** HTTP 307/302 to the login page, or HTTP 401/403.
**Actual:** HTTP 200. The response is 19,454 bytes and contains `participant@system.com` and `admin@system.com`, their names and roles. `/admin/audit` returns ≈20.9 KB including audit entries and the joined user records.

**Cause — three layers, each insufficient on its own**
- `proxy.ts` lines 22–33: the only check is whether one of four cookie names exists. The value is never verified, decoded, or looked up. Line 35 explicitly delegates role checks to “the layout guards”.
- `src/app/(admin)/layout.tsx` line 1 is `"use client"`; the role check at lines 29–47 runs in `useEffect` in the browser. It cannot protect a server-rendered payload.
- The admin pages query Prisma directly with no guard: `admin/access/page.tsx` lines 35–45 (`prisma.user.findMany`), `admin/audit/page.tsx` lines 35–41 (`prisma.auditLog.findMany` with `include: { user: true }`).

A real browser will redirect after hydration, but the data has already been delivered. With JavaScript disabled, the table stays on screen; with `curl`, the redirect never happens at all.

**Additional risk (source-confirmed):** `src/actions/admin.ts` `createUser` (lines 10–61) reads the session at lines 17–18 but **never checks it** before `prisma.user.create` at line 34. `updateUserRole` (lines 63–99) only checks that *someone* is signed in (line 68), not that they are an admin. A forged cookie passes the proxy, so the server action surface is reachable without a valid identity. Exploiting it requires the action ID from the client bundle — hence “source-confirmed missing authorization”, not a runtime exploit demonstration.

**Impact:** disclosure of the user directory (emails, names, roles, creation dates, whether a password is set) and the audit trail (actions, entity IDs, change payloads). With production data this is a reportable privacy incident, and the audit trail is exactly the data an investigator would need.

**Demo caution:** clear the forged cookie afterwards. Do not run this against a production host.

---

### D3 — `/admin/database` crashes because MySQL SQL runs on PostgreSQL

- **Severity:** HIGH
- **Evidence:** CONFIRMED BY RUNTIME TEST
- **Time:** 2 minutes

**Steps**
1. Open `/admin/database` (any session that passes the proxy).
2. Observe the empty content shell; read the server console.

**Expected:** table inventory, row counts, storage, connection count.
**Actual:** HTTP 200 shell, no content; server log:

> `PrismaClientKnownRequestError` … code `42703` … `column "table_rows" does not exist`
> at `getDatabaseStats` (`src/lib/admin/database-stats.ts:27`) called from `DatabaseManagement` (`src/app/(admin)/admin/database/page.tsx:15`)

**Cause:** `src/lib/admin/database-stats.ts` lines 27–41 query MySQL's `information_schema.TABLES` using `TABLE_ROWS`, `DATA_LENGTH`, `INDEX_LENGTH`; lines 43–45 run `SHOW STATUS LIKE 'Threads_connected'`. PostgreSQL has none of these. The schema is PostgreSQL (`prisma/schema.prisma` line 6), `.env` points at PostgreSQL, but `docker-compose.yml` lines 2–16 still provision MySQL 8.4 and `HANDOVER.md` documents MySQL. This is environment drift made visible.

**Impact:** the database monitoring screen is unusable. More importantly it proves the deployment documentation and the runtime are out of sync — a risk for handover.

**Fix direction:** use `pg_stat_user_tables`, `pg_total_relation_size`, `pg_stat_activity`, or drop the page until it is ported. Align `docker-compose.yml` and `HANDOVER.md` with PostgreSQL.

---

### D4 — `/admin/status` reports 100% uptime and “All Systems Operational” while metrics are unavailable

- **Severity:** MEDIUM (operational false confidence)
- **Evidence:** CONFIRMED BY RUNTIME TEST
- **Time:** 1–2 minutes (optional)

**Observed:** the page renders “All Systems Operational”, seven green “Operational” status rows (four endpoints plus three infrastructure rows), and **100%** uptime, while the uptime detail reads “N/A”. This is on the same database where the `SHOW GLOBAL STATUS` query fails.

**Cause:**
- `src/lib/admin/system-status.ts` lines 42–44 wrap the MySQL `SHOW GLOBAL STATUS` query in `.catch(() => [])`. The failure is discarded.
- Lines 46–55 derive uptime from the (now empty) map, so `uptimeSeconds` is 0.
- Line 114 then returns `uptimePercent: uptimeSeconds > 0 ? uptimePercent : 100` — an invented 100%.
- Lines 57–62 label a `narrative.count()` query as “Voice Transcription Engine” and an `atlasReflectionRow.count()` as “Reflection Generation”. A reachable table is not a working service.

**Impact:** an operator looking at this page would conclude the platform is healthy during a partial outage. The “Operational” badges only prove that four `count()` queries executed.

**Fix direction:** use PostgreSQL-native metrics (`pg_postmaster_start_time()`, `pg_stat_activity`), return `unknown` rather than 100 when telemetry is missing, and probe real dependencies (model provider, storage, queue) instead of counting rows.

---

### D5 — A failed save is invisible; the wizard advances and marks onboarding complete

- **Severity:** CRITICAL (data loss)
- **Evidence:** CONFIRMED BY SOURCE CODE
- **Time:** 3 minutes (source walkthrough) or 4 minutes (live via request blocking)

**Steps (safe live variant)**
1. Open `/observation` with the seed participant.
2. DevTools → Network → right-click `/api/observation` → “Block request URL”.
3. Answer one question and press Next.
4. Observe: the wizard advances, no error appears. Reload: the answer is gone.
5. Continue to the end; the dashboard is unblocked even though nothing was saved.

**Cause:**
- `ObservationWizard.tsx` `persistAnswers` lines 216–242: `await fetch(...)` then `const data = await res.json()` at line 231. `res.ok` is never checked; a 500 JSON body is treated as success. The `catch` at 236–239 only fires on a thrown exception (network failure or invalid JSON), and even then it returns the old id.
- `goNext` lines 288–309 calls `persistAnswers` and advances regardless of the return value.
- `completeAndExit` lines 270–286 wraps the save in `try { ... } catch {}`, then unconditionally sets `localStorage["hasCompletedFirstObservation"] = "true"` at line 279 and navigates to `/dashboard` at 285.
- The same pattern exists in `finalize` (244–262): only `data.success` sets the record; failures are logged to the console.

**Impact:** the participant believes their most sensitive disclosures were recorded. They were not. The dashboard then treats onboarding as complete, so the participant may never be prompted to re-enter the data. This is the single most damaging participant-facing defect after the authorization issue.

**Fix direction:** check `res.ok`, surface a blocking error with retry, only set the local flag after a confirmed 2xx, and disable navigation while a save is in flight.

---

### D6 — Skipping a section does not delete answers already saved in it

- **Severity:** HIGH (record contradicts the participant)
- **Evidence:** CONFIRMED BY SOURCE CODE (deterministic)
- **Time:** 3 minutes (source walkthrough; live test needs a throw-away account)

**Steps (live, with a test account only)**
1. Answer a question in a section, press Next (this saves it).
2. Go back and press “Skip section”.
3. Finish, then inspect `ObservationResponse` for the observation, or re-open the draft.

**Expected:** the skipped answers are removed, or explicitly marked as skipped.
**Actual:** they remain and are rehydrated on resume; intelligence still sees them.

**Cause:**
- `ObservationWizard.tsx` `skipSection` lines 312–330 builds `cleared` by `delete`-ing the section's field ids **from the in-memory object only** (316–318), then calls `persistAnswers(cleared, ...)` (320).
- The server (`src/app/api/observation/route.ts` lines 143–153) iterates only the entries present in the request and **upserts** them. There is no delete, no tombstone, and no “skipped” marker. Anything omitted simply survives.

**Impact:** a participant who skips “pain” or “bleeding” still receives a record built on the answers they thought they had withdrawn. This is both a data-quality and a trust problem, and it is hard to explain in a privacy review.

**Fix direction:** send an explicit list of cleared field ids and delete those rows in the same transaction; or store a `skipped` state. Add a regression test that saves, skips, and re-reads.

---

### D7 — Completion is a client-supplied boolean with no validation

- **Severity:** HIGH
- **Evidence:** CONFIRMED BY SOURCE CODE
- **Time:** 2 minutes

**Show:** `POST /api/observation` with `{ "answers": {}, "completed": true }` (do not execute — read the route instead).

**Cause:** `src/app/api/observation/route.ts` lines 81–89 accept `completed` from the body. Lines 186–201 then set `status: "record_saved"` and `completedAt` without checking a single required answer, screen, consent or section. The audit entry at 205–214 records a completion that never happened.

**Runtime corroboration:** the seeded draft is `in_progress`, has 33 responses and no `completedAt`, yet an `AtlasRecord` already exists. That is possible because the wizard calls `finalize` when it *enters* the record flow (lines 296–300) and on resume of a record screen (264–268) — before completion.

**Impact:** empty or partial records can be marked complete and then feed check-ins, timelines and intelligence. There is no server-side definition of “complete”, so the client is the only gate.

**Fix direction:** compute completeness on the server from the form definition (required questions per flow), reject `completed: true` unless satisfied, and only then generate the record.

---

### D8 — Duplicate intelligence runs; no idempotency

- **Severity:** MEDIUM
- **Evidence:** CONFIRMED BY RUNTIME TEST + SOURCE
- **Time:** 2 minutes

**Observed:** the database contains **three** `AtlasIntelligence` runs for the same observation, plus three audit `CREATE` entries.

**Cause:** every `POST /api/observation/intelligence` calls `persistRun`, which creates a new run row (`src/app/api/observation/intelligence/route.ts` lines 227–236) and upserts `AtlasRecord` (333–350). The client re-triggers finalisation on every resume of a record screen (`ObservationWizard.tsx` 264–268) and again when entering the record flow (296–300). There is no idempotency key, input hash or uniqueness constraint.

**Impact:** audit noise, inconsistent traceability, and — once a paid model is configured — repeated cost for identical input. The participant can also see the record change between visits if the model is non-deterministic.

**Fix direction:** derive an input hash, store it on the run, return the existing run on a repeat, and add a unique constraint.

---

### D9 — Governance is inert: no rule ever runs, and the result is ignored

- **Severity:** HIGH (safety control is decorative)
- **Evidence:** CONFIRMED BY SOURCE CODE + CONFIRMED BY RUNTIME TEST
- **Time:** 3 minutes

**Cause — three independent problems**

1. **No rule can fire.** `src/content/aikb/governance.json` declares six rules (GOV-001 … GOV-006) and **all six are `"severity": "warn"`** (lines 4–31). `governance-service.ts` line 25 skips any rule whose severity is not `"block"` (`if (rule.severity !== "block") continue;`). The loop therefore never scans anything, `violations` stays empty, and line 37 returns `passed: true` unconditionally.
2. **The result is ignored.** `src/app/api/observation/intelligence/route.ts` receives `result.governance`, returns it at line 206, but never branches on `passed`. Lines 203–208 always return `success: true`. A failing reflection would still be persisted and shown.
3. **The check would self-trip if enabled.** `reflection-runner.ts` lines 205–226 include `disclaimer` at line 225; the English disclaimer is “This record is not a diagnosis…” (`v43/atlas-intelligence-service.ts` 764–769). `governance-service.ts` line 22 serialises the whole reflection and lines 10–15 block the literal term `diagnosis`. The moment any rule is changed to `block`, every English record fails on its own disclaimer.

**Runtime status:** the three stored runs all say `passed: true` — exactly what the current code produces, since the validator is a no-op. This is not evidence of older code; it is reproducible from the source.

**Impact:** the control provides false assurance. The audit trail says “passed”, the participant sees a “non-diagnostic” disclaimer, and no content is actually reviewed. It is also keyword-only: a paraphrased diagnosis passes, while benign text would fail once the rules are enabled.

**Fix direction:** mark the intended rules as `"block"`, exclude the disclaimer from the scanned corpus (scan only generated prose), block or replace on failure, persist `passed` and `violations` truthfully, and add a regression test with an English fixture **and** a diagnosed-style adversarial fixture.

---

### D10 — Persistence failures are swallowed and returned as success

- **Severity:** HIGH
- **Evidence:** CONFIRMED BY SOURCE CODE
- **Time:** 2 minutes

**Cause:** `src/app/api/observation/intelligence/route.ts` lines 190–201 wrap `persistRun` in `try/catch` and only `console.error`. Execution continues to `return NextResponse.json({ success: true, ... })` at 203–208. The same pattern exists for narrative mirroring (`api/observation/route.ts` 159–175) and domain projection (219–226).

**Impact:** the participant sees a record that has no `AtlasIntelligence` row and possibly no `AtlasRecord`. Support cannot reproduce it; the audit trail is silent. Non-fatal projection is a defensible design choice, but it needs telemetry and a visible degraded state — not a console line.

**Fix direction:** keep the response usable, but return a `persisted: false` flag, emit a structured error/metric, and surface “saved locally, not yet synced” in the UI.

---

### D11 — Translation write endpoints accept any authenticated user

- **Severity:** MEDIUM (content integrity)
- **Evidence:** CONFIRMED BY SOURCE CODE + RUNTIME reachability
- **Time:** 2 minutes

**Runtime:** as the seed participant, `POST /api/translations` with `{}` returned **400 “key is required”** — not 403. The request passed authorization and reached the handler's validation.

**Cause:**
- `src/app/api/translations/route.ts` POST lines 76–83 check only `session?.user?.id`; writes follow at 103–114.
- `src/app/api/translations/[id]/route.ts` PATCH lines 5–12 and DELETE lines 77–84 do the same; writes at 26–55 and 93.
- No role check, no audit entry, no ownership concept (translations are global).

**Impact:** any participant can rewrite UI copy for every user, or delete a translation and break a screen. In a health product, altered copy is a safety and reputational issue, not just vandalism.

**Fix direction:** require `role === "admin"` (or a dedicated content permission) on all three verbs, and audit changes.

---

### D12 — Unauthenticated legacy endpoint can rewrite any observation's signals and record

- **Severity:** CRITICAL
- **Evidence:** CONFIRMED BY SOURCE CODE + RUNTIME reachability
- **Time:** 3 minutes

**Runtime:** an unauthenticated `POST /api/observation/reflection` with a non-existent id reached the handler and returned **500 “Failed to finalize”** — proving there is no auth gate before the write logic.

**Cause:** `src/app/api/observation/reflection/route.ts` `POST` lines 43–45 read the body immediately; there is no `auth()` call anywhere in the file. It then:
- line 92: `prisma.signal.deleteMany({ where: { observationId } })`
- lines 115+: `prisma.atlasRecord.upsert(...)`
- lines 152–156: marks the observation `reflection_generated`

The only thing an attacker needs is an observation id. Ids are CUIDs, but they appear in admin pages, audit rows and support exports.

**Impact:** cross-tenant integrity attack — erase or replace another participant's derived clinical signals and Atlas Record. Even without reading the data, destruction is enough.

**Fix direction:** delete the endpoint if it is legacy, or add `auth()`, ownership verification (same pattern as `api/observation/intelligence/route.ts` 126–147) and an audit entry. Confirm no client still calls it before removal.

---

### D13 — `/api/records` returns hard-coded mock data

- **Severity:** LOW
- **Evidence:** CONFIRMED BY SOURCE CODE
- **Time:** 1 minute (optional)

`src/app/api/records/route.ts` lines 3–11 return two fixed records (`WA-2026-03871`, `WA-2026-03870`) to any caller with a cookie; `POST` lines 13–16 echoes `{ success: true, recordId: "WA-NEW-001" }`. Runtime: HTTP 200.

**Impact:** if any screen consumes this route, it displays fictional records. If nothing consumes it, it is dead code that will confuse the next developer. Check consumers before deleting.

---

### D14 — A record exists, but the dashboard says the observation is incomplete

- **Severity:** MEDIUM (state consistency / UX)
- **Evidence:** CONFIRMED BY RUNTIME TEST
- **Time:** 2 minutes

**Observed:** `/api/participant/summary` returns `hasCompletedFirstObservation: false` and `progress: 50%`; `/api/participant/records` returns one record; `/dashboard` redirects to `/observation`.

**Cause:**
- `src/lib/observation/summary.ts` lines 509–512 define completion strictly as `flowKey === "first_observation" && status === "record_saved"`.
- Lines 552–558 compute progress as `observationResponse.count / formQuestion.count`, a raw answer ratio with no notion of required or skipped questions.
- The record exists because the wizard finalises on entering the record flow (`ObservationWizard.tsx` 296–300) before the observation is marked complete.

**Impact:** the participant sees a finished-looking Atlas Record while being told to continue the observation. It also means the record was generated from partial data — the same root cause as D7.

**Fix direction:** generate the record only after server-validated completion, and derive progress from the same completeness function.

---

## 3. Source-code reference guide

Use this table when the owner asks “where exactly?”. Line numbers are from the audited working tree and were re-checked on 4 Nov 2026.

| Ref | File | Lines | What it proves |
|---|---|---|---|
| S1 | `package.json` | 6, 72–79 | `next dev` is the documented start; `"type": "commonjs"` conflicts with ESM `proxy.ts`; `main`/`directories` are leftovers. |
| S2 | `proxy.ts` | 14–37, 39–49 | Auth is cookie-presence only; role checks are explicitly deferred to client layout guards. |
| S3 | `src/app/(admin)/layout.tsx` | 1, 29–47 | The admin guard is `"use client"` + `useEffect`; it runs after the server payload is delivered. |
| S4 | `src/app/(admin)/admin/access/page.tsx` | 35–45, 72–77 | Unguarded `prisma.user.findMany`, emails/names/roles rendered server-side. |
| S5 | `src/app/(admin)/admin/audit/page.tsx` | 35–41 | Unguarded audit query with `include: { user: true }`. |
| S6 | `src/actions/admin.ts` | 10–61, 63–99 | `createUser` has no authorization check at all; `updateUserRole` checks only “signed in”. |
| S7 | `src/app/api/observation/route.ts` | 143–153 | Saves only upsert supplied field ids; no deletion for omitted/skipped answers. |
| S8 | `src/app/api/observation/route.ts` | 177–201, 205–228 | `completed` from the client sets `record_saved`/`completedAt`; always returns success. |
| S9 | `.../observation/ObservationWizard.tsx` | 216–242 | `persistAnswers` ignores `res.ok`; errors are swallowed. |
| S10 | `.../observation/ObservationWizard.tsx` | 244–268 | `finalize` only handles `data.success`; auto-finalises on record screens. |
| S11 | `.../observation/ObservationWizard.tsx` | 270–286 | `completeAndExit` sets the local completion flag regardless of save outcome. |
| S12 | `.../observation/ObservationWizard.tsx` | 288–310, 312–330 | Navigation advances after a failed save; skip clears memory only. |
| S13 | `src/app/api/observation/intelligence/route.ts` | 126–147 | Correct ownership check (the pattern other routes should copy). |
| S14 | `src/app/api/observation/intelligence/route.ts` | 190–208 | Persistence errors swallowed; `success: true` returned even when governance fails. |
| S15 | `src/app/api/observation/reflection/route.ts` | 43–45, 92, 115–156 | No auth; `deleteMany` + `upsert` on a caller-supplied observation id. |
| S16 | `src/lib/observation/intelligence/reflection-runner.ts` | 205–236 | Governance is computed after the disclaimer is added to the scanned reflection. |
| S17 | `src/lib/observation/intelligence/governance-service.ts` | 10–15, 22–37 | Keyword-only block list (includes “diagnosis”) and `severity !== "block"` skip at line 25 → no rule runs. |
| S17a | `src/content/aikb/governance.json` | 4–31 | All six GOV rules are declared `"severity": "warn"`, so S17 skips every one; validation always returns `passed: true`. |
| S18 | `src/lib/admin/database-stats.ts` | 27–45 | MySQL `information_schema` columns and `SHOW STATUS` on PostgreSQL. |
| S19 | `src/lib/admin/system-status.ts` | 42–55, 112–115 | MySQL status failure swallowed; uptime fabricated as 100%. |
| S20 | `src/app/api/translations/route.ts` | 76–83, 103–114 | Session-only check before writes. |
| S21 | `src/app/api/translations/[id]/route.ts` | 5–12, 26–55, 77–84, 93 | Session-only check before update/delete. |
| S22 | `src/app/api/records/route.ts` | 3–16 | Hard-coded mock records and echo response. |
| S23 | `src/app/api/checkin/route.ts` | 57–64 | Creates a `record_saved` observation before intelligence; no idempotency. |
| S24 | `src/lib/observation/summary.ts` | 509–512, 542–565 | Completion requires `record_saved`; progress is a raw answer ratio. |
| S25 | `prisma/schema.prisma` / `docker-compose.yml` | schema 6; compose 2–16 | Schema is PostgreSQL; compose still provisions MySQL 8.4 — the drift behind S18/S19. |
| S26 | `src/app/(participant)/layout.tsx` | 87–101 | The dashboard gate accepts the `localStorage` completion hint as an alternative to the server flag, so a failed save still unblocks the UI. |

**Three excerpts worth showing on screen**

`proxy.ts` 22–36:
```ts
const sessionToken =
  request.cookies.get("__Secure-authjs.session-token") ??
  request.cookies.get("authjs.session-token") ??
  ...;
if (!sessionToken) {
  const loginUrl = new URL("/", request.url);
  return NextResponse.redirect(loginUrl);
}
return NextResponse.next();
```

`ObservationWizard.tsx` 220–235:
```ts
const res = await fetch("/api/observation", { ... });
const data = await res.json();
if (data.observationId && data.observationId !== observationId) {
  setObservationId(data.observationId);
}
return data.observationId as string | undefined;
```

`system-status.ts` 112–115:
```ts
return {
  overallStatus: anyDown ? "Down" : allOperational ? "Operational" : "Degraded",
  uptimePercent: uptimeSeconds > 0 ? uptimePercent : 100,
  uptimeSeconds,
```

---

## 4. Safe command reference

All commands below are read-only with respect to application data. The two exceptions are noted explicitly.

### Preconditions

- Run from `D:\Web Designs\Womb Atlas`.
- Use only the synthetic seed accounts.
- Do not run migrations, seeds, resets, `npm install`, or any `POST/PATCH/DELETE` except the deliberate probes listed in D2/D11/D12 (which target invalid ids or empty bodies).

### Commands

```powershell
# 1. Reproduce the startup defect (intentional; no data touched)
npm run dev

# 2. Workaround used for the audit
npx next dev --webpack -p 3200

# 3. Unauthenticated probe (expect a redirect once auth is fixed)
curl.exe -i http://localhost:3200/admin/access

# 4. Forged-cookie probe (read-only disclosure demo)
curl.exe -i -H "Cookie: authjs.session-token=forged-not-a-real-session" `
  http://localhost:3200/admin/access

# 5. Static checks
npx tsc --noEmit
npm run lint
npm run check:stale-answers

# 6. Read-only database inspection (no writes)
psql "$env:DATABASE_URL" -c 'select id, status, "currentScreenId", "completedAt" from "Observation" order by "startedAt" desc limit 5;'
psql "$env:DATABASE_URL" -c 'select count(*) from "ObservationResponse";'
```

**Expected static results (observed):** `tsc --noEmit` passes; `npm run lint` fails with 10 errors and 13 warnings; `check:stale-answers` reports “No stale answers” (19 select answers checked).

### Do not run during the demo

```text
prisma migrate dev | prisma migrate deploy | prisma db push
prisma db seed | npm run db:seed | npm run seed:loer-v7
any reset/truncate/drop script
npm install / npm ci (changes lockfile and node_modules)
any POST to /api/observation, /api/checkin, /api/observation/intelligence
any PATCH/DELETE to /api/translations
```

**Note for Windows:** in Windows PowerShell, `curl` is an alias for `Invoke-WebRequest`. Use `curl.exe` for the flags shown above.

---

## 5. 25-minute meeting script

**Format:** screen share, terminal on the left, editor on the right, browser in the middle. Keep a second window with this document for line numbers.

### 0:00–2:00 — Framing

> “This is a read-only review. I have not changed code, configuration or data, and every demo uses synthetic seed accounts. I’ll show you what breaks, why, and what it costs. Then I’ll propose a fix order. I will not fix anything in this session.”

State the headline up front:

> “There are two release blockers: the documented start command does not work, and admin data can be read with a cookie I typed by hand. Neither is hard to fix. The harder problem is that several parts of the system report success when they have failed.”

### 2:00–5:00 — D1: start command

Run `npm run dev`. Open `localhost:3000` → 500. Point at the module-format error, then `package.json` line 79.

> “One line, left over from `npm init`, makes the documented command unusable. The app runs with a webpack workaround, which is how I’ve been testing — but that is not a fix, and a new developer or CI will hit this immediately.”

Take the question “why didn’t tests catch it?” — because `tsc` passes and lint is already red; nothing runs the dev server in CI.

### 5:00–9:00 — D2: forged cookie

Run the `curl.exe` command with the forged cookie. Show `200` and the email addresses in the body. Then show `proxy.ts` 22–36 and the client-only guard in `(admin)/layout.tsx` 29–47.

> “The proxy asks ‘is there a cookie?’, not ‘is this a valid session, and is this person an admin?’. The role check lives in a client component, which means the server has already sent the data. In the browser you see a flash and a redirect; in `curl` you see everything.”

Mention the server actions at `src/actions/admin.ts` 10–61 as the next layer: `createUser` has no check at all.

### 9:00–12:00 — D3 and D4: admin observability

Open `/admin/database` → empty shell; show the console error `42703 column "table_rows" does not exist`, then `database-stats.ts` 27–45.

> “This is MySQL SQL in a PostgreSQL application. The compose file still provisions MySQL. The database screen has never worked in this environment.”

Open `/admin/status` → “All Systems Operational”, 100%, uptime “N/A”.

> “The metrics query fails, the failure is caught, and the page then invents 100%. Four green badges only prove that four counts executed.”

### 12:00–18:00 — D5, D6, D7: participant data integrity

Open the wizard and block `/api/observation` in DevTools. Answer, press Next, reload.

> “It advanced and said nothing. The answer is gone. `persistAnswers` never checks `res.ok`, and `completeAndExit` sets the local completion flag regardless.”

Then `skipSection` 312–330 + server 143–153.

> “Skip deletes the answer from memory, not from the database. The server only upserts what it receives. Anything omitted survives, and the next intelligence run still sees it.”

Then completion 186–201.

> “Completion is a boolean from the browser. The server does not check a single required answer. That is also why this draft has a record but is still marked in progress.”

### 18:00–21:00 — D9 and D12: safety controls

Show `src/content/aikb/governance.json` (all six rules `warn`), then `governance-service.ts` line 25, then the route's return at 203–208.

> “Every governance rule is declared ‘warn’. The validator skips anything that isn’t ‘block’, so it never scans a single word and always returns passed. The route then returns success without looking at the result. It is a safety control in name only. And if you simply change a rule to ‘block’ tomorrow, the first English record fails on its own disclaimer, because the scanned text includes ‘This record is not a diagnosis’.”

Then `reflection/route.ts` 43–45 and 92.

> “This endpoint has no auth at all. Give it an observation id and it deletes and replaces that person’s signals and record. I confirmed it reaches the write path unauthenticated; I did not execute a destructive write.”

### 21:00–24:00 — Fix order

Present the P0/P1 list from section 6. Emphasise:

> “P0 is about an hour: the module type, server-side session and role checks, and disabling the legacy endpoint. P1 is the data-integrity work — save errors, skip semantics, server-validated completion, idempotent runs, governance enforcement. P2 is observability and cleanup.”

### 24:00–25:00 — Close

> “The participant experience is close. The engineering risk is concentrated in authorization and in silent failure. I would not put this in front of real participants until P0 and the first three P1 items are done.”

Then the conclusion phrase from section 8.

### Anticipated questions

- **“Can we demo it today?”** Yes, with the webpack workaround, and only with seed data. The documented command is broken until the one-line fix.
- **“Is the data real?”** No. Seed accounts only; no production records were queried.
- **“Did you change anything?”** No source, config or database writes. This report is the only artefact.
- **“How long to fix?”** P0 is roughly a day including verification; P1 is several days; P2 can follow.
- **“Why wasn’t this caught?”** No CI runs the dev server or the participant flow; lint already fails and is ignored; there are no authorization tests.

---

## 6. MVP remediation priorities

Estimates assume one developer familiar with the codebase; they exclude QA and deployment.

### P0 — before any external demo or pilot (≈1 day)

| # | Action | Files | Why now |
|---|---|---|---|
| P0-1 | Remove/repair the module type (`"type": "module"` or delete line), drop `main`/`directories` leftovers | `package.json` | Unblocks the documented start command, CI and onboarding. 5 minutes. |
| P0-2 | Validate the session in the proxy (NextAuth `auth` wrapper or JWT decode) — presence is not authentication | `proxy.ts` | Stops forged cookies at the edge. |
| P0-3 | Add server-side role guards to the admin layout **and** every admin page/server action; make `createUser` require admin | `(admin)/layout.tsx`, `admin/*/page.tsx`, `actions/admin.ts` | Closes the disclosure and the unauthenticated user-creation path. Client guards become UX only. |
| P0-4 | Authenticate + authorize or delete `/api/observation/reflection` | `api/observation/reflection/route.ts` | Removes the cross-tenant destructive endpoint. |

### P1 — before pilot with real participants (≈3–5 days)

| # | Action | Files | Why |
|---|---|---|---|
| P1-1 | Handle save failures: check `res.ok`, block navigation, retry, only set the local flag after 2xx | `ObservationWizard.tsx` | Prevents silent data loss. |
| P1-2 | Server-validate completion against required questions; refuse `completed: true` otherwise | `api/observation/route.ts` | Stops empty/partial “complete” records. |
| P1-3 | Delete cleared answers on skip (or persist an explicit skipped state) in one transaction | `ObservationWizard.tsx`, `api/observation/route.ts` | Makes the record match the participant's intent. |
| P1-4 | Make governance real: mark intended rules `block`, exclude the disclaimer from the scanned corpus, block/replace on failure, store truthful results | `src/content/aikb/governance.json`, `reflection-runner.ts`, `governance-service.ts`, `intelligence/route.ts` | Restores the safety control and removes the latent English self-trip. |
| P1-5 | Make intelligence runs idempotent (input hash + unique constraint) | `intelligence/route.ts`, schema | Stops duplicate runs and repeat cost. |
| P1-6 | Surface persistence failures (`persisted: false`, metric/log) instead of `success: true` | `intelligence/route.ts`, `api/observation/route.ts` | Makes divergence visible and supportable. |
| P1-7 | Restrict translation writes to admin and audit them | `api/translations/**` | Protects global content integrity. |

### P2 — hardening and cleanup (≈2–3 days)

| # | Action | Files |
|---|---|---|
| P2-1 | Port admin DB stats to PostgreSQL; align `docker-compose.yml` and `HANDOVER.md` | `database-stats.ts`, compose, docs |
| P2-2 | Honest health page: real uptime, `unknown` instead of 100, real dependency probes | `system-status.ts` |
| P2-3 | Remove or clearly quarantine `/api/records` mock (check consumers first) | `api/records/route.ts` |
| P2-4 | Fix the 10 lint errors and add CI that runs `tsc`, lint and a smoke test of `npm run dev` | repo-wide |
| P2-5 | Unify completion state so a record is only generated after completion | `ObservationWizard.tsx`, `summary.ts` |

**Sequencing note:** P0-1 must be first, otherwise none of the fixes can be verified through the documented path. P0-2/P0-3 should be done together; changing only the proxy leaves the server actions exposed.

---

## 7. Outstanding verification

These items are deliberately **not** claimed as findings. Each needs a dedicated throw-away account and a database snapshot.

| # | Question | Why it matters | Safe method |
|---|---|---|---|
| V1 | Does a failed save actually leave no row, and does the dashboard still unblock? | Confirms D5 end-to-end | Block the request in DevTools; compare `ObservationResponse` before/after; re-seed afterwards |
| V2 | Do skipped answers persist across resume and reach intelligence? | Confirms D6 | Test account; save, skip, reload, inspect rows; do not run intelligence if cost matters |
| V3 | Can a participant complete with zero answers via the API? | Confirms D7 | Test account + disposable observation; delete afterwards |
| V4 | What happens when one governance rule is changed to `block`? | Predicts a total English failure mode before it ships | Deterministic: the disclaimer contains “diagnosis” and is inside the scanned JSON; no runtime write needed |
| V5 | Are there any `"severity": "block"` rules anywhere else (other AIKB versions)? | Confirms the validator is inert in this build | `Get-ChildItem src/content -Recurse -Filter *.json \| Select-String '"severity"'` |
| V6 | Is `/api/observation/reflection` still called by any client? | Decides delete vs. guard | Static search of `src/` for the path; check network traces |
| V7 | Is `/api/records` consumed by any screen? | Decides delete vs. keep | Search imports/fetches; runtime network log |
| V8 | Do sessions survive a database reset with a stale JWT? | Related resume risk | Requires a disposable database — **not** in this environment |
| V9 | Does `npm run build` succeed after the module-type fix? | Release gate | Separate worktree/branch; not run in this read-only audit |
| V10 | Are there other MySQL-only queries? | Hidden breakage | `Get-ChildItem src -Recurse -Include *.ts \| Select-String "SHOW \|information_schema\|TABLE_ROWS\|DATA_LENGTH"` |
| V11 | Do admin server actions enforce role at runtime after the fix? | Verifies P0-3 | Automated test with participant and admin sessions |

**Not verified at all:** production configuration, real participant data, email delivery, model-provider behaviour with live keys, accessibility, load/performance, backup and restore.

---

## 8. Conclusion

The evidence supports a confident technical walkthrough: the startup defect, the forged-cookie disclosure, the PostgreSQL crash, the false health page, the duplicate runs and the state inconsistency were all reproduced at runtime; the save, skip, completion, governance and persistence defects follow directly from the cited code.

However, the documented start command fails, so a live demo depends on a workaround rather than the shipping path, and the highest-risk write behaviours were intentionally not exercised.

**PARTIALLY READY**

---

### Appendix — environment snapshot

| Item | Value |
|---|---|
| Framework | Next.js 16.2.9 (App Router, Turbopack default), React 19 |
| ORM / DB | Prisma 7.8.0, `@prisma/adapter-pg`, PostgreSQL `127.0.0.1:5432/wombatlas_db` |
| Auth | NextAuth v5, JWT sessions |
| Runtime used | `npx next dev --webpack -p 3200` (workaround) |
| Seed accounts | `participant@system.com` / `password`, `admin@system.com` / `password` (synthetic) |
| AI keys | `OPENAI_API_KEY` and Google/GCS variables empty in `.env`; deterministic fallback, no external cost |
| Static checks | `tsc --noEmit` passes; `eslint` 10 errors / 13 warnings; `check:stale-answers` clean |
| Seed data observed | 1 in-progress first observation (`cmvxs9lpq00004cvknfodhqp7`, 33 responses, `currentScreenId=s80-constellation-record`), 1 AtlasRecord (Moderate), 3 intelligence runs, 3 audit CREATE rows, 6 `*_other` responses without parent selections |
| Repo state | Not a git repository; no source/config/DB changes made during the audit |

### Note on existing documents

`demonstration_plan.md` (also dated 4 Nov 2026) predates this audit and uses a different issue list. It is not the evidence base for this report. Where they conflict, this report is authoritative because each claim here has a runtime observation or a cited code path. In particular, the earlier plan treats the empty Google/OpenAI configuration as a defect that prevents records; runtime evidence contradicts that — records and runs were produced through the deterministic fallback, and no external API was called.
