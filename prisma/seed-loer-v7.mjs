// Scoped reseed of the `first_observation` flow only.
//
// Use this instead of the full `npx prisma db seed` when you want to apply the
// LOER v7.0.0 alignment without the full seeder's other side effects — it does
// not touch users (the full seeder resets the admin and participant passwords),
// translations, signal/reflection rules, or the `atlas_checkin` flow.
//
//   npm run seed:loer-v7            apply
//   npm run seed:loer-v7 -- --dry   report what would change, write nothing
//
// Participant data is never touched: Observation.flowKey,
// Observation.currentScreenId and ObservationResponse.fieldId are plain string
// columns with no foreign key to the definition tables, so replacing the flow
// cannot cascade into observations, responses, narratives or Atlas Records.
import "dotenv/config";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { PrismaClient, Prisma } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { applyLoerV7Alignment } from "./seed/loer-v7-alignment.mjs";

const FLOW = "first_observation";
const DRY = process.argv.includes("--dry");

const __dirname = dirname(fileURLToPath(import.meta.url));
const data = JSON.parse(readFileSync(join(__dirname, "seed", "form-definition.json"), "utf-8"));

const url = process.env.DATABASE_URL;

if (!url) {
  throw new Error("DATABASE_URL is missing. Check your .env file.");
}

const parsed = new URL(url);

if (!["postgresql:", "postgres:"].includes(parsed.protocol)) {
  throw new Error(
    `Expected a PostgreSQL DATABASE_URL, but received: ${parsed.protocol}`
  );
}

const adapter = new PrismaPg({
  connectionString: url,
});
const prisma = new PrismaClient({ adapter });

const json = (v) => (v == null ? Prisma.DbNull : v);

/**
 * Report how much of the flow each locale actually covers.
 *
 * `getFormDefinition` falls back to English per key, so a missing translation
 * is invisible at runtime — the screen just renders in English and nothing
 * anywhere says so. Printing coverage at seed time makes the shortfall a number
 * someone can act on instead of a bug report from a participant.
 */
async function reportTranslationCoverage(screens, questions, prompts) {
  // This seeder deliberately does NOT write translations. Replacing the flow
  // re-points every translation key, but the values themselves are owned by
  // prisma/seed-translations.mjs (additive, never clobbers an admin edit) and
  // by the admin Translations page. Reporting the shortfall here is the useful
  // half: a flow change is exactly when coverage silently drops.
  // Only strings that actually have English to translate. Several screens carry
  // no support copy at all, and counting their empty `purpose` as untranslated
  // reported a permanent shortfall nobody could ever close.
  const wanted = [];
  const add = (key, source) => {
    if (source && String(source).trim()) wanted.push(key);
  };
  for (const s of screens) {
    add(`SCREEN.${s.screenId}.name`, s.name);
    add(`SCREEN.${s.screenId}.purpose`, s.purpose);
    add(`SCREEN.${s.screenId}.primaryActionLabel`, s.primaryActionLabel);
  }
  for (const q of questions) {
    add(`QUESTION.${q.fieldId}.questionText`, q.questionText);
    for (const o of q.options) add(`OPTION.${q.fieldId}.${o.value}.label`, o.label);
  }
  for (const p of prompts) add(`PROMPT.${p.promptId}.promptText`, p.promptText);

  const rows = await prisma.formTranslation.findMany({
    where: { key: { in: wanted } },
    // FormTranslation's relation is `values` (schema.prisma), not `data`.
    select: { key: true, values: { select: { locale: true, value: true } } },
  });
  const byLocale = new Map();
  for (const r of rows) {
    for (const d of r.values) {
      if (!d.value?.trim()) continue;
      byLocale.set(d.locale, (byLocale.get(d.locale) ?? 0) + 1);
    }
  }
  const locales = [...byLocale.keys()].sort();
  console.log(`\nTranslation coverage — ${wanted.length} translatable strings in ${FLOW}:`);
  if (!locales.length) {
    console.log("  none — every screen will render in English.");
    console.log("  Run `npm run db:seed:translations` to load the dictionaries.");
    return;
  }
  for (const loc of locales) {
    const n = byLocale.get(loc);
    const pct = Math.round((n / wanted.length) * 100);
    console.log(`  ${loc.padEnd(5)} ${String(n).padStart(4)} / ${wanted.length}  (${pct}%)${pct < 100 ? "  — the remainder renders in English" : ""}`);
  }
}

