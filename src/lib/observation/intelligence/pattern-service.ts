// Pattern detection.
//
// NOTE (source-of-truth reality): all 120 AIKB pattern entries ship with EMPTY
// valueChecks/fieldIds, so the AIKB-only detection path never fires. The SoT
// therefore detects patterns deterministically (the ARIF engine, buildAtlasRecord)
// and uses the AIKB pattern registry only for ids + metadata, matched by name.
//
// This service supports BOTH: (1) the AIKB valueChecks path (future-proof, keyed
// on registryFieldId), and (2) enrichment of deterministically-detected patterns
// against the AIKB registry by name.
import type { AikbBundle } from "@/lib/observation/aikb/types";
import type {
  AtlasObservationRecord,
  AtlasPatternRecord,
  AtlasSignalRecord,
  DetectedPattern,
} from "./types";

function normalizePatternName(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function findAikbPatternEntry(aikb: AikbBundle, patternName: string) {
  const normalized = normalizePatternName(patternName);
  return (
    aikb.patterns.entries.find((entry) => normalizePatternName(entry.name) === normalized) ??
    aikb.patterns.entries.find((entry) => normalizePatternName(entry.name).includes(normalized)) ??
    aikb.patterns.entries.find((entry) => normalized.includes(normalizePatternName(entry.name)))
  );
}

function confidenceFromMatches(matchCount: number): {
  confidence: AtlasPatternRecord["confidence"];
  observationConfidence: number;
} {
  if (matchCount >= 4) return { confidence: "high", observationConfidence: 0.82 };
  if (matchCount >= 2) return { confidence: "moderate", observationConfidence: 0.64 };
  return { confidence: "low", observationConfidence: 0.42 };
}

/** AIKB valueChecks/fieldIds detection path (ported; fires only when populated). */
function detectFromAikb(
  observations: AtlasObservationRecord[],
  signals: AtlasSignalRecord[],
  aikb: AikbBundle,
): AtlasPatternRecord[] {
  const detected: AtlasPatternRecord[] = [];

  for (const entry of aikb.patterns.entries) {
    if (entry.valueChecks.length === 0 && entry.fieldIds.length === 0) continue;

    const supportingObservationIds = observations
      .filter((observation) => {
        // Match value checks on the registry field id (observatory-system stores
        // UPPERCASE app ids; the registry uses snake_case).
        const check = entry.valueChecks.find((item) => item.fieldId === observation.registryFieldId);
        return check ? check.values.includes(observation.value) : false;
      })
      .map((observation) => observation.id);

    const supportingSignalIds = signals
      .filter((signal) => entry.fieldIds.includes(signal.fieldId))
      .map((signal) => signal.id);

    const matchCount = supportingObservationIds.length + supportingSignalIds.length;
    if (matchCount === 0) continue;

    const { confidence, observationConfidence } = confidenceFromMatches(matchCount);
    detected.push({
      id: entry.id,
      name: entry.name,
      domain: entry.domain,
      confidence,
      observationConfidence,
      supportingObservationIds,
      supportingSignalIds,
      role: "supporting",
      meaning: entry.meaning,
      atlasNote: entry.atlasNote,
      watchOverTime: entry.watchOverTime,
    });
  }

  return detected;
}

/** Enrich deterministically-detected patterns with AIKB ids + metadata by name. */
function enrichDetectedPatterns(
  detectedPatterns: DetectedPattern[],
  observations: AtlasObservationRecord[],
  signals: AtlasSignalRecord[],
  aikb: AikbBundle,
): AtlasPatternRecord[] {
  return detectedPatterns.map((pattern, index) => {
    const aikbEntry = findAikbPatternEntry(aikb, pattern.name);
    const matchCount = pattern.supportingSignals.length;
    return {
      id: aikbEntry?.id ?? `PAT-MVP-${String(index + 1).padStart(3, "0")}`,
      name: pattern.name,
      domain: aikbEntry?.domain ?? "Observed experience",
      confidence: matchCount >= 3 ? "high" : matchCount >= 2 ? "moderate" : "low",
      observationConfidence: matchCount >= 3 ? 0.8 : matchCount >= 2 ? 0.64 : 0.48,
      supportingObservationIds: observations
        .filter((observation) =>
          pattern.supportingSignals.some((signal) => signal.includes(observation.label)),
        )
        .map((observation) => observation.id),
      supportingSignalIds: signals.map((signal) => signal.id).slice(0, 3),
      role: index === 0 ? "dominant" : "supporting",
      meaning: aikbEntry?.meaning ?? pattern.meaning,
      atlasNote: aikbEntry?.atlasNote ?? pattern.atlasNote,
      watchOverTime: aikbEntry?.watchOverTime ?? pattern.watchOverTime,
    } satisfies AtlasPatternRecord;
  });
}

/**
 * Detect patterns. Prefers the AIKB valueChecks path; falls back to enriching the
 * deterministically-detected patterns (the ARIF detector output) — which is what
 * actually produces patterns today, since AIKB valueChecks are empty.
 */
export function detectPatterns(
  observations: AtlasObservationRecord[],
  signals: AtlasSignalRecord[],
  aikb: AikbBundle,
  detectedPatterns: DetectedPattern[] = [],
): AtlasPatternRecord[] {
  const fromAikb = detectFromAikb(observations, signals, aikb);

  const patterns =
    fromAikb.length > 0 ? fromAikb : enrichDetectedPatterns(detectedPatterns, observations, signals, aikb);

  patterns.sort(
    (left, right) =>
      right.supportingObservationIds.length +
      right.supportingSignalIds.length -
      (left.supportingObservationIds.length + left.supportingSignalIds.length),
  );
  if (patterns[0]) patterns[0].role = "dominant";

  return patterns;
}

export function getDominantPattern(patterns: AtlasPatternRecord[]) {
  return patterns.find((pattern) => pattern.role === "dominant") ?? patterns[0] ?? null;
}
