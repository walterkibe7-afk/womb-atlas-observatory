"use client";

import { ArrowRight, Bell, CalendarDays, ChevronDown, Download } from "lucide-react";

export function AdminHeader() {
  return (
    <header className="flex flex-wrap items-start justify-between gap-4">
      <div>
        <h1 className="font-serif text-[42px] leading-[1.05] text-fg">
          Observatory Administration <span className="text-brand-gold">✶</span>
        </h1>
        <p className="mt-1 text-sm text-muted">
          Oversee the observatory. Ensure data integrity. Strengthen our collective impact. Protect our community.
        </p>
      </div>

      <div className="flex items-center gap-2">
        <button className="inline-flex items-center gap-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-inset)] px-3 py-2 text-xs text-secondary transition-colors hover:border-brand-gold">
          <CalendarDays size={14} className="text-brand-gold" />
          May 4 – May 10, 2026
          <ChevronDown size={13} className="text-subtle" />
        </button>

        <button
          aria-label="Notifications — 7 unread"
          className="relative inline-flex h-9 w-9 items-center justify-center rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-inset)] text-brand-gold transition-colors hover:border-brand-gold"
        >
          <Bell size={15} />
          <span className="absolute -right-1.5 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-danger px-1 text-[10px] font-semibold text-fg">
            7
          </span>
        </button>

        <button className="bg-cta inline-flex items-center gap-2 rounded-lg border border-[var(--color-cta-border)] px-3.5 py-2 text-xs text-on-accent transition-colors hover:border-brand-gold">
          <Download size={14} />
          Export Report
          <ArrowRight size={13} />
        </button>
      </div>
    </header>
  );
}
