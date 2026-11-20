# Technical Change Specification — LOER v7.0.0 + AIKB v2.0/v2.1

**Companion to:** `LOER_v7_Change_Request.md` (client-facing) · **Revision B**
**Repo:** `womb-atlas-observatory-system` · branch `staging` @ `a3da931`
**Date:** 2 August 2026
**Constraint:** no new modules. Every change lands in an existing file in the chain below.

### Revision B changes

- **Corrected** — TASK-01: LOER S29 `pain_present` is a *missing question*, not a rename of `pain_response`. Revision A was wrong on this.
- **New** — TASK-09: the field-map bridge (CR-09/CR-10). Highest-value, lowest-cost item; promoted to P0.
- **New** — §3.5: assessment of the AIKB v2.0/v2.1 package.
- **New** — §6 now carries dated stages.

---

## 1. How the observation flow is actually built

Understanding this chain is a prerequisite — the flow is **generated**, so most fixes are edits to a source register and a generator, not to React components.

```
src/lib/observation/intelligence/v43/screen-register-first-observation.ts   ← v5 source of truth (hand-authored TS, mirrored from mobile app)
src/lib/observation/intelligence/v43/observation-contract.ts                ← app field id → AIKB registry field id
prisma/seed/form-definition.legacy.json                                     ← carries atlas_checkin flow, projection targets, narrative prompt texts
        │
        ├── scripts/build-form-definition.mts        (npm run form:build)
        ▼
prisma/seed/form-definition.json                     ← 88 screens / 58 questions / 97 routes / 0 signals / 0 reflectionRules
        │
        ├── prisma/seed.mjs                          (npx prisma db seed)
        ▼
DB: form_flows, form_screens, form_questions, form_answer_options,
    narrative_prompts, screen_routes, form_translations
        │
        ├── src/lib/observation/definition.ts        (reads DB → FormDefinition)
        ▼
src/app/(participant)/observation/ObservationWizard.tsx
        ├── src/lib/observation/router.ts            resolveNextScreen / isScreenVisible
        ├── src/lib/observation/conditions.ts        condition DSL evaluator
        └── src/app/(participant)/observation/screens/ScreenRenderer.tsx
```

Finalisation is a **separate** path:

```
ObservationWizard.finalize()  →  POST /api/observation/intelligence
                                 └── src/lib/observation/intelligence/reflection-runner.ts (AIKB v1 engine, LIVE)

POST /api/observation/reflection  →  SignalRule + ReflectionRule tables  (DORMANT — see §3.3)
```

### Note on stale project documentation

`CLAUDE.md` describes an architecture that no longer exists and will mislead anyone picking this up:

- It names `src/content/observation-schema.json` (65 questions) as the source of truth. **That file does not exist.** The seeded `form-definition.json` replaced it.
- It states `api/observation/route.ts` creates the `AtlasRecord`, computes burden from `bleedingScore`/`painScore`/`safetyFlag`, and generates a mocked reflection. **None of that is true** — that route only persists responses and projects to domain tables. Burden and reflection come from the AIKB engine via `/api/observation/intelligence`.
- It states `api/records/route.ts` and `api/voice/route.ts` are mocked stubs — worth re-verifying before relying on either statement.

**Action:** update `CLAUDE.md` as part of P0. Cost is minutes; the cost of not doing it is every future change being made against a wrong mental model.

---

## 2. Pending build step — verified, not hypothetical

`prisma/seed/form-definition.json` is **out of sync with its own generator**. Running `npm run form:build` produces a different file than the one committed.

Verified by running the generator and diffing (working tree since restored to `HEAD`):

```
prisma/seed/form-definition.json    | 23 ++++-------------------
prisma/seed/screen-register-v5.json |  2 +-
```

**Three route targets change — two are LOER v7.0.0 branch fixes:**

| Route | Committed (live in DB) | After `form:build` | LOER v7.0.0 |
|---|---|---|---|
| `s17-ever-pregnant` = `no` | `s21-bleeding-patterns` | `s20-trying-to-conceive` | `S19` (still wrong, but closer) |
| `s17-ever-pregnant` = `prefer_not_to_say` | `s21-bleeding-patterns` | `s20-trying-to-conceive` | `S19` (still wrong) |
| `s58-spoken-to-provider` = `no` | `s63-narrative-intro` | `s60-care-dismissal` | **`S60` ✅ exact match** |

