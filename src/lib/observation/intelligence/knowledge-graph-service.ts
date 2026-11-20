// Expands the AIKB knowledge graph around detected patterns/signals to gather
// related ids, education notes, strengths, trajectory and care context.
// Ported from participant-app knowledge-graph-service.ts.
import type { AikbBundle } from "@/lib/observation/aikb/types";
import type { AtlasPatternRecord, AtlasSignalRecord, KnowledgeContext } from "./types";

export function expandKnowledgeGraph(
  patterns: AtlasPatternRecord[],
  signals: AtlasSignalRecord[],
  aikb: AikbBundle,
): KnowledgeContext {
  const patternIds = new Set(patterns.map((pattern) => pattern.id));
  const signalIds = new Set(signals.map((signal) => signal.id));
  const relatedPatternIds = new Set<string>();
  const relatedSignalIds = new Set<string>();

  for (const edge of aikb.knowledgeGraph.edges) {
    if (patternIds.has(edge.fromId) && edge.toId.startsWith("PAT-")) relatedPatternIds.add(edge.toId);
    if (patternIds.has(edge.fromId) && edge.toId.startsWith("SIG-")) relatedSignalIds.add(edge.toId);
    if (signalIds.has(edge.toId) && edge.fromId.startsWith("PAT-")) relatedPatternIds.add(edge.fromId);
  }

  const dominant = patterns.find((pattern) => pattern.role === "dominant");
  const educationNotes = patterns.slice(0, 3).map((pattern) => pattern.meaning);
  const strengthNotes =
    dominant?.name === "Care Friction"
      ? ["You noticed care friction and preserved that experience in your record."]
      : ["You completed a first observation and created a baseline for future comparison."];

  return {
    relatedSignalIds: [...relatedSignalIds, ...signals.map((signal) => signal.id)].slice(0, 8),
    relatedPatternIds: [...relatedPatternIds, ...patterns.map((pattern) => pattern.id)].slice(0, 6),
    educationNotes,
    strengthNotes,
    trajectoryNotes: patterns.slice(0, 2).map((pattern) => pattern.watchOverTime),
    careContextNotes: patterns.some((pattern) => pattern.name === "Care Friction")
      ? ["Care experience is preserved as observational context, not as a clinical judgment."]
      : [],
  };
}
