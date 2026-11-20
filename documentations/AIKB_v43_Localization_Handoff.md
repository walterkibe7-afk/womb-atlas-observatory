# AIKB v4.3 Engine Localization — Handoff

**Status as of 2026-09-16, commit `138ff19` ("first observation localization completed!"), branch `staging`.**
Live-tested end-to-end by the client (Hatim) across three full observation cycles in Urdu. All
known issues found during those tests are fixed. Two structurally separate surfaces remain
untranslated by design decision (deferred, not forgotten) — see §5.

This file exists so a fresh Claude session (or a fresh pair of human eyes) can pick this work up
without re-deriving everything from git history. Read this before touching any file named in §6.

---

## 1. What this project is

Womb Atlas Observatory participant portal, going multilingual. **Urdu first**, but the
architecture targets seven languages from day one: `en`, `ur`, `fr`, `sw`, `es`, `luo`, `kik`
(`src/lib/observation/languages.ts`). Language is chosen **once, permanently**, right after first
sign-in (`/choose-language`), enforced server-side, no admin override — because generated content
(reflections, AI chat) exists in that language from that point on and can't be retroactively
translated. That gate, the safety-blocklist fix, and the wizard-chrome translation were built in an
earlier phase of this project (see git history before commit `2bc045a`) and are **not** what this
document is about.

**This document covers**: localizing the deterministic "v4.3 engine" — the hardcoded TypeScript
pattern-detection/archetype/reflection-composition system that produces the actual content of an
Atlas Record (archetype, patterns, signal landscape, watch predictions, the reflection chamber's
deep-dive tabs). This is a *separate* content layer from the observation wizard's own questions —
distinct code, distinct translation mechanism, and it was **still 100% English** when this phase
started, despite the wizard itself already rendering correctly in Urdu.

The original scoping plan for this phase is `documentations/AIKB_v43_Localization_Plan.md` — read
it for the full "why only the v4.3 engine, not the AIKB JSON bundle" reasoning and the `.name`
dual-use safety rule. This handoff assumes that context and reports what actually happened once
implementation started, including several things the plan didn't anticipate.

---

## 2. The two translation mechanisms in this codebase — don't confuse them

### A. The pre-existing wizard mechanism (`FormTranslation` DB table)

Already built before this phase. Backs the observation wizard's screens/questions/options and the
UI chrome (sidebar, buttons, safety banner). Keys look like `QUESTION.access_to_care.questionText`
or `OPTION.access_to_care.sometimes.label`. Loaded via
`loadTranslationMap(flowKey, locale, prefixes?)` in `src/lib/observation/translations.ts`, resolved
via `getFormDefinition()` in `src/lib/observation/definition.ts`. **Already has ~500+ Urdu rows
seeded** — the wizard renders correctly in Urdu already and always did.

### B. The new v4.3-engine mechanism (`v43Text`, static JSON file) — built this phase

`src/lib/observation/intelligence/v43/v43-i18n.ts`:

```ts
const LOCALE_FILES: Record<string, LocaleMap> = {
  ur: translationsUr as LocaleMap,   // src/content/aikb/v43-translations-ur.json
};

export function v43Text(id: string, field: string, fallback: string, locale?: string): string {
  if (!locale || locale === "en") return fallback;
  const entry = LOCALE_FILES[locale]?.[`${id}.${field}`];
  return entry?.[locale] ?? fallback;
}
```

Pure synchronous lookup, no DB, no async. Callers always pass their own English value as
`fallback`, so it's a correct-by-construction no-op for English/undefined locale and gracefully
falls back to English for any missing key — never throws, never blank. **This is generic
multi-lingual infrastructure, not Urdu-specific** — adding French means adding `fr:
translationsFr` here plus a new JSON file with the same key shape. Confirmed with the client this
is understood correctly.

**The safety rule that governs every single edit in this phase**: many hardcoded registries have a
`.name` field that is dual-use — read as a *matching key* (`===`/`.includes()` against detected
pattern names, narrative theme names, etc.) **and**, via a fallback chain, as legacy display text.
**Never edit `.name` in place.** Always read it as a lookup key into `v43Text`, write the translated
result to a *different* field (or a new field, e.g. `label`), and translate only at the confirmed
display call site — after all matching/scoring against the original English value has already run.
This was verified by direct code tracing at every location touched, not assumed.

