# Seed build tooling

Two generated artifacts feed the seeder, each reproducible from committed source:
the **AIKB** (from spec workbooks) and the **form definition** (from the v5 screen
register). Neither is hand-edited.

---

# Form definition (observation flow)

`prisma/seed/form-definition.json` (the `first_observation` screens/questions/options/
routes that the seeder loads) is **generated** from the committed v5 screen-register
source — the observation-flow analogue of the AIKB build.

> Note: the mobile app has **no** observation seeder/generator — it renders the flow
> directly from a hand-authored TS screen register. We mirror that TS source into this
> repo and generate our DB seed from it.

## Sources

- **Screen register (source of truth):** `src/lib/observation/intelligence/v43/screen-register-first-observation.ts` (mirrored from the mobile app; also used by the v4.3 engine).
- **Field bindings:** `src/lib/observation/intelligence/v43/observation-contract.ts` (app field id → AIKB registry field id).
- **Legacy carry-over:** `prisma/seed/form-definition.legacy.json` (supplies the preserved `atlas_checkin` flow + projection targets + narrative prompt texts).
- **Generator:** `scripts/build-form-definition.mts` (Node `--experimental-strip-types`).

## Command

```bash
npm run form:build   # regenerate prisma/seed/form-definition.json from the v5 screen register
```

It also refreshes the inspection snapshots `screen-register-v5.json` +
`app-to-registry-field-map.json`. After regenerating, reseed the DB (`npx prisma db seed`)
to apply changes. The old DSL `signals`/`reflectionRules` are intentionally emitted empty —
the v4.3 intelligence engine replaces them.

---

# AIKB build tooling

The Atlas Intelligence Knowledge Base (`src/content/aikb/*.json`) is a **generated
artifact**, not hand-written. It is built from the AIKB specification workbooks so
it can be regenerated whenever the specs change.

## Sources

- **Spec workbooks:** `prisma/seed/aikb-specs/AIKB_v1_Part*.xlsx` (+ `AIKB_Signal_Registry_Standard_v1.0.xlsx`) — copied from the mobile app's `specifications/`.
- **Sheet-mapping config:** `scripts/aikb-source-map.json` (which sheets/columns feed each output).
- **Generator:** `scripts/build-aikb.mjs` (Node + SheetJS `xlsx`). Uses the `xlsx` devDependency.
- **Validator:** `scripts/validate-aikb.mjs`.

## Commands

```bash
npm run aikb:build      # regenerate src/content/aikb/*.json from prisma/seed/aikb-specs/*.xlsx
npm run aikb:validate   # sanity-check the generated bundle
```

`build-aikb.mjs` reads workbooks from `prisma/seed/aikb-specs/` and writes the seven
JSON files to `src/content/aikb/`. The AIKB loader (`src/lib/observation/aikb/loader.ts`)
imports those JSON files at build time.

## Known delta: `pain_duration`

The generator currently emits **65** observation fields, but
`src/content/aikb/observations.json` is kept at **66** — it retains a
`pain_duration` field that exists in the mobile app's committed registry and is used
by the v5 pain flow, but is **not present in the `Part0_Observation_Registry` workbook**.

After running `npm run aikb:build`, `pain_duration` will be dropped. Until the Part0
workbook includes it, re-add it (or restore `observations.json` from version control).
The other six files (`signals`, `patterns`, `reflection`, `knowledge_graph`, `indices`,
`governance`) regenerate byte-identically.
