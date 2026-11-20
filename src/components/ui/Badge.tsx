import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export type BadgeVariant =
  | "new"       // small NEW pill (magenta on plum)
  | "accent"    // magenta theme chip
  | "neutral"   // muted theme chip
  | "outline"   // outlined status chip ("Under Review", "Atlas Record")
  | "gold"      // solid gold pill ("High Quality")
  | "gold-outline"    // small outline pill, gold border/text (dashboard "NEW" / "Latest" tags)
  | "purple-outline"; // small outline pill, purple border/text ("BETA" tags)

const VARIANT: Record<BadgeVariant, string> = {
  new: "bg-accent-soft text-brand-purple-light tracking-[0.1em] font-semibold text-[9px] px-1.5 py-0.5 rounded-[5px]",
  accent: "bg-accent-soft text-brand-purple-light text-xs px-2.5 py-1 rounded-md",
  neutral: "bg-[var(--color-surface-hover)] text-muted text-xs px-2.5 py-1 rounded-md",
  outline: "border border-[var(--color-border)] bg-[var(--color-surface-hover)] text-muted text-xs px-2 py-1 rounded-md",
  gold: "bg-brand-gold text-on-gold font-semibold text-xs px-3 py-1 rounded-full",
  "gold-outline": "border border-[var(--color-border-brand)] text-brand-gold tracking-[0.1em] font-semibold text-[9px] px-1.5 py-0.5 rounded-[5px] bg-transparent",
  "purple-outline": "border border-brand-purple/50 text-brand-purple-light tracking-[0.1em] font-semibold text-[9px] px-1.5 py-0.5 rounded-[5px] bg-transparent",
};

/** Small label chip. `variant` selects the visual treatment. */
export function Badge({
  children,
  variant = "neutral",
  className,
}: {
  children: ReactNode;
  variant?: BadgeVariant;
  className?: string;
}) {
  return (
    <span className={cn("inline-flex items-center gap-1 leading-none", VARIANT[variant], className)}>
      {children}
    </span>
  );
}

// Severity / priority share one vocabulary: High → danger, Medium → amber,
// Low → green. Reused by the queue rows, record header and signal lists.
export type Severity = "High" | "Medium" | "Low";

const SEVERITY_COLOR: Record<Severity, string> = {
  High: "var(--color-danger)",
  Medium: "var(--color-brand-orange)",
  Low: "var(--color-brand-green)",
};

/** Coloured dot + label, e.g. "● High". Normalises casing/synonyms. */
export function SeverityTag({
  level,
  showLabel = true,
  className,
}: {
  level: string;
  showLabel?: boolean;
  className?: string;
}) {
  const normalized = normalizeSeverity(level);
  const color = SEVERITY_COLOR[normalized];
  return (
    <span className={cn("inline-flex items-center gap-1.5 text-xs", className)} style={{ color }}>
      <span className="w-[7px] h-[7px] rounded-full" style={{ background: color }} />
      {showLabel && (normalized === "Medium" ? "Medium" : normalized)}
    </span>
  );
}

export function normalizeSeverity(level: string): Severity {
  const s = (level || "").toLowerCase();
  if (s === "high") return "High";
  if (s === "moderate" || s === "medium") return "Medium";
  return "Low";
}
