// Report stored answers whose option values no longer exist in the flow.
//
//   node scripts/check-stale-answers.mjs
//
// Option VALUES are the join between a saved answer and its translated label:
// the review screen maps `value -> option.label`, and the label is what carries
// the locale. An answer saved before the option list changed matches no option,
// so it falls through to a humanised form of the stored code — which reads as
// untranslated English no matter which language is selected.
//
// This is a data problem, not a translation one. Closing it is the CR §8
// migration; two of its mappings still need a client decision, so this script
// only reports.
import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const FLOW = "first_observation";
const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is not set.");
  process.exit(1);
}
const parsed = new URL(url);

if (!["postgresql:", "postgres:"].includes(parsed.protocol)) {
  console.error(`Expected a PostgreSQL DATABASE_URL, but received: ${parsed.protocol}`);
  process.exit(1);
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({
    connectionString: url,
  }),
});

async function main() {
  const questions = await prisma.formQuestion.findMany({
    where: { screen: { flowKey: FLOW } },
    select: { fieldId: true, fieldType: true, options: { select: { value: true } } },
  });
  const valid = new Map(questions.map((q) => [q.fieldId, new Set(q.options.map((o) => o.value))]));
  const kind = new Map(questions.map((q) => [q.fieldId, q.fieldType]));

  const responses = await prisma.observationResponse.findMany({
    select: { observationId: true, fieldId: true, value: true },
  });

  const byField = new Map();
  const affectedObservations = new Set();
  let checked = 0;

  for (const r of responses) {
    const options = valid.get(r.fieldId);
    if (!options) continue; // field is not a select, or no longer in the flow
    if (!["single_select", "multi_select"].includes(kind.get(r.fieldId))) continue;
    checked++;
    const values = Array.isArray(r.value) ? r.value : [r.value];
    const stale = values.filter((v) => typeof v === "string" && v && !options.has(v));
    if (!stale.length) continue;
    affectedObservations.add(r.observationId);
    const entry = byField.get(r.fieldId) ?? { count: 0, values: new Set() };
    entry.count++;
    for (const v of stale) entry.values.add(v);
    byField.set(r.fieldId, entry);
  }

  const totalStale = [...byField.values()].reduce((n, e) => n + e.count, 0);
  console.log(`Checked ${checked} select answers across ${responses.length} stored responses.\n`);

  if (!byField.size) {
    console.log("No stale answers — every stored value maps to a current option.");
    console.log("Any untranslated text on the review screen is therefore NOT this.");
    return;
  }

  console.log(`${totalStale} answers reference values the flow no longer has,`);
  console.log(`across ${affectedObservations.size} observation(s).\n`);
  console.log("field".padEnd(30) + "answers".padStart(8) + "   values no longer in the flow");
  for (const [field, e] of [...byField].sort((a, b) => b[1].count - a[1].count)) {
    console.log(
      field.padEnd(30) + String(e.count).padStart(8) + "   " + [...e.values].slice(0, 5).join(", ") +
        (e.values.size > 5 ? ` (+${e.values.size - 5} more)` : ""),
    );
  }
  console.log(
    "\nThese render as humanised English on the review screen in every locale, " +
      "because there is no option left to translate.\nA NEW observation is unaffected — " +
      "it stores current values, which do translate.",
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
