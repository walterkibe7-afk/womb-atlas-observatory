import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

/** Rounded-square icon container (emerging concepts, quick actions, avatars). */
export function IconTile({
  children,
  size = 32,
  className,
  colorClass = "text-brand-gold",
}: {
  children: ReactNode;
  size?: number;
  className?: string;
  colorClass?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center justify-center rounded-lg bg-[var(--color-surface-hover)] shrink-0",
        colorClass,
        className,
      )}
      style={{ width: size, height: size }}
    >
      {children}
    </span>
  );
}

/** Gradient monogram avatar (user menu, contributor). */
export function Avatar({
  initials,
  size = 34,
  className,
}: {
  initials: string;
  size?: number;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "bg-avatar inline-flex items-center justify-center rounded-[9px] font-semibold text-on-avatar shrink-0",
        className,
      )}
      style={{ width: size, height: size, fontSize: size * 0.35 }}
    >
      {initials}
    </span>
  );
}
