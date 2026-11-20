import type { UiStrings } from "@/lib/observation/ui-strings";

// Shared badge styling for a record's burden level, used by the reflections
// list, records list, the in-flow "Your Atlas Record" screen, and the
// standalone Atlas Record detail view — kept in one place so the four copies
// don't drift. Built from theme tokens (not literal colours) so it stays
// correct under any portal theme.
export function burdenBadgeClass(burden?: string): string {
  if (burden === "High") return "text-danger border-danger/50 bg-danger/15";
  if (burden === "Moderate") return "text-brand-orange border-brand-orange/50 bg-brand-orange/15";
  if (burden === "Low") return "text-brand-green border-brand-green/50 bg-brand-green/15";
  return "text-subtle border-border";
}

// The display text for a burden value. `burden` itself stays the fixed
// English enum wherever it's computed or matched against (deriveBurden,
// burdenBadgeClass above) — this only translates what the participant reads.
export function burdenLabel(burden: string | undefined, strings: UiStrings): string {
  if (burden === "High") return strings.burdenHigh;
  if (burden === "Moderate") return strings.burdenModerate;
  if (burden === "Low") return strings.burdenLow;
  return burden ?? "";
}
