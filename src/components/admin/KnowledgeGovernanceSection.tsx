"use client";

import type { KnowledgeGovernanceStats } from "@/app/(admin)/admin/types";
import { dateFormatter, numberFormatter } from "@/app/(admin)/admin/utils";
import { Badge, Button, SectionCard, SectionLink } from "@/components/ui";

export function KnowledgeGovernanceSection({
  knowledgeStats,
}: {
  knowledgeStats: KnowledgeGovernanceStats | null;
}) {
  const knowledgeRows = (knowledgeStats?.recentActivity ?? []).slice(0, 4);

  const totals = [
    { label: "Total Signals", value: knowledgeStats?.totalSignals.value ?? 0 },
    { label: "Active Signals", value: knowledgeStats?.activeSignals.value ?? 0 },
    { label: "New This Month", value: knowledgeStats?.newThisMonth.value ?? 0 },
    { label: "Merged This Month", value: knowledgeStats?.mergedThisMonth.value ?? 0 },
  ];

  return (
    <SectionCard
      title="Knowledge Governance"
      titleVariant="display"
      action={<SectionLink href="/admin/audit">View registry →</SectionLink>}
      className="col-span-12 xl:col-span-4"
    >
      <div
        id="knowledge-governance"
        className="grid grid-cols-4 gap-2 border-y border-[var(--color-border-subtle)] py-3"
      >
        {totals.map(({ label, value }) => (
          <div key={label}>
            <p className="text-[11px] text-subtle">{label}</p>
            <p className="mt-1 font-serif text-[30px] leading-none text-fg">
              {numberFormatter.format(value)}
            </p>
          </div>
        ))}
      </div>

      <div className="mt-3">
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-brand-gold">
          Recent Signal Activity
        </p>

        {knowledgeRows.length === 0 ? (
          <p className="py-2 text-xs text-subtle">No activity yet.</p>
        ) : (
          <ul>
            {knowledgeRows.map((row) => (
              <li
                key={`${row.signalId}-${row.timestamp}`}
                className="grid grid-cols-[1fr_auto_auto] items-center gap-3 border-b border-[var(--color-border-subtle)] py-2 text-sm last:border-b-0"
              >
                <p className="truncate text-secondary">&ldquo;{row.signalName}&rdquo;</p>
                <span className="text-[12px] text-subtle">
                  {dateFormatter.format(new Date(row.timestamp))}
                </span>
                <Badge variant="accent">{row.action}</Badge>
              </li>
            ))}
          </ul>
        )}
      </div>

      <Button variant="secondary" className="bg-cta mt-4 w-full border-[var(--color-cta-border)] text-on-accent">
        Manage Signal Registry
      </Button>
    </SectionCard>
  );
}
