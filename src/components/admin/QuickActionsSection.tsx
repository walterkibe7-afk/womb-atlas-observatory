"use client";

import type { LucideIcon } from "lucide-react";
import { Download, Gauge, Megaphone, Settings, ShieldCheck, UserPlus } from "lucide-react";
import { SectionCard } from "@/components/ui";

const quickActions: { label: string; icon: LucideIcon }[] = [
  { label: "Add New Steward", icon: UserPlus },
  { label: "Create Announcement", icon: Megaphone },
  { label: "Export Data", icon: Download },
  { label: "Run Data Quality Check", icon: ShieldCheck },
  { label: "View System Status", icon: Gauge },
  { label: "System Settings", icon: Settings },
];

export function QuickActionsSection() {
  return (
    <SectionCard title="Quick Actions" titleVariant="display" className="col-span-12 xl:col-span-3">
      <div className="grid grid-cols-3 gap-2">
        {quickActions.map(({ label, icon: Icon }) => (
          <button
            key={label}
            className="flex items-center gap-1.5 rounded-[var(--radius-panel)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-inset)] px-2 py-2.5 text-left text-[11px] leading-tight text-secondary transition-colors hover:border-brand-gold hover:text-fg"
          >
            <Icon size={14} className="shrink-0 text-brand-gold" />
            <span>{label}</span>
          </button>
        ))}
      </div>
    </SectionCard>
  );
}
