// Minimal className combiner (no deps): filters falsy values and joins.
// Later duplicate/conflicting classes still win via source order, which is all
// the UI primitives here rely on.
export type ClassValue = string | number | false | null | undefined;

export function cn(...classes: ClassValue[]): string {
  return classes.filter(Boolean).join(" ");
}
