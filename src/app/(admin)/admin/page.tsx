"use client";

import { useEffect, useState } from "react";
import type {
  AdminDashboardStats,
  StewardNetworkStats,
  ObservatoryCoverageStats,
  KnowledgeGovernanceStats,
  ObservatoryGrowthStats,
  ObservationReturnRateStats,
  DataQualityOverview,
} from "./types";
import { fetchJson } from "./utils";
import { AdminHeader } from "@/components/admin/AdminHeader";
import { TopStatsSection } from "@/components/admin/TopStatsSection";
import { StewardNetworkSection } from "@/components/admin/StewardNetworkSection";
import { CoverageMapSection } from "@/components/admin/CoverageMapSection";
import { KnowledgeGovernanceSection } from "@/components/admin/KnowledgeGovernanceSection";
import { GrowthDashboardSection } from "@/components/admin/GrowthDashboardSection";
import { ReturnRateSection } from "@/components/admin/ReturnRateSection";
import { DataQualitySection } from "@/components/admin/DataQualitySection";
import { SystemHealthSection } from "@/components/admin/SystemHealthSection";
import { RecentAlertsSection } from "@/components/admin/RecentAlertsSection";
import { QuickActionsSection } from "@/components/admin/QuickActionsSection";
import { FooterBanner } from "@/components/admin/FooterBanner";

export default function AdminDashboard() {
  const [dashboardStats, setDashboardStats] = useState<AdminDashboardStats | null>(null);
  const [networkStats, setNetworkStats] = useState<StewardNetworkStats | null>(null);
  const [coverageStats, setCoverageStats] = useState<ObservatoryCoverageStats | null>(null);
  const [knowledgeStats, setKnowledgeStats] = useState<KnowledgeGovernanceStats | null>(null);
  const [growthStats, setGrowthStats] = useState<ObservatoryGrowthStats | null>(null);
  const [returnRateStats, setReturnRateStats] = useState<ObservationReturnRateStats | null>(null);
  const [qualityStats, setQualityStats] = useState<DataQualityOverview | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    Promise.all([
      fetchJson<AdminDashboardStats>("/api/admin/stats/dashboard"),
      fetchJson<StewardNetworkStats>("/api/admin/stats/steward-network"),
      fetchJson<ObservatoryCoverageStats>("/api/admin/stats/observatory-coverage-map"),
      fetchJson<KnowledgeGovernanceStats>("/api/admin/stats/knowledge-governance"),
      fetchJson<ObservatoryGrowthStats>("/api/admin/stats/observatory-growth"),
      fetchJson<ObservationReturnRateStats>("/api/admin/stats/observation-return-rate"),
      fetchJson<DataQualityOverview>("/api/admin/stats/data-quality-overview"),
    ])
      .then(([dashboard, network, coverage, knowledge, growth, rates, quality]) => {
        if (!active) return;
        setDashboardStats(dashboard);
        setNetworkStats(network);
        setCoverageStats(coverage);
        setKnowledgeStats(knowledge);
        setGrowthStats(growth);
        setReturnRateStats(rates);
        setQualityStats(quality);
      })
      .catch((error) => {
        if (!active) return;
        setLoadError(error instanceof Error ? error.message : "Failed to load admin dashboard data.");
      });

    return () => {
      active = false;
    };
  }, []);

  return (
    <div className="min-h-full px-6 py-5">
      <div className="mx-auto max-w-[1920px] space-y-4">
        <AdminHeader />

        {loadError && (
          <div
            role="alert"
            className="rounded-[var(--radius-panel)] border border-danger bg-[var(--color-surface-inset)] px-4 py-2 text-sm text-danger"
          >
            {loadError}
          </div>
        )}

        <TopStatsSection dashboardStats={dashboardStats} />

        <section className="grid grid-cols-12 gap-3">
          <StewardNetworkSection networkStats={networkStats} />
          <CoverageMapSection coverageStats={coverageStats} />
          <KnowledgeGovernanceSection knowledgeStats={knowledgeStats} />
          <GrowthDashboardSection growthStats={growthStats} />
          <ReturnRateSection returnRateStats={returnRateStats} />
          <DataQualitySection qualityStats={qualityStats} />
          <SystemHealthSection />
          <RecentAlertsSection />
          <QuickActionsSection />
        </section>

        <FooterBanner />
      </div>
    </div>
  );
}