**But regeneration is lossy — this is a defect in the generator:**

`scripts/build-form-definition.mts` does not emit the `translations` block. Running it drops **every** screen, question and option translation (ur / fr / sw / es) — 0 of 88 screens retain translations after a rebuild. Those translations were added to `form-definition.json` on 13 July, after the generator last ran, and exist **only** in the committed JSON.

> **Do not run `npm run form:build` until the generator preserves translations.** It will silently destroy the multilingual content and the loss only surfaces after a reseed.

Also do **not** run `npm run aikb:build` — `scripts/README.md` documents that it drops `pain_duration` from `src/content/aikb/observations.json` (66 fields committed vs 65 emitted), because the field exists in the mobile app's registry but not in the `Part0_Observation_Registry` workbook.

### TASK-00 (do first, blocks everything else)

1. `scripts/build-form-definition.mts` — merge translations from the existing `form-definition.json` (or from `prisma/seed/translations.json`) into generated output instead of dropping them. Add a guard that fails the build if the translated-screen count decreases.
2. Re-run `npm run form:build`, confirm the diff is **only** the three route targets.
3. `npx prisma db seed`.

Without TASK-00, every subsequent seed change either loses translations or has to be hand-patched into the JSON, which defeats the generator.

---

## 3. Current-state facts established during review

### 3.1 Seed contents

| Artifact | Count |
|---|---|
| `first_observation` screens | 78 (`s00-landing` … `s82-atlas-record`) |
| `atlas_checkin` screens | 10 (`S83`–`S92`) |
| Questions | 58 (52 first-observation, 6 check-in) |
| Routes | 97 — of which **11 carry a condition**, all others unconditional |
| Narrative prompts | 6 (5 on `s64-narrative-chamber`, 1 on `s71-sensitive-narrative`) |
| `signals` | **0** |
| `reflectionRules` | **0** |

### 3.2 Routing engine capability

`src/lib/observation/router.ts` + `conditions.ts` are sound and fully data-driven. The DSL supports `all` / `any` / `not`, and leaf ops `eq`, `neq`, `in`, `nin`, `contains_any`, `any_except`, `count_gte`, `present`, `isTrue`, plus `signal` and `burden` predicates.

**Every branch in LOER v7.0.0 is expressible in the existing DSL.** No engine work is required for CR-04 — only seed data. This matches the working assumption that branching is seed-driven.

### 3.3 Two parallel intelligence paths

| Path | Status | Notes |
|---|---|---|
| `POST /api/observation/intelligence` → `reflection-runner.ts` (AIKB v1) | **LIVE** — called by `ObservationWizard.finalize()` | Bundle is fully populated: 66 observation fields, 491 signal mappings, 120 patterns, 80 reflection archetypes, 360 knowledge-graph edges, 5 indices, 6 governance rules. |
| `POST /api/observation/reflection` → `SignalRule` / `ReflectionRule` tables | **DORMANT** | Nothing calls it. Both tables seed 0 rows, so `computeSignals()` returns `[]`, `computeBurden([])` returns `"Low"`, and `selectReflection` returns empty copy with target `S77A`. |

The dormant path is dead code with a live route handler and a misleading constellation implementation (its own 6-domain list, *including* Cycle, which the live path lacks). It also skews admin statistics: `src/lib/admin/knowledge-governance-stats.ts` and `seed-intelligence-stats.ts` both count `signalRule` rows, which are always 0.

**Recommendation:** delete `/api/observation/reflection`, `src/lib/observation/signals.ts`, `src/lib/observation/reflection.ts` and the `SignalRule` / `ReflectionRule` models, and repoint the two admin stats modules at the AIKB bundle. Alternative (if the DSL path is wanted for governance transparency): populate both tables from the register. **Do not keep both.**

### 3.4 Hardcoded life-stage suppression

`src/lib/observation/router.ts:17-31` — `LIFE_STAGE_SUPPRESSED_SCREENS` hides `s20-trying-to-conceive` and `s21`–`s27` (the entire bleeding chamber) when `reproductive_state` is `pregnant` or `postmenopausal`.

The in-code comment states this is held in code rather than seeded `visibilityRule` data deliberately, so it does not require a reseed. That reasoning is sound but the **rule itself contradicts LOER v7.0.0** (see CR-04). The register adapts wording; it does not exclude screens.

---

