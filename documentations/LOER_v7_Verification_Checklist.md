# LOER v7.0.0 Alignment — Verification Checklist

**Verifies:** CR Revision C §2 (new screens), §3 (screen adjustments), §4 (branching and routing)
**Date:** 12 August 2026
**Environment:** staging, seeded with `npx prisma db seed`

Each item cites the CR section it proves. Items marked **⚠ pending** cannot pass yet — the connected work they depend on is listed in §7.

---

## 1. Pre-flight

**Which seeder to run.** `npm run seed:loer-v7` replaces the `first_observation` flow only and is the normal choice. The full `npx prisma db seed` also works, but it additionally resets the `admin@system.com` and `participant@system.com` passwords to `password` and rebuilds the translation tables — avoid it on any shared environment. Add `-- --dry` to the scoped seeder to report without writing.

| # | Check | Expected | ✓ |
|---|---|---|---|
| 1.1 | `node scripts/verify-loer-v7.mjs` | `PASS — 19 branch cases and all structural checks.` | ☐ |
| 1.2 | Overlay summary line in the verifier output | `screensAdded 17, screensRetired 13, questionsAdded 22, questionsPatched 6, questionsRetired 2` | ☐ |
| 1.3 | `npx tsc --noEmit` | no output | ☐ |
| 1.4 | `npm run lint` | 12 pre-existing errors only, none in `router.ts`, `types.ts`, `ScreenRenderer.tsx`, `seed.mjs` | ☐ |
| 1.5 | `npx prisma db seed` completes | log line `LOER v7 alignment: +17 screens, -13 retired, +22 questions, 6 patched, -2 retired, 97 routes` | ☐ |

### Row counts after seeding

Counts are split by flow — `atlas_checkin` contributes 10 screens, 6 questions and 9 routes that this change does not touch.

```sql
SELECT flowKey, COUNT(*) FROM form_screens GROUP BY flowKey;
-- first_observation 82, atlas_checkin 10

SELECT COUNT(*) FROM form_questions q
  JOIN form_screens s ON s.screenId = q.screenId
  WHERE s.flowKey = 'first_observation';                                  -- 66

SELECT COUNT(*) FROM screen_routes r
  JOIN form_screens s ON s.screenId = r.fromScreenId
  WHERE s.flowKey = 'first_observation';                                  -- 88

SELECT COUNT(*) FROM form_questions;                                      -- 72 (66 + 6)
SELECT COUNT(*) FROM screen_routes;                                       -- 97 (88 + 9)
SELECT COUNT(*) FROM narrative_prompts;                                   -- 7
```

| # | Check | Expected | ✓ |
|---|---|---|---|
| 1.6 | `form_screens` for `first_observation` | 82 | ☐ |
| 1.7 | `screen_routes` — `first_observation` / total | 88 / 97 | ☐ |
| 1.8 | `form_questions` — `first_observation` / total | 66 / 72 | ☐ |
| 1.9 | `narrative_prompts` total | 7 — `NP01`–`NP05`, `PQ01`, `MI01` | ☐ |
| 1.10 | Retired screens absent | `s64-narrative-chamber`, `s66-sensitive-topics`, `s67-pain-during-sex`, `s68-bowel-movements`, `s69-unusual-discharge`, `s70-symptom-priority`, `s71-sensitive-narrative`, `s33-pain-duration`, `s34-pain-predictability`, `s73-processing-drift`, `s74-review-archive` all return 0 rows | ☐ |
| 1.11 | Participant answers preserved | `SELECT COUNT(*) FROM observation_responses` unchanged before and after the reseed | ☐ |

---

## 2. New screens — CR §2

Walk the wizard as a new participant. Twelve new screens plus the five-screen narrative restructure.

| # | LOER | Screen appears | Captures | ✓ |
|---|---|---|---|---|
| 2.1 | S15 | Reproductive History intro, before Ever Pregnant | information only | ☐ |
| 2.2 | S29 | Pain Presence — *"Do you experience pain or discomfort?"* | Yes / No / I'm not sure | ☐ |
| 2.3 | S33 | Pain Triggers and Associated Experiences | two multi-selects: `pain_triggers`, `associated_experiences` | ☐ |
| 2.4 | S34 | Pain Management and Impact | two multi-selects: `pain_management`, `pain_functional_impact` | ☐ |
| 2.5 | S39 | Cycle Applicability, before Cycle Predictability | `cycle_applicability` | ☐ |
| 2.6 | S46 | Functional Impact, before Missed Activities | `function_impact` | ☐ |
| 2.7 | S62 | Information and Support Needs | multi-select **plus** a free-text box | ☐ |
| 2.8 | S63 | Priority Question | text or audio capture | ☐ |
| 2.9 | S69 | The Most Important Thing, straight after the fifth narrative prompt | text or audio | ☐ |
| 2.10 | S73 | Reflection Expansion — reachable via Explore | ⚠ pending §7(A) | ☐ |
| 2.11 | S74 | Reflection Review | `reflection_review_response`, `reflection_review_note` render | ☐ |
| 2.12 | S79 | Record Privacy and Use, **before** the save screen | three controls: storage, contribution, sharing | ☐ |

