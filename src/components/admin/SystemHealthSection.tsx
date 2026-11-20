"use client";

import { CircleCheck } from "lucide-react";
import { SectionCard } from "@/components/ui";

const services = [
  "Application",
  "Database",
  "Storage",
  "AI Services",
  "Integrations",
  "Email Service",
  "Audio Processing",
];

export function SystemHealthSection() {
  return (
    <SectionCard title="System Health" titleVariant="display" className="col-span-12 xl:col-span-7">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 xl:grid-cols-7">
        {services.map((service) => (
          <div
            key={service}
            className="flex flex-col items-center gap-1 rounded-[var(--radius-panel)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-inset)] px-2 py-2.5 text-center"
          >
            {/* Status ships as icon + label, never colour alone. */}
            <CircleCheck size={15} className="text-brand-gold" />
            <p className="text-[11px] leading-tight text-secondary">{service}</p>
            <p className="text-[11px] text-brand-gold">Operational</p>
          </div>
        ))}
      </div>
    </SectionCard>
  );
}