### 3.5 AIKB v2.0 / v2.1 package assessment

Delivered in `documentations/AIKBs/AIKBs/` — 23 workbooks plus a release report. The repo currently seeds from **v1** workbooks in `prisma/seed/aikb-specs/`, which the new Compatibility Matrix classifies as `Superseded`.

**Safe to adopt now — `AIKB_v2.1_Part0_Observation_Registry.xlsx`.** Sheet `01_Observation_Registry`, 65 rows, carries `Source_Screen_ID`, `Source_Field_ID`, `Source_DB_Table`, `Source_DB_Column`. Verified join: **55 of the 58 questions** in `form-definition.json` match a Part 0 row on `targetColumn` → `Source_DB_Column`. The three misses (`consent_acknowledged`, `preferred_language_disclosure`, `pain_duration`) are the three questions with no projection target configured. This is the generator input for TASK-09.

**Not safe to adopt — the signal, pattern and reflection layers.** From `AIKB_2.0_Release_Package.xlsx`:

| Sheet | Finding |
|---|---|
| `08_Final_Classification` | *"Production Approved: NO — for every component without exception"* |
| `06_Governance_Dashboard` GOV-14 | **Blocker** — *"No pattern may be emitted, therefore no reflection may be generated."* |
| `06_Governance_Dashboard` GOV-13 | **Blocker** — all 59 signals are Draft |
| `04_Compatibility_Matrix` | AIKB v1.0 Parts 0–13 → `Superseded` (683 legacy signals, 120 legacy patterns) |
| `07_Release_Readiness` | 9 gates pass, 7 blocked, 4 not started |

The live engine runs 491 signal mappings derived from v1. Swapping to 59 unratified signals under an active GOV-14 prohibition replaces a working pipeline with one contractually forbidden to emit output. **Hold `src/content/aikb/*.json` at v1** until GOV-13/GOV-14 close.

**Screen-numbering conflict.** Part 0's `Source_Screen_ID` uses the *build's* numbering from S67 onward (`S80` Constellation, `S81` Observed Patterns, `S82` Atlas Record), while `AIKB_2.0_Semantic_Consistency_Audit.xlsx` `TRN-08` uses LOER's (*"S77 constellation states"*). Do **not** derive screen IDs from Part 0 — join on `Source_DB_Column` only, which is numbering-independent. This is why TASK-09 keys on the DB column rather than the screen or field id.

**Out of scope.** `AIKB_v2.1_Part7A_Participant_Archetype_Registry.xlsx` — 6 archetypes, 49 pattern maps, 20 transition rules. New participant-facing classification layer; new module; excluded.

## 4. Schema changes

Additive only. No table is dropped; no participant data is destroyed.

### 4.1 `FormScreen` — governance metadata (CR-06)

`prisma/schema.prisma:83`. All nullable, all backfilled from the register.

```prisma
model FormScreen {
  // ... existing fields ...
  scrId            String?  // SCR-1003
  masterScreenId   String?  // S03            ← v7.0.0 canonical id
  trustCardId      String?  // TRUST-S03
  aiDisclosure     String?  @db.Text
  adaptiveRuleIds  Json?    // ["ADP-1003"]
  knowledgeIds     Json?    // ["KN-3001","KN-3005"]
  reasoningIds     Json?    // ["RC-1005","RC-8001"]
  reflectionIds    Json?    // ["REF-6001","REF-8004"]
  observationIds   Json?    // ["OBS-6001", ...]
  technicalComponents Json? // ["TC-1002","TC-7001"]
  registerStatus   String?  // "Draft for clinical review"
}
```

`status` stays as-is (it drives runtime behaviour); `registerStatus` carries the register's governance state so the admin portal stops asserting `Locked` for everything.

### 4.2 New domain columns

Existing chamber tables gain columns for the fields CR-01/CR-02 introduce. **No new tables** — these are additive columns on `PainPattern`, `DailyLife`, `CareAccess`, `CyclePattern`, `ObservationConsent`, `AtlasRecord`. Exact columns follow from the projection mapping in §5.

### 4.3 Migration

One migration, `prisma/migrations/<ts>_loer_v7_alignment/`. Additive DDL only — safe to run against existing data.

> **Note:** `prisma/schema.prisma` declares `provider = "mysql"` and `src/lib/prisma.ts` uses `@prisma/adapter-mariadb`, while `docker-compose.yml` provisions Postgres. Generate the migration against MariaDB/MySQL — the compose file is stale. Do not "fix" this as a side effect of this work.

