// Applies prisma/seed/kik-corrections.json to the `kik` values in
// prisma/seed/translations-luo-kik.json, matching on the English source text
// from form-definition.json.
//
// Corrections are keyed by English rather than by translation key so one entry
// fixes every place that string appears — "No" alone covers 13 keys.
//
// Usage:  node scripts/apply-kik-corrections.mjs [--dry-run]
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const seedDir = join(rootDir, "prisma", "seed");
const targetPath = join(seedDir, "translations-luo-kik.json");

const dryRun = process.argv.includes("--dry-run");

const fd = JSON.parse(readFileSync(join(seedDir, "form-definition.json"), "utf-8"));
const translations = JSON.parse(readFileSync(targetPath, "utf-8"));
const corrections = JSON.parse(readFileSync(join(seedDir, "kik-corrections.json"), "utf-8"));
delete corrections._comment;

/** Translation key -> English source string. */
const english = {};
for (const s of fd.screens ?? []) {
  english[`SCREEN.${s.screenId}.name`] = s.name;
  english[`SCREEN.${s.screenId}.purpose`] = s.purpose;
  english[`SCREEN.${s.screenId}.primaryActionLabel`] = s.primaryActionLabel;
}
for (const q of fd.questions ?? []) {
  english[`QUESTION.${q.fieldId}.questionText`] = q.questionText;
  for (const o of q.options ?? []) english[`OPTION.${q.fieldId}.${o.value}.label`] = o.label;
}

let applied = 0;
let unchanged = 0;
const usedSources = new Set();

for (const [key, localeMap] of Object.entries(translations)) {
  const source = english[key];
  if (typeof source !== "string") continue;
  const replacement = corrections[source];
  if (replacement === undefined) continue;
  usedSources.add(source);
  if (localeMap.kik === replacement) {
    unchanged += 1;
    continue;
  }
  localeMap.kik = replacement;
  applied += 1;
}

const unused = Object.keys(corrections).filter((s) => !usedSources.has(s));
if (unused.length > 0) {
  console.warn(`! ${unused.length} correction(s) matched no entry — English source may have changed:`);
  for (const s of unused.slice(0, 10)) console.warn(`    ${JSON.stringify(s.slice(0, 70))}`);
}

if (!dryRun) {
  writeFileSync(targetPath, `${JSON.stringify(translations, null, 2)}\n`, "utf-8");
}

console.log(
  `${dryRun ? "[dry run] " : ""}${applied} kik value(s) ${dryRun ? "would be" : ""} replaced` +
    `, ${unchanged} already correct, from ${Object.keys(corrections).length} correction(s).`,
);
