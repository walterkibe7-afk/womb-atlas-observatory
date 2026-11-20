# Womb Atlas Observatory — Handover

**Scope:** everything changed in the last four commits (the Atlas Intelligence
alignment + the follow-up bug fixes) and a full description of how the new
observation → signals → patterns → indices → archetype → reflection flow works.

| Commit | Summary |
|---|---|
| `755d78f` | Port the v4.3 "Atlas Intelligence" engine + AIKB, add the 11 run tables, regenerate the observation flow from the mobile v5 screen register, add the generators/migration baseline. |
| `f50046f` | Section-intro descriptions (`body[]` → screen `purpose`), review-screen label rendering, resilient localStorage resume, observationId validation. |
| `a7895e3` | Orphaned-session guard (JWT after reset) + seeded participant, `bleeding_progression` → `Json`. |
| `4b2d8b9` | In-flow Constellation Record screen replaced with real per-answer tap-node patterns (mobile-app parity, fixes a bug where it always looked the same); searchable country dropdown for `current_country`/`birth_country`. |

---

## 1. Big picture — what this system now does

A participant walks the **first observation** flow (a DB-seeded questionnaire).
On finish, the answers are run through the **Atlas Intelligence pipeline**, which
produces an auditable *run* (signals, patterns, indices, an archetype, a
reflection) and a participant-facing **Atlas Record**. The pipeline is a port of
the mobile app (`womb-atlas-participant-app`) v4.3 engine onto our Prisma/MySQL
stack, so the archetypes/reflections match the mobile app structurally.

Two cooperating layers:

- **Deterministic v4.3 engine** (`src/lib/observation/intelligence/v43/`) — the
  source of truth for *detection*. Given the raw responses it detects
  observed **patterns** (via a fixed signal ontology) and selects an
  **archetype** (via weighted scoring), and composes a deterministic baseline
  reflection. This is verbatim-ported from the mobile app.
- **AIKB layer** (`src/lib/observation/intelligence/*.ts` + `src/content/aikb/`) —
  the *knowledge base*. It normalizes observations to registry field ids, maps
  them to AIKB **signals**, enriches the v4.3 patterns with stable `PAT-###` ids +
  metadata, computes the 5 named **indices**, expands the **knowledge graph**,
  picks the reflection **archetype/tone** for the LLM prompt, and runs
  **governance** + **explainability**.

**Reflection prose** is assembled by OpenAI when `OPENAI_API_KEY` is set
(governed), otherwise the deterministic baseline is used. Detection (patterns,
indices, archetype) is **always deterministic** — the LLM only rewrites wording.

---

## 2. The intelligence pipeline (step by step)

Entry point: `POST /api/observation/intelligence` (`src/app/api/observation/intelligence/route.ts`)
→ `runAtlasIntelligence(answers)` (`src/lib/observation/intelligence/reflection-runner.ts`).
The route loads the observation's `ObservationResponse` rows into an answer map,
runs the pipeline, persists an auditable run + the `AtlasRecord`, and returns a
payload the record screens consume.

Stages (in `reflection-runner.ts`):

1. **Adapt answers → responses** (`answersToResponses`). Narrative prompt keys
   (`NP##` / `SNP##`) are pulled out and re-attached as `narrative_responses` on
   the narrative screens; everything else becomes `{screenId, fieldId, value}`.

2. **Extract observations** (`extractObservations`, `intelligence/extractor.ts`).
   Each answer is normalized to the **AIKB registry field id**
   (`toRegistryFieldId` = `lowercase(fieldId)`), filtered to dictionary fields,
   split per selected value, tagged with its reflection **section**, and given an
   `OBS-###` id. Values like `none` / `prefer_not_to_say` are ignored. Produces
   `AtlasObservationRecord[]` + `sectionCounts`.

3. **Map observations → signals** (`mapObservationsToSignals`,
   `intelligence/signal-service.ts`). Looks up each observation's
   `registryFieldId` in `aikb.signals.mappings` and groups matched observations
   under a `SIG-###`. Produces `AtlasSignalRecord[]`.

