# LOER v7.0.0 Alignment — Implementation Notes

**Covers:** CR Revision C §2 (new screens), §3 (screen adjustments), §4 (branching and routing)
**Date:** 12 August 2026

---

## 1. What was built

| File | Purpose |
|---|---|
| `prisma/seed/loer-v7-alignment.mjs` | The alignment overlay — new screens, questions, options, narrative prompts, screen/question patches, retirements, and the rebuilt routing table. |
| `prisma/seed.mjs` | Applies the overlay in memory before any DB write. |
| `scripts/verify-loer-v7.mjs` | Offline conformance check. No database needed. |
| `src/lib/observation/types.ts` | Three new render kinds. |
| `src/app/(participant)/observation/screens/ScreenRenderer.tsx` | Renders the three new kinds; S04 now renders its acknowledgement. |
| `src/lib/observation/router.ts` | Life-stage screen suppression removed (§3.3). |

### Why an overlay rather than editing the generated definition

`prisma/seed/form-definition.json` is generated from the mobile screen register by `npm run form:build`. Editing it directly would put the alignment one regeneration away from being lost. The overlay is applied in memory at seed time, so the generator and the alignment stay independent and `npx prisma db seed` produces the aligned flow either way.

### Commands

```bash
node scripts/verify-loer-v7.mjs
```

```bash
npx prisma db seed
```

### Result

```
Overlay applied: screensAdded 17, screensRetired 13,
                 questionsAdded 22, questionsPatched 6, questionsRetired 2
Flow: 82 screens, 66 questions, 88 routes
PASS — 19 branch cases and all structural checks.
```

The verifier asserts dense ordering, exactly one unconditional fallback per screen, no orphan or unreachable screens, no duplicate field ids or option values, and walks the graph once per branch case — including that a "no pain" participant reaches S35 without seeing any pain-detail screen, that "never spoken to a provider" still reaches Access to Care, and that `record-privacy` always precedes the save screen.

---

## 2. Decisions taken during implementation

**Screen ids stay internal slugs.** Per CR §9.1 condition 5. The LOER number is carried on each screen as `loerScreenId` for traceability and is asserted by the verifier. New screens use descriptive slugs (`pain-presence`, `pain-triggers`, `record-privacy`) rather than LOER numbers, so no existing `Observation.currentScreenId` pointer is invalidated.

**S30 becomes Pain Pattern; the coping question moves to S34.** `s30-pain-response` asked *"When pain happens, what do you usually do?"* — a coping question, which LOER places at S34. S30 now carries `pain_pattern` (frequency, from AIKB Part 0), and the coping question becomes `pain_functional_impact` on the new S34 screen. Its option values are unchanged, so the data migration is a direct field rename.

**S39 → S40A / S40B is delivered as adaptive wording on one screen.** `FormQuestion.fieldId` is unique, and both variants capture `cycle_predictability`, so two screens cannot both hold it. S40 is seeded with wording that reads correctly for cycling and non-cycling participants. If the client wants genuinely distinct copy per variant, that needs a `copyVariants` column — see §3(H).

**Explore / Continue choices are answer-map fields, not questions.** `reflection_explore_choice` (S72) and `record_explore_choice` (S76) drive their branches. The condition evaluator reads the answer map directly, so no rendered question is needed — but the buttons must write them. See §3(A).

**Retired screens do not delete participant answers.** `ObservationResponse.fieldId` is a plain string with no foreign key to `FormQuestion`, so answers captured on retired screens survive. They are re-homed by the migration in §3(E).

**Narrative answers need no migration.** Prompt ids `NP01`–`NP05` are re-pointed from the single narrative screen to the five themed screens. Answers are keyed on prompt id, so they carry across unchanged. This is simpler than CR §8 anticipated.

**New captures persist to `ObservationResponse` only.** `targetTable` / `targetColumn` are set only where the column already exists (`pain_patterns.pain_triggers`, `daily_life.function_impact`, `daily_life.symptom_severity`). Everything else is stored in the canonical answer table, which is also what the intelligence engine reads. Promoting them to typed chamber columns is §3(C) — the seed runs today without it.

**One projection bug corrected in passing.** `disruption_frequency` (S51) was projecting into `daily_life.function_impact`, which LOER assigns to S46. It now writes `daily_life.life_disruption`, freeing `function_impact` for the new S46 screen.

**Provisional copy is labelled.** Participant-facing wording written for the new screens carries `Provisional copy — pending governance sign-off (CR §9.1 condition 2)` in the question's `notes`. Note that AIKB v2.1 Part 0's `Allowed_Values` cells are truncated at 80 characters in the workbook, so they seed the opening options of a list but do not complete it — the lists were finished to register intent and need sign-off.

---

## 3. Connected changes still required

Ordered by consequence.

### A. Wizard must write the Explore / Continue choices — *required for two branches*

`src/app/(participant)/observation/ObservationWizard.tsx`. The S72 and S76 action buttons must set `reflection_explore_choice` (`explore` | `continue`) and `record_explore_choice` (`constellation` | `patterns` | `privacy`) in the answer map. Until then those two branches never fire and both screens fall through to their default path — the flow stays valid, but the participant has no choice.