**Interaction between the two mechanisms**: `readableValue()`/`meta.label` in
`observation-extractor.ts` (§4.5 below) bridge them — they reuse mechanism A's already-seeded rows
to translate content inside the v4.3 engine, rather than duplicating translation effort. This is
the one place the two systems talk to each other.

---

## 3. What got fixed, in the order it was found (each one matters for a future debugging session)

Everything below passed `npx tsc --noEmit`, `npm run lint`, and `npm run build` clean at every
step. 304 Urdu keys now exist in `src/content/aikb/v43-translations-ur.json`, all verified against
every call site with an automated coverage check (zero missing keys) — see §7 for how to re-run
that check.

### 3.1 The three original registries (per the approved plan)

- **`pattern-ontology.ts`** — 15 pattern/theme definitions (6 primary, 5 secondary, 4 emergent),
  each with `participantLabel`, `plainLanguageMeaning`, `atlasNote`, `whyConnected`,
  `watchOverTime`. `aggregatePattern()`, `detectEmergentThemes()`, `buildOntologyRoutingContext()`,
  `toAtlasObservedPatterns()`, `participantLabelFor()` all locale-aware. `id`/`scientificName`/
  `class` left untouched everywhere (matching keys).
- **`atlas-intelligence-service.ts`** — `meaningRegistry` (8 entries), `bodyLiteracyLibrary` (9
  entries incl. `Baseline`), `composeReflection()`'s prose templates. `detectPatterns()`,
  `selectMeanings()`, `selectBodyLiteracy()`, `composeReflection()`, `buildAtlasRecord()` all
  locale-aware.
- **`atlas-intelligence-v43.ts`** — `archetypeRegistry` (6), `signalLandscapeRegistry` (5),
  `experienceLayerRegistry` (7), `patternConnectionRegistry` (8, keyed by
  `"${patternA}::${patternB}"`), `strengthRegistry` (6), plus every prose template in
  `composeReflectionContent()`/`detectArchetype()`/`buildReflectionCompass()`.

### 3.2 Bugs found only by live testing — these are the ones worth remembering

1. **The critical one**: `reflection-runner.ts` called `buildAtlasRecord(responses)` **with no
   `locale` argument at all**, even though the function received `locale` as a parameter and
   correctly forwarded it to the LLM reflection call two lines later. This single missing argument
   meant every deterministic v4.3 field (archetype, patterns, signal landscape, watch predictions,
   reflection compass, observation portrait) was generated in English regardless of locale, at the
   moment the record was created — while the free-form LLM-written paragraph and the UI chrome
   (separate mechanisms, both already locale-aware) looked correctly translated. This produced a
   deceptive "half-translated" first impression that looked like a deep architectural problem but
   was one missing parameter. **Lesson: when locale threading looks broken end-to-end, check the
   thinnest connector file between the route and the engine before assuming the engine itself is
   wrong.**

