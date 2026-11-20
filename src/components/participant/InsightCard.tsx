import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { Card } from "@/components/ui";
import { useUiStrings } from "@/lib/observation/ui-strings-context";

/**
 * The shared frame for the dashboard's three core-insight cards.
 *
 * Distinct from `SectionCard` on purpose: these three carry a step number and an
 * underlined title, which the design uses to say "read these in order, they are
 * one thought". Rather than push two one-off props into `SectionCard` — a
 * primitive used by every panel in three portals — the treatment lives here,
 * where the only three call sites are.
 */
export function InsightCard({
  step,
  title,
  action,
  children,
  className,
}: {
  /** The 1 / 2 / 3 badge. */
  step: number;
  title: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  const strings = useUiStrings();
  return (
    <Card className={`flex flex-col ${className ?? ""}`}>
      <div className="flex items-center gap-2.5 mb-4 flex-wrap">
        <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full border border-border-brand text-brand-gold text-[12px] font-semibold">
          {step}
        </span>
        {/* Underline is an inline border on the text itself, not the row, so it
            stops at the end of the words rather than running under the chip. */}
        <h3 className="font-serif text-[13px] font-semibold uppercase tracking-[0.08em] text-brand-gold border-b border-border-brand pb-0.5">
          {title}
        </h3>
        <span className="text-[9px] font-semibold uppercase tracking-[0.1em] text-subtle border border-border-subtle rounded-[5px] px-1.5 py-0.5">
          {strings.dashboardCoreInsightBadge}
        </span>
        {action && <span className="ml-auto">{action}</span>}
      </div>
      <div className="flex flex-1 flex-col">{children}</div>
    </Card>
  );
}

/** The pill used for contributing factors and strengths. */
export function InsightChip({ icon: Icon, children }: { icon: LucideIcon; children: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-(--color-surface-hover) px-2.5 py-1 text-[12px] text-muted">
      <Icon size={12} strokeWidth={1.6} className="shrink-0 text-brand-gold" />
      {children}
    </span>
  );
}

/**
 * The left rail shared by the pattern and archetype cards: the glyph sits at the
 * top, its caption at the bottom, and both are the same width so the caption
 * lines up under the medallion and the chips beside it start on a common edge.
 */
export function InsightRow({
  media,
  caption,
  children,
}: {
  media?: ReactNode;
  caption?: string;
  children: ReactNode;
}) {
  return (
    // items-stretch + mt-auto drops the caption to the bottom of the rail, so it
    // sits level with the chips on the right rather than hanging directly under
    // the medallion with dead space beneath it.
    <div className="flex flex-1 items-stretch gap-4">
      {(media || caption) && (
        <div className="w-22 sm:w-26 shrink-0 flex flex-col items-center">
          {media}
          {caption && (
            <span className="text-subtle text-[11px] leading-tight text-center mt-auto pt-3">{caption}</span>
          )}
        </div>
      )}
      <div className="min-w-0 flex-1 flex flex-col">{children}</div>
    </div>
  );
}
