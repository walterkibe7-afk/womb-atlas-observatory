// Flags machine-translation corruption in the seed translation files.
//
// Written after the Kikuyu drop was found to contain unrelated proper nouns
// (an author's name substituted for "Atlas", a politician's name as an answer
// label), text in entirely unrelated languages (Spanish, Māori), and raw
// translator-tool markup. Verbatim-English checks alone miss all of that, so
// this looks for the specific failure signatures instead.
//
// Usage:  node scripts/validate-translations.mjs [--locale=kik] [--verbose]
import { readFileSync, existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const seedDir = join(rootDir, "prisma", "seed");

const TRANSLATION_FILES = ["translations.json", "translations-luo-kik.json", "translations-ui.json"];

const args = process.argv.slice(2);
const verbose = args.includes("--verbose");
const localeArg = args.find((a) => a.startsWith("--locale="))?.slice("--locale=".length);

/** Locales written in a non-Latin script; Latin runs there mean untranslated text. */
const NON_LATIN_LOCALES = new Set(["ur"]);

/** Proper nouns that legitimately appear untranslated. */
const ALLOWED_TERMS =
  /\b(womb|atlas|pcos|iud|hiv|bmi|id|ok|inuit|m[ée]tis|endometriosis|ovulation|perimenopause|menopause)\b/gi;

const CHECKS = [
  {
    id: "tool-markup",
    describe: "raw translator-tool markup",
    test: (t) => /\((?:trg|src)\)|=\s*"\d+"\s*>/.test(t),
  },
  {
    id: "foreign-language",
    describe: "text in an unrelated language",
    // Spanish markers are only a defect OUTSIDE Spanish — `¿` is correct
    // punctuation in es. The proper nouns are ones the MT hallucinated in
    // place of real content and are never valid in any locale here.
    test: (t, { locale }) =>
      /Te Matua Ngahere|Mahinda Amaraweera|Ngũgĩ wa Thiong/i.test(t) ||
      (locale !== "es" && /[¿¡]|\bDónde\b|\bInicio\b|\bestá\b/i.test(t)),
  },
  {
    id: "wrong-script",
    describe: "characters from an unexpected writing system",
    test: (t, { locale }) =>
      !NON_LATIN_LOCALES.has(locale) &&
      /[؀-ۿऀ-ॿ඀-෿஀-௿一-鿿]/.test(t),
  },
  {
    id: "untranslated",
    describe: "left in English",
    test: (t, { source, locale }) => {
      if (!source) return false;
      if (NON_LATIN_LOCALES.has(locale)) {
        // Three or more consecutive Latin words in an Arabic-script locale.
        return /(?:\b[A-Za-z]{3,}\b[\s,]+){2}\b[A-Za-z]{3,}\b/.test(t.replace(ALLOWED_TERMS, ""));
      }
      const words = (s) => (String(s).replace(ALLOWED_TERMS, "").toLowerCase().match(/[a-z]{3,}/g) || []);
      const src = new Set(words(source));
      const tgt = words(t);
      if (src.size === 0 || tgt.length < 2) return false;
      return tgt.filter((w) => src.has(w)).length / tgt.length >= 0.6;
    },
  },
  {
    id: "repeated-phrase",
    describe: "a word or phrase stuttered",
    // Deliberately strict: allowing filler words between the repeats matches
    // ordinary Bantu reduplication ("mara kwa mara", "hatua kwa hatua"), which
    // is correct Swahili. MT stutters with nothing between them.
    test: (t) => /\b(\w{4,})\b[\s,]+\1\b/i.test(t) || /\b(\w+\s+\w+)\b\s+\1\b/i.test(t),
  },
  {
    id: "hallucinated-name",
    describe: "an unrelated brand or place name",
    test: (t) => /\b(mahindra|imi ga wakaranai|injera)\b/i.test(t),
  },
  {
    id: "empty",
    describe: "blank",
    test: (t) => t.trim().length === 0,
  },
];

/** English source text, keyed the same way the translation files are. */
function loadEnglishSource() {
  const path = join(seedDir, "form-definition.json");
  if (!existsSync(path)) return {};
  const fd = JSON.parse(readFileSync(path, "utf-8"));
  const en = {};
  for (const s of fd.screens ?? []) {
    en[`SCREEN.${s.screenId}.name`] = s.name;
    en[`SCREEN.${s.screenId}.purpose`] = s.purpose;
    en[`SCREEN.${s.screenId}.primaryActionLabel`] = s.primaryActionLabel;
  }
  for (const q of fd.questions ?? []) {
    en[`QUESTION.${q.fieldId}.questionText`] = q.questionText;
    for (const o of q.options ?? []) en[`OPTION.${q.fieldId}.${o.value}.label`] = o.label;
  }
  for (const p of fd.narrativePrompts ?? []) {
    for (const field of ["promptText", "helperText", "title"]) {
      if (p[field]) en[`PROMPT.${p.promptId}.${field}`] = p[field];
    }
  }
  return en;
}

const english = loadEnglishSource();
const entries = {};
for (const file of TRANSLATION_FILES) {
  const path = join(seedDir, file);
  if (!existsSync(path)) continue;
  for (const [key, localeMap] of Object.entries(JSON.parse(readFileSync(path, "utf-8")))) {
    entries[key] = { ...(entries[key] ?? {}), ...localeMap };
  }
}

const findings = {};
const totals = {};
for (const [key, localeMap] of Object.entries(entries)) {
  for (const [locale, value] of Object.entries(localeMap)) {
    if (localeArg && locale !== localeArg) continue;
    if (typeof value !== "string") continue;
    totals[locale] = (totals[locale] ?? 0) + 1;
    const ctx = { locale, source: english[key] };
    for (const check of CHECKS) {
      if (!check.test(value, ctx)) continue;
      ((findings[locale] ??= {})[check.id] ??= []).push({ key, value, source: english[key] });
    }
  }
}

const locales = Object.keys(totals).sort();
let worst = 0;
console.log("Translation integrity report\n");
for (const locale of locales) {
  const byCheck = findings[locale] ?? {};
  const affected = new Set(Object.values(byCheck).flat().map((f) => f.key));
  const pct = ((affected.size / totals[locale]) * 100).toFixed(1);
  worst = Math.max(worst, affected.size);
  const summary = Object.entries(byCheck)
    .map(([id, list]) => `${id}=${list.length}`)
    .join("  ");
  console.log(
    `${locale.padEnd(5)} ${String(affected.size).padStart(4)}/${String(totals[locale]).padEnd(5)} ` +
      `(${pct.padStart(5)}%) ${summary || "clean"}`,
  );
  if (verbose) {
    for (const [id, list] of Object.entries(byCheck)) {
      const label = CHECKS.find((c) => c.id === id)?.describe ?? id;
      console.log(`\n  ${id} — ${label} (${list.length})`);
      for (const f of list.slice(0, 8)) {
        console.log(`    ${f.key}`);
        if (f.source) console.log(`      en : ${JSON.stringify(String(f.source).slice(0, 70))}`);
        console.log(`      out: ${JSON.stringify(f.value.slice(0, 70))}`);
      }
      if (list.length > 8) console.log(`    …and ${list.length - 8} more`);
    }
    console.log();
  }
}

if (!verbose) console.log("\nRe-run with --verbose (and optionally --locale=xx) to see the entries.");
process.exit(worst > 0 ? 1 : 0);
