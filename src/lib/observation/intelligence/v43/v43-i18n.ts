// Translation lookup for the v4.3 engine's hardcoded English registries
// (pattern-ontology.ts, atlas-intelligence-service.ts's meaningRegistry/
// bodyLiteracyLibrary, atlas-intelligence-v43.ts's archetypeRegistry).
//
// Deliberately separate from those files — never edit their English text in
// place. This is a pure, synchronous lookup (no DB, no async), so calling it
// costs nothing extra over reading the field directly, and it is a no-op by
// construction whenever `locale` is missing or "en": callers always pass the
// original English value as `fallback`, and that's exactly what comes back.
import translationsUr from "@/content/aikb/v43-translations-ur.json";
import translationsLuo from "@/content/aikb/v43-translations-luo.json";
import translationsKik from "@/content/aikb/v43-translations-kik.json";
import translationsEs from "@/content/aikb/v43-translations-es.json";
import translationsFr from "@/content/aikb/v43-translations-fr.json";
import translationsSw from "@/content/aikb/v43-translations-sw.json";

type LocaleMap = Record<string, Record<string, string>>;

const LOCALE_FILES: Record<string, LocaleMap> = {
  ur: translationsUr as LocaleMap,
  luo: translationsLuo as LocaleMap,
  kik: translationsKik as LocaleMap,
  es: translationsEs as LocaleMap,
  fr: translationsFr as LocaleMap,
  sw: translationsSw as LocaleMap,
};

/**
 * Look up a translated value for `${id}.${field}`. Returns `fallback`
 * (the caller's own English value) whenever locale is unset, "en", or the
 * specific key has no translation yet — never blank, never throws.
 */
export function v43Text(id: string, field: string, fallback: string, locale?: string): string {
  if (!locale || locale === "en") return fallback;
  const entry = LOCALE_FILES[locale]?.[`${id}.${field}`];
  return entry?.[locale] ?? fallback;
}
