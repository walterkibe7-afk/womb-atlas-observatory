// Maps normalized observations to AIKB signals by registry field id.
// Ported from participant-app signal-service.ts (matches on registryFieldId).
import type { AikbBundle } from "@/lib/observation/aikb/types";
import type { AtlasObservationRecord, AtlasSignalRecord } from "./types";

export function mapObservationsToSignals(
  observations: AtlasObservationRecord[],
  aikb: AikbBundle,
): AtlasSignalRecord[] {
  const signalsByField = new Map(
    aikb.signals.mappings.map((mapping) => [mapping.observationFieldId, mapping] as const),
  );
  const grouped = new Map<string, AtlasSignalRecord>();

  for (const observation of observations) {
    const mapping = signalsByField.get(observation.registryFieldId);
    if (!mapping) continue;

    const existing = grouped.get(mapping.id);
    if (existing) {
      existing.observationIds.push(observation.id);
      continue;
    }

    grouped.set(mapping.id, {
      id: mapping.id,
      observationIds: [observation.id],
      signalType: mapping.signalType,
      label: mapping.label,
      fieldId: mapping.observationFieldId,
    });
  }

  return [...grouped.values()];
}
