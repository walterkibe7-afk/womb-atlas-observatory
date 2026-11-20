// Identifies which patterns should be watched over time. Ported from
// participant-app trajectory-service.ts.
import type { AtlasPatternRecord } from "./types";

export function identifyTrajectoryPatterns(patterns: AtlasPatternRecord[]) {
  return patterns
    .filter((pattern) => pattern.observationConfidence >= 0.5)
    .map((pattern) => ({
      patternId: pattern.id,
      watchArea: pattern.watchOverTime,
    }));
}