4. **Deterministic detection** (`buildAtlasRecord`,
   `v43/atlas-intelligence-service.ts`). This is where patterns + the archetype
   actually come from:
   - `detectPatterns` runs the responses through `ONTOLOGY_SIGNAL_RULES`
     (`v43/pattern-ontology.ts`): each rule is `{fieldId, values[], primaryPatternId,
     contributionLevel, evidenceTheme, …}`. A response whose `fieldId` + selected
     value matches a rule contributes evidence to that pattern (with
     exclude/secondary conditions). Matched patterns become `AtlasObservedPattern[]`,
     ranked, with the top one dominant.
   - `detectArchetype` (`v43/atlas-intelligence-v43.ts`) scores every entry in the
     `archetypeRegistry` by summing `patternWeights` over the detected patterns
     (+ narrative-theme weight), and picks the highest — with a narrative override
     when narrative intelligence is present.
   - `composeReflection` builds the deterministic **baseline** reflection content.

5. **Enrich patterns against the AIKB** (`detectPatterns`,
   `intelligence/pattern-service.ts`). The AIKB `valueChecks` path exists but is
   **dormant** (all 120 AIKB pattern entries ship with empty `valueChecks`/`fieldIds`
   — see caveats), so in practice the v4.3-detected patterns are matched to AIKB
   entries **by name** to attach a stable `PAT-###` id, domain, meaning, atlasNote,
   watchOverTime, and a confidence (`high/moderate/low` from match count).

6. **Expand the knowledge graph** (`expandKnowledgeGraph`,
   `intelligence/knowledge-graph-service.ts`). Walks `aikb.knowledgeGraph.edges`
   from the detected pattern/signal ids to gather related ids + education,
   strength, trajectory, and care-context notes → `KnowledgeContext`.

7. **Plan the reflection / pick archetype+tone** (`planReflection`,
   `intelligence/reflection-planner.ts`). Selects an AIKB reflection archetype
   whose `selectionSignals` (e.g. `pat_001` → `PAT-001`) intersect the detected
   pattern ids; carries its **tone** (supportive/gentle/empowering) and the
   dominant/supporting pattern ids, strengths, watch areas, and reflection
   questions. This `planArchetype` feeds the OpenAI prompt.

8. **Assemble the reflection** (`reflection-runner.ts` §158–177). Baseline =
   the v4.3 `composeReflection` output. If `OPENAI_API_KEY` is set,
   `enhanceReflectionWithOpenAi` (`v43/openai-reflection.ts`) sends the plan +
   knowledge context + patterns + baseline and the model **rewrites the prose**
   (JSON-only, 8s timeout, `gpt-4o-mini` default). On success →
   `reflectionSource="openai"`; on any failure (no key, 401, timeout, governance
   block, parse error) → deterministic baseline. The OpenAI output is scanned for
   blocked clinical terms before use.

9. **Compute indices** (`computeIndices`, `intelligence/indices-service.ts`).
   Each of the 5 AIKB indices = the **mean `observationConfidence` of the patterns
   it references**. Feeds the **participant dashboard's** "Signal Evolution" trend
   chart (index → domain label, scaled to 0–4 in the API route, stored as
   `AtlasRecord.constellation_scores`). It does **not** feed the in-flow
   "Constellation Record" screen — see §4.4 for why, and the known bug in §6.

10. **Governance** (`validateGovernance`, `intelligence/governance-service.ts`).
    Scans the assembled reflection for blocked terms per the `block`-severity AIKB
    rules (GOV-001 never diagnose / GOV-002 observational language). Sets
    `governance.passed` + `violations`.

11. **Explainability** (`buildExplainabilityTrace`,
    `intelligence/explainability-service.ts`). Records the per-stage trace under
    one `traceId`.

12. **Persist** (`persistRun` in the API route). Writes `AtlasIntelligenceRun` +
    child rows (observations/signals/patterns/indices/plan/reflection/
    explainability/governance) and upserts the participant-facing `AtlasRecord`
    (`reflection_summary`, `burdenLevel`, `constellation_scores`,
    `observed_patterns`). All persistence is **non-fatal** — the result is still
    returned if a write fails.

