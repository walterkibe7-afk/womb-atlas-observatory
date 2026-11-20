import { prisma } from "@/lib/prisma";

export interface StewardNetworkStats {
  activeStewards: Metric;
  languagesCovered: Metric;
  countriesCovered: Metric;
  signalsCurated: Metric;
  conceptsApproved: Metric;
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

export async function getStewardNetworkStats(): Promise<StewardNetworkStats> {
  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  const [
    activeStewards,
    languagesRaw,
    countriesRaw,
    signalsCurated,
    conceptsRaw,
    activeStewardsPrev,
    languagesRawPrev,
    countriesRawPrev,
    signalsCuratedPrev,
    conceptsRawPrev,
  ] = await Promise.all([
    prisma.user.count({ where: { role: "steward" } }),
    prisma.participantContext.findMany({
      where: {
        preferred_language: { not: null },
        observation: { stewardReview: { isNot: null } },
      },
      distinct: ["preferred_language"],
    }),
    prisma.participantContext.findMany({
      where: {
        current_country: { not: null },
        observation: { stewardReview: { isNot: null } },
      },
      distinct: ["current_country"],
    }),
    prisma.signal.count({
      where: { observation: { stewardReview: { isNot: null } } },
    }),
    prisma.signal.findMany({
      where: { observation: { stewardReview: { status: "Approved" } } },
      distinct: ["signalId"],
    }),
    prisma.user.count({
      where: { role: "steward", createdAt: { lt: sevenDaysAgo } },
    }),
    prisma.participantContext.findMany({
      where: {
        preferred_language: { not: null },
        observation: { stewardReview: { reviewedAt: { lt: sevenDaysAgo } } },
      },
      distinct: ["preferred_language"],
    }),
    prisma.participantContext.findMany({
      where: {
        current_country: { not: null },
        observation: { stewardReview: { reviewedAt: { lt: sevenDaysAgo } } },
      },
      distinct: ["current_country"],
    }),
    prisma.signal.count({
      where: { observation: { stewardReview: { reviewedAt: { lt: sevenDaysAgo } } } },
    }),
    prisma.signal.findMany({
      where: { observation: { stewardReview: { status: "Approved", reviewedAt: { lt: sevenDaysAgo } } } },
      distinct: ["signalId"],
    }),
  ]);

  return {
    activeStewards: {
      value: activeStewards,
      change: calcChange(activeStewards, activeStewardsPrev),
    },
    languagesCovered: {
      value: languagesRaw.length,
      change: calcChange(languagesRaw.length, languagesRawPrev.length),
    },
    countriesCovered: {
      value: countriesRaw.length,
      change: calcChange(countriesRaw.length, countriesRawPrev.length),
    },
    signalsCurated: {
      value: signalsCurated,
      change: calcChange(signalsCurated, signalsCuratedPrev),
    },
    conceptsApproved: {
      value: conceptsRaw.length,
      change: calcChange(conceptsRaw.length, conceptsRawPrev.length),
    },
  };
}
