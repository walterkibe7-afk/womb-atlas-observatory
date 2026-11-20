import { prisma } from "@/lib/prisma";

export interface ObservatoryGrowthStats {
  newSignals: Metric;
  newConcepts: Metric;
  languagesAdded: Metric;
  crossLanguageLinks: Metric;
  totalSignals: number;
  totalConcepts: number;
  totalLanguages: number;
  growthOverTime: GrowthDataPoint[];
}

export interface Metric {
  value: number;
  change: number;
}

export interface GrowthDataPoint {
  month: string;
  signals: number;
  concepts: number;
  languages: number;
}

function calcChange(current: number, previous: number): number {
  if (previous === 0) {
    if (current === 0) return 0;
    return 100;
  }
  return Math.round(((current - previous) / previous) * 1000) / 10;
}

function countCrossLinks(signals: readonly { signalId: string; observation: { context: { preferred_language: string | null } | null } | null }[]): number {
  const signalLangs = new Map<string, Set<string>>();
  for (const sig of signals) {
    const lang = sig.observation?.context?.preferred_language;
    if (!lang) continue;
    if (!signalLangs.has(sig.signalId)) {
      signalLangs.set(sig.signalId, new Set());
    }
    signalLangs.get(sig.signalId)!.add(lang);
  }
  return Array.from(signalLangs.values()).filter((langs) => langs.size >= 2).length;
}

function getMonthLabels(now: Date): string[] {
  const labels: string[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    labels.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  }
  return labels;
}

function isInMonth(date: Date, year: number, month: number): boolean {
  return date.getFullYear() === year && date.getMonth() === month;
}

export async function getObservatoryGrowthStats(): Promise<ObservatoryGrowthStats> {
  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);

  const [
    newSignalsCurrent,
    newSignalsPrev,
    newConceptsCurrentRaw,
    newConceptsPrevRaw,
    totalConceptsRaw,
    allContexts,
    allDistinctLanguages,
    crossLinkCurrentRaw,
    crossLinkPrevRaw,
    allSignalsWithDates,
    allApprovedConcepts,
  ] = await Promise.all([
    // newSignals - current 7-day window
    prisma.signal.count({
      where: { observation: { completedAt: { gte: sevenDaysAgo } } },
    }),
    // newSignals - previous 7-day window
    prisma.signal.count({
      where: { observation: { completedAt: { gte: fourteenDaysAgo, lt: sevenDaysAgo } } },
    }),
    // newConcepts - current 7-day window (distinct approved signalIds)
    prisma.signal.findMany({
      where: {
        observation: {
          stewardReview: { status: "Approved", reviewedAt: { gte: sevenDaysAgo } },
        },
      },
      select: { signalId: true },
      distinct: ["signalId"],
    }),
    // newConcepts - previous 7-day window
    prisma.signal.findMany({
      where: {
        observation: {
          stewardReview: { status: "Approved", reviewedAt: { gte: fourteenDaysAgo, lt: sevenDaysAgo } },
        },
      },
      select: { signalId: true },
      distinct: ["signalId"],
    }),
    // totalConcepts - all-time distinct approved signalIds
    prisma.signal.findMany({
      where: { observation: { stewardReview: { status: "Approved" } } },
      select: { signalId: true },
      distinct: ["signalId"],
    }),
    // All contexts with observation dates (for language first appearance)
    prisma.participantContext.findMany({
      where: {
        preferred_language: { not: null },
        observation: { completedAt: { not: null } },
      },
      select: {
        preferred_language: true,
        observation: { select: { completedAt: true } },
      },
    }),
    // All distinct languages (for totalLanguages)
    prisma.participantContext.findMany({
      where: { preferred_language: { not: null } },
      select: { preferred_language: true },
      distinct: ["preferred_language"],
    }),
    // Cross-language links - current 7-day window
    prisma.signal.findMany({
      where: { observation: { completedAt: { gte: sevenDaysAgo } } },
      select: {
        signalId: true,
        observation: {
          select: { context: { select: { preferred_language: true } } },
        },
      },
    }),
    // Cross-language links - previous 7-day window
    prisma.signal.findMany({
      where: { observation: { completedAt: { gte: fourteenDaysAgo, lt: sevenDaysAgo } } },
      select: {
        signalId: true,
        observation: {
          select: { context: { select: { preferred_language: true } } },
        },
      },
    }),
    // All signals with observation dates (for growthOverTime.signals)
    prisma.signal.findMany({
      select: { observation: { select: { completedAt: true } } },
    }),
    // All approved concepts with review dates (for growthOverTime.concepts)
    prisma.signal.findMany({
      where: { observation: { stewardReview: { status: "Approved" } } },
      select: {
        signalId: true,
        observation: {
          select: { stewardReview: { select: { reviewedAt: true } } },
        },
      },
    }),
  ]);

  // Compute language first appearance dates
  const firstAppearance = new Map<string, Date>();
  for (const ctx of allContexts) {
    if (!ctx.preferred_language || !ctx.observation?.completedAt) continue;
    const existing = firstAppearance.get(ctx.preferred_language);
    if (!existing || ctx.observation.completedAt < existing) {
      firstAppearance.set(ctx.preferred_language, ctx.observation.completedAt);
    }
  }

  // languagesAdded - current and previous 7-day windows
  const languagesAddedCurrent = Array.from(firstAppearance.entries())
    .filter(([_, date]) => date >= sevenDaysAgo).length;
  const languagesAddedPrev = Array.from(firstAppearance.entries())
    .filter(([_, date]) => date >= fourteenDaysAgo && date < sevenDaysAgo).length;

  const crossLinkCurrent = countCrossLinks(crossLinkCurrentRaw);
  const crossLinkPrev = countCrossLinks(crossLinkPrevRaw);

  const monthLabels = getMonthLabels(now);
  const growthOverTime: GrowthDataPoint[] = monthLabels.map((label) => {
    const [yearStr, monthStr] = label.split("-");
    const year = parseInt(yearStr);
    const month = parseInt(monthStr) - 1;

    const signals = allSignalsWithDates.filter(
      (s) => s.observation?.completedAt && isInMonth(s.observation.completedAt, year, month),
    ).length;

    const concepts = allApprovedConcepts.filter(
      (s) =>
        s.observation?.stewardReview?.reviewedAt &&
        isInMonth(s.observation.stewardReview.reviewedAt, year, month),
    ).length;

    const languages = Array.from(firstAppearance.entries())
      .filter(([_, date]) => isInMonth(date, year, month))
      .length;

    return { month: label, signals, concepts, languages };
  });

  return {
    newSignals: {
      value: newSignalsCurrent,
      change: calcChange(newSignalsCurrent, newSignalsPrev),
    },
    newConcepts: {
      value: newConceptsCurrentRaw.length,
      change: calcChange(newConceptsCurrentRaw.length, newConceptsPrevRaw.length),
    },
    languagesAdded: {
      value: languagesAddedCurrent,
      change: calcChange(languagesAddedCurrent, languagesAddedPrev),
    },
    crossLanguageLinks: {
      value: crossLinkCurrent,
      change: calcChange(crossLinkCurrent, crossLinkPrev),
    },
    totalSignals: allSignalsWithDates.length,
    totalConcepts: totalConceptsRaw.length,
    totalLanguages: allDistinctLanguages.length,
    growthOverTime,
  };
}
