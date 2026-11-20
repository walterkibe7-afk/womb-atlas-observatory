import { prisma } from "@/lib/prisma";

export interface ObservatoryCoverageStats {
  countriesCovered: number;
  countryList: { country: string; observationCount: number }[];
  regionsNeedingGrowth: string[];
  underRepresentedLanguages: string[];
}

function bottomQuartile(
  items: { key: string; count: number }[],
): string[] {
  if (items.length === 0) return [];
  const sorted = [...items].sort((a, b) => a.count - b.count);
  const quartileIndex = Math.ceil(sorted.length / 4);
  return sorted.slice(0, quartileIndex).map((i) => i.key);
}

export async function getObservatoryCoverageStats(): Promise<ObservatoryCoverageStats> {
  const [countriesGrouped, languagesGrouped] = await Promise.all([
    prisma.participantContext.groupBy({
      by: ["current_country"],
      _count: { id: true },
      where: { current_country: { not: null } },
    }),
    prisma.participantContext.groupBy({
      by: ["preferred_language"],
      _count: { id: true },
      where: { preferred_language: { not: null } },
    }),
  ]);

  const countryList = countriesGrouped
    .map((g) => ({
      country: g.current_country!,
      observationCount: g._count.id,
    }))
    .sort((a, b) => b.observationCount - a.observationCount);

  const countryItems = countriesGrouped.map((g) => ({
    key: g.current_country!,
    count: g._count.id,
  }));

  const languageItems = languagesGrouped.map((g) => ({
    key: g.preferred_language!,
    count: g._count.id,
  }));

  return {
    countriesCovered: countriesGrouped.length,
    countryList,
    regionsNeedingGrowth: bottomQuartile(countryItems),
    underRepresentedLanguages: bottomQuartile(languageItems),
  };
}