2. **A second, separate `dominantPattern`/`supportingPatterns` computation.** Inside
   `buildAtlasRecordV43()`'s own return block (bottom of the function, easy to miss), a *second*
   copy of this computation existed, independent of the one already fixed inside
   `composeReflectionContent()`, and it used raw `pattern.name` (scientific name) instead of
   `participantLabel`. This is what fed `AtlasRecordDetail.dominantPattern` (via
   `atlas-intelligence-service.ts`'s `buildDownloadRecord`/`toAtlasRecordDetail` chain) and showed
   up as raw "Hormonal Rhythm" / "Daily Function" headings on the final "Your Atlas Record" screen.
   Confirmed safe to translate (checked every consumer — PDF, chat context, dashboard, summary.ts —
   all pure display, never matched against).

3. **`routeObservation()`** (`pattern-ontology.ts`) never received `locale` and read
   `primary.participantLabel`/`secondary.participantLabel` straight off the raw registry
   definitions. Fixed to translate via `v43Text(id, "participantLabel", ...)`. This fed
   `SignalRoutingResult.primaryParticipantLabel`/`secondaryParticipantLabel`, consumed by
   `buildSignalContributions()` in the Evidence tab.

4. **`reflection-chamber.ts` — the Reflection Chamber deep-dive UI's data builder — was a
   completely separate hardcoded-English subsystem**, not covered by the original 3-file plan at
   all. It builds its own internal `ontologyContext` via `buildOntologyRoutingContext(observations)`
   *without* locale, and has its own hardcoded registries (`WATCH_ITEM_DEFINITIONS`,
   `WATCH_GROUP_DEFINITIONS`) and ~13 English prose-fragment templates for the Story/
   Understanding/Connections narrative. Fixed: threaded `locale` through every function in the
   file (`buildStory`, `buildConnections`, `buildUnderstanding`, `buildPatternCard`,
   `buildWatchGroups`, `buildWatchItem`, `buildAtlasRecordSections`, `buildArchetype`), translated
   its labels/templates. **Safety note**: `WATCH_ITEM_DEFINITIONS[].label` and
   `WATCH_GROUP_DEFINITIONS[].itemLabels` are matched against `narrativeIntelligence.watchModifiers`
   internally — translation happens only at the very end, in `buildWatchGroups`' return statement,
   after all matching is done, same dual-use pattern as everywhere else.

5. **The Evidence tab's 34-entry `evidenceTheme` registry** (`ONTOLOGY_SIGNAL_RULES` in
   `pattern-ontology.ts`) fed `evidenceThemeFor()`'s card *titles* ("Care access", "Night
   disruption", etc.) with zero locale awareness. Fixed, 34 new keys authored.

6. **The Evidence tab's bullet text** ("Current Access to Care: sometimes",
   "Bleeding Daily-Life Impact: disturbs sleep") — this is the one that looked like it needed a
   large new translation effort but didn't. It's built in `observation-extractor.ts`'s
   `extractObservationsFromResponses()` via `readableValue()` and `meta.label`, which reconstruct
   "field label: answer value" strings **independently of the wizard's own rendering**, from a
   parallel hardcoded TS registry (`screen-register-first-observation.ts`'s `firstObservationScreens`)
   and/or the AIKB JSON bundle. Investigated whether the wizard's *already-seeded* DB translations
   (`QUESTION.${fieldId}.questionText`, `OPTION.${fieldId}.${value}.label` — confirmed 501 Urdu
   option rows + 80 question rows already exist) could be reused instead of authoring anything new.
   They could. Fix: threaded an optional `fieldTranslations: Record<string,string>` map (fetched
   once via `loadTranslationMap("first_observation", locale)` in `reflection-runner.ts`, no prefix
   restriction so it gets everything) through `extractObservationsFromResponses()` →
   `readableValue()`/the label construction, and through **both** call paths that actually reach a
   screen: `atlas-intelligence-service.ts`'s `detectPatterns()` (which matters more than it looks —
   it feeds `supportingObservations` shown on the Observed Patterns screen, via
   `aggregatePattern()`'s `supportingSignals = matched.map(r => r.normalizedSignal)`, not just the
   Evidence tab) and `reflection-chamber.ts`'s own extraction call. **Zero new content authored for
   this fix** — pure reuse of already-approved wizard translations, so no native-speaker-review debt
   was added.

7. **`formatSubduedPatternMessages()`** (`atlas-intelligence-v43.ts`) — the "What Atlas did NOT
   strongly observe" section, e.g. "No strong Pelvic Pressure pattern was observed in this record."
   Small, easy to miss because it's a short self-contained function. Translated the pattern name
   via `participantLabelFor()` (which already resolves legacy names like "Pelvic Pressure" through
   `LEGACY_TO_CANONICAL_SCIENTIFIC` correctly) and **reworded the sentence structure** rather than
   splicing the name into the English "No strong ... pattern was observed" frame — Urdu reads
   naturally with the pattern name first: `${label} — اس ریکارڈ میں کوئی مضبوط پیٹرن نہیں دیکھا گیا۔`

### 3.3 PDF fixes (partial — see §5 for what's deliberately not done)

`src/lib/pdf/atlas-pdf.ts`'s `generateAtlasRecordPdf()` was reading raw `.name` instead of the
translated `.label` for signal landscape, experience layers, and strengths — same bug class as
§3.2.2, fixed with the same `label ?? name` pattern. **The PDF still renders Urdu text as garbled
characters** — that's a font problem, not a translation problem, and is explicitly deferred (§5).

