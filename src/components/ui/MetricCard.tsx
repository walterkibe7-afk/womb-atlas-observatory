import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/cn";

type Trend = { direction: "up" | "down"; label: string; colorClass?: string };

/**
 * Dashboard stat tile: a large outlined icon on the left, with the label, a
 * Spectral numeral and optional sub-label / trend stacked beside it. `variant`
 * selects the card fill (plum for the highlighted pending/in-review tiles,
 * surface for the rest).
 */
export function MetricCard({
  icon: Icon,
  label,
  value,
  iconColorClass = "text-brand-gold",
  sub,
  trend,
  variant = "surface",
  className,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  iconColorClass?: string;
  sub?: string;
  trend?: Trend | null;
  variant?: "surface" | "plum";
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex items-center gap-3.5 rounded-[var(--radius-card)] border px-4 py-3.5",
        variant === "plum"
          ? "bg-surface-plum border-[var(--color-border-strong)]"
          : "bg-surface-card border-[var(--color-border)]",
        className,
      )}
    >
      <Icon size={30} strokeWidth={1.4} className={cn("shrink-0", iconColorClass)} />
      <div className="min-w-0">
        <div className="text-[11px] text-muted truncate">{label}</div>
        <div className="font-serif text-[30px] leading-none font-semibold text-fg mt-1 mb-0.5">
          {value}
        </div>
        {sub && <div className="text-[10px] text-faint leading-tight">{sub}</div>}
        {trend && (
          <div className={cn("text-[11px] mt-0.5", trend.colorClass ?? "text-brand-green")}>
            {trend.direction === "up" ? "↑" : "↓"} {trend.label}
          </div>
        )}
      </div>
    </div>
  );
}
