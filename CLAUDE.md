# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

> The `@AGENTS.md` import above is load-bearing: **Next.js 16 has breaking changes from your training data.** Read the relevant guide in `node_modules/next/dist/docs/` before writing Next.js code.

## Commands

```bash
npm run dev      # Start dev server (http://localhost:3000)
npm run build    # Production build
npm run start    # Serve the production build
npm run lint     # ESLint (eslint-config-next, core-web-vitals + typescript)
```

There is no test runner configured in this repo.

### Database (Prisma 7)
```bash
npx prisma generate        # Regenerate client after editing prisma/schema.prisma
npx prisma migrate dev     # Create + apply a migration in development
npx prisma studio          # Browse data
```
`prisma.config.ts` (not the schema block) supplies the datasource URL from `DATABASE_URL` via `dotenv`. Set `DATABASE_URL` in `.env` before running anything that touches the DB.

## Architecture

A Next.js App Router MVP ("Womb Atlas Observatory") for collecting menstrual/reproductive health observations, generating deterministic "Atlas Records," and routing them through a human review workflow. Three user roles, each with its own route group and sidebar:

- `src/app/(participant)/` — check-in, observation wizard, dashboard, timeline, records, reflections
- `src/app/(steward)/` — clinical review queue: audit, escalated, processed
- `src/app/(admin)/` — access control, database, status, insights

Each route group has its own `layout.tsx` + sidebar component (`Sidebar`, `StewardSidebar`, `AdminSidebar` in `src/components/`).


### The observation engine is schema-driven
`src/content/observation-schema.json` is the source of truth: 65 question objects, each with `fieldId`, `screenId`, `fieldType` (`single_select` | `multi_select` | `boolean` | `text` | `country` | `text_audio`), `allowedValues`, and target `dbTable`/`dbColumn`. The wizard at `(participant)/observation/page.tsx` reads this JSON, groups questions by `screenId` into wizard screens, and renders inputs dynamically — **add or change questions by editing the JSON, not the component.** Answers are collected into a single `answers` object keyed by `fieldId`.

### Observation → Atlas Record pipeline
`src/app/api/observation/route.ts` (POST) is the core write path. On submit it:
1. Stores the full answer map in `Observation.dynamicAnswers` (Json column).
2. Mirrors select fields into typed "context chamber" tables (`DemographicContext`, `BleedingPattern`, `PainPattern`).
3. Creates an `AtlasRecord` with `Signal` rows (deterministic extraction).
4. Computes a **Burden Level** (Low/Moderate/High) from `bleedingScore`/`painScore`/`safetyFlag` using fixed rules.
5. Generates the AI Reflection text. **This is currently a mocked deterministic template** — there is no LLM call yet (comments reference a future Gemini integration). `templateId` encodes the burden type (A/B/C).

`api/voice/route.ts` and `api/records/route.ts` are also **mocked stubs** returning fixed data (future: Google Cloud Speech-to-Text, real record queries).

### Data model (`prisma/schema.prisma`)
`User` (role: participant/steward/admin) → `Observation` → typed context chambers + `Narrative` (audio/transcription) + `Reflection`. `AtlasRecord` holds `Signal`s (Physical Reality vs Lived Experience). `StewardReview` is the human review record; `AuditLog` tracks security events. The full free-form payload lives in `Observation.dynamicAnswers`; the chamber tables are a curated subset.

## ⚠️ Database provider mismatch
The runtime uses **MySQL/MariaDB**: `prisma/schema.prisma` declares `provider = "mysql"`, `src/lib/prisma.ts` connects via `@prisma/adapter-mariadb` (`PrismaMariaDb`), and the default URL is `mysql://root:@localhost:3306/wombatlas_db`. But `docker-compose.yml` spins up **Postgres**, and UI copy mentions "PostgreSQL." Treat MySQL/MariaDB as the real target (that's what the code connects to); the compose file and some copy are stale. Confirm intent before standardizing either way.

## Conventions
- `src/lib/prisma.ts` exports a singleton `prisma` (cached on `globalThis` outside production) — always import from `@/lib/prisma`, never `new PrismaClient()`.
- Path alias `@/*` → `src/*`.
- Styling is Tailwind v4 (`@tailwindcss/postcss`) with a dark theme via CSS custom properties (`var(--color-brand-gold)`, `var(--color-surface)`, etc.) defined in `src/app/globals.css`. Reuse these tokens rather than hardcoding hex values.
- Icons: `lucide-react`. Charts: `recharts`. Client state: `zustand`. Interactive pages are `"use client"`.

## Reference material (not code)
`documentations/` (RFQ, engineering brief, designs), `wireframes/` (screen PDFs/PNGs), and `client-repo-evaluation/` hold product spec and design intent — consult them when behavior is ambiguous.
