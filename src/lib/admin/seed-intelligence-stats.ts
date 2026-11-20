import { prisma } from "@/lib/prisma";

// =====================================================================
// Seed Intelligence Layer (admin "Reports & Analytics" page) stats.
//
// Everything here is derived from the same tables the Observatory Coverage
// Map reads, so the two views agree:
//   • Geography + Active Regions  <- ParticipantContext.current_country
//   • Languages                   <- ParticipantContext.preferred_language
// ParticipantContext is 1:1 with Observation, so its per-country counts are
// per-observation counts (matching the coverage map's "observationCount").
// Signal frequency comes from the Signal table, named via SignalRule.
// =====================================================================

export interface SeedIntelligenceStats {
  totalObservations: number;
  activeRegions: number;
  supportedLanguages: number;
  uniqueSignals: number;
  /** Top countries by observation volume (keyed `region` for the bar chart). */
  geoData: { region: string; volume: number }[];
  /** Declared-language share as whole percents, top languages first. */
  langData: { name: string; value: number }[];
  /** Most frequently detected signals, human-named. */
  signalFreqData: { name: string; freq: number }[];
}

const languageDisplay = new Intl.DisplayNames(["en"], { type: "language" });

/** "en"/"sw-KE" -> "English"/"Swahili"; falls back to the title-cased raw value. */
function languageName(raw: string): string {
  const v = raw.trim();
  if (!v) return v;
  const base = v.split(/[-_]/)[0].toLowerCase();
  try {
    const name = languageDisplay.of(base);
    if (name && name.toLowerCase() !== base) return name;
  } catch {
    /* not a recognized language subtag */
  }
  return v.charAt(0).toUpperCase() + v.slice(1);
}

// Supported values for the "Filter Data" time-range control.
const RANGE_DAYS: Record<string, number> = { "7d": 7, "30d": 30, "90d": 90 };

/**
 * @param range "7d" | "30d" | "90d" scopes to observations started within that
 *   window (by `Observation.startedAt`); anything else means all time. Country
 *   and language live on ParticipantContext, so they're scoped through the
 *   parent observation's date.
 */
export async function getSeedIntelligenceStats(range = "all"): Promise<SeedIntelligenceStats> {
  const days = RANGE_DAYS[range];
  const since = days ? new Date(Date.now() - days * 24 * 60 * 60 * 1000) : null;
  const obsWhere = since ? { startedAt: { gte: since } } : {};
  const viaObs = since ? { observation: { startedAt: { gte: since } } } : {};

  const [totalObservations, countriesGrouped, languagesGrouped, signalsGrouped, signalRules] =
    await Promise.all([
      prisma.observation.count({ where: obsWhere }),
      prisma.participantContext.groupBy({
        by: ["current_country"],
        _count: { id: true },
        where: { current_country: { not: null }, ...viaObs },
      }),
      prisma.participantContext.groupBy({
        by: ["preferred_language"],
        _count: { id: true },
        where: { preferred_language: { not: null }, ...viaObs },
      }),
      prisma.signal.groupBy({
        by: ["signalId"],
        _count: { id: true },
        where: viaObs,
      }),
      prisma.signalRule.findMany({ select: { signalId: true, name: true } }),
    ]);

  // Geography — top countries by observation volume (same source as the map).
  const geoData = countriesGrouped
    .map((g) => ({ region: g.current_country!, volume: g._count.id }))
    .sort((a, b) => b.volume - a.volume)
    .slice(0, 6);

  // Languages — each declared language's share of the total, top 6.
  const langTotal = languagesGrouped.reduce((sum, g) => sum + g._count.id, 0);
  const langData = languagesGrouped
    .map((g) => ({ name: languageName(g.preferred_language!), count: g._count.id }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 6)
    .map((l) => ({
      name: l.name,
      value: langTotal > 0 ? Math.round((l.count / langTotal) * 100) : 0,
    }));

  // Signal frequency — top detected signals, named from the SignalRule catalog.
  const ruleName = new Map(signalRules.map((r) => [r.signalId, r.name]));
  const signalFreqData = signalsGrouped
    .map((g) => ({ name: ruleName.get(g.signalId) ?? g.signalId, freq: g._count.id }))
    .sort((a, b) => b.freq - a.freq)
    .slice(0, 6);

  return {
    totalObservations,
    activeRegions: countriesGrouped.length,
    supportedLanguages: languagesGrouped.length,
    uniqueSignals: signalsGrouped.length,
    geoData,
    langData,
    signalFreqData,
  };
}
