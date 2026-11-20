"use client";

import { ArrowRight, CircleAlert, Globe2, Lock, ShieldCheck, type LucideIcon } from "lucide-react";

const marks: { icon: LucideIcon; title: string; detail?: string }[] = [
  { icon: Lock, title: "Secure. Private. Trusted.", detail: "All data is encrypted and governed by consent." },
  { icon: ShieldCheck, title: "You are in control.", detail: "We do not provide medical advice." },
  { icon: CircleAlert, title: "Observations are not diagnoses.", detail: "Context matters." },
  { icon: Globe2, title: "Building the world's first observatory for women's health." },
];

export function FooterBanner() {
  return (
    <section className="grid grid-cols-1 gap-px overflow-hidden rounded-[var(--radius-card)] border border-[var(--color-border)] bg-surface-card md:grid-cols-2 xl:grid-cols-5">
      {marks.map(({ icon: Icon, title, detail }) => (
        <div
          key={title}
          className="flex items-center gap-3 border-[var(--color-border-subtle)] px-4 py-3.5 xl:border-r"
        >
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[var(--color-border-brand)] text-brand-gold">
            <Icon size={16} />
          </span>
          <div className="min-w-0">
            <p className="text-[13px] font-medium text-brand-gold">{title}</p>
            {detail && <p className="text-[11px] text-subtle">{detail}</p>}
          </div>
        </div>
      ))}

      <button className="flex items-center justify-center gap-2 px-4 py-3.5 text-[13px] text-secondary transition-colors hover:bg-[var(--color-surface-hover)] hover:text-fg">
        Learn more about our data &amp; methods
        <ArrowRight size={15} />
      </button>
    </section>
  );
}