**Burden** (Low/Moderate/High) is derived from the top pattern confidence in the
API route (`deriveBurden`).

---

## 3. Data & generation pipeline

Everything the DB needs is **generated from committed source, then seeded** — see
`prisma/README.md` and `scripts/README.md` for the full guide. In short:

```
AIKB spec workbooks (prisma/seed/aikb-specs/*.xlsx)
   -- npm run aikb:build -->  src/content/aikb/*.json   (imported at runtime by the AIKB loader)

v5 screen register (src/lib/observation/intelligence/v43/screen-register-first-observation.ts)
 + observation-contract.ts (field bindings)
 + form-definition.legacy.json (atlas_checkin flow, projection targets, narrative texts)
   -- npm run form:build -->  prisma/seed/form-definition.json
   -- npm run db:seed    -->  form_* tables + admin + participant users
```

- **AIKB** = the knowledge base (66 obs fields, 491 signal mappings, 120 patterns,
  80 reflection archetypes, 5 indices, ~360-edge knowledge graph, 6 governance
  rules). Loaded by `src/lib/observation/aikb/loader.ts`.
- **form-definition.json** = the observation flow (screens/questions/options/routes)
  loaded into `form_*` tables by `prisma/seed.mjs`.
- **Field-id alignment** is what makes the verbatim v4.3 port possible: observatory
  field ids now equal the mobile v5 snake_case ids; `registryFieldId =
  lowercase(fieldId)`; option values are snake_case codes (`every_1_2_hours`).

**Commands** (run from `womb-atlas-observatory-system`):
```bash
npm run aikb:build      # xlsx -> src/content/aikb/*.json
npm run form:build      # v5 register -> prisma/seed/form-definition.json
npm run db:seed         # seed form_* + users
npx prisma migrate deploy   # apply migrations to a DB
npx prisma generate         # regenerate the client after a schema edit
```

---

## 4. Detailed change log

### 4.1 Atlas Intelligence engine + AIKB (commit `755d78f`)
- **AIKB bundle**: `src/content/aikb/{observations,signals,patterns,reflection,
  knowledge_graph,indices,governance}.json` + loader/types/field-map in
  `src/lib/observation/aikb/`.
- **Pipeline services** (pure, no Prisma): `intelligence/{extractor,signal-service,
  pattern-service,indices-service,knowledge-graph-service,reflection-planner,
  governance-service,explainability-service,trajectory-service,sections,types,
  index}.ts` + the orchestrator `reflection-runner.ts`.
- **v4.3 engine** (verbatim-ported): `intelligence/v43/*` — `pattern-ontology.ts`,
  `atlas-intelligence-v43.ts`, `atlas-intelligence-service.ts`,
  `narrative-intelligence.ts`, `openai-reflection.ts`, `observation-contract.ts`,
  `observation-extractor.ts`, `screen-register-first-observation.ts`, types, etc.
- **API**: `src/app/api/observation/intelligence/route.ts` (run + persist).
- **Wiring**: `ObservationWizard` finalize → `/api/observation/intelligence`;
  `ScreenRenderer` reflection/record screens consume `archetype`,
  `reflectionContent`, `reflectionSource`.
- **Schema** (`prisma/schema.prisma`): `registryFieldId` on `FormQuestion`,
  `screenId` on `ObservationResponse`, and 11 run tables (`AtlasIntelligenceRun`,
  `AtlasObservationRow`, `AtlasSignalRow`, `AtlasPatternRow`, `AtlasIndexRow`,
  `AtlasReflectionPlanRow`, `AtlasReflectionRow`, `AtlasExplainabilityRow`,
  `AtlasTrajectoryRow`, `AtlasGovernanceRow`, `KnowledgeGraphRow`).
- **Generators + reproducibility**: `scripts/build-aikb.mjs` + `aikb-source-map.json`
  + `validate-aikb.mjs`, `scripts/build-form-definition.mts`, the AIKB spec xlsx
  under `prisma/seed/aikb-specs/`, and the migration baseline
  `prisma/migrations/20260702000000_init/`.

