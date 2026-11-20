import { NextResponse } from "next/server";
import { ActionType, Prisma } from "@prisma/client";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { logAuditEvent } from "@/lib/audit-logger";
import { runAtlasIntelligence } from "@/lib/observation/intelligence/reflection-runner";
import type { AnswerMap } from "@/lib/observation/types";
import { buildAllConstellationNodes } from "@/lib/observation/intelligence/v43/constellation-node-content";
import { buildDownloadRecord, buildObservedPatternCards } from "@/lib/observation/intelligence/v43/atlas-intelligence-service";

type RunResult = Awaited<ReturnType<typeof runAtlasIntelligence>>;

// Ontology scientificName (AtlasPatternRecord.name — see v43/pattern-ontology.ts's
// PRIMARY/SECONDARY_PATTERNS/EMERGENT_THEMES) -> dashboard constellation domain.
//
// NOT index-based on purpose: computeIndices()/indices.json's IDX-002..IDX-005
// patternIds reference PAT-002..007, which the by-name AIKB matcher never actually
// assigns to a detected pattern (only PAT-001/Bleeding Burden resolves — see
// documentations/Update_Observation_v5.md §6). That pinned Pain/Hormonal/Daily
// Life/Care Access at 0 on every run, so check-ins never moved those domains no
// matter what changed. Grouping by each pattern's own domain (ground truth, always
// populated) sidesteps that curated-content bug entirely.
// "Escalating Burden" is deliberately excluded — a cross-domain synthesis pattern
// with no single home. "Cycle" has no dedicated ontology pattern, so it isn't
// emitted here either (unchanged from prior behavior).
const PATTERN_DOMAIN: Record<string, string> = {
  "Bleeding Burden": "Bleeding",
  "Pain Distribution": "Pain",
  "Pelvic Function": "Pain",
  "Hormonal Rhythm": "Hormonal",
  "Body Unpredictability": "Hormonal",
  "Daily Function": "Daily Life",
  "Planning Around Symptoms": "Daily Life",
  "Symptom Adaptation": "Daily Life",
  "Life Reorganization": "Daily Life",
  "Adaptive Living": "Daily Life",
  "Care Experience": "Care Access",
  "Diagnostic Uncertainty": "Care Access",
  "Care Navigation Complexity": "Care Access",
  "Delayed Recognition": "Care Access",
};
const CONSTELLATION_DOMAIN_ORDER = ["Bleeding", "Pain", "Hormonal", "Daily Life", "Care Access"];

function deriveBurden(result: RunResult): "Low" | "Moderate" | "High" {
  if (result.patterns.some((p) => p.confidence === "high")) return "High";
  if (result.patterns.some((p) => p.confidence === "moderate")) return "Moderate";
  return "Low";
}

function toConstellation(result: RunResult) {
  const byDomain = new Map<string, number[]>();
  for (const pattern of result.patterns) {
    const domain = PATTERN_DOMAIN[pattern.name];
    if (!domain) continue;
    const values = byDomain.get(domain) ?? [];
    values.push(pattern.observationConfidence);
    byDomain.set(domain, values);
  }
  return CONSTELLATION_DOMAIN_ORDER.map((domain) => {
    const values = byDomain.get(domain) ?? [];
    const mean = values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0;
    return { domain, score: Math.min(4, Math.round(mean * 5)), evidenceCount: values.length };
  });
}

function toConstellationNodes(result: RunResult, locale?: string) {
  return buildAllConstellationNodes(
    result.observations,
    result.atlasRecord.observedPatterns,
    result.atlasRecord.patternConnections,
    locale,
  );
}

// Everything the rich "Observed Patterns" and "Your Atlas Record" screens need
// (mobile-app parity), computed from the same AtlasRecord the pipeline already
// produces. Not persisted — recomputed on every finalize()/resume like
// `constellation`/`constellationNodes` already are.
function toAtlasRecordDetail(result: RunResult, locale?: string) {
  const ar = result.atlasRecord;
  return {
    generatedAt: ar.generatedAt,
    observationPortrait: ar.observationPortrait,
    dominantPattern: ar.dominantPattern,
    supportingPatterns: ar.supportingPatterns,
    signalLandscape: ar.signalLandscape,
    experienceLayers: ar.experienceLayers,
    strengths: ar.strengths,
    reflectionCompass: ar.reflectionCompass,
    narrativeThemes: ar.narrativeThemes,
    bodyLiteracyNote: ar.bodyLiteracyNote,
    whatAtlasWillWatch: ar.whatAtlasWillWatch,
    disclaimer: ar.disclaimer,
    subduedPatternMessages: ar.subduedPatternMessages,
    observedPatternCards: buildObservedPatternCards(ar.observedPatterns, ar.patternConnections, locale),
    downloadRecord: buildDownloadRecord(ar, locale),
  };
}

