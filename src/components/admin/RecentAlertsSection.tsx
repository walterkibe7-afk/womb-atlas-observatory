"use client";

import { CircleAlert, TriangleAlert, type LucideIcon } from "lucide-react";
import { SectionCard, SectionLink } from "@/components/ui";

type Alert = { title: string; detail: string; time: string; icon: LucideIcon; tone: string };

const alerts: Alert[] = [
  {
    title: "High transcription failure rate",
    detail: "East Africa region",
    time: "1h ago",
    icon: TriangleAlert,
    tone: "text-danger",
  },
  {
    title: "Companion prompt update",
    detail: "New version deployed",
    time: "3h ago",
    icon: CircleAlert,
    tone: "text-brand-gold",
  },
];

export function RecentAlertsSection() {
  return (
    <SectionCard
      title="Recent Alerts"
      titleVariant="display"
      action={<SectionLink href="/admin/audit">View all →</SectionLink>}
      className="col-span-12 xl:col-span-2"
    >
      <ul className="space-y-2">
        {alerts.map(({ title, detail, time, icon: Icon, tone }) => (
          <li
            key={title}
            className="rounded-[var(--radius-panel)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-inset)] p-2.5"
          >
            <p className="flex items-start gap-2 text-[12px] text-secondary">
              <Icon size={14} className={`mt-0.5 shrink-0 ${tone}`} />
              <span className="flex-1">{title}</span>
            </p>
            <div className="mt-1 flex items-center justify-between gap-2 pl-6">
              <p className="text-[11px] text-subtle">{detail}</p>
              <p className="shrink-0 text-[11px] text-faint">{time}</p>
            </div>
          </li>
        ))}
      </ul>
    </SectionCard>
  );
}
