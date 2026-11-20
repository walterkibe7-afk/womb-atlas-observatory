# Change Request — Alignment to LOER v7.0.0

**Document:** Change Request for client approval · **Revision C**
**Supersedes:** Revisions A and B (2 August 2026)
**Date:** 2 August 2026
**Prepared for:** Womb Atlas Observatory — First Observation
**Estimated duration:** 2 weeks, inclusive of data migration

---

## 1. Background

The Observatory's First Observation flow — its screens, routing and conditional branching — was built from the **Womb Atlas mobile application's screen register**, which was the canonical source available and agreed at the time of implementation. The observation engine, the branching rules and the seeded flow definition all derive from that register.

The client has since designated the **LOER v7.0.0 Production Candidate — Sprint 1 Master Screen Register (S01–S80)** as the shared canonical document for the First Observation, and has asked that the Observatory be aligned to it.

This change request covers that realignment. It is a scope change against a newly designated source document, not a correction of the delivered build.

The work falls into three areas:

1. **New screens** — screens defined in LOER v7.0.0 that the mobile register did not contain.
2. **Governance layer** — a per-screen governance and disclosure model that LOER v7.0.0 introduces and the mobile register did not carry.
3. **Reflection and Atlas Record flow** — an expanded reflection sequence with participant review, versioned regeneration and explicit record privacy controls.

Alongside these, the client has supplied the **AIKB v2.0 / v2.1** knowledge base package. Its Part 0 Observation Registry is adopted in this change as the observation mapping authority. The signal, pattern and reflection knowledge layers are held at their current version — see §7.

---

## 2. New screens

Twelve screens are added, and the narrative section is restructured from a single screen into five, giving a net increase of sixteen screens.

| LOER | SCR ID | Screen | Capture | Type |
|---|---|---|---|---|
| S15 | SCR-2011 | Reproductive History Intro | `reproductive_history_intro_viewed` | Information |
| S29 | SCR-3009 | Pain Presence | `pain_present` | Single select — gate for the pain section |
| S33 | SCR-3013 | Pain Triggers and Associated Experiences | `pain_triggers; associated_experiences` | Multi-select |
| S34 | SCR-3014 | Pain Management and Impact | `pain_management; pain_functional_impact` | Two grouped multi-selects |
| S39 | SCR-4004 | Cycle Applicability Transition | `cycle_applicability` | Single select — drives adaptive cycle wording |
| S46 | SCR-4011 | Functional Impact | `function_impact` | Multi-select |
| S62 | SCR-7001 | Information and Support Needs | `information_needs` | Multi-select + self-description |
| S63 | SCR-7002 | Priority Question | `priority_question_payload` | Text or audio |
| S69 | SCR-7008 | Most Important Thing | `most_important_payload` | Text or audio |
| S73 | SCR-8004 | Reflection Expansion and Education | `reflection_expansion` | Expandable generated sections |
| S74 | SCR-8005 | Reflection Review and Continue | `reflection_review` | Review + optional text/audio |
| S79 | SCR-9005 | Record Privacy and Use Controls | `record_privacy_controls` | Settings review |

**Narrative restructure (S64–S68).** The current single narrative screen becomes five, each carrying one of the register's defined themes: Beginning · Daily Life · Care Journey · What You Have Learned · Change Needed. Each captures its own payload (`narrative_p1..p5_payload`) so the five are separately addressable by the reflection layer.

**Answer options** for the new selection screens are taken from the AIKB v2.1 Part 0 `Allowed_Values` column, which covers `pain_triggers`, `pain_management`, `function_impact` and the rest. This removes the need for new content design on those screens.

---

## 3. Screen adjustments

### 3.1 Additional captures on existing screens

| LOER | Screen | Added |
|---|---|---|
| S32 | Pain Location and Spread | `pain_spread`; optional body map (TC-6004) |
| S52 | Areas of Life Affected | `priority_impact_areas` — participant prioritisation |
| S53 | Normalization and Concern | `symptom_concern` |
| S61 | Access to Care and Support | `care_access_barriers` — optional multi-select |
| S01 | Consent | `consent_version`; `consent_preferences` |
| S04 | Safety Alert | `safety_alert_viewed`; `safety_alert_version` |
| S56 | Overall Symptom Burden | `symptom_burden` replaces the current predictability capture |

### 3.2 Input type changes

`bleeding_progression` → single select · `pain_timing` → multi-select · `symptoms_related_to` → multi-select · `care_response` → multi-select.