function toObservedPatternGroups(result: RunResult) {
  const byDomain = new Map<string, string[]>();
  for (const p of result.patterns) {
    if (!byDomain.has(p.domain)) byDomain.set(p.domain, []);
    byDomain.get(p.domain)!.push(p.name);
  }
  return [...byDomain.entries()].map(([domain, signals]) => ({ domain, signals }));
}

function reflectionParagraphs(result: RunResult): string[] {
  const c = result.reflectionContent;
  return [
    c.openingInsight,
    c.whatExperienceMayMean,
    ...c.whatAppearsConnected.slice(0, 2),
    ...c.strengthsObserved.slice(0, 2),
  ].filter((p): p is string => Boolean(p && p.trim()));
}

/**
 * POST /api/observation/intelligence — run the Atlas Intelligence pipeline
 * (v4.3 detection + AIKB archetype + OpenAI reflection) for one observation,
 * persist an auditable run + the participant-facing AtlasRecord, and return the
 * reflection payload (backward-compatible with the record screens + rich fields).
 * Body: { observationId, locale? }
 */
export async function POST(req: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { observationId } = (await req.json()) as { observationId: string };
    if (!observationId) {
      return NextResponse.json({ error: "observationId required" }, { status: 400 });
    }

    const observation = await prisma.observation.findUnique({
      where: { id: observationId },
      select: { id: true, userId: true },
    });
    if (!observation) {
      return NextResponse.json({ error: "Observation not found" }, { status: 404 });
    }
    if (observation.userId !== session.user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const responses = await prisma.observationResponse.findMany({ where: { observationId } });
    const answers: AnswerMap = {};
    for (const r of responses) answers[r.fieldId] = r.value as AnswerMap[string];

    // The reflection is generated, not seeded, so it cannot come from the
    // translation dictionaries — it has to be written in the participant's
    // language at generation time. Locale is the session's, not client input —
    // it's a permanent account-level choice now, not a per-request value.
    const result = await runAtlasIntelligence(answers, session.user.locale ?? "en");

    const burden = deriveBurden(result);
    const constellation = toConstellation(result);
    const constellationNodes = toConstellationNodes(result, session.user.locale ?? "en");
    const observedPatterns = toObservedPatternGroups(result);
    const reflectionCopy = reflectionParagraphs(result);

    // The rich, RecordResult-shaped read-model the Records/Reflections pages render
    // straight from the DB (no pipeline re-run). Persisted to AtlasRecord.record_payload.
    const recordPayload = {
      generatedAt: result.atlasRecord.generatedAt,
      burden,
      reflectionType: result.archetype.name,
      reflectionSource: result.reflectionSource,
      archetype: result.archetype,
      planArchetype: result.planArchetype,
      reflectionContent: result.reflectionContent,
      reflectionCopy,
      signals: result.signals.map((s) => ({
        signalId: s.id,
        name: s.label,
        domain: s.signalType,
        severity: "moderate",
      })),
      constellation,
      constellationNodes,
      observedPatterns,
      atlasRecordDetail: toAtlasRecordDetail(result, session.user.locale ?? "en"),
      reflectionChamber: result.reflectionChamber,
      indices: result.indices,
    };

    // Persist auditable run + participant-facing AtlasRecord (non-fatal).
    try {
      await persistRun(observationId, observation.userId, result, {
        burden,
        constellation,
        observedPatterns,
        reflectionCopy,
        recordPayload,
      });
    } catch (persistError) {
      console.error("Atlas intelligence persistence failed (result still returned):", persistError);
    }

    return NextResponse.json({
      success: true,
      traceId: result.traceId,
      governance: result.governance,
      ...recordPayload,
    });
  } catch (error) {
    console.error("Atlas intelligence run failed:", error);
    return NextResponse.json({ error: "Atlas intelligence run failed" }, { status: 500 });
  }
}

