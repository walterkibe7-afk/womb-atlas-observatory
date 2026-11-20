// Config-driven projection: copies canonical ObservationResponse rows into the
// spec's typed domain tables using each question's targetTable/targetColumn.
// Because the domain-table Prisma fields are named exactly like the spec columns,
// this needs no per-field mapping code.
import { prisma } from "@/lib/prisma";
import type { AnswerMap, AnswerValue } from "./types";

// Tables that are NOT simple 1:1 domain projections (handled by dedicated paths).
const SKIP_TABLES = new Set(["narratives", "atlas_records", "atlas_checkins"]);
// Field types that are not stored via projection.
const SKIP_FIELD_TYPES = new Set(["text_audio", "generated_json", "single_select/text_audio"]);

// targetTable -> Prisma delegate (typed loosely so we can write generically).
/* eslint-disable @typescript-eslint/no-explicit-any */
const TABLE_DELEGATES: Record<string, any> = {
  participant_context: prisma.participantContext,
  observation_consents: prisma.observationConsent,
  observation_safety: prisma.observationSafety,
  reproductive_history: prisma.reproductiveHistory,
  bleeding_patterns: prisma.bleedingPattern,
  pain_patterns: prisma.painPattern,
  cycle_patterns: prisma.cyclePattern,
  daily_life: prisma.dailyLife,
  care_access: prisma.careAccess,
  sensitive_topics: prisma.sensitiveTopics,
};
/* eslint-enable @typescript-eslint/no-explicit-any */

interface QuestionMeta {
  fieldId: string;
  fieldType: string;
  targetTable: string;
  targetColumn: string;
}

function coerce(fieldType: string, value: AnswerValue): unknown {
  if (fieldType === "boolean") return value === true || value === "true";
  if (fieldType === "multi_select") return Array.isArray(value) ? value : value == null ? [] : [value];
  return value; // single_select | text | country
}

/**
 * Project the given answers into the typed domain tables for one observation.
 * `questions` is the full question metadata (from the form definition / DB).
 */
export async function projectResponses(
  observationId: string,
  answers: AnswerMap,
  questions: QuestionMeta[],
): Promise<void> {
  const metaByField = new Map(questions.map((q) => [q.fieldId, q]));

  // Group converted values by target table.
  const perTable = new Map<string, Record<string, unknown>>();
  for (const [fieldId, value] of Object.entries(answers)) {
    const meta = metaByField.get(fieldId);
    if (!meta) continue;
    if (SKIP_TABLES.has(meta.targetTable)) continue;
    if (SKIP_FIELD_TYPES.has(meta.fieldType)) continue;
    if (!TABLE_DELEGATES[meta.targetTable]) continue;
    if (!perTable.has(meta.targetTable)) perTable.set(meta.targetTable, {});
    perTable.get(meta.targetTable)![meta.targetColumn] = coerce(meta.fieldType, value);
  }

  // Upsert each table keyed on observationId.
  for (const [table, data] of perTable.entries()) {
    if (table === "observation_consents" && data["consent_acknowledged"]) {
      data["consent_timestamp"] = new Date();
    }
    const delegate = TABLE_DELEGATES[table];
    await delegate.upsert({
      where: { observationId },
      create: { observationId, ...data },
      update: data,
    });
  }
}
