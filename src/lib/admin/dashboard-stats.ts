import { prisma } from "@/lib/prisma";

export interface AdminDashboardStats {
  observationsPreserved: Metric;
  atlasRecords: Metric;
  recordsInReview: Metric;
  activeStewards: Metric;
  countriesRepresented: Metric;
}

interface Metric {
  value: number;
  change: number;
}

function calcChange(current: number, previous: number): number {
  if (previous === 0) {
    if (current === 0) return 0;
    return 100;
  }
  return Math.round(((current - previous) / previous) * 1000) / 10;
}

export async function getAdminDashboardStats(): Promise<AdminDashboardStats> {
  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  const [
    observationsPreserved,
    atlasRecords,
    recordsInReview,
    activeStewards,
    countriesRaw,
    observationsPreservedPrev,
    atlasRecordsPrev,
    recordsInReviewPrev,
    activeStewardsPrev,
    countriesRawPrev,
  ] = await Promise.all([
    // --- Current counts ---
    prisma.observation.count({ where: { status: "record_saved" } }),
    prisma.atlasRecord.count(),
    prisma.observation.count({
      where: { status: { not: "record_saved" } },
    }),
    prisma.user.count({ where: { role: "steward" } }),
    prisma.participantContext.findMany({
      where: { current_country: { not: null } },
      select: { current_country: true },
      distinct: ["current_country"],
    }),
    // --- Prior 7-day counts ---
    prisma.observation.count({
      where: { status: "record_saved", startedAt: { lt: sevenDaysAgo } },
    }),
    prisma.atlasRecord.count({
      where: { createdAt: { lt: sevenDaysAgo } },
    }),
    prisma.observation.count({
      where: {
        status: { not: "record_saved" },
        startedAt: { lt: sevenDaysAgo },
      },
    }),
    prisma.user.count({
      where: { role: "steward", createdAt: { lt: sevenDaysAgo } },
    }),
    prisma.participantContext.findMany({
      where: { current_country: { not: null } },
      select: { current_country: true },
      distinct: ["current_country"],
    }),
  ]);

  const prevCountryIds = new Set(countriesRawPrev.map((c) => c.current_country));

  return {
    observationsPreserved: {
      value: observationsPreserved,
      change: calcChange(observationsPreserved, observationsPreservedPrev),
    },
    atlasRecords: {
      value: atlasRecords,
      change: calcChange(atlasRecords, atlasRecordsPrev),
    },
    recordsInReview: {
      value: recordsInReview,
      change: calcChange(recordsInReview, recordsInReviewPrev),
    },
    activeStewards: {
      value: activeStewards,
      change: calcChange(activeStewards, activeStewardsPrev),
    },
    countriesRepresented: {
      value: countriesRaw.length,
      change: calcChange(countriesRaw.length, prevCountryIds.size),
    },
  };
}
