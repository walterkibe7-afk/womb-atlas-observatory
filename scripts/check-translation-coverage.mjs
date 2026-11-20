// Report how much of the first_observation flow each locale covers.
//
//   node scripts/check-translation-coverage.mjs
//
// Reads the seeded dictionaries directly, so it works before a reseed. A key
// with no translation is not an error — getFormDefinition falls back to the
// English — but the fallback is invisible at runtime, which is exactly why the
// shortfall is worth printing somewhere.
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { applyLoerV7Alignment } from "../prisma/seed/loer-v7-alignment.mjs";
import { UI_STRINGS, UI_TRANSLATION_PREFIX, sectionSlug } from "../src/lib/observation/ui-strings.ts";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SEED = join(__dirname, "..", "prisma", "seed");
const FLOW = "first_observation";
const LOCALES = ["es", "fr", "sw", "ur", "luo", "kik"];

const data = JSON.parse(readFileSync(join(SEED, "form-definition.json"), "utf-8"));
applyLoerV7Alignment(data);
const screens = data.screens.filter((s) => s.flowKey === FLOW);
const ids = new Set(screens.map((s) => s.screenId));

const wanted = new Map();
for (const s of screens) {
  wanted.set(`SCREEN.${s.screenId}.name`, s.name);
  wanted.set(`SCREEN.${s.screenId}.purpose`, s.purpose);
  wanted.set(`SCREEN.${s.screenId}.primaryActionLabel`, s.primaryActionLabel);
}
for (const q of data.questions.filter((q) => ids.has(q.screenId))) {
  wanted.set(`QUESTION.${q.fieldId}.questionText`, q.questionText);
  for (const o of q.options) wanted.set(`OPTION.${q.fieldId}.${o.value}.label`, o.label);
}
for (const p of data.narrativePrompts.filter((p) => ids.has(p.screenId))) {
  wanted.set(`PROMPT.${p.promptId}.promptText`, p.promptText);
}
// UI chrome counts too — nav, safety guidance, consent notice, chamber labels.
for (const [key, value] of Object.entries(UI_STRINGS)) {
  wanted.set(`${UI_TRANSLATION_PREFIX}${key}`, value);
}
for (const section of new Set(screens.map((s) => s.section))) {
  if (section) wanted.set(`SECTION.${sectionSlug(section)}.label`, section);
}
for (const [k, v] of [...wanted]) if (!v || !String(v).trim()) wanted.delete(k);

const dicts = ["translations.json", "translations-luo-kik.json", "translations-ui.json"]
  .filter((f) => existsSync(join(SEED, f)))
  .map((f) => JSON.parse(readFileSync(join(SEED, f), "utf-8")));

console.log(`${wanted.size} translatable strings in ${FLOW}\n`);
console.log("  locale  translated");
let worst = 100;
for (const loc of LOCALES) {
  let have = 0;
  for (const k of wanted.keys()) {
    if (dicts.some((d) => d[k]?.[loc]?.trim())) have++;
  }
  const pct = Math.round((have / wanted.size) * 100);
  worst = Math.min(worst, pct);
  console.log(`  ${loc.padEnd(6)} ${String(have).padStart(4)} / ${wanted.size}  (${String(pct).padStart(3)}%)`);
}
if (worst < 100) console.log("\nAnything untranslated renders in English — screens can be mixed language.");