---

## 4. Files touched this phase (matches commit `138ff19` exactly)

| File | What changed |
|---|---|
| `src/lib/observation/intelligence/v43/v43-i18n.ts` | **New.** The `v43Text()` lookup + `LOCALE_FILES` registry. |
| `src/content/aikb/v43-translations-ur.json` | **New.** 304 Urdu keys, all verified against source. |
| `src/lib/observation/intelligence/v43/pattern-ontology.ts` | 15 patterns/themes translated; `routeObservation()`, `buildOntologyRoutingContext()` locale-threaded. |
| `src/lib/observation/intelligence/v43/atlas-intelligence-service.ts` | `meaningRegistry`/`bodyLiteracyLibrary`/`composeReflection()` translated; `detectPatterns()`, `buildAtlasRecord()`, `buildObservedPatternCards()`, `buildDownloadRecord()` locale/fieldTranslations-threaded. |
| `src/lib/observation/intelligence/v43/atlas-intelligence-v43.ts` | All 5 registries + all prose templates translated; second `dominantPattern`/`supportingPatterns` bug fixed; `formatSubduedPatternMessages()` fixed. |
| `src/lib/observation/intelligence/v43/reflection-chamber.ts` | Entire file made locale-aware (was untouched by the original plan); Watch/Story/Understanding/Connections/Evidence-tab-titles translated. |
| `src/lib/observation/intelligence/v43/observation-extractor.ts` | `extractObservationsFromResponses()`/`readableValue()` now accept and use a `fieldTranslations` map reused from the wizard's own DB rows. |
| `src/lib/observation/intelligence/reflection-runner.ts` | The critical `locale` argument fix; fetches `fieldTranslations` once and threads it everywhere. |
| `src/app/api/observation/intelligence/route.ts` | Passes `session.user.locale` into `buildObservedPatternCards`/`buildDownloadRecord`. |
| `src/app/(participant)/observation/screens/ScreenRenderer.tsx` | `.label ?? .name` fix for signal landscape/experience layers/strengths (Records screen duplicate). |
| `src/components/observation/atlas-record-detail.tsx` | Same `.label ?? .name` fix (the standalone Records-page mirror). |
| `src/lib/pdf/atlas-pdf.ts` | Same `.label ?? .name` fix for the PDF export. |
| `documentations/AIKB_v43_Localization_Plan.md` | The original scoping plan (unchanged this phase, listed here because it's the required reading companion to this file). |

---

## 5. Known remaining gaps — deliberately not fixed, not forgotten

1. **Constellation screen** (`src/lib/observation/intelligence/v43/constellation-node-content.ts`)
   — calls `buildOntologyRoutingContext(input.observations)` and `participantLabelFor(patternTitle)`
   **without locale anywhere in the file**. The visual constellation map's pattern titles and
   related-pattern lists stay English regardless of locale. Same fix pattern as everything above
   would apply; just not yet done.
2. **`narrative-intelligence.ts`** — a fully separate, self-contained 17-entry hardcoded English
   registry (`participantLabel`, etc. for narrative themes like "Finding ways to cope", "Not
   knowing what comes next"). Feeds `narrativeThemes` shown on the record detail page. Completely
   untouched; same treatment would apply.
3. **PDF Arabic-script rendering.** `atlas-pdf.ts` uses jsPDF's built-in `"helvetica"` font, which
   has no Arabic glyphs at all. Any Urdu text run through it renders as garbled mojibake
   characters — confirmed directly in the client's exported PDF. Fixing this means embedding a
   Unicode font with Arabic coverage (e.g. Noto Nastaliq Urdu) into jsPDF **and** likely
   pre-shaping the Urdu text for correct letter-joining before drawing it, since jsPDF does not do
   Arabic contextual shaping on its own. The client explicitly said "we will work on the pdf part
   later" — do not start this without asking first, it's a bigger, separate piece of work.
4. **Native-speaker review.** None of the ~300+ Urdu strings authored this phase (by Claude, not a
   certified Urdu translator) have had a native-speaker pass — including the earlier-phase safety
   blocklist terms. This was flagged as a pre-ship requirement in the original plan and has not
   been actioned. The reused wizard-translation content (§3.2.6) is the one exception — that was
   presumably already reviewed as part of the wizard's own earlier localization work, not authored
   this phase.
5. **Not retested since the fixes**: chat/Aminata, dashboard, and timeline screens. Only the
   observation wizard + record/reflection screens were retested live after each fix round.

---

## 6. How to verify/test (what actually worked, this phase)

Locale is permanent by design (no admin override) once set through `/choose-language`, so fast
iteration used **Prisma Studio** (`npx prisma studio`) to flip a test `User.locale` directly
between `null`/`en`/`ur` rather than creating a new account every round.

Verification loop that was actually used, each round:
1. `npx tsc --noEmit` — must be clean.
2. `npm run lint` — check for *new* errors only (there is pre-existing unrelated lint debt in files
   never touched this phase — e.g. `ParticipantDataProvider.tsx`, `ChatInterface.tsx`,
   `ObservationWizard.tsx` — do not attempt to fix that debt as part of this work).
3. `npm run build` — must be clean.
4. Automated key-coverage check — a scratch Node script (written and discarded each time, not
   committed) that regexes every file for `v43Text\("...",\s*"..."` and `t\("..."` calls (the local
   `t = (field, fallback) => v43Text("_template", field, fallback, locale)` helper pattern used in
   several files) and cross-checks against `Object.keys()` of `v43-translations-ur.json`. Dynamic
   keys (`v43Text(variable, "field", ...)`, e.g. registry-name-keyed lookups) were checked by hand
   against the known registry entries — there is no automated check for those, so if you add a new
   dynamically-keyed lookup, verify its coverage manually.
5. **Live test**: sign up a *fresh* test account (or flip an existing test account's `locale` to
   `null` via Prisma Studio to re-trigger the gate), pick Urdu, run the full observation wizard to
   completion, and check — in order of what's broken most often — the "Your Atlas Record" screen
   (dominant pattern, supporting patterns, signal landscape, experience layers, strengths,
   reflection compass), the Reflection Chamber's Watch/Understanding/Connections/Evidence tabs, and
   the Observed Patterns screen.
6. **English regression check**: repeat step 5 with `locale: "en"` (or `null`, since undefined is
   also a no-op) on a separate test account — content must read *identically* to how it read before
   this phase, since `v43Text` is supposed to be a strict no-op for English. Any difference is a
   real regression.

**Important**: because the first observation is "record once" (edit-only after completion),
fixing a bug in the pipeline does **not** retroactively fix an already-generated record — its
`AtlasRecord.record_payload` was frozen at creation time. Every fix in §3 required a genuinely
*fresh* observation to verify, not a re-view of an existing one. This tripped up verification more
than once this phase — if a fix looks like it didn't work, check whether the test used a fresh
record before assuming the code is wrong.

---

## 7. Continuing this work

- To fix §5 item 1 or 2 (Constellation screen / `narrative-intelligence.ts`): same mechanical
  pattern as everything in §3 — add `locale?: string` params, thread them down every call chain to
  the actual registry lookup, translate via `v43Text(matchingKey, field, englishValue, locale)`,
  never mutate a field that's read elsewhere as a `.find()`/`.includes()`/`===` matching key. Trace
  every call site before editing, the way §3.2's bugs were found — don't assume a function that
  looks locale-aware actually received `locale` from its caller; check.
- To add a new language once Urdu is signed off: add the locale to `LANGUAGES`
  (`src/lib/observation/languages.ts`) if not already listed (all seven already are), author a new
  `src/content/aikb/v43-translations-<code>.json` with the same key shape as the Urdu file, add one
  line to `LOCALE_FILES` in `v43-i18n.ts`, add a `BLOCKED_TERMS_BY_LOCALE` entry in
  `openai-reflection.ts` if the diagnostic-language safety blocklist needs script-specific terms
  for that language, and seed the wizard-level `FormTranslation` rows the normal way
  (`prisma/seed-translations.mjs`, see `HANDOVER.md` §6). No engine code changes required — this
  was confirmed architecturally sound with the client (2026-09-16).
- The exhaustive key-coverage check script (§6.4) was never committed — if repeating this pattern
  for a new file/registry, it's worth writing that check as a proper `npm run` script this time
  rather than a disposable scratch file, since it will be needed again for every future file that
  gets this treatment.
