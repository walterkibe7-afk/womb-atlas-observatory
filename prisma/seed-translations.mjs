// Additive translation seeder — the safe subset of `seed.mjs` for adding a new
// language to a live database.
//
// Unlike `prisma db seed`, this script ONLY upserts. It never deletes, so it
// cannot destroy translations edited through the admin Translations page, and
// it does not touch the form-definition tables or the seeded user accounts.
// Values identical to what is already stored are skipped rather than rewritten.
//
// Usage (call node directly — see the note on npm below):
//   node prisma/seed-translations.mjs                          # default files
//   node prisma/seed-translations.mjs translations.json        # a different file
//   node prisma/seed-translations.mjs a.json b.json            # several, merged
//   node prisma/seed-translations.mjs --locales=luo,kik        # restrict to these locales
//   node prisma/seed-translations.mjs --dry-run                # report, write nothing
//
// `npm run db:seed:translations -- --flag` is unreliable: under PowerShell npm
// swallows everything after `--`. --dry-run is still honoured there (via
// npm_config_dry_run), but --locales= and file arguments are not, so pass them
// to node directly.
//
// File paths resolve against prisma/seed/ first, then the working directory.
import "dotenv/config";
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, isAbsolute, join, resolve } from "node:path";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SEED_DIR = join(__dirname, "seed");
// All three dictionaries. `translations.json` (es/fr/sw/ur) was missing here,
// so a default run seeded Dholuo, Kikuyu and the UI chrome but silently skipped
// the four other languages.
const DEFAULT_FILES = [
  "translations.json",
  "translations-luo-kik.json",
  "translations-ui.json",
  "translations-shell-ur.json",
  "translations-shell-luo.json",
  "translations-shell-kik.json",
  "translations-shell-es.json",
  "translations-shell-fr.json",
  "translations-shell-sw.json",
];

const args = process.argv.slice(2);
// `npm run … -- --dry-run` does not reach us under PowerShell: npm claims
// --dry-run as its own flag and sets npm_config_dry_run instead, and the shell
// drops the rest. Honouring the env var means the safe intent is never lost —
// getting a real write when you asked for a preview is the worst failure here.
const dryRun = args.includes("--dry-run") || process.env.npm_config_dry_run === "true";
const localeArg = args.find((a) => a.startsWith("--locales="));
const localeFilter = localeArg
  ? new Set(localeArg.slice("--locales=".length).split(",").map((s) => s.trim()).filter(Boolean))
  : null;
const fileArgs = args.filter((a) => !a.startsWith("--"));
const files = fileArgs.length > 0 ? fileArgs : DEFAULT_FILES;

function resolveFile(file) {
  const candidates = isAbsolute(file) ? [file] : [join(SEED_DIR, file), resolve(process.cwd(), file)];
  const hit = candidates.find(existsSync);
  if (!hit) {
    throw new Error(`Could not find ${file}. Looked in:\n  ${candidates.join("\n  ")}`);
  }
  return hit;
}

/** Registered language codes, so we can warn about ones the UI can never show. */
function registeredLocales() {
  try {
    const src = readFileSync(join(__dirname, "..", "src", "lib", "observation", "languages.ts"), "utf-8");
    return new Set([...src.matchAll(/code:\s*"([^"]+)"/g)].map((m) => m[1]));
  } catch {
    return null;
  }
}

/** Merge every input file into one key -> { locale: value } map. */
function loadEntries() {
  const merged = new Map();
  for (const file of files) {
    const path = resolveFile(file);
    const parsed = JSON.parse(readFileSync(path, "utf-8"));
    let keys = 0;
    for (const [key, localeMap] of Object.entries(parsed)) {
      const filtered = Object.entries(localeMap).filter(
        // `en` is the English source recorded alongside each entry so staleness
        // is detectable; it is not a translation and never reaches the database
        // (loadTranslationMap short-circuits on the English locale anyway).
        ([locale, value]) =>
          locale !== "en" && (!localeFilter || localeFilter.has(locale)) && typeof value === "string",
      );
      if (filtered.length === 0) continue;
      const target = merged.get(key) ?? {};
      for (const [locale, value] of filtered) target[locale] = value;
      merged.set(key, target);
      keys += 1;
    }
    console.log(`Loaded ${keys} keys from ${path}`);
  }
  return merged;
}

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

async function main() {
  const entries = loadEntries();
  if (entries.size === 0) {
    console.log("Nothing to do — no matching keys.");
    return;
  }

  const locales = [...new Set([...entries.values()].flatMap((m) => Object.keys(m)))].sort();
  console.log(
    `\n${entries.size} keys across ${locales.length} locale(s): ${locales.join(", ")}` +
      `\nTarget database: ${parsed.pathname.slice(1)} on ${parsed.hostname}` +
      (dryRun ? "\nDRY RUN — no writes will be made." : ""),
  );

  const known = registeredLocales();
  const unknown = known ? locales.filter((l) => !known.has(l)) : [];
  if (unknown.length > 0) {
    console.warn(
      `\n! ${unknown.join(", ")} ${unknown.length === 1 ? "is" : "are"} not listed in ` +
        `src/lib/observation/languages.ts, so the UI will not offer ${unknown.length === 1 ? "it" : "them"} ` +
        `until added there.`,
    );
  }

  const keys = [...entries.keys()];
  const existingRows = await prisma.formTranslation.findMany({
    where: { key: { in: keys } },
    select: { id: true, key: true },
  });
  const idByKey = new Map(existingRows.map((r) => [r.key, r.id]));

  const existingData = await prisma.formTranslationData.findMany({
    where: { translationId: { in: existingRows.map((r) => r.id) }, locale: { in: locales } },
    select: { translationId: true, locale: true, value: true },
  });
  const valueByPair = new Map(existingData.map((d) => [`${d.translationId} ${d.locale}`, d.value]));

  const stats = { newKeys: 0, created: 0, updated: 0, unchanged: 0 };

  for (const [key, localeMap] of entries) {
    let translationId = idByKey.get(key);

    if (!translationId) {
      stats.newKeys += 1;
      if (!dryRun) {
        // upsert, not create: another process may have added the key meanwhile.
        const row = await prisma.formTranslation.upsert({
          where: { key },
          update: {},
          create: { key },
          select: { id: true },
        });
        translationId = row.id;
        idByKey.set(key, translationId);
      }
    }

    for (const [locale, value] of Object.entries(localeMap)) {
      const current = translationId ? valueByPair.get(`${translationId} ${locale}`) : undefined;
      if (current === value) {
        stats.unchanged += 1;
        continue;
      }
      if (current === undefined) stats.created += 1;
      else stats.updated += 1;

      if (!dryRun && translationId) {
        await prisma.formTranslationData.upsert({
          where: { translationId_locale: { translationId, locale } },
          update: { value },
          create: { translationId, locale, value },
        });
      }
    }
  }

  const verb = dryRun ? "would be" : "were";
  console.log(
    `\nDone.\n` +
      `  ${stats.newKeys} new translation key(s) ${verb} added\n` +
      `  ${stats.created} value(s) ${verb} created\n` +
      `  ${stats.updated} existing value(s) ${verb} overwritten\n` +
      `  ${stats.unchanged} value(s) already matched and ${verb} skipped\n` +
      `  0 rows deleted — this script never deletes.`,
  );

  if (stats.updated > 0 && !dryRun) {
    console.warn(
      `! ${stats.updated} value(s) already existed with different text and have been ` +
        `replaced by the file's version. Re-run with --dry-run first if that was unintended.`,
    );
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
