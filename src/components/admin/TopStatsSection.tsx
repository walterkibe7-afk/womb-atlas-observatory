"use client";

import { CircleCheck, ClipboardList, Globe, UsersRound } from "lucide-react";
import type { AdminDashboardStats } from "@/app/(admin)/admin/types";
import { sparklineSets } from "@/app/(admin)/admin/utils";
import { HeaderStat } from "./HeaderStat";

export function TopStatsSection({
  dashboardStats,
}: {
  dashboardStats: AdminDashboardStats | null;
}) {
  // Each tile keeps its own series hue for the life of the dashboard — colour
  // identifies the stat, never its current rank or the sign of its delta.
  const topStats = [
    {
      label: "Observations Preserved",
      icon: UsersRound,
      seriesColor: "var(--color-chart-1)",
      metric: dashboardStats?.observationsPreserved ?? { value: 0, change: 0 },
    },
    {
      label: "Living Atlas Records",
      icon: ClipboardList,
      seriesColor: "var(--color-chart-2)",
      metric: dashboardStats?.atlasRecords ?? { value: 0, change: 0 },
    },
    {
      label: "Records in Review",
      icon: CircleCheck,
      seriesColor: "var(--color-chart-2)",
      metric: dashboardStats?.recordsInReview ?? { value: 0, change: 0 },
    },
    {
      label: "Active Stewards",
      icon: UsersRound,
      seriesColor: "var(--color-chart-1)",
      metric: dashboardStats?.activeStewards ?? { value: 0, change: 0 },
    },
    {
      label: "Countries Represented",
      icon: Globe,
      seriesColor: "var(--color-chart-2)",
      metric: dashboardStats?.countriesRepresented ?? { value: 0, change: 0 },
    },
  ] as const;

  return (
    <section className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-5">
      {topStats.map((item, index) => (
        <HeaderStat
          key={item.label}
          label={item.label}
          metric={item.metric}
          icon={item.icon}
          seriesColor={item.seriesColor}
          sparkline={sparklineSets[index] ?? sparklineSets[0]}
        />
      ))}
    </section>
  );
}