### 4.2 Flow copy + UX fixes (commit `f50046f`)
- **Section-intro descriptions**: the generator now composes screen `purpose` from
  the register's `description` **plus** its `body[]` paragraphs
  (`scripts/build-form-definition.mts`); information/consent/narrative screens
  render it with `whitespace-pre-line` (`ScreenRenderer.tsx`). Previously intro
  screens showed only a heading.
- **Review screen labels**: `displayAnswer()` maps stored option **codes** back to
  their **labels** (arrays joined, booleans → Yes/No, narrative → text/"audio
  saved"). Previously the review/edit view showed raw snake_case codes.
- **Resilient resume** (`ObservationWizard.tsx`): if the server is reachable but
  doesn't confirm the cached observation (e.g. after a DB reset), the stale
  `localStorage` cache is dropped + cleared — this removed both the stale
  `observationId` (FK crash) and the **phantom 0-second narrative audio** (a dead
  `audioUrl` cached from a previous run). `persistAnswers` now also **adopts the
  server's canonical observationId**.
- **observationId validation** (`api/observation/route.ts`): a client-supplied
  `observationId` must exist **and** belong to the user, else the route
  reuses/creates a real one — fixes the `P2003` FK on `observationResponse` and
  closes a cross-user write hole.

### 4.3 Session + projection fixes (commit `a7895e3`)
- **Orphaned JWT guard** (`api/observation/route.ts`): auth uses `strategy:"jwt"`,
  so a login cookie survives a DB reset while its `User` row is gone → `observation.create`
  FK-crashed on `userId`. `resolveUserId` now verifies the user exists and returns
  `null` (→ 401 re-login) instead of a 500.
- **Seeded participant** (`prisma/seed.mjs`): `participant@system.com` /
  `password` (alongside `admin@system.com` / `password`), so a reset always leaves
  a working login.
- **`bleeding_progression` → `Json`** (`prisma/schema.prisma` + migration
  `20260703000000_bleeding_progression_json`): it became a multi-select in v5, but
  its projection column was still `String?`, so projecting the array failed. It was
  the only such mismatch (all other multi-selects were already `Json?`). The
  projection step is **non-fatal**; this just silences the error and populates the
  `bleeding_patterns` mirror.

### 4.4 Constellation Record now shows real per-answer patterns + searchable country field (commit `4b2d8b9`)
- **Bug**: the in-flow "Constellation Record" screen (`s80-constellation-record`)
  looked identical for every participant regardless of answers. Root cause: it
  rendered a `recharts` radar chart from `AtlasRecord.indices`, and
  `src/content/aikb/indices.json`'s `patternIds` (`PAT-002`…`PAT-007`) reference AIKB
  pattern ids that `pattern-service.ts`'s by-name matching never actually assigns to
  any v4.3-detected pattern (only `PAT-001`/bleeding ever resolves — see §6). So
  `computeIndices` returned `0` for 4 of the 5 domains on **every** run, for every
  participant, and the 5th (bleeding) only ever took one of 3 fixed values. This bug
  is inherited from the mobile app's identical copy of `indices.json` +
  `indices-service.ts`, but is invisible there because the mobile app's constellation
  screen never consumed indices in the first place.
- **Fix**: the screen no longer uses `indices` at all. It now mirrors the mobile
  app's `atlas-constellation.tsx` UX — a background illustration
  (`public/assets/constellation-record-approved.png`, copied from
  `womb-atlas-participant-app`) with 6 tappable hotspot nodes (Bleeding, Pain,
  Hormonal, Cycle Disruption, Daily Life, Care Access). Tapping a node opens a modal
  with "What Atlas observed / Why Atlas connected these experiences / What Atlas
  will continue observing / Atlas Note / Related Patterns / Supporting
  Observations", computed **per participant** from the same `observedPatterns`,
  `patternConnections`, and extracted observations the reflection pipeline already
  produces — no new detection logic.
  - New `intelligence/v43/constellation-node-content.ts`: the hotspot registry
    (`CONSTELLATION_HOTSPOTS`) + `buildConstellationNodeContent`/
    `buildAllConstellationNodes`, a server-side port of the mobile app's
    `services/atlas-intelligence/constellation-node-content.ts`. Reuses
    `buildOntologyRoutingContext`/`routingsForPattern`/`participantLabelFor` from
    `pattern-ontology.ts` — already ported for the v4.3 detector, previously unused
    by anything.
  - New `src/components/observation/atlas-constellation-map.tsx`: the client hotspot
    map + modal, restyled to this app's `var(--color-*)` tokens (the mobile version
    uses its own `wao-*` design system).
  - `api/observation/intelligence/route.ts`: adds `constellationNodes` (6
    `ConstellationNodeContent` objects) to the JSON response via
    `toConstellationNodes()`. Not persisted to the DB — recomputed on every
    `finalize()`/resume, same as `constellation`/`observedPatterns` already were.
  - `ScreenRenderer.tsx`: `ConstellationScreen` now renders
    `<AtlasConstellationMap nodes={record.constellationNodes} />` instead of a
    `recharts` `RadarChart`; the `recharts` import was removed from this file (the
    participant dashboard's separate Signal Evolution chart still uses `recharts`
    and is untouched).
  - `constellation`/`constellation_scores` (indices-derived, 0–4 scores) are **kept
    as-is** for the dashboard's Signal Evolution trend chart — only the in-flow
    screen changed. The underlying indices bug above still affects that chart; see
    the follow-up note in §6.