---

## 5. Work items

### TASK-01 — Branching (CR-04) · **P1**

**File:** `src/lib/observation/intelligence/v43/screen-register-first-observation.ts` (source register), then regenerate.

| Branch | Change |
|---|---|
| S17 `ever_pregnant` ≠ `yes` | route to `s19-pregnancy-loss`, not `s20`/`s21`. Register: *"S18 if Yes; S19 otherwise"*. |
| S29 pain gate | **New question required first — corrected in Rev B.** `s30-pain-response` is *"When pain happens, what do you usually do?"* (`continue_as_usual` / `slow_down_or_rest` / `cancel_plans_or_activities` / `stay_home_or_in_bed`) — a coping question, semantically LOER **S34** `pain_management`, not a presence gate. Add `pain_present` (`yes` / `no` / `unsure`) as a new S29 screen, then the route: `{"field":"pain_present","op":"eq","value":"no"}` → `s35-pain-progression`, default → `s30`. Re-home the existing `pain_response` question to S34. `s35` is the convergence point — register lists its Previous Screen as *"S29 or S34"*. |
| S39 cycle applicability | new screen (TASK-02) + branch on `cycle_applicability` → S40A / S40B. |
| S58 `spoken_to_provider` = `no` | → `s60-care-dismissal`. **Already correct in the source register — delivered by TASK-00.** |
| S72 → S73/S74 | branch on the Explore vs Continue action. |
| S76 → S77/S78/S79 | branch on the Explore vs Continue action. |

**Life-stage suppression:** delete `LIFE_STAGE_SUPPRESSED_SCREENS` (`router.ts:17-31`). Replace with adaptive *wording* — the register's mechanism is `ADP-4001` (S21), `ADP-4005` (S25), `ADP-5006` (S41) and the S40A/S40B variants, i.e. per-screen copy variants keyed on `reproductive_state` / `cycle_applicability`, not visibility. Implement via the existing `translations` mechanism or a `copyVariants` block on the screen; **do not** implement as a new module.

Keep `isScreenVisible` and the `visibilityRule` DSL — they remain correct infrastructure.

### TASK-02 — Missing screens (CR-01) · **P2**

Add to the source register, then regenerate. Render kinds available today: `question`, `information`, `consent`, `safety_check`, `safety_alert`, `narrative`, `review`, `processing`, `reflection`, `constellation`, `observed_patterns`, `atlas_record`, `confirmation`, `comparison`.

| LOER | Screen | renderKind | New render kind needed? |
|---|---|---|---|
| S15 | Reproductive History Intro | `information` | no |
| S33 | Pain Triggers & Associated | `question` (2 multi-selects) | no |
| S34 | Pain Management & Impact | `question` (2 grouped multi-selects) | no |
| S39 | Cycle Applicability Transition | `question` | no |
| S46 | Functional Impact | `question` | no |
| S62 | Information & Support Needs | `question` | no |
| S63 | Priority Question | `narrative` (text or audio) | no |
| S64–S68 | Narrative Prompts 1–5 | `narrative` ×5 | no — split the existing single screen; move `NP01`–`NP05` to one screen each and replace prompt text with the register's five themes |
| S69 | Most Important Thing | `narrative` | no |
| S73 | Reflection Expansion & Education | — | **yes** — `reflection_expansion` |
| S74 | Reflection Review & Continue | — | **yes** — `reflection_review` (accept / disagree / correct / regenerate, versioned) |
| S79 | Record Privacy & Use Controls | — | **yes** — `record_privacy` |

Three new render kinds → three cases in `ScreenRenderer.tsx:104` and three entries in the `RenderKind` union at `src/lib/observation/types.ts:29`. These are new *screen types within the existing renderer*, not new modules.

S74 needs a regeneration endpoint. Extend the existing `POST /api/observation/intelligence` with a `regenerate` flag and a version counter on `AtlasRecord` — do not add a new route.

### TASK-03 — Corrected captures (CR-02) · **P2**

Source register edits, all seed-only:

