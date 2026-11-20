// Draft the missing participant-facing translations for the first_observation
// flow using the project's own Vertex AI client.
//
//   node scripts/translate-missing.mjs --dry            report what is missing
//   node scripts/translate-missing.mjs --limit 20       sample 20 strings per locale
//   node scripts/translate-missing.mjs                  draft everything missing
//
// Reads prisma/seed/translations.todo.json (regenerate it from the flow first)
// and writes into the seeded dictionaries.
//
// IMPORTANT: output is a DRAFT. LOER S01 requires approved translations that
// preserve legal and participant meaning rather than literal wording, so a
// speaker still needs to review this before the flow counts as translated.
// Review and editing happen in the admin Translations page.
import "dotenv/config";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { GoogleGenAI } from "@google/genai";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SEED = join(__dirname, "..", "prisma", "seed");

const DRY = process.argv.includes("--dry");
const limitArg = process.argv.indexOf("--limit");
const LIMIT = limitArg !== -1 ? parseInt(process.argv[limitArg + 1], 10) : Infinity;
const onlyArg = process.argv.indexOf("--locale");
const ONLY = onlyArg !== -1 ? process.argv[onlyArg + 1] : null;

const LANGUAGES = {
  es: "Spanish (Latin American)",
  fr: "French",
  sw: "Swahili (Kiswahili, as spoken in Kenya)",
  ur: "Urdu",
  luo: "Dholuo (Luo, as spoken in western Kenya)",
  kik: "Kikuyu (Gikuyu, as spoken in central Kenya)",
};
// Which dictionary each locale is seeded from.
const FILE_FOR = {
  es: "translations.json", fr: "translations.json", sw: "translations.json", ur: "translations.json",
  luo: "translations-luo-kik.json", kik: "translations-luo-kik.json",
};

const BATCH = 20;
const MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash";
const project = process.env.GOOGLE_CLOUD_PROJECT?.trim();
const location = process.env.GOOGLE_CLOUD_LOCATION?.trim() || "us-central1";

const todoPath = join(SEED, "translations.todo.json");
if (!existsSync(todoPath)) {
  console.error("prisma/seed/translations.todo.json not found — regenerate the work list first.");
  process.exit(1);
}
const todo = JSON.parse(readFileSync(todoPath, "utf-8"));

// locale -> [{ key, english }]
const work = {};
for (const [key, entry] of Object.entries(todo)) {
  for (const locale of entry.missing ?? []) {
    if (ONLY && locale !== ONLY) continue;
    (work[locale] ??= []).push({ key, english: entry.english });
  }
}

console.log(`Missing strings by locale (${Object.keys(todo).length} keys in the work list):`);
for (const [loc, items] of Object.entries(work)) {
  const n = Math.min(items.length, LIMIT);
  console.log(`  ${loc.padEnd(5)} ${String(items.length).padStart(4)} missing${n < items.length ? `  → drafting ${n}` : ""}`);
}
if (DRY) { console.log("\n--dry: nothing written."); process.exit(0); }
if (!project) { console.error("\nGOOGLE_CLOUD_PROJECT is not set — cannot reach Vertex AI."); process.exit(1); }

const ai = new GoogleGenAI({ vertexai: true, project, location });

function promptFor(language, items) {
  const numbered = items.map((it, i) => `${i + 1}. ${it.english.replace(/\n/g, "\\n")}`).join("\n");
  return `Translate these interface strings from a women's reproductive-health observation app into ${language}.

Rules:
- Translate meaning, not words. These are read by participants describing their own symptoms, so use everyday, respectful language a non-clinician would use.
- Keep the register warm and plain. Reading age around 12.
- Say exactly what the source says and nothing else. Do not add a sentence, a clause, an explanation or a reassurance that is not in the source, and do not drop one. The translation must have the same number of sentences as the source.
- Never introduce a diagnosis, a cause, or advice. Never soften or strengthen a safety instruction.
- Use normal sentence case for sentences. Do NOT capitalise every word — title case is wrong in a sentence and wrong in most of these languages.
- Preserve "\\n" line breaks exactly where they appear, including blank lines between paragraphs.
- If a term has no natural equivalent, use the closest everyday phrasing rather than an English loanword, unless the English word is genuinely what speakers use.
- Finish every sentence. Never end mid-phrase.
- Return ONLY a JSON array of ${items.length} strings, in the same order. No commentary.

${numbered}`;
}

async function translateBatch(locale, items) {
  const res = await ai.models.generateContent({
    model: MODEL,
    config: {
      temperature: 0.2,
      responseMimeType: "application/json",
      responseSchema: { type: "ARRAY", items: { type: "STRING" } },
      maxOutputTokens: 8192,
    },
    contents: [{ role: "user", parts: [{ text: promptFor(LANGUAGES[locale], items) }] }],
  });
  const text = res.text ?? "";
  let arr;
  try {
    arr = JSON.parse(text);
  } catch {
    throw new Error(`unparseable response for ${locale}: ${text.slice(0, 120)}`);
  }
  if (!Array.isArray(arr) || arr.length !== items.length) {
    throw new Error(`length mismatch for ${locale}: wanted ${items.length}, got ${Array.isArray(arr) ? arr.length : "non-array"}`);
  }
  return arr.map((s) => String(s));
}