### B. Record persistence must move to S80 — *required for §6.2 to hold*

`ObservationWizard.finalize()` fires on entering any screen in `RECORD_KINDS`, and `POST /api/observation/intelligence` writes the `AtlasRecord` immediately. The seed now places `record-privacy` before the save screen, but the write still happens earlier in the sequence. Split the route into derive (no write, for S76–S78 display) and persist (S80), e.g. a `{ persist: boolean }` flag, and move the `record_saved` status transition to the S80 action.

### C. Schema migration for typed projection

Additive. Needed only to promote the new captures out of `ObservationResponse` into the chamber tables.

| Table | Columns |
|---|---|
| `pain_patterns` | `pain_spread`, `associated_experiences`, `pain_management`, `pain_functional_impact` (all Json) |
| `cycle_patterns` | `cycle_applicability` (String); **`symptoms_related_to` String → Json** — required by the §3.2 multi-select change, and the reason its projection is currently disabled |
| `daily_life` | `priority_impact_areas` (Json), `symptom_concern` (String) |
| `care_access` | `care_access_barriers` (Json), `information_needs` (Json) |
| `observation_consents` | `consent_version`, `consent_preferences`, `safety_alert_viewed`, `safety_alert_version`, `record_storage_consent`, `record_contribution_consent`, `record_sharing_preference` |
| `atlas_records` | `version` — needed for S74 versioned regeneration |

### D. AIKB observation mapping — *new captures do not reach the reflection without it*

`src/lib/observation/aikb/field-map.ts` resolves app field ids by lowercasing, and `extractor.ts` drops any field the AIKB registry does not recognise. None of the new field ids are in the registry, so their answers are stored but not used by the reflection, constellation or pattern layers. This is the CR §7 Part 0 bridge: generate the override map by joining `targetColumn` to Part 0's `Source_DB_Column`, and add a build assertion that fails when a question resolves to no registry field.

### E. Data migration (CR §8)

| From | To | Note |
|---|---|---|
| `pain_response` | `pain_functional_impact` | Option values unchanged; direct rename. Wrap the scalar in an array. |
| `symptom_predictability` | `symptom_burden` | Value mapping needed — the old scale was Improving/Same/Worsening, the new one is Barely/Somewhat/Quite a lot/Overwhelming. Not a direct map; needs a decision. |
| `pain_during_sex` = yes | `pain_triggers` += `sex` | |
| `bowel_movement_pain` = yes | `pain_triggers` += `bowel_movements` | |
| `unusual_discharge` = yes | `associated_experiences` += `unusual_discharge` | |
| `bleeding_progression` | array → scalar | §3.2 multi → single. Needs a rule when a participant selected more than one. |
| `pain_timing`, `symptoms_relation`, `care_response` | scalar → array | §3.2 single → multi. Safe. |
| Narratives | none | Prompt ids preserved. |

Two of these need a client decision before they can run: the `symptom_predictability` → `symptom_burden` scale mapping, and the `bleeding_progression` collapse rule.

### F. Governance layer (CR §5)

Not implemented — §5 was outside this instruction. Needs `FormScreen` columns for the ten register fields, the LOER CSV committed as a generator input, and the join emitted at build time. Participant-facing display of AI Disclosure and Trust Card, and the admin display of register status, follow from that.

### G. Constellation Cycle domain (CR §6.3)

`src/app/api/observation/intelligence/route.ts` — `PATTERN_DOMAIN` has no Cycle entry and `CONSTELLATION_DOMAIN_ORDER` omits it, because the pattern ontology has no dedicated cycle pattern. AIKB Part 0 lists `Cycle Disruption` among the expected `constellation_scores` values, so the target is confirmed; the mapping still needs a scientific decision.

### H. S40A / S40B distinct wording

Only if neutral wording is judged insufficient. Needs a `copyVariants` Json column on `FormScreen` and variant selection in the renderer keyed on `cycle_applicability`.

### I. Translations

The 17 new screens and 22 new questions have no translation rows, so the four non-English locales fall back to English on those screens. Translation keys follow the existing `SCREEN.<id>.<field>` / `QUESTION.<fieldId>.<field>` convention.

Related: `scripts/build-form-definition.mts` does not emit the `translations` block, so running `npm run form:build` drops every existing translation. Fix that before the next regeneration.

### J. Section progress indicator

`inputSections()` counts sections that carry questions or prompts. The alignment adds `Narrative Preparation` and moves several screens between sections, so the "Section n of total" indicator will change. Worth a visual check after reseeding.

---

## 4. Verification status

| Check | Result |
|---|---|
| `node scripts/verify-loer-v7.mjs` | PASS — 19 branch cases, all structural checks |
| `npx tsc --noEmit` | Clean |
| `npm run lint` | Clean on all changed files (12 pre-existing errors remain in admin and chat components) |
| Seed against a live database | **Not run** — no database was reachable in this environment |

The seed path itself has not been executed against MySQL/MariaDB. Run `npx prisma db seed` against staging and confirm the row counts match the verifier's report (82 screens, 66 questions, 88 routes) before treating this as done.