### 3.3 Adaptive wording

LOER v7.0.0 requires that cycling and non-cycling participants receive the same questions with adapted wording rather than a reduced flow. Copy variants are added for the bleeding section (ADP-4001, ADP-4005), the cycle section (S40A / S40B variants under ADP-5005) and S50, which the register defines neutrally as *Dizziness, Faintness or Weakness*.

---

## 4. Branching and routing

The register defines eight conditional transitions. All are implemented as seeded routing rules:

| LOER | Condition |
|---|---|
| S03 → S04 / S05 | Urgent safety flag selected, or none |
| S17 → S18 / S19 | Ever pregnant — Yes, or otherwise |
| S29 → S30 / S35 | Pain present — Yes or Unsure, versus No |
| S39 → S40A / S40B | Cycle applicability variant |
| S58 → S59 / S60 | Spoken to a provider — Yes, or otherwise |
| S72 → S73 / S74 | Explore, or continue |
| S76 → S77 / S78 / S79 | Explore path selection |
| S69 | Reached from S68 or from narrative skips |

S35 is configured as the convergence point for both pain paths, per the register's *"S29 or S34"* previous-screen definition.

---

## 5. Governance layer (new)

LOER v7.0.0 attaches a governance and disclosure model to every screen. This did not exist in the mobile register and is added here.

**Stored per screen:** SCR ID · Trust Card ID · AI Disclosure · Adaptive Rule IDs · Knowledge IDs · Reasoning IDs · Reflection IDs · Observation IDs · Technical Components · Register Status.

**Displayed to participants:** the **AI Disclosure** line and the **Trust Card** on every screen that defines one — for example S03 Quick Safety Check carries *"AI is not used to diagnose or assess emergencies"*, and S77 Constellation Record carries *"Observation map only; no diagnosis, risk score or peer comparison."*

**Surfaced to administrators:** the register's own `Status` value (`Draft for clinical review`, `Draft for governance approval`, and so on), replacing the current uniform status display, so the governance state of each screen is visible and auditable.

The governance metadata is generated directly from the LOER register file, so it stays in step with the document rather than being maintained by hand.

---

## 6. Reflection and Atlas Record flow

### 6.1 Reflection sequence

| LOER | Screen | Change |
|---|---|---|
| S70 | Reflection Introduction | Explicit generation action ("Create my reflection") with `reflection_generation_consent` recorded |
| S71 | Reflection Generation Status | Retained; recoverable processing state |
| S72 | Reflection Overview | Retained; evidence-linked participant-facing synthesis |
| S73 | Reflection Expansion and Education | **New.** Separates participant report, observation and general education into distinct sections |
| S74 | Reflection Review and Continue | **New.** Participant may accept, disagree, correct, or request a versioned regeneration. Disagreement is recorded without penalty and the record carries version lineage. |

### 6.2 Atlas Record sequence

The record sequence is set to the register's order:

**S75** Preparation → **S76** Record Overview → **S77** Constellation → **S78** Observed Patterns → **S79** Privacy and Use Controls → **S80** Save Atlas Record.

Two consequences:

- The Atlas Record is persisted at **S80**, after the participant has reviewed the record and set their privacy choices. S79 presents storage, contribution and sharing as separate choices, per the register's *"Saving is separate from optional contribution; no consent expansion."*
- The reflection derived for display at S76–S78 is computed without being committed, so the participant sees the full record before it is stored.

### 6.3 Constellation

The constellation gains the **Cycle** domain alongside Bleeding, Pain, Hormonal, Daily Life and Care Access, so observations from S39–S44 are represented (KN-4003).

---

## 7. Knowledge base alignment

**Adopted now — AIKB v2.1 Part 0 Observation Registry.** Part 0 carries `Source_DB_Table` and `Source_DB_Column` for all 65 observations, giving a direct and verifiable mapping between the flow and the knowledge base. This becomes the generated observation mapping, replacing hand-maintained field correspondence. Verified coverage: 55 of the 58 existing questions map on database column, plus the new screens in §2.

**Held at current version — Parts 1 to 13.** The AIKB 2.0 Release Package classifies every component `Production Candidate — Conditional` with `Production Approved: NO`, and records two open blockers that bear directly on runtime behaviour: `GOV-13` (all 59 signals remain Draft) and `GOV-14` (*"No pattern may be emitted, therefore no reflection may be generated"*).

