import { prisma } from "@/lib/prisma";

export interface ParticipantPattern {
  name: string; // participant-facing label (Reflection Chamber's participantLabel)
  scientificName: string;
  role: string;
  confidence: string;
  whyThisMatters: string;
  observedBecause: string[];
}

export interface ParticipantConnection {
  fromLabel: string;
  toLabel: string;
  whyConnected: string;
}

export interface ParticipantWatchItem {
  label: string;
  status: string;
  compareNote: string;
}

export interface ParticipantWatchGroup {
  groupLabel: string;
  items: ParticipantWatchItem[];
}

export interface ParticipantArchetype {
  name: string;
  coreTheme: string;
  whySelected: string;
}

export interface ParticipantDomainScore {
  domain: string;
  score: number; // 0-4
}

export interface ParticipantReflection {
  openingInsight: string;
  whatExperienceMayMean: string;
  whatAppearsConnected: string[];
  strengthsObserved: string[];
  bodyLiteracyNote: string;
  whatAtlasWillWatch: string[];
}

export interface ParticipantContext {
  userName: string | null;
  ageRange: string | null;
  currentCountry: string | null;
  preferredLanguage: string | null;
  reproductiveState: string | null;
  isCheckin: boolean;
  burdenLevel: string | null;
  archetype: ParticipantArchetype | null;
  storyHeadline: string | null;
  storyNarrative: string | null;
  participantVoice: string[];
  domainScores: ParticipantDomainScore[];
  patterns: ParticipantPattern[];
  connections: ParticipantConnection[];
  watchGroups: ParticipantWatchGroup[];
  reflection: ParticipantReflection | null;
  narratives: { promptId: string; text: string }[];
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === "string") : [];
}

function asString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

const EMPTY: Omit<ParticipantContext, "userName"> = {
  ageRange: null,
  currentCountry: null,
  preferredLanguage: null,
  reproductiveState: null,
  isCheckin: false,
  burdenLevel: null,
  archetype: null,
  storyHeadline: null,
  storyNarrative: null,
  participantVoice: [],
  domainScores: [],
  patterns: [],
  connections: [],
  watchGroups: [],
  reflection: null,
  narratives: [],
};

// -- Reflection Chamber pattern -> ParticipantPattern -----------------------
function toChamberPattern(p: unknown): ParticipantPattern | null {
  if (!isRecord(p)) return null;
  return {
    name: asString(p.participantLabel) || asString(p.scientificName) || "Observed pattern",
    scientificName: asString(p.scientificName),
    role: asString(p.role) || "supporting",
    confidence: asString(p.confidence) || "moderate",
    whyThisMatters: asString(p.whyThisMatters),
    observedBecause: asStringArray(p.observedBecause),
  };
}

/**
 * Builds the participant context fed to Aminata's system prompt.
 *
 * Source of truth: `AtlasRecord.record_payload` — the rich, pre-computed
 * read-model the Records/Reflections pages render directly from the DB (see
 * `api/observation/intelligence/route.ts`'s `toAtlasRecordDetail`/
 * `recordPayload`). This includes the "Reflection Chamber" narrative layer
 * (participant-facing pattern labels, why-this-matters explanations,
 * pattern-to-pattern connections, and watch groups) — richer and more
 * conversational than the raw AIKB pattern text the audit-trail
 * `AtlasIntelligenceRun` rows carry. Falls back to the older
 * `reflection_summary`/`observed_patterns`/`constellation_scores` JSON shape
 * for observations that predate this read-model (persistence is non-fatal,
 * so a run can also fail to populate it).
 *
 * The "most recently completed observation" query also naturally picks up
 * Atlas Check-Ins: a check-in creates a full new `Observation` row
 * (flowKey "atlas_checkin", status "record_saved") re-run through the same
 * pipeline, so its `record_payload` and any check-in note (saved as a
 * `Narrative` with promptId "checkin_note") surface here with no extra query.
 */
