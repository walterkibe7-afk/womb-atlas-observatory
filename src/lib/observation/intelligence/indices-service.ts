// Computes the 5 AIKB Atlas indices as the mean observation-confidence of their
// matched patterns. Ported from participant-app indices-service.ts.
import type { AikbBundle } from "@/lib/observation/aikb/types";
import type { AtlasIndexRecord, AtlasPatternRecord } from "./types";

export function computeIndices(
  patterns: AtlasPatternRecord[],
  aikb: AikbBundle,
): AtlasIndexRecord[] {
  return aikb.indices.definitions.map((definition) => {
    const matchedPatterns = patterns.filter((pattern) => definition.patternIds.includes(pattern.id));
    const value =
      matchedPatterns.length === 0
        ? 0
        : matchedPatterns.reduce((total, pattern) => total + pattern.observationConfidence, 0) /
          matchedPatterns.length;

    return {
      id: definition.id,
      name: definition.name,
      description: definition.description,
      value: Number(value.toFixed(2)),
      patternIds: matchedPatterns.map((pattern) => pattern.id),
    };
  });
}
