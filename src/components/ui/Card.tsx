import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

type CardVariant = "surface" | "plum" | "inset";

const VARIANT_BG: Record<CardVariant, string> = {
  surface: "bg-surface-card",   // gradient plum card (default)
  plum: "bg-surface-plum",      // brighter plum (stat cards)
  inset: "bg-[var(--color-surface-inset)]", // flat inner panel
};

/**
 * Base surface container in the Atlas design language: gradient fill, hairline
 * border, 14px radius. Everything card-shaped in the steward portal builds on
 * this. Pass `padding={false}` when the children manage their own padding.
 */
export function Card({
  children,
  className,
  variant = "surface",
  padding = true,
}: {
  children: ReactNode;
  className?: string;
  variant?: CardVariant;
  padding?: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded-[var(--radius-card)] border border-[var(--color-border)] transition-all duration-200 ease-out hover:-translate-y-1 hover:shadow-lg hover:border-border-strong",
        VARIANT_BG[variant],
        padding && "p-4",
        className,
      )}
    >
      {children}
    </div>
  );
}
