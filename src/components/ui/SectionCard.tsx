import type { ReactNode } from "react";
import Link from "next/link";
import { cn } from "@/lib/cn";
import { Card } from "./Card";
import { Badge } from "./Badge";

type CardVariant = "surface" | "plum" | "inset";

/**
 * `caps` — small uppercase gold caption (steward / participant / analyst).
 * `display` — large sentence-case cream serif heading (admin observatory).
 */
export type SectionTitleVariant = "caps" | "display";

const TITLE_VARIANT: Record<SectionTitleVariant, string> = {
  caps: "text-[13px] font-semibold uppercase tracking-[0.08em] text-brand-gold",
  display: "text-[22px] leading-tight text-fg",
};

/**
 * A Card with the portal's standard section header: a Spectral title, an
 * optional NEW badge, and an optional right-aligned action link. Used by every
 * titled panel on the dashboard (Signal Snapshot, Review Queue…).
 */
export function SectionCard({
  title,
  isNew = false,
  titleBadge,
  titleVariant = "caps",
  action,
  variant = "surface",
  children,
  className,
  bodyClassName,
}: {
  title: string;
  isNew?: boolean;
  /** Extra badge next to the title, for treatments other than the standard NEW pill (e.g. a BETA outline chip). */
  titleBadge?: ReactNode;
  titleVariant?: SectionTitleVariant;
  action?: ReactNode;
  variant?: CardVariant;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <Card variant={variant} className={className}>
      <div className="flex items-center justify-between gap-2 mb-3.5 flex-wrap">
        <div className="flex items-center gap-2">
          <h3 className={cn("font-serif", TITLE_VARIANT[titleVariant])}>{title}</h3>
          {isNew && <Badge variant="new">NEW</Badge>}
          {titleBadge}
        </div>
        {action}
      </div>
      <div className={bodyClassName}>{children}</div>
    </Card>
  );
}

/** The recurring "view all →" style link used in section headers/footers. */
export function SectionLink({
  children,
  href = "#",
  className,
}: {
  children: ReactNode;
  href?: string;
  className?: string;
}) {
  return (
    <Link
      href={href}
      className={cn("text-xs text-link no-underline hover:underline", className)}
    >
      {children}
    </Link>
  );
}