Adopting the new signal and pattern layers while GOV-14 is open would leave the product unable to produce reflections. The signal, pattern and reflection layers therefore stay on the current knowledge base until the client's Clinical Governance Council ratifies. A separate change request will cover the upgrade once ratified.

Two further items are noted for the client's governance record rather than actioned here: `GOV-23` (urgent safety flags at S03 reach no signal) and `GOV-05` / `GOV-16` (check-in and sensitive-topic observations have no LOER home). The sensitive-topic content is re-homed as part of this change — see §8.

---

## 8. Data migration

Included in the two-week estimate.

| Migration | Detail |
|---|---|
| Observation field set | Existing responses mapped onto the LOER field set via the AIKB Part 0 column bridge. All participant answers are retained; none deleted. |
| Sensitive topics | `pain_during_sex`, `bowel_movement_pain` and `unusual_discharge` re-homed into S33 `pain_triggers` / `associated_experiences` and S36 `pelvic_symptoms`. The AIKB Part 0 allowed values for `pain_triggers` already include Sex, Bowel movements and Urination, so the existing answers map directly. |
| Consent and privacy | New columns for consent version, consent preferences, safety-alert acknowledgement and record privacy controls. Existing consents backfilled with the version in force at capture. |
| Atlas Record versioning | Version lineage added to support S74 regeneration. Existing records become version 1. |
| Narrative payloads | Existing narrative responses distributed across the five S64–S68 payloads by prompt id. |
| Schema | Governance metadata columns added to the screen definition table. Additive only; no table dropped. |

---

## 9. Timeline

Ten working days. Kickoff **Monday 3 August 2026**.

| Week | Working days | Contents |
|---|---|---|
| **Week 1** | Mon 3 – Fri 7 Aug | Screen register rebuilt to LOER v7.0.0 — twelve new screens, narrative restructure, screen adjustments, all eight branches, adaptive wording variants. Schema migration for governance metadata, consent and privacy, and record versioning. AIKB Part 0 observation mapping generated. |
| **Week 2** | Mon 10 – Fri 14 Aug | Reflection sequence S70–S74 including participant review and versioned regeneration. Atlas Record sequence S75–S80 with privacy controls and save-at-S80. Governance display — AI Disclosure, Trust Card, register status. Data migration executed and verified. Conformance verification against the register. |

**Delivery: Friday 14 August 2026.**

### 9.1 Conditions

The two-week duration holds on these conditions. Each is small, but a delay on any one moves delivery day for day.

1. **LOER v7.0.0 confirmed as the authoritative version by Wed 5 August.** The AIKB v2.1 Part 0 rows are stamped `LOER v7.1.0`. If a v7.1.0 register exists, we need it before the register is rebuilt.
2. **Participant-facing copy for S62, S63, S69 and the five narrative prompts supplied by Wed 5 August.** The register defines the themes and capture types; the wording itself is not in the material we hold. Everything else — including all new answer options — is available from the register and AIKB Part 0.
3. Trust Card and AI Disclosure copy is taken verbatim from the register; no separate copy round is assumed.
4. Staging database access is available throughout, with a deployment window in each week for the two migrations.
5. Screen identifiers remain internal. Aligning to LOER's S01–S80 numbering is not included; the register's screen *content, order and branching* are what this change delivers.

### 9.2 Risk

Two weeks is a firm but tight schedule for this scope. The two migrations and the reflection review flow carry the most delivery risk. If a condition in §9.1 slips, the most effective way to protect the date is to defer the S73 Reflection Expansion screen to a follow-up — it is the only item in §2 that nothing else depends on.

---

## 10. Out of scope

- **AIKB Parts 1–13 upgrade** — blocked by GOV-13 and GOV-14 (§7). Separate change request once ratified.
- **AIKB Part 7A Participant Archetypes** — six participant archetypes with pattern mapping and transition rules. A new participant-facing capability, not part of this alignment.
- **Atlas Check-In flow** — LOER v7.0.0 defines no check-in screens (`GOV-05`).
- **Screen renumbering to S01–S80 identifiers** — see §9.1 condition 5.
- Steward, admin and analyst portals; authentication; audit logging; translation infrastructure.

---

## 11. Approval

| | |
|---|---|
| Scope | §2 – §8 |
| Duration | 10 working days, inclusive of data migration |
| Delivery | Friday 14 August 2026 |
| Conditions | §9.1 — items 1 and 2 required by Wednesday 5 August 2026 |