async function persistRun(
  observationId: string,
  userId: string,
  result: RunResult,
  ui: {
    burden: string;
    constellation: unknown;
    observedPatterns: unknown;
    reflectionCopy: string[];
    recordPayload: unknown;
  },
) {
  const run = await prisma.atlasIntelligenceRun.create({
    data: {
      traceId: result.traceId,
      observationId,
      userId,
      pipelineVersion: "1.0.0",
      governancePassed: result.governance.passed,
      timings: {},
    },
  });

  await Promise.all([
    result.observations.length &&
      prisma.atlasObservationRow.createMany({
        data: result.observations.map((o) => ({
          runId: run.id,
          businessId: o.id,
          fieldId: o.fieldId,
          section: o.section,
          label: o.label,
          value: o.value,
          displayText: o.displayText,
          screenId: o.screenId || "",
        })),
      }),
    result.signals.length &&
      prisma.atlasSignalRow.createMany({
        data: result.signals.map((s) => ({
          runId: run.id,
          businessId: s.id,
          signalType: s.signalType,
          label: s.label,
          fieldId: s.fieldId,
          observationBusinessIds: s.observationIds,
        })),
      }),
    result.patterns.length &&
      prisma.atlasPatternRow.createMany({
        data: result.patterns.map((p) => ({
          runId: run.id,
          businessId: p.id,
          name: p.name,
          domain: p.domain,
          role: p.role,
          confidence: p.confidence,
          observationConfidence: p.observationConfidence,
          meaning: p.meaning,
          atlasNote: p.atlasNote,
          watchOverTime: p.watchOverTime,
        })),
      }),
    result.indices.length &&
      prisma.atlasIndexRow.createMany({
        data: result.indices.map((i) => ({
          runId: run.id,
          businessId: i.id,
          name: i.name,
          description: i.description,
          value: i.value,
          patternBusinessIds: i.patternIds,
        })),
      }),
    prisma.atlasReflectionPlanRow.create({
      data: {
        runId: run.id,
        traceId: result.traceId,
        archetypeId: result.planArchetype.id,
        archetypeName: result.planArchetype.name,
        tone: result.planArchetype.tone,
        plan: result.knowledgeContext as unknown as Prisma.InputJsonValue,
      },
    }),
    prisma.atlasReflectionRow.create({
      data: {
        runId: run.id,
        traceId: result.traceId,
        reflection: result.reflectionContent as unknown as Prisma.InputJsonValue,
        atlasRecord: result.atlasRecord as unknown as Prisma.InputJsonValue,
      },
    }),
    prisma.atlasExplainabilityRow.create({
      data: {
        runId: run.id,
        traceId: result.traceId,
        steps: result.explainability.steps as unknown as Prisma.InputJsonValue,
      },
    }),
    prisma.atlasGovernanceRow.create({
      data: {
        runId: run.id,
        passed: result.governance.passed,
        violations: result.governance.violations,
      },
    }),
  ]);

  // Participant-facing AtlasRecord (what the dashboard + record screens read).
  const reflectionSummary = {
    type: result.archetype.name,
    burden: ui.burden,
    archetype: result.archetype.name,
    paragraphs: ui.reflectionCopy,
    bodyLiteracyNote: result.atlasRecord.bodyLiteracyNote,
    disclaimer: result.atlasRecord.disclaimer,
    source: result.reflectionSource,
  };
  await prisma.atlasRecord.upsert({
    where: { observationId },
    create: {
      observationId,
      burdenLevel: ui.burden,
      reflection_summary: reflectionSummary as Prisma.InputJsonValue,
      constellation_scores: ui.constellation as Prisma.InputJsonValue,
      observed_patterns: ui.observedPatterns as Prisma.InputJsonValue,
      record_payload: ui.recordPayload as Prisma.InputJsonValue,
    },
    update: {
      burdenLevel: ui.burden,
      reflection_summary: reflectionSummary as Prisma.InputJsonValue,
      constellation_scores: ui.constellation as Prisma.InputJsonValue,
      observed_patterns: ui.observedPatterns as Prisma.InputJsonValue,
      record_payload: ui.recordPayload as Prisma.InputJsonValue,
    },
  });

  // Audit the generated Atlas Record + intelligence run (ties the trace to the
  // observation). Logged only after a successful persist.
  await logAuditEvent({
    entityId: observationId,
    entityType: "AtlasRecord",
    actionType: ActionType.CREATE,
    dataAfter: {
      traceId: result.traceId,
      runId: run.id,
      burdenLevel: ui.burden,
      reflectionSource: result.reflectionSource,
      governancePassed: result.governance.passed,
    },
    userId,
  });
}
