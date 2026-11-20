# Localizing the v4.3 Reflection Content — Implementation Plan

## 0. What this document is

A precise, file-by-file plan for translating the content that actually appears in the Reflection Chamber, the wizard's Atlas Record screens, and the deterministic reflection fallback — the content the client's Urdu testing showed as still-English. This supersedes the earlier "translate `src/content/aikb/*.json`" plan: that content was traced to its actual consumers and confirmed **not** to be what renders on screen. This document only targets the confirmed live path.

Every claim below is a traced fact — file, line, function — not an assumption. Where a call site wasn't independently re-verified in this pass, it's marked `(inferred)` and should be re-confirmed during implementation.

---

## 1. The two systems, and why only one needs work

Womb Atlas computes a reflection two ways at once:

- **The AIKB layer** — `src/content/aikb/*.json`, generated from Excel via `npm run aikb:build`. Feeds `AtlasPatternRecord`/`AtlasObservationRecord`/`AtlasSignalRecord` via `src/lib/observation/intelligence/pattern-service.ts` and `explainability-service.ts`.
- **The v4.3 engine** — hardcoded TypeScript registries in three files, "ported verbatim from the mobile app." Feeds `AtlasObservedPattern`, `AtlasArchetype`, and the deterministic reflection paragraphs.

**Traced conclusion: the AIKB JSON layer's prose fields (`patterns.json`'s `meaning`/`atlasNote`/`watchOverTime`, `reflection.json`'s `name`, `observations.json`/`signals.json`'s `label`) only ever reach two destinations — the LLM prompt as English input context (`openai-reflection.ts`'s `buildPrompt()`, where English input is correct by design — the model is instructed to translate from it), and `AtlasExplainabilityRow`/`AtlasObservationRow`/`AtlasSignalRow`, which are DB audit rows read only by steward/analyst dashboards, never the participant UI.** They do not need translation to fix what was seen on screen. **Do not spend effort there.** (`knowledge_graph.json`, `indices.json`, `governance.json` were already independently confirmed to need zero translation, for separate reasons — pure structural edges, analyst-only, and internal governance labels respectively.)

**The v4.3 engine's hardcoded registries are the confirmed source of everything visible.** Direct textual matches to the client's screenshots:

| Screenshot text | Source |
|---|---|
| "Heavy or disruptive bleeding" (pattern name) | `pattern-ontology.ts`, `PRIMARY_PATTERNS[0].participantLabel` |
| "Atlas noticed that bleeding may be requiring more preparation, energy, and attention in daily life." | `pattern-ontology.ts`, `PRIMARY_PATTERNS[0].plainLanguageMeaning` |
| "Atlas grouped these because bleeding-related answers may connect duration, clot burden, product changes, and daily preparation." | `pattern-ontology.ts`, `PRIMARY_PATTERNS[0].whyConnected` |
| "Whether bleeding remains stable, becomes heavier or more unpredictable..." | `pattern-ontology.ts`, `PRIMARY_PATTERNS[0].watchOverTime` |
| "The Adapting Navigator" + "This archetype appears when body experiences begin influencing planning, preparation, and routine..." | `atlas-intelligence-v43.ts`, `archetypeRegistry[0].name` / `.whatThisMeans` |

This is where the work goes.

---

## 2. The three files, field by field

### 2.1 `src/lib/observation/intelligence/v43/pattern-ontology.ts`

Three hardcoded arrays: `PRIMARY_PATTERNS`, `SECONDARY_PATTERNS`, `EMERGENT_THEMES` — 54 entries combined, type `OntologyPatternDefinition`.

**Translate these fields (confirmed rendered):**
| Field | Confirmed render site |
|---|---|
| `participantLabel` | `reflection-chamber.ts`'s `ObservedPatternCard`/`UnderstandingBlockCard`; `atlas-intelligence-service.ts`'s `composeReflection()` snapshot text |
| `plainLanguageMeaning` | `reflection-chamber.ts`'s `buildPatternCard()` → `ObservedPatternCard`'s "Why this matters"; `composeReflection()`'s reflection paragraphs |
| `whyConnected` | `reflection-chamber.ts`'s `buildUnderstanding()` → `UnderstandingBlockCard`'s "Why" text |
| `watchOverTime` | Feeds the Watch tab `(inferred — re-confirm buildWatchGroups() reads this field before implementing)` |
| `atlasNote` | Read via `PATTERN_BY_ID.get(pattern.id)?.atlasNote` in `toAtlasObservedPatterns()`; exact render site not independently confirmed — translate anyway, zero-cost if unused |

**Never touch — zero read references found anywhere in the codebase (pure authoring documentation):** `signalRules`, `relationshipRules`, `confidenceRules`, `inclusionCriteria`, `exclusionCriteria`, `definition`.

**Never touch — matching/compute keys, used in `===` comparisons and Map keys throughout the pipeline:** `id`, `scientificName`, `class`.

### 2.2 `src/lib/observation/intelligence/v43/atlas-intelligence-service.ts`

Two hardcoded lookup objects, each keyed by canonical scientific name (the key itself is a **matching key — never touch**):

- `meaningRegistry: Record<string, AtlasMeaning>` — 8 entries, fields `name`, `explanation`. Both confirmed rendered: `meaningRegistry[...].explanation` feeds `composeReflection()`'s third reflection paragraph.
- `bodyLiteracyLibrary: Record<string, AtlasBodyLiteracy>` — 8 entries, fields `title`, `note`. `note` confirmed rendered as the reflection's body-literacy note; translate `title` alongside it (zero-cost if unused).

**Translate:** `name`, `explanation`, `title`, `note` (the values only — never the object's string keys, e.g. `"Bleeding Burden"`, which are matching lookups).

### 2.3 `src/lib/observation/intelligence/v43/atlas-intelligence-v43.ts`

`archetypeRegistry: ArchetypeDefinition[]` — 6 entries.

**Translate:** `description`, `whatThisMeans`, `whyTemplate`, `logicSummary` — confirmed rendered via `AtlasArchetype.description/whatThisMeans/whyAtlasChose/archetypeLogicSummary` in `ScreenRenderer.tsx` and `atlas-record-detail.tsx`.

**`name` needs the same defensive treatment as pattern names (see §3) — do not translate in place.** Archetype selection (`scoreArchetype()`) passes `definition.name` into `narrativeThemeToArchetypeScore(...)`, an external function not yet inspected in this pass. Whether that function compares `name` against something wasn't confirmed either way — **treat as a suspected matching key until proven otherwise, per the rule below.**

**Never touch — confirmed matching/compute fields:** `patternWeights` (a `Record<patternName, weight>` used directly in scoring), `narrativeThemes` (compared via `.includes()` against detected theme names).

---

## 3. The one rule that prevents breaking computation

**Every `name`-shaped field in every one of these registries is a suspected dual-use field (matching key *and* legacy display text) until specifically proven to be display-only.** This was independently confirmed twice already — `pattern.name` in `pattern-ontology.ts` (compared with `===` in ~10 places across the pipeline) and archetype selection passing `definition.name` into an unverified scoring function. Given that pattern repeating, the safe default for the whole plan is:

> **Never edit a `name` field's value in place. Always add a new, separate `<thing>ParticipantLabel`-style field carrying the translation, read only at the confirmed display call site, leaving every existing comparison/lookup untouched.**

This costs nothing extra to apply uniformly and removes the need to individually re-prove every single comparison site before writing code.

---

## 4. Architecture — one lookup file, zero edits to the registries themselves

Same mechanism used everywhere else tonight (`FormTranslation`, `translations-shell-ur.json`), adapted for hardcoded TS instead of JSON:

1. **New file:** `src/content/aikb/v43-translations-ur.json`, keyed `"<id>.<field>": { "ur": "..." }` — e.g. `"bleeding_burden.plainLanguageMeaning": { "ur": "..." }`, `"bleeding_burden.participantLabel": { "ur": "..." }`.
2. **New accessor module:** `src/lib/observation/intelligence/v43/v43-i18n.ts`:
   ```ts
   import translationsUr from "@/content/aikb/v43-translations-ur.json";
   const LOCALE_FILES: Record<string, Record<string, Record<string, string>>> = { ur: translationsUr as any };
   export function v43Text(id: string, field: string, fallback: string, locale?: string): string {
     if (!locale || locale === "en") return fallback;
     return LOCALE_FILES[locale]?.[`${id}.${field}`]?.[locale] ?? fallback;
   }
   ```
   Pure, synchronous, no DB, no async — same as reading the hardcoded English value directly, just with a lookup in front of it.
3. **`locale` threads through exactly where it already does today** — `runAtlasIntelligence(answers, locale)` already receives it (confirmed working, per the reflection chamber fix earlier tonight). It needs to additionally reach: `detectPatterns()` (pattern-service.ts and/or atlas-intelligence-service.ts's own `detectPatterns`), `toAtlasObservedPatterns()`, `composeReflection()`, `selectArchetype`/`buildArchetype` (the function containing the `scoreArchetype`/`selected` logic in atlas-intelligence-v43.ts). Each of these already receives several parameters; add `locale?: string` to each signature and pass it down one level further, same shape as the reflection-chamber threading already done.
4. **At each confirmed display-construction point identified in §2, wrap the raw field read:** e.g. `pattern.plainLanguageMeaning` becomes `v43Text(pattern.id, "plainLanguageMeaning", pattern.plainLanguageMeaning, locale)`. This is a one-line change per field, at the point where the value is placed into the object that ultimately reaches a screen — not at every intermediate pass-through.

**What never changes:** every `.ts` registry file's own source text stays byte-identical, forever. Nothing is edited in `pattern-ontology.ts`, `atlas-intelligence-service.ts`, or `atlas-intelligence-v43.ts` except adding an optional `locale` parameter to a handful of function signatures and wrapping specific field reads at specific lines. No `id`, `scientificName`, `class`, `patternWeights`, `narrativeThemes`, or any structural/scoring field is ever read differently based on locale.

---

## 5. How we confirm nothing broke

1. **Golden-record regression check, before any other testing.** Pick one fixed, representative answer set. Run the pipeline against it once *before* any code change, save the full output (`AtlasRecord`, `reflectionChamber`, `archetype`, burden, constellation — the works) as a snapshot. After the change, run the *same* answer set with `locale` unset/`"en"` and diff the output against the snapshot — it must be **byte-for-byte identical**. If it isn't, something touched a compute path, and that's found before it ships, not after.
2. **`tsc --noEmit`, lint, `npm run build`** — same discipline as every change made tonight, no exceptions given this is the most delicate code touched all night.
3. **Run the same answer set with `locale: "ur"`** and manually confirm: pattern names, "why this matters," "why connected," watch predictions, and archetype name/description now render in Urdu; Burden Level, confidence stars, and every structural label are unaffected; the AI-written reflection paragraph (already confirmed working) is unaffected.
4. **Confirm a second, different answer set** (ideally one that hits `SECONDARY_PATTERNS` or `EMERGENT_THEMES`, not just the first primary pattern) to make sure the fix isn't accidentally scoped to only the first array.

---

## 6. Producing the actual Urdu content

~326 fields total (54 patterns × ~5 fields + 8+8 registry entries × 2 fields + 6 archetypes × 4 fields, plus new `participantLabel`-equivalent fields for patterns/archetypes). Same approach as every translation batch tonight: I draft fluent Urdu directly, seed it into the new JSON file, verify via the golden-record check above. Same caveat as everything translated tonight — this is a first draft, not a substitute for native-speaker review before this is called production-ready, and it matters more here than anywhere else so far, since this is the actual clinical-adjacent guidance content, not UI chrome.

---

## 7. What this results in, concretely

After this work: an Urdu-locale participant sees her pattern names, the "why this matters"/"why connected"/"what Atlas will watch" explanations, her archetype's name and description, and the deterministic reflection fallback — all in Urdu, matching the same standard already achieved for the shell, the wizard, and the AI-written reflection paragraph earlier tonight. Nothing about which patterns get detected, which archetype gets selected, how confidence is scored, or what the LLM receives as input changes for any locale, including English — confirmed by the golden-record diff in §5, not just asserted.

**Explicitly still out of scope after this:** the AIKB JSON files' display fields (§1 — confirmed low-value, can be revisited later at near-zero risk using the identical mechanism if ever needed for the steward/analyst audit views), voice/STT-TTS, RTL layout, native-speaker review of any Urdu content produced tonight.