export async function buildParticipantContext(userId: string): Promise<ParticipantContext> {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { name: true } });

  const observation = await prisma.observation.findFirst({
    where: { userId, status: { in: ["reflection_generated", "record_saved"] } },
    orderBy: { completedAt: "desc" },
    include: {
      context: true,
      narratives: true,
      atlasRecord: true,
    },
  });

  if (!observation) {
    return { userName: user?.name ?? null, ...EMPTY };
  }

  const demographic = {
    ageRange: observation.context?.age_range ?? null,
    currentCountry: observation.context?.current_country ?? null,
    preferredLanguage: observation.context?.preferred_language ?? null,
    reproductiveState: observation.context?.reproductive_state ?? null,
  };

  const narratives = observation.narratives
    .filter((n) => n.textResponse)
    .map((n) => ({ promptId: n.promptId, text: n.textResponse! }));

  const isCheckin = observation.flowKey === "atlas_checkin";
  const atlas = observation.atlasRecord;
  const payload = isRecord(atlas?.record_payload) ? atlas!.record_payload : null;
  const chamber = payload && isRecord(payload.reflectionChamber) ? payload.reflectionChamber : null;

  if (payload && chamber) {
    const story = isRecord(chamber.story) ? chamber.story : {};
    const archetypeRaw = isRecord(chamber.archetype) ? chamber.archetype : null;
    const content = isRecord(payload.reflectionContent) ? payload.reflectionContent : {};

    const domainScores: ParticipantDomainScore[] = Array.isArray(payload.constellation)
      ? (payload.constellation as unknown[])
          .filter(isRecord)
          .map((c) => ({ domain: asString(c.domain) || "Domain", score: typeof c.score === "number" ? c.score : 0 }))
      : [];

    const patterns: ParticipantPattern[] = [
      toChamberPattern(chamber.dominantPattern),
      ...(Array.isArray(chamber.supportingPatterns) ? chamber.supportingPatterns.map(toChamberPattern) : []),
    ].filter((p): p is ParticipantPattern => p !== null);

    const connections: ParticipantConnection[] = Array.isArray(chamber.connections)
      ? (chamber.connections as unknown[])
          .filter(isRecord)
          .map((c) => ({
            fromLabel: asString(c.fromLabel),
            toLabel: asString(c.toLabel),
            whyConnected: asString(c.whyConnected),
          }))
      : [];

    const watchGroups: ParticipantWatchGroup[] = Array.isArray(chamber.watchGroups)
      ? (chamber.watchGroups as unknown[]).filter(isRecord).map((g) => ({
          groupLabel: asString(g.groupLabel),
          items: Array.isArray(g.items)
            ? (g.items as unknown[])
                .filter(isRecord)
                .map((i) => ({
                  label: asString(i.label),
                  status: asString(i.status),
                  compareNote: asString(i.compareNote),
                }))
            : [],
        }))
      : [];

    const archetype: ParticipantArchetype | null = archetypeRaw
      ? {
          name: asString(archetypeRaw.name) || asString(payload.reflectionType) || "Baseline Observation",
          coreTheme: asString(archetypeRaw.coreTheme),
          whySelected: asString(archetypeRaw.whySelected),
        }
      : null;

    const reflection: ParticipantReflection = {
      openingInsight: asString(content.openingInsight),
      whatExperienceMayMean: asString(content.whatExperienceMayMean),
      whatAppearsConnected: asStringArray(content.whatAppearsConnected),
      strengthsObserved: asStringArray(content.strengthsObserved),
      bodyLiteracyNote: asString(content.bodyLiteracyNote),
      whatAtlasWillWatch: asStringArray(content.whatAtlasWillWatch),
    };

    return {
      userName: user?.name ?? null,
      ...demographic,
      isCheckin,
      burdenLevel: asString(payload.burden) || atlas?.burdenLevel || null,
      archetype,
      storyHeadline: asString(story.headline) || null,
      storyNarrative: asString(story.narrative) || null,
      participantVoice: asStringArray(story.participantVoice),
      domainScores,
      patterns,
      connections,
      watchGroups,
      reflection,
      narratives,
    };
  }

  // Legacy fallback — pre-Reflection-Chamber observation, or a run whose
  // persistence failed non-fatally.
  const legacyPatterns: ParticipantPattern[] = Array.isArray(atlas?.observed_patterns)
    ? (atlas!.observed_patterns as Array<{ domain?: string; signals?: string[] }>).map((p) => ({
        name: (p.signals ?? []).join(", ") || p.domain || "Observed pattern",
        scientificName: "",
        role: "supporting",
        confidence: "moderate",
        whyThisMatters: "",
        observedBecause: [],
      }))
    : [];

  const legacyDomainScores: ParticipantDomainScore[] = Array.isArray(atlas?.constellation_scores)
    ? (atlas!.constellation_scores as Array<{ domain?: string; score?: number }>).map((c) => ({
        domain: c.domain ?? "Domain",
        score: typeof c.score === "number" ? c.score : 0,
      }))
    : [];

  const summary = atlas?.reflection_summary as Record<string, unknown> | null;
  const summaryParagraphs = asStringArray(summary?.paragraphs);
  const legacyReflection: ParticipantReflection | null = summary
    ? {
        openingInsight: summaryParagraphs[0] ?? "",
        whatExperienceMayMean: summaryParagraphs[1] ?? "",
        whatAppearsConnected: [],
        strengthsObserved: [],
        bodyLiteracyNote: asString(summary.bodyLiteracyNote),
        whatAtlasWillWatch: [],
      }
    : null;

  return {
    userName: user?.name ?? null,
    ...demographic,
    isCheckin,
    burdenLevel: atlas?.burdenLevel ?? null,
    archetype: summary ? { name: asString(summary.archetype) || "Baseline Observation", coreTheme: "", whySelected: "" } : null,
    storyHeadline: null,
    storyNarrative: null,
    participantVoice: [],
    domainScores: legacyDomainScores,
    patterns: legacyPatterns,
    connections: [],
    watchGroups: [],
    reflection: legacyReflection,
    narratives,
  };
}