- **Country fields now use a searchable dropdown**: `current_country`/
  `birth_country` (`fieldType: "country"`) previously rendered as a plain free-text
  `<input>` in `QuestionFields.tsx` — the register's own placeholder text always
  said "Country Search Dropdown", but nothing implemented it. New
  `src/components/observation/country-search-field.tsx`: a combobox with the ISO
  3166-1 alpha-2 code list + the browser's built-in `Intl.DisplayNames` for display
  names (no new dependency; `Intl.supportedValuesOf` does **not** support
  `"region"`, so the code list has to be hardcoded — ported from the mobile app's
  `CountrySearchField`). Wired into `QuestionFields.tsx` for `fieldType ===
  "country"` only; plain `fieldType === "text"` questions are unchanged.

---

## 5. Environment & accounts

`.env` (server-only; the observation/narrative/intelligence routes are `runtime="nodejs"`):

| Var | Purpose |
|---|---|
| `DATABASE_URL` | MySQL/MariaDB (default `mysql://root:@localhost:3306/wombatlas_db`). |
| `OPENAI_API_KEY` | Enables LLM reflection prose. Absent/invalid → deterministic fallback. |
| `OPENAI_MODEL` | Optional; defaults to `gpt-4o-mini`. |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | Google sign-in. |
| (GCP audio/STT vars) | Consumed by the existing narrative storage/STT seams (`src/lib/media/*`). |

- Restart the dev server after editing `.env`.
- **Seeded logins:** `admin@system.com` / `password`, `participant@system.com` /
  `password`.
- **After any DB reset you must sign out and sign back in** — the JWT cookie
  outlives the wiped `User` row.

---

## 6. Known gaps / caveats

- **`indices.json` pattern-id mismatch (unfixed)**: `IDX-002`…`IDX-005`'s
  `patternIds` (`PAT-002`…`PAT-007`) don't correspond to any pattern the by-name
  matcher in `pattern-service.ts` actually produces (only `PAT-001`/bleeding
  resolves), so `computeIndices` returns `0` for those 4 indices on every run — see
  §4.4 for the full trace. This no longer affects the in-flow Constellation Record
  screen (rebuilt on real pattern data instead, §4.4), but it **still affects the
  participant dashboard's Signal Evolution trend chart**, which reads
  `AtlasRecord.constellation_scores` directly. Also present, unfixed, in the mobile
  app's identical `indices.json`. Fixing it means re-deriving which `PAT-###` ids
  each index should actually reference (or reworking `computeIndices` to key off
  something more stable, e.g. pattern domain) — deferred because it touches curated
  AIKB content shared with the mobile app.