/**
 * Reject a draft that does not look like a translation of its source.
 *
 * Sampling caught two failure modes worth catching automatically: a paragraph
 * came back with Every Word Capitalised, and another gained a trailing clause
 * that was not in the English and then stopped mid-phrase. Both are the kind of
 * thing nobody reviewing a language they do not read would spot, so they are
 * checked structurally instead.
 */
function rejectReason(english, translated) {
  if (!translated.trim()) return "empty";

  // The source echoed back. This slipped through every structural check —
  // identical text has a perfect length ratio, the same paragraph count and the
  // same sentence count — and produced 20 Dholuo "translations" that were just
  // the English. Numbers, acronyms and proper nouns legitimately survive
  // translation unchanged, so only prose is rejected.
  const flat = (s) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
  const wordCount = english.trim().split(/\s+/).length;
  const isProse = wordCount >= 3 && /[a-z]{4}/.test(english);
  if (isProse && flat(translated) === flat(english)) {
    return "identical to the English source — not translated";
  }

  // Content added or lost. Character ratio is crude across scripts, so it is
  // deliberately loose — it is looking for a bolted-on sentence, not style.
  const ratio = translated.length / Math.max(english.length, 1);
  if (english.length > 25 && (ratio < 0.45 || ratio > 2.4)) {
    return `length ratio ${ratio.toFixed(2)} — content probably added or dropped`;
  }

  // Paragraph structure must survive verbatim; the seed renders it with
  // whitespace-pre-line, so a lost blank line changes the layout.
  const paras = (s) => s.split(/\n\s*\n/).length;
  if (paras(english) !== paras(translated)) {
    return `paragraph count ${paras(english)} -> ${paras(translated)}`;
  }

  // Sentence count, only when the source is clearly prose.
  const sentences = (s) => (s.match(/[.!?]["')\]]?(\s|$)/g) ?? []).length;
  if (sentences(english) >= 2 && sentences(translated) > sentences(english) + 1) {
    return `sentence count ${sentences(english)} -> ${sentences(translated)} — extra sentence`;
  }

  // Title Case On A Sentence. Latin-script locales only; meaningless for Urdu.
  const words = translated.trim().split(/\s+/);
  if (words.length >= 6 && /[A-Za-z]/.test(translated)) {
    const capped = words.filter((w) => /^[A-Z][a-z]/.test(w)).length;
    if (capped / words.length > 0.6 && english.split(/\s+/).filter((w) => /^[A-Z][a-z]/.test(w)).length / words.length < 0.4) {
      return "title-cased a sentence";
    }
  }
  return null;
}

const dicts = {};
const load = (file) => (dicts[file] ??= JSON.parse(readFileSync(join(SEED, file), "utf-8")));
let written = 0;
let failed = 0;
const rejected = [];
for (const [locale, allItems] of Object.entries(work)) {
  const items = allItems.slice(0, LIMIT === Infinity ? undefined : LIMIT);
  const file = FILE_FOR[locale];
  const dict = load(file);
  console.log(`\n${locale} — ${items.length} strings, ${Math.ceil(items.length / BATCH)} batches`);
  for (let i = 0; i < items.length; i += BATCH) {
    const batch = items.slice(i, i + BATCH);
    try {
      const out = await translateBatch(locale, batch);
      batch.forEach((it, j) => {
        const value = out[j]?.trim();
        if (!value) return;
        const bad = rejectReason(it.english, value);
        if (bad) {
          rejected.push({ locale, key: it.key, reason: bad, english: it.english, draft: value });
          return;
        }
        const entry = (dict[it.key] ??= {});
        entry[locale] = value;
        // Record the English this was translated from. `build-translation-todo`
        // compares it against the current source to spot a translation that has
        // gone stale because the English changed under an unchanged key.
        entry.en = it.english;
        written++;
      });
      process.stdout.write(`  ${Math.min(i + BATCH, items.length)}/${items.length}\r`);
    } catch (e) {
      failed += batch.length;
      console.warn(`\n  batch ${i / BATCH + 1} failed: ${e.message}`);
    }
  }
  console.log();
}

for (const [file, dict] of Object.entries(dicts)) {
  writeFileSync(join(SEED, file), JSON.stringify(dict, null, 2) + "\n");
  console.log(`wrote ${file}`);
}
console.log(`\ndrafted ${written} strings, ${failed} request failures, ${rejected.length} rejected by validation.`);
if (rejected.length) {
  writeFileSync(join(SEED, "translations.rejected.json"), JSON.stringify(rejected, null, 2) + "\n");
  console.log("rejected drafts -> translations.rejected.json (those keys stay untranslated, so they fall back to English)");
  const byReason = {};
  for (const r of rejected) {
    const kind = r.reason.split(" ").slice(0, 2).join(" ");
    byReason[kind] = (byReason[kind] ?? 0) + 1;
  }
  for (const [k, v] of Object.entries(byReason)) console.log(`  ${k}: ${v}`);
}
