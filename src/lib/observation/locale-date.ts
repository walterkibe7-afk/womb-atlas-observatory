/**
 * Locale-aware date formatting for participant-facing dates (Dashboard,
 * Timeline, Records, Check-in). Every date in this codebase used to be
 * hardcoded to `toLocaleDateString("en-US", …)` regardless of the
 * participant's locale, so month names stayed English even once the
 * surrounding text was translated.
 *
 * `-u-nu-latn` forces Latin digits for every locale — Urdu's default ICU
 * numbering system is Arabic-Indic, which would look inconsistent next to
 * the Latin digits used everywhere else in this app (record ids, counts,
 * confidence dots, etc).
 */
function resolveLocaleTag(locale?: string): string {
  if (!locale || locale === "en") return "en-US";
  return `${locale}-u-nu-latn`;
}

export function formatDateLong(date: Date, locale?: string): string {
  return date.toLocaleDateString(resolveLocaleTag(locale), { year: "numeric", month: "long", day: "numeric" });
}

export function formatDateMedium(date: Date, locale?: string): string {
  return date.toLocaleDateString(resolveLocaleTag(locale), { year: "numeric", month: "short", day: "numeric" });
}

export function formatDateShort(date: Date, locale?: string): string {
  return date.toLocaleDateString(resolveLocaleTag(locale), { month: "short", year: "2-digit" });
}
