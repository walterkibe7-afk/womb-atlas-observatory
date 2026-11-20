import { cn } from "@/lib/cn";
import { Badge } from "./Badge";

export type TabItem = { id: string; label: string; isNew?: boolean };

/**
 * Underlined tab bar in the design language: active tab is gold text with a gold
 * underline, others muted. Optional NEW badge per tab. Controlled component.
 */
export function Tabs({
  tabs,
  active,
  onChange,
  className,
}: {
  tabs: TabItem[];
  active: string;
  onChange: (id: string) => void;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-wrap gap-x-6 gap-y-2 border-b border-[var(--color-border-subtle)] text-[13px]",
        className,
      )}
    >
      {tabs.map((tab) => {
        const isActive = tab.id === active;
        return (
          <button
            key={tab.id}
            onClick={() => onChange(tab.id)}
            className={cn(
              "pb-2.5 -mb-px flex items-center gap-2 transition-colors",
              isActive
                ? "text-fg font-semibold border-b-2 border-brand-gold"
                : "text-subtle hover:text-fg border-b-2 border-transparent",
            )}
          >
            {tab.label}
            {tab.isNew && <Badge variant="new">NEW</Badge>}
          </button>
        );
      })}
    </div>
  );
}
