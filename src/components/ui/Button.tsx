import type { ButtonHTMLAttributes, ReactNode } from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/cn";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
export type ButtonSize = "sm" | "md";

const VARIANT: Record<ButtonVariant, string> = {
  // Solid gold CTA (Approve & Add to Atlas).
  primary:
    "bg-brand-gold text-on-gold font-semibold hover:brightness-105 border border-transparent",
  // Outlined neutral (Flag / secondary actions).
  secondary:
    "bg-[var(--color-surface-inset)] text-[var(--color-text-primary)] border border-[var(--color-border)] hover:border-brand-gold",
  // Text-only / low emphasis.
  ghost:
    "bg-transparent text-muted border border-transparent hover:text-fg",
  // Destructive (Reject / Exclude).
  danger:
    "bg-transparent text-danger border border-[var(--color-border)] hover:border-danger",
};

const SIZE: Record<ButtonSize, string> = {
  sm: "text-xs px-3 py-1.5 gap-1.5 rounded-md",
  md: "text-sm px-4 py-2 gap-2 rounded-lg",
};

/**
 * Themed button. Reusable across the portal — variants map to the design's
 * action treatments, `loading` swaps the leading icon for a spinner and
 * disables the control.
 */
export function Button({
  children,
  variant = "primary",
  size = "md",
  loading = false,
  icon,
  className,
  disabled,
  ...props
}: {
  children: ReactNode;
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  icon?: ReactNode;
} & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed",
        SIZE[size],
        VARIANT[variant],
        className,
      )}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? <Loader2 size={size === "sm" ? 13 : 15} className="animate-spin" /> : icon}
      {children}
    </button>
  );
}