async function main() {
  const summary = applyLoerV7Alignment(data);
  console.log("LOER v7 overlay:", summary);

  const screens = data.screens.filter((s) => s.flowKey === FLOW);
  const screenIds = new Set(screens.map((s) => s.screenId));
  const questions = data.questions.filter((q) => screenIds.has(q.screenId));
  const prompts = data.narrativePrompts.filter((p) => screenIds.has(p.screenId));
  const routes = data.routes.filter((r) => screenIds.has(r.fromScreenId));

  console.log(
    `Target: ${screens.length} screens, ${questions.length} questions, ` +
      `${prompts.length} prompts, ${routes.length} routes.`,
  );

  const before = {
    screens: await prisma.formScreen.count({ where: { flowKey: FLOW } }),
    responses: await prisma.observationResponse.count(),
    observations: await prisma.observation.count(),
  };
  console.log(
    `Current DB: ${before.screens} screens in ${FLOW}; ` +
      `${before.observations} observations, ${before.responses} responses (must not change).`,
  );

  if (DRY) {
    console.log("\n--dry: nothing written.");
    return;
  }

  // Replace the flow. The cascade is contained within the definition tables:
  // FormFlow -> FormScreen -> FormQuestion -> FormAnswerOption, plus
  // NarrativePrompt and ScreenRoute. `atlas_checkin` is a separate FormFlow row
  // and is left in place.
  // ~660 writes (83 screens, 72 questions with 411 nested options, 7 prompts,
  // 90 routes). Prisma's interactive-transaction default is a 5s timeout with a
  // 2s max wait — fine against a local database, and it will roll the whole
  // thing back against a remote one. Raised deliberately.
  await prisma.$transaction(async (tx) => {
    await tx.formFlow.deleteMany({ where: { key: FLOW } });

    const flow = data.flows.find((f) => f.key === FLOW) ?? { key: FLOW, name: "First Observation" };
    await tx.formFlow.create({ data: { key: flow.key, name: flow.name } });

    for (const s of screens) {
      await tx.formScreen.create({
        data: {
          screenId: s.screenId,
          flowKey: s.flowKey,
          name: s.name,
          section: s.section,
          purpose: s.purpose,
          inputType: s.inputType,
          renderKind: s.renderKind,
          primaryActionLabel: s.primaryActionLabel,
          order: s.order,
          atlasDomain: s.atlasDomain ?? null,
          mvpPhase: s.mvpPhase,
          status: s.status,
          visibilityRule: json(s.visibilityRule),
        },
      });
    }

    for (const q of questions) {
      await tx.formQuestion.create({
        data: {
          fieldId: q.fieldId,
          registryFieldId: q.registryFieldId ?? q.fieldId.toLowerCase(),
          screenId: q.screenId,
          questionText: q.questionText,
          fieldType: q.fieldType,
          required: q.required,
          validation: q.validation ?? null,
          notes: q.notes ?? null,
          targetTable: q.targetTable,
          targetColumn: q.targetColumn,
          order: q.order,
          options: {
            create: q.options.map((o) => ({
              value: o.value,
              label: o.label,
              order: o.order,
              isExclusive: o.isExclusive,
              signalTag: o.signalTag ?? null,
            })),
          },
        },
      });
    }

    for (const p of prompts) {
      await tx.narrativePrompt.create({
        data: {
          promptId: p.promptId,
          screenId: p.screenId,
          promptText: p.promptText,
          captureType: p.captureType,
          order: p.order,
        },
      });
    }

    for (const r of routes) {
      await tx.screenRoute.create({
        data: {
          fromScreenId: r.fromScreenId,
          toScreenId: r.toScreenId,
          condition: json(r.condition),
          priority: r.priority,
          note: r.note ?? null,
        },
      });
    }
  }, { maxWait: 30_000, timeout: 180_000 });

  const after = {
    screens: await prisma.formScreen.count({ where: { flowKey: FLOW } }),
    questions: await prisma.formQuestion.count({ where: { screen: { flowKey: FLOW } } }),
    routes: await prisma.screenRoute.count({ where: { fromScreen: { flowKey: FLOW } } }),
    checkin: await prisma.formScreen.count({ where: { flowKey: "atlas_checkin" } }),
    responses: await prisma.observationResponse.count(),
    observations: await prisma.observation.count(),
  };

  console.log(
    `\nDone: ${after.screens} screens, ${after.questions} questions, ${after.routes} routes ` +
      `in ${FLOW}. atlas_checkin untouched (${after.checkin} screens).`,
  );

  await reportTranslationCoverage(screens, questions, prompts);

  if (after.responses !== before.responses || after.observations !== before.observations) {
    throw new Error(
      `Participant data changed — observations ${before.observations}->${after.observations}, ` +
        `responses ${before.responses}->${after.responses}. Investigate before proceeding.`,
    );
  }
  console.log(
    `Participant data intact: ${after.observations} observations, ${after.responses} responses.`,
  );

  // Progress pointers that referenced a retired screen would strand a resume.
  const stranded = await prisma.observation.findMany({
    where: { flowKey: FLOW, currentScreenId: { notIn: [...screenIds] } },
    select: { id: true, currentScreenId: true },
  });
  if (stranded.length) {
    console.warn(
      `\n${stranded.length} in-progress observation(s) point at a screen that no longer exists:`,
    );
    for (const o of stranded.slice(0, 10)) console.warn(`  ${o.id} -> ${o.currentScreenId}`);
    console.warn("Their answers are intact. Re-point them before the participant resumes.");
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
