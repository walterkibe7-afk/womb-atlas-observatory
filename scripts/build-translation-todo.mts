// Rebuild prisma/seed/translations.todo.json — every participant-facing string
// in the first_observation flow that is missing a translation in one or more
// locales, with its English source.
//
//   node --experimental-strip-types scripts/build-translation-todo.mts
//
// Covers both halves of the flow's text: the seeded screens, questions, options
// and prompts, and the UI chrome in UI_STRINGS (nav, safety guidance, consent
// notice, reflection chamber labels). The chrome used to be literals in the
// components, so it never appeared in a translation work list at all.
import { readFileSync, writeFileSync, existsSync } from "node:fs";
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

const screens = data.screens.filter((s: { flowKey: string }) => s.flowKey === FLOW);
const ids = new Set(screens.map((s: { screenId: string }) => s.screenId));
const want = new Map<string, string>();

for (const s of screens) {
  want.set(`SCREEN.${s.screenId}.name`, s.name);
  want.set(`SCREEN.${s.screenId}.purpose`, s.purpose);
  want.set(`SCREEN.${s.screenId}.primaryActionLabel`, s.primaryActionLabel);
}
for (const q of data.questions.filter((q: { screenId: string }) => ids.has(q.screenId))) {
  want.set(`QUESTION.${q.fieldId}.questionText`, q.questionText);
  for (const o of q.options) want.set(`OPTION.${q.fieldId}.${o.value}.label`, o.label);
}
for (const p of data.narrativePrompts.filter((p: { screenId: string }) => ids.has(p.screenId))) {
  want.set(`PROMPT.${p.promptId}.promptText`, p.promptText);
}
for (const [key, value] of Object.entries(UI_STRINGS)) {
  want.set(`${UI_TRANSLATION_PREFIX}${key}`, value);
}
// Section headings shown on the review screen.
const sections = new Set<string>(screens.map((s: { section: string }) => s.section));
for (const section of sections) {
  if (section) want.set(`SECTION.${sectionSlug(section)}.label`, section);
}
for (const [k, v] of [...want]) if (!v || !String(v).trim()) want.delete(k);

const dicts = ["translations.json", "translations-luo-kik.json", "translations-ui.json"]
  .filter((f) => existsSync(join(SEED, f)))
  .map((f) => JSON.parse(readFileSync(join(SEED, f), "utf-8")));

const norm = (s: unknown) => String(s ?? "").toLowerCase().replace(/\s+/g, " ").trim();

/**
 * A locale needs work when it has no value, or when the value it has was
 * translated from different English.
 *
 * Each dictionary entry carries an `en` field recording the source the
 * translations were written against. Without it a key whose id never changed
 * but whose English did — S06's purpose was rewritten by the LOER alignment —
 * keeps its old translation forever: correct in English, quietly wrong in every
 * other language, and invisible to a coverage count that only asks whether a
 * value exists.
 */
const todo: Record<string, { english: string; missing: string[]; stale?: boolean }> = {};
let staleKeys = 0;
for (const [key, english] of want) {
  const entry = dicts.find((d) => d[key]);
  const source = entry?.[key]?.en;
  const stale = source !== undefined && norm(source) !== norm(english);
  const missing = LOCALES.filter((l) => stale || !dicts.some((d) => d[key]?.[l]?.trim()));
  if (stale) staleKeys++;
  if (missing.length) {
    todo[key] = { english: String(english), missing, ...(stale ? { stale: true } : {}) };
  }
}

writeFileSync(join(SEED, "translations.todo.json"), JSON.stringify(todo, null, 2) + "\n");

const uiCount = Object.keys(UI_STRINGS).length;
console.log(`${want.size} translatable strings (${want.size - uiCount} from the flow, ${uiCount} UI chrome)`);
console.log(`${Object.keys(todo).length} still need work${staleKeys ? ` (${staleKeys} stale — English changed since translation)` : ""}:`);
const per: Record<string, number> = {};
for (const v of Object.values(todo)) for (const l of v.missing) per[l] = (per[l] ?? 0) + 1;
for (const l of LOCALES) console.log(`  ${l.padEnd(5)} ${per[l] ?? 0}`);