### Narrative restructure

| # | Check | Expected | ✓ |
|---|---|---|---|
| 2.13 | Five separate narrative screens | The Beginning · Daily Life · Your Care Journey · What You Have Learned · Change Needed | ☐ |
| 2.14 | Each has its own prompt | `NP01`…`NP05`, one per screen | ☐ |
| 2.15 | Existing narrative answers survive the reseed | an observation with prior narrative text still shows it on the matching screen | ☐ |

---

## 3. Screen adjustments — CR §3

### 3.1 Additional captures

| # | LOER | Screen | New field visible | ✓ |
|---|---|---|---|---|
| 3.1.1 | S32 | Pain Location and Spread | `pain_spread` renders below pain location | ☐ |
| 3.1.2 | S52 | Areas of Life Affected | `priority_impact_areas` second question | ☐ |
| 3.1.3 | S53 | Normalization and Concern | `symptom_concern` second question | ☐ |
| 3.1.4 | S61 | Access to Care and Support | `care_access_barriers` second question | ☐ |
| 3.1.5 | S01 | Consent | `consent_preferences` optional block; leaving it empty still allows Continue | ☐ |
| 3.1.6 | S04 | Safety Alert | acknowledgement control renders **and** the guidance text is still shown | ☐ |
| 3.1.7 | S56 | Overall Symptom Burden | asks manageability (Barely / Somewhat / Quite a lot / Overwhelming), **not** predictability | ☐ |

### 3.2 Input types

| # | Field | Expected control | ✓ |
|---|---|---|---|
| 3.2.1 | `bleeding_progression` | single select — only one option selectable | ☐ |
| 3.2.2 | `pain_timing` | multi-select | ☐ |
| 3.2.3 | `symptoms_relation` | multi-select | ☐ |
| 3.2.4 | `care_response` | multi-select | ☐ |

### 3.3 Adaptive wording — the key regression test

Run the whole flow **twice**, answering S07 Reproductive State as `pregnant` and then as `postmenopausal`.

| # | Check | Expected | ✓ |
|---|---|---|---|
| 3.3.1 | Bleeding section appears for a pregnant participant | S21–S27 all shown — previously they were hidden | ☐ |
| 3.3.2 | Bleeding section appears for a postmenopausal participant | S21–S27 all shown | ☐ |
| 3.3.3 | S20 Trying to Conceive appears in both | shown — previously hidden | ☐ |
| 3.3.4 | S21 intro wording | reads correctly for someone not currently cycling | ☐ |
| 3.3.5 | S50 title and question | *"Dizziness, Faintness or Weakness"* — the question no longer says *"during your period"* | ☐ |
| 3.3.6 | S40 wording | reads correctly whether or not the participant cycles | ☐ |

---

## 4. Branching — CR §4

Each case is one full run. The screen sequence given is what should appear; anything extra or missing is a failure.

| # | LOER | Answer | Expected sequence | ✓ |
|---|---|---|---|---|
| 4.1 | S03 | any urgent safety flag | Quick Safety Check → **Safety Alert** → Context Intro | ☐ |
| 4.2 | S03 | no flag selected | Quick Safety Check → Context Intro (**no** Safety Alert) | ☐ |
| 4.3 | S17 | Ever Pregnant = **Yes** | Ever Pregnant → Pregnancy Count → Pregnancy Loss → Trying to Conceive | ☐ |
| 4.4 | S17 | Ever Pregnant = **No** | Ever Pregnant → **Pregnancy Loss** → Trying to Conceive → Bleeding intro (**skips** Pregnancy Count, but still asks Pregnancy Loss) | ☐ |
| 4.5 | S17 | Prefer not to say | same as 4.4 | ☐ |
| 4.6 | S29 | Pain Present = **No** | Pain Presence → **Pain Progression** → Pelvic Function (skips all five pain-detail screens) | ☐ |
| 4.7 | S29 | Pain Present = **Yes** | Pain Presence → Pain Pattern → Pain Timing → Pain Location → Pain Triggers → Pain Management → Pain Progression | ☐ |
| 4.8 | S29 | Pain Present = **Unsure** | same as 4.7 | ☐ |
| 4.9 | S35 | both paths converge | Pain Progression is reached from either 4.6 or 4.7 | ☐ |
| 4.10 | S58 | Spoken to Provider = **Yes** | Spoken to Provider → Care Response → Care Dismissal → Access to Care | ☐ |
| 4.11 | S58 | Spoken to Provider = **No** | Spoken to Provider → **Care Dismissal → Access to Care** → Information Needs (skips Care Response only) | ☐ |
| 4.12 | S72 | Continue | Reflection Overview → Reflection Review (skips Expansion) — ⚠ pending §7(A) | ☐ |
| 4.13 | S72 | Explore | Reflection Overview → Reflection Expansion → Reflection Review | ☐ |
| 4.14 | S76 | default | Record Overview → Constellation → Observed Patterns → Privacy → Save | ☐ |
| 4.15 | S76 | patterns | Record Overview → Observed Patterns (skips Constellation) — ⚠ pending §7(A) | ☐ |
| 4.16 | S76 | privacy | Record Overview → Privacy (skips both) — ⚠ pending §7(A) | ☐ |
| 4.17 | S69 | follows S68 | Change Needed → The Most Important Thing, immediately | ☐ |

