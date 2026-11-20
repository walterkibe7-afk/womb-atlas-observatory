import { NextResponse } from "next/server";
import { ActionType, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { logAuditEvent } from "@/lib/audit-logger";
import { computeSignals } from "@/lib/observation/signals";
import { selectReflection } from "@/lib/observation/reflection";
import type {
  AnswerMap,
  Condition,
  ReflectionRuleDef,
  SignalRuleDef,
} from "@/lib/observation/types";

const SEVERITY_SCORE: Record<string, number> = { high: 2, moderate: 1, low: 0.5 };

// Spec constellation domains (S80). Signal `domain` strings are normalised onto these.
const CONSTELLATION_DOMAINS = [
  "Bleeding",
  "Pain",
  "Hormonal",
  "Cycle",
  "Daily Life",
  "Care Access",
] as const;

function domainOf(signalDomain: string): string {
  const d = signalDomain.toLowerCase();
  if (d.includes("bleed")) return "Bleeding";
  if (d.includes("pain") || d.includes("sensitive")) return "Pain";
  if (d.includes("hormon")) return "Hormonal";
  if (d.includes("cycle")) return "Cycle";
  if (d.includes("daily") || d.includes("safety")) return "Daily Life";
  if (d.includes("care")) return "Care Access";
  return "Daily Life";
}

/**
 * POST /api/observation/reflection — finalize an observation.
 * Body: { observationId }
 * Computes signals + burden + reflection from the DB rule rows, persists Signal
 * rows and the AtlasRecord, saves narratives, and returns the reflection payload.
 */
export async function POST(req: Request) {
  try {
    const { observationId } = (await req.json()) as { observationId: string };
    if (!observationId) {
      return NextResponse.json({ error: "observationId required" }, { status: 400 });
    }

    // Rebuild the answer map from canonical responses.
    const responses = await prisma.observationResponse.findMany({ where: { observationId } });
    const answers: AnswerMap = {};
    for (const r of responses) answers[r.fieldId] = r.value as AnswerMap[string];

    // Load rules and run the deterministic engine.
    const [signalRows, reflectionRows] = await Promise.all([
      prisma.signalRule.findMany(),
      prisma.reflectionRule.findMany({ orderBy: { priority: "asc" } }),
    ]);
    const signalRules: SignalRuleDef[] = signalRows.map((r) => ({
      signalId: r.signalId,
      name: r.name,
      domain: r.domain,
      sourceScreen: r.sourceScreen,
      severity: r.severity as SignalRuleDef["severity"],
      condition: r.condition as Condition,
    }));
    const reflectionRules: ReflectionRuleDef[] = reflectionRows.map((r) => ({
      ruleId: r.ruleId,
      condition: r.condition as Condition,
      reflectionType: r.reflectionType,
      templateCopy: r.templateCopy,
      targetScreen: r.targetScreen,
      priority: r.priority,
    }));

    const signals = computeSignals(answers, signalRules);
    const reflection = selectReflection(signals, reflectionRules);

    // Constellation domain scores (0-4) + observed pattern cards.
    const constellation = CONSTELLATION_DOMAINS.map((domain) => {
      const inDomain = signals.filter((s) => domainOf(s.domain) === domain);
      const raw = inDomain.reduce((sum, s) => sum + (SEVERITY_SCORE[s.severity] ?? 0), 0);
      return { domain, score: Math.min(4, Math.round(raw)), evidenceCount: inDomain.length };
    });
    const observedPatterns = CONSTELLATION_DOMAINS.map((domain) => ({
      domain,
      signals: signals.filter((s) => domainOf(s.domain) === domain).map((s) => s.name),
    })).filter((p) => p.signals.length > 0);

    // Persist signals (replace) + AtlasRecord (upsert).
    await prisma.signal.deleteMany({ where: { observationId } });
    if (signals.length) {
      await prisma.signal.createMany({
        data: signals.map((s) => ({
          observationId,
          signalId: s.signalId,
          domain: s.domain,
          severity: s.severity,
          evidence: s.evidence as Prisma.InputJsonValue,
        })),
      });
    }

    const reflectionSummary = {
      type: reflection.reflectionType,
      burden: reflection.burden,
      targetScreen: reflection.targetScreen,
      paragraphs: reflection.copy,
      matchedRules: reflection.matchedRuleIds,
      disclaimer:
        "This Atlas Record is observational and reflective. It is not a diagnosis.",
    };

    await prisma.atlasRecord.upsert({
      where: { observationId },
      create: {
        observationId,
        burdenLevel: reflection.burden,
        reflection_summary: reflectionSummary,
        constellation_scores: constellation,
        observed_patterns: observedPatterns,
      },
      update: {
        burdenLevel: reflection.burden,
        reflection_summary: reflectionSummary,
        constellation_scores: constellation,
        observed_patterns: observedPatterns,
      },
    });

    // Save narrative TEXT captured under prompt ids (NP01..NP05 / SNP01). Audio +
    // transcription are written separately by the narrative upload endpoint, so we
    // only set textResponse here and never clobber the audio fields.
    for (const [key, value] of Object.entries(answers)) {
      if (!/^(NP|SNP)\d+$/.test(key)) continue;
      const text =
        typeof value === "string"
          ? value
          : value && typeof value === "object" && !Array.isArray(value)
            ? (value as { text?: string }).text
            : undefined;
      if (typeof text === "string" && text.trim()) {
        await prisma.narrative.upsert({
          where: { observationId_promptId: { observationId, promptId: key } },
          create: { observationId, promptId: key, textResponse: text, status: "completed" },
          update: { textResponse: text },
        });
      }
    }

    const finalized = await prisma.observation.update({
      where: { id: observationId },
      data: { status: "reflection_generated", completedAt: new Date() },
      select: { userId: true },
    });

    await logAuditEvent({
      entityId: observationId,
      entityType: "AtlasRecord",
      actionType: ActionType.UPDATE,
      dataAfter: {
        status: "reflection_generated",
        burdenLevel: reflection.burden,
        reflectionType: reflection.reflectionType,
        signalCount: signals.length,
      },
      userId: finalized.userId,
    });

    return NextResponse.json({
      success: true,
      observationId,
      burden: reflection.burden,
      reflectionType: reflection.reflectionType,
      reflectionCopy: reflection.copy,
      targetScreen: reflection.targetScreen,
      signals: signals.map((s) => ({ signalId: s.signalId, name: s.name, domain: s.domain, severity: s.severity })),
      constellation,
      observedPatterns,
    });
  } catch (error) {
    console.error("Failed to finalize observation:", error);
    return NextResponse.json({ error: "Failed to finalize" }, { status: 500 });
  }
}