- S56 — replace `symptom_predictability` with `symptom_burden` (manageability / overwhelm scale).
- S32 — add `pain_spread`; optional body map (TC-6004) behind the existing multi-select.
- S52 — add `priority_impact_areas`.
- S53 — add `symptom_concern`; rename `normalization_impact` → `normalization_context`.
- S61 — add `care_access_barriers` (optional multi-select).
- S01 — persist `consent_version` + `consent_preferences` into `ObservationConsent`.
- S04 — persist `safety_alert_viewed` + `safety_alert_version`.
- Input types: `bleeding_progression` → single, `pain_timing` → multi, `symptoms_related_to` → multi, `care_response` → multi.

**Multi→single on `bleeding_progression` is data-affecting.** Existing rows hold arrays. Either migrate (take the highest-severity element) or retain arrays for pre-migration records and read defensively. Flag to the client before executing.

### TASK-04 — Record sequencing + privacy controls (CR-05) · **P0**

**Highest priority.** Two coupled changes:

1. **Reorder** the terminal screens to the register sequence: `s75-prep` → `s76-record-overview` → `s77-constellation` → `s78-observed-patterns` → `s79-privacy-controls` → `s80-save`. Currently `s78-atlas-record-saved` (`confirmation`, order 73) fires **before** constellation (75), patterns (76) and the record screen (77).
2. **Move the commit point.** `ObservationWizard.tsx:257` calls `finalize()` on entering any screen in `RECORD_KINDS`; `/api/observation/intelligence` then persists the `AtlasRecord`. Split this: *derivation* (compute reflection, constellation, patterns for display) must remain early so S76–S78 have content, but *persistence* must move behind the S80 save action.

Suggested split, reusing the existing route: `POST /api/observation/intelligence` gains `{ persist: boolean }`. S75 calls it with `persist: false` (derive and return, no write); S80 calls it with `persist: true` plus the `record_privacy_controls` payload from S79. `Observation.status` moves to `record_saved` only on the S80 call.

Add `record_privacy_controls` (OBS-9001) to `ObservationConsent` — storage, contribution and sharing choices as separate booleans, not one blanket flag. Register: *"Saving is separate from optional contribution; no consent expansion."*

### TASK-05 — Governance metadata (CR-06) · **P3**

1. Schema per §4.1.
2. Add the LOER CSV as a committed generator input — `prisma/seed/loer-v7-register.csv` (the file already sits at repo root as `LOER_v7.0.csv`, currently untracked).
3. `scripts/build-form-definition.mts` — join the CSV onto each screen by master screen ID, emit the governance block. Semicolon-delimited ID lists split to arrays.
4. `prisma/seed.mjs:88-106` — write the new columns.
5. Surface `aiDisclosure` and Trust Card in the wizard chrome (P3, gated on client decision D3).
6. Repoint the admin portal's status display at `registerStatus`.

### TASK-06 — Cycle constellation domain (CR-07) · **P3**

`src/app/api/observation/intelligence/route.ts:24-38` — `PATTERN_DOMAIN` has no Cycle entry, and `CONSTELLATION_DOMAIN_ORDER` (line 39) omits it, because the AIKB ontology has no dedicated cycle pattern. Requires either a new pattern in the AIKB registry or mapping an existing hormonal/rhythm pattern to Cycle. **Needs a scientific decision — do not resolve unilaterally in code.**

### TASK-07 — Field renaming (CR-08) · **P3**

Rename in the source register + `observation-contract.ts`. `ObservationResponse.fieldId` is a plain string, so a data migration must rewrite existing rows. Ship with a compatibility map in `src/lib/observation/definition.ts` so in-flight drafts resume.

Priority within P3: `period_dizziness` → `dizziness_frequency` and `pain_response` → `pain_present` first — both carry semantics, not just naming.

### TASK-08 — Sensitive Topics disposition (CR-03) · **P4, gated on D1**

If re-homing: `pain_during_sex` and `bowel_movement_pain` → S33 `associated_experiences` options; `unusual_discharge` → S36 `pelvic_symptoms`; `symptom_priority` → S63 Priority Question. Retire `s65`, `s66`, `s71`, `s72`, `s73-processing-drift`, `s74-review-archive`, `s33-pain-duration`, `s34-pain-predictability` (fold the last into S30 `pain_pattern`).

Screens are retired from the register; **existing `ObservationResponse` rows are retained** — participant answers are never deleted.

---

### TASK-09 — Field-map bridge (CR-09 + CR-10) · **P0, do first**