- **AIKB `valueChecks` are empty** for all 120 patterns, so the AIKB-only pattern
  path is dormant; detection runs through the deterministic v4.3 ontology and AIKB
  entries are matched **by name** for ids/metadata. If the pattern registry is ever
  populated with `valueChecks`, that path activates automatically
  (`pattern-service.ts`).
- **`pain_duration`** exists in the mobile registry + v5 pain flow but not in the
  `Part0` AIKB workbook, so `aikb:build` emits 65 fields and `observations.json` is
  kept at 66 by re-adding it. Re-add after regenerating (see `scripts/README.md`).
- **Unmatched responses**: `consent_acknowledged` and `safety_flags` have no
  contract field binding (they aren't reflection inputs) — the
  `[AtlasObservationDebug] Responses without contract field binding` log line is
  expected, not an error.
- **Projection tables are an optional mirror.** The EAV `ObservationResponse` rows
  + the intelligence run are the source of truth; the 10 typed domain tables are a
  convenience view written non-fatally by `src/lib/observation/projection.ts`.
- **Narrative audio** URLs live in `localStorage` + the `Narrative` table, not in
  `ObservationResponse` — so on a brand-new device the audio player won't rehydrate
  from the server (text/transcription do). Pre-existing limitation.
- **Two working copies (D:/E:).** The repo is cloned on both drives and kept in
  sync via git. Schema/DB changes are **per-database**: after pulling, run
  `npx prisma migrate deploy` (or `db push`) **and** `npx prisma generate` on that
  machine, then restart the dev server.

---

## 7. Verify a change end-to-end

1. `npm run dev`, sign in as the seeded participant.
2. Walk the first observation to the reflection step.
3. Expect `POST /api/observation 200` then `POST /api/observation/intelligence 200`.
4. Check the returned `reflectionSource` (`openai` when the key is valid,
   `deterministic` otherwise) and that patterns/indices/archetype are populated.
5. Type-check after edits: `npx prisma generate && npx tsc --noEmit`
   (the two `build-form-definition.mts` import-extension warnings are expected —
   that script runs via `node --experimental-strip-types`, not the Next build).

---

## 8. File map (quick reference)

| Area | Path |
|---|---|
| Pipeline orchestrator | `src/lib/observation/intelligence/reflection-runner.ts` |
| AIKB services | `src/lib/observation/intelligence/{extractor,signal-service,pattern-service,indices-service,knowledge-graph-service,reflection-planner,governance-service,explainability-service}.ts` |
| Deterministic v4.3 engine | `src/lib/observation/intelligence/v43/{atlas-intelligence-service,atlas-intelligence-v43,pattern-ontology,narrative-intelligence,openai-reflection}.ts` |
| Constellation Record content (§4.4) | `src/lib/observation/intelligence/v43/constellation-node-content.ts`, `src/components/observation/atlas-constellation-map.tsx` |
| Country searchable dropdown (§4.4) | `src/components/observation/country-search-field.tsx` |
| AIKB bundle + loader | `src/content/aikb/*.json`, `src/lib/observation/aikb/*` |
| Intelligence API | `src/app/api/observation/intelligence/route.ts` |
| Observation save/resume API | `src/app/api/observation/route.ts` |
| Wizard + screens | `src/app/(participant)/observation/ObservationWizard.tsx`, `screens/ScreenRenderer.tsx`, `screens/QuestionFields.tsx` |
| Flow loader / router | `src/lib/observation/{definition,router,projection,types}.ts` |
| Generators | `scripts/build-aikb.mjs`, `scripts/build-form-definition.mts` |
| Schema + migrations | `prisma/schema.prisma`, `prisma/migrations/*` |
| Seed | `prisma/seed.mjs`, `prisma/seed/form-definition.json` |
| DB / generation guide | `prisma/README.md`, `scripts/README.md` |
