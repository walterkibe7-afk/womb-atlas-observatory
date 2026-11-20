# Database, generation & seeding — the complete guide

Everything the database needs is **generated from committed source and then seeded**.
This is the single reference for regenerating the JSON artifacts, seeding, migrating,
and doing a full reset.

---

## 0. Prerequisites

- **MySQL/MariaDB** running locally, and `DATABASE_URL` set in `.env`
  (default `mysql://root:@localhost:3306/wombatlas_db`).
- `npm install` (installs `prisma`, `@prisma/client`, and the `xlsx` devDependency used by the AIKB generator).
- Node 22.15+ (the form generator uses `--experimental-strip-types`).
- After **any** edit to `prisma/schema.prisma`, run `npx prisma generate` before building.

---

## 1. The data pipeline (what generates what)

```
  ┌─ AIKB spec workbooks ─────────────┐   npm run aikb:build     ┌─ src/content/aikb/*.json ─┐
  │ prisma/seed/aikb-specs/*.xlsx     │ ───────────────────────► │ observations, signals,     │
  └───────────────────────────────────┘                          │ patterns, reflection,      │
                                                                  │ knowledge_graph, indices,  │
                                                                  │ governance                 │
                                                                  └────────────┬───────────────┘
                                                                               │ (imported at build time
                                                                               │  by the AIKB loader)
  ┌─ v5 screen register (TS source) ──────────────────────────┐  npm run form:build           │
  │ src/lib/observation/intelligence/v43/                     │ ────────────►┐                 │
  │   screen-register-first-observation.ts   (flow)           │              │                 │
  │   observation-contract.ts                (field bindings) │              ▼                 │
  │ prisma/seed/form-definition.legacy.json  (check-in flow,  │   prisma/seed/form-definition.json
  │                                           projection tgts) │              │                 │
  └────────────────────────────────────────────────────────────┘             │                 │
                                                                              ▼                 ▼
                                                       npm run db:seed  ──►  DATABASE  ◄─────────┘
                                                       (prisma/seed.mjs reads form-definition.json;
                                                        the app reads the AIKB JSON at runtime)
```

- **AIKB JSON** = the intelligence knowledge base (used by the Atlas Intelligence engine at runtime).
- **form-definition.json** = the observation flow (screens/questions/options/routes) that the seeder loads into the `form_*` tables.
- The seeder **does not** touch the AIKB JSON — that is imported directly by the app.

---

## 2. Commands

### Generate the JSON artifacts

```bash
npm run aikb:build      # prisma/seed/aikb-specs/*.xlsx  ->  src/content/aikb/*.json
npm run aikb:validate   # sanity-check the AIKB bundle
npm run form:build      # v5 screen register (TS) ->  prisma/seed/form-definition.json
```

### Seed the database

```bash
npm run db:seed         # (= prisma db seed) loads form-definition.json + admin user
```

### Regenerate everything, then seed

```bash
npm run aikb:build && npm run form:build && npm run db:seed
```

> ⚠️ After `npm run aikb:build`, re-add the `pain_duration` field to
> `src/content/aikb/observations.json` (see the caveat below) before relying on the
> pain flow.

### Migrations

```bash
npx prisma migrate dev --name <change>   # create + apply a migration in dev (also seeds)
npx prisma migrate status                # show applied/pending migrations
npx prisma generate                      # regenerate the client after a schema edit
```

### Full reset (development only — destroys all data)

```bash
npx prisma migrate reset                 # drop, re-apply all migrations, reseed
# or the schema-push equivalent:
npx prisma db push --force-reset && npm run db:seed
```

The current DB was baselined with migration `20260702000000_init`, so `migrate dev`
and `migrate reset` both work going forward.

---

## 3. Key files

| Path | Role |
|---|---|
| `scripts/build-aikb.mjs` + `scripts/aikb-source-map.json` | AIKB generator (SheetJS) + sheet-mapping config |
| `prisma/seed/aikb-specs/AIKB_v1_Part*.xlsx` | AIKB spec workbooks (source of truth) |
| `scripts/build-form-definition.mts` | Form-definition generator (reads the committed v5 TS source) |
| `scripts/validate-aikb.mjs` | AIKB validator |
| `src/lib/observation/intelligence/v43/screen-register-first-observation.ts` | v5 observation flow — hand-authored TS source |
| `prisma/seed/form-definition.json` | Generated seed input (do not hand-edit; run `form:build`) |
| `prisma/seed/form-definition.legacy.json` | Legacy v4.1 definition — source of the preserved `atlas_checkin` flow + projection targets |
| `prisma/seed.mjs` | The seeder (loads `form-definition.json`, seeds admin) |
| `prisma/schema.prisma` | Prisma schema (41 tables) |
| `scripts/README.md` | Generator internals / provenance |

---

## 4. Caveats

- **`pain_duration`:** `aikb:build` emits 65 observation fields; `observations.json`
  is kept at **66** because `pain_duration` (used by the v5 pain flow) exists in the
  mobile registry but not in the `Part0` workbook. Re-add it after regenerating.
  (Details in `scripts/README.md`.)
- **Empty `signals` / `reflectionRules`:** `form:build` intentionally emits these empty
  — the v4.3 Atlas Intelligence engine (`/api/observation/intelligence`) replaces the
  old DSL rule engine.
- **`form-definition.json` is generated** — edit the TS screen register (or the legacy
  file / bindings) and re-run `npm run form:build`; never hand-edit the JSON.
- **Regenerate the Prisma client** (`npx prisma generate`) after schema edits, or the
  build fails with stale-type errors.
- **Sessions survive a reset (JWT).** Auth uses `strategy: "jwt"`, so the login cookie
  keeps its `userId` even after `migrate reset` / `db push --force-reset` wipes the
  `User` table. Writing with that orphaned id FK-crashes on `userId` — the observation
  route now degrades to `401` instead of `500`, but you must **sign out and sign in
  again** to mint a valid session. The seeder provisions two accounts for this:
  `admin@system.com` and `participant@system.com`, both with password `password`.