**Defect:** `src/lib/observation/aikb/field-map.ts` resolves app field ids by `toLowerCase()` with an empty `OVERRIDES` map. `extractor.ts:76` (`if (!registryField) continue;`) silently drops any field the AIKB registry does not know. **20 of 58 questions are dropped today** — answers persist in `ObservationResponse` but never reach signals, patterns, constellation or reflection.

**Fix — generated, not hand-written:**

1. Commit `AIKB_v2.1_Part0_Observation_Registry.xlsx` (or a CSV export of sheet `01_Observation_Registry`) into `prisma/seed/`.
2. Extend `scripts/build-form-definition.mts` to emit an override map by joining each question's `targetColumn` to Part 0's `Source_DB_Column`, taking `Source_Field_ID.toLowerCase()` as the registry id. 55 of 58 resolve automatically.
3. Write the result into `field-map.ts`'s `OVERRIDES` as a generated constant; delete the incorrect "Verified: every one of the 65 app fields maps" comment at lines 2–4.
4. Handle the three unjoined questions explicitly: give `consent_acknowledged` its `observation_consents.consent_acknowledged` projection target (Part 0 OBS-001 defines it); leave `preferred_language_disclosure` and `pain_duration` unmapped with a comment.
5. Add a build assertion: fail if any question resolves to no registry field. This is what stops the defect recurring.

No DDL. No reseed of participant data. One file changes at runtime.

**Verification:** submit a fixture observation touching all 58 fields, assert `extractObservations()` returns a record for every non-narrative field, and confirm the constellation moves on domains that previously stayed at zero.

**Coupling:** ships in the same commit as TASK-07 (field renaming) or the renames re-break the map.

## 6. Execution order and dates

Working days. Kickoff Monday 3 August 2026. Stage names match §5.1 of the change request.

| Stage | Task | Duration | Delivery | Gate |
|---|---|---|---|---|
| **S1** | **TASK-09** field-map bridge · **TASK-00** generator translation fix | 4d | **Thu 6 Aug** | none — start immediately |
| **S2** | **TASK-04** record sequencing + S79 privacy (+ migration) | 5d | **Thu 13 Aug** | D5 |
| **S3** | TASK-01 branching, S29 gate question, life-stage reversal | 5d | **Thu 20 Aug** | none |
| **S4** | TASK-02 missing screens (+3 render kinds), TASK-03 corrected captures | 6d | **Fri 28 Aug** | **D7, D8, D2** by Fri 14 Aug |
| **S5** | TASK-05 governance metadata (+ migration), TASK-06 cycle domain, TASK-07 field renaming | 5d | **Fri 4 Sep** | D3, D4, D6; TASK-06 needs a scientific decision |
| **S6** | TASK-08 sensitive topics | 4d | **Thu 10 Sep** | D1 + client closure of GOV-16 |
| **S7** | Seed-graph verification script (§7), conformance run, stabilisation | 4d | **Wed 16 Sep** | — |

Housekeeping — fold into any stage after S1: delete the dormant DSL path (§3.3) and correct `CLAUDE.md` (§1).

**Not scheduled:** the AIKB engine upgrade (§3.5) is blocked by GOV-13/GOV-14 and cannot be dated. Part 7A archetypes are out of scope.

**Critical path:** S1 → S2 → S3 → S4 → S5 → S7. S6 is the only stage that can be dropped without moving the completion date.

---

## 7. Verification

No test runner is configured in this repo. Recommended checks before each reseed:

1. `npm run form:build` → diff must contain **only** intended changes; translated-screen count must not decrease (guard added in TASK-00).
2. Route reachability: assert every screen `S01`–`S80` is reachable from `s00-landing` for at least one answer set, and that no screen is orphaned.
3. Branch coverage: one traversal per LOER branch condition — `ever_pregnant` ∈ {yes, no, prefer_not_to_say}, `pain_present` ∈ {yes, no, unsure}, `cycle_applicability` variants, `spoken_to_provider` ∈ {yes, no}, safety flags set and unset.
4. Life-stage: traverse as `pregnant` and `postmenopausal` — bleeding screens must now be **present with adapted wording**, not absent.
5. Sequencing: confirm no `AtlasRecord` row is written before the S80 action.
6. `npm run lint` and `npm run build`.

A small script under `scripts/` asserting 2–5 against the generated `form-definition.json` would be worth the hour; it is a graph walk over the seed JSON, requires no DB, and is not a new module.
