import { prisma } from "@/lib/prisma";

export interface DashboardStats {
  totalContributions: Metric;
  atlasRecords: Metric;
  observationsPreserved: Metric;
  meaningsIdentified: Metric;
  regionsActive: number;
  avgRepeatRate: Metric;
}

interface Metric {
  value: number;
  change: number;
}

interface RepeatRateGroup {
  _count: { id: number };
}

function calcChange(current: number, previous: number): number {
  if (previous === 0) {
    if (current === 0) return 0;
    return 100;
  }
  return Math.round(((current - previous) / previous) * 1000) / 10;
}

function calcRepeatRate(groups: RepeatRateGroup[]): number {
  const totalUsers = groups.length;
  if (totalUsers === 0) return 0;
  const multiObsUsers = groups.filter((g) => g._count.id > 1).length;
  return (multiObsUsers / totalUsers) * 100;
}

function dateWindows(): { sevenDaysAgo: Date; ninetyDaysAgo: Date; ninetySevenDaysAgo: Date } {
  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
  const ninetySevenDaysAgo = new Date(now.getTime() - 97 * 24 * 60 * 60 * 1000);
  return { sevenDaysAgo, ninetyDaysAgo, ninetySevenDaysAgo };
}

export async function getDashboardStats(): Promise<DashboardStats> {
  const { sevenDaysAgo, ninetyDaysAgo, ninetySevenDaysAgo } = dateWindows();

  const [
    totalContributions,
    totalContributionsPrev,
    atlasRecords,
    atlasRecordsPrev,
    observationsPreserved,
    observationsPreservedPrev,
    signals,
    signalsPrev,
    regionsRaw,
    repeatRateCurrent,
    repeatRatePrev,
  ] = await Promise.all([
    prisma.observation.count(),
    prisma.observation.count({ where: { startedAt: { lt: sevenDaysAgo } } }),

    prisma.atlasRecord.count(),
    prisma.atlasRecord.count({ where: { createdAt: { lt: sevenDaysAgo } } }),

    prisma.observation.count({ where: { status: "record_saved" } }),
    prisma.observation.count({
      where: { status: "record_saved", startedAt: { lt: sevenDaysAgo } },
    }),

    prisma.signal.count(),
    prisma.signal.count({
      where: { observation: { startedAt: { lt: sevenDaysAgo } } },
    }),

    prisma.participantContext.findMany({
      where: { current_country: { not: null } },
      select: { current_country: true },
      distinct: ["current_country"],
    }),

    prisma.observation.groupBy({
      by: ["userId"],
      _count: { id: true },
      where: { startedAt: { gte: ninetyDaysAgo } },
    }),

    prisma.observation.groupBy({
      by: ["userId"],
      _count: { id: true },
      where: {
        startedAt: {
          gte: ninetySevenDaysAgo,
          lt: sevenDaysAgo,
        },
      },
    }),
  ]);

  const avgRepeatRateValue = calcRepeatRate(repeatRateCurrent);
  const avgRepeatRatePrevValue = calcRepeatRate(repeatRatePrev);

  return {
    totalContributions: {
      value: totalContributions,
      change: calcChange(totalContributions, totalContributionsPrev),
    },
    atlasRecords: {
      value: atlasRecords,
      change: calcChange(atlasRecords, atlasRecordsPrev),
    },
    observationsPreserved: {
      value: observationsPreserved,
      change: calcChange(observationsPreserved, observationsPreservedPrev),
    },
    meaningsIdentified: {
      value: signals,
      change: calcChange(signals, signalsPrev),
    },
    regionsActive: regionsRaw.length,
    avgRepeatRate: {
      value: Math.round(avgRepeatRateValue * 10) / 10,
      change: calcChange(avgRepeatRateValue, avgRepeatRatePrevValue),
    },
  };
}