### Record sequence order

| # | Check | Expected | ✓ |
|---|---|---|---|
| 4.18 | Order of the final screens | Reflection Review → Record Preparation → **Record Overview → Constellation → Observed Patterns → Privacy → Save** | ☐ |
| 4.19 | Privacy precedes save | Record Privacy screen is always seen before the save confirmation | ☐ |
| 4.20 | ⚠ **No `atlas_records` row exists before the save screen** | `SELECT COUNT(*) FROM atlas_records WHERE observationId = ?` returns 0 until S80 is actioned | ☐ |

> **4.20 will fail on the current build.** The screen order is correct, but persistence still happens on entering the record flow. See §7(B) — this is the one item that stops CR §6.2 being true.

---

## 5. Data integrity after reseed

| # | Check | Expected | ✓ |
|---|---|---|---|
| 5.1 | Existing in-progress drafts resume | a draft started before the reseed opens without error | ☐ |
| 5.2 | Completed observations still open | a `record_saved` observation still renders its record | ☐ |
| 5.3 | No orphaned progress pointers | any `Observation.currentScreenId` pointing at a retired screen is handled — the wizard falls back rather than blanking | ☐ |
| 5.4 | Answers on retired screens retained | `observation_responses` rows for `pain_during_sex`, `bowel_movement_pain`, `unusual_discharge`, `pain_response`, `symptom_predictability`, `pain_duration` still present | ☐ |

> 5.4 confirms nothing was lost. Those answers are re-homed by the migration in §7(E), which has not run yet.

---

## 6. Regression

| # | Check | Expected | ✓ |
|---|---|---|---|
| 6.1 | Atlas Check-In flow unaffected | `atlas_checkin` still has 10 screens and 6 questions | ☐ |
| 6.2 | Section progress indicator | "Section n of total" counts correctly and does not stall — the section set changed, so re-check | ☐ |
| 6.3 | Skip-section still works | skipping from a section intro clears that section's answers and advances | ☐ |
| 6.4 | Consent and safety cannot be skipped | skip control absent on S01, S03, S04 | ☐ |
| 6.5 | Review screen lists new questions | the review/edit screen shows the 22 new captures and jumps to the right screen | ☐ |
| 6.6 | Non-English locales | new screens fall back to English without breaking layout — ⚠ expected, see §7(I) | ☐ |

---

## 7. Known-pending — do not raise as defects

These are identified and scoped in `LOER_v7_Implementation_Notes.md` §3. They are not yet built, so the checklist items above that depend on them are marked ⚠.

| Ref | Item | Blocks |
|---|---|---|
| A | Wizard does not yet write `reflection_explore_choice` / `record_explore_choice` | 2.10, 4.12, 4.15, 4.16 — those screens fall through to the default path |
| B | Atlas Record still persists on entering the record flow, not at S80 | 4.20 |
| C | Typed projection columns not yet added — new captures live in `observation_responses` only | chamber-table spot checks |
| D | AIKB observation mapping not yet bridged — new captures do not reach the reflection | reflection content will not change on the new fields |
| E | Data migration not yet run | 5.4 stays as-is by design |
| F | Governance layer (CR §5) not in this change | AI Disclosure / Trust Card display |
| G | Constellation Cycle domain not yet added | constellation still shows five domains |
| I | Translations absent for the 17 new screens and 22 new questions | 6.6 |

---

## 8. Sign-off

| | Name | Date |
|---|---|---|
| Verified by | | |
| Sections passed | §1 ☐ §2 ☐ §3 ☐ §4 ☐ §5 ☐ §6 ☐ | |
| Deviations raised | | |
