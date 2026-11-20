import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";

// Deferred tab payload for one Atlas Record. Split from the queue endpoint so
// selecting a record loads its heavy detail (responses, audit, timeline) lazily.

type NarrativeAnswerShape = { text?: string; audioUrl?: string };

function displayId(id: string, year: number) {
  return `WA-${year}-${id.slice(-5).toUpperCase()}`;
}

/** Server-side twin of the wizard's displayAnswer: map option codes -> labels. */
function displayAnswer(
  value: unknown,
  options: { value: string; label: string }[],
): { text: string; isNarrative: boolean } {
  const label = (v: string) => options.find((o) => o.value === v)?.label ?? v;
  if (Array.isArray(value)) return { text: value.map((v) => label(String(v))).join(", "), isNarrative: false };
  if (typeof value === "boolean") return { text: value ? "Yes" : "No", isNarrative: false };
  if (value && typeof value === "object") {
    const n = value as NarrativeAnswerShape;
    return { text: n.text?.trim() || (n.audioUrl ? "Audio response saved" : ""), isNarrative: true };
  }
  if (value == null || value === "") return { text: "", isNarrative: false };
  return { text: label(String(value)), isNarrative: false };
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  const role = (session?.user as { role?: string } | undefined)?.role;
  if (role !== "steward") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const { id } = await params;

    const record = await prisma.atlasRecord.findUnique({
      where: { id },
      include: {
        observation: {
          include: {
            user: { select: { id: true, name: true } },
            responses: true,
            narratives: true,
            stewardReview: { include: { steward: { select: { name: true } } } },
            atlasRuns: {
              orderBy: { createdAt: "desc" },
              take: 1,
              include: { patterns: true, signals: true, governance: true },
            },
          },
        },
      },
    });

    if (!record || !record.observation) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const obs = record.observation;
    const run = obs.atlasRuns[0];

    // -- Form metadata (labels + screen grouping) ---------------------------
    const [questions, screens, prompts] = await Promise.all([
      prisma.formQuestion.findMany({ include: { options: true } }),
      prisma.formScreen.findMany({ select: { screenId: true, name: true, section: true, order: true } }),
      prisma.narrativePrompt.findMany({ select: { promptId: true, promptText: true } }),
    ]);
    const questionByField = new Map(questions.map((q) => [q.fieldId, q]));
    const screenById = new Map(screens.map((s) => [s.screenId, s]));
    const promptText = new Map(prompts.map((p) => [p.promptId, p.promptText]));

    // -- Observations (structured responses, grouped by screen) -------------
    const groups = new Map<
      string,
      { screenId: string; screenName: string; section: string; order: number; items: { fieldId: string; label: string; value: string; order: number }[] }
    >();
    for (const r of obs.responses) {
      const q = questionByField.get(r.fieldId);
      if (!q) continue; // narrative prompts / unmapped fields aren't structured answers
      const shown = displayAnswer(r.value, q.options);
      if (shown.isNarrative || !shown.text) continue; // narrative handled separately
      const screen = screenById.get(q.screenId);
      const key = q.screenId;
      if (!groups.has(key)) {
        groups.set(key, {
          screenId: q.screenId,
          screenName: screen?.name ?? q.screenId,
          section: screen?.section ?? "",
          order: screen?.order ?? 9999,
          items: [],
        });
      }
      groups.get(key)!.items.push({ fieldId: q.fieldId, label: q.questionText, value: shown.text, order: q.order });
    }
    const observations = [...groups.values()]
      .sort((a, b) => a.order - b.order)
      .map((g) => ({
        screenId: g.screenId,
        screenName: g.screenName,
        section: g.section,
        items: g.items.sort((a, b) => a.order - b.order).map(({ fieldId, label, value }) => ({ fieldId, label, value })),
      }));

    // -- Narrative (merge audio/transcription rows with typed text) ---------
    // Rewrite the stored (participant-gated) audio path to the steward route so
    // reviewers can play it back: only the file name is portable between routes.
    const stewardAudioUrl = (stored: string | null | undefined) =>
      stored ? `/api/steward/narrative-audio/${stored.split("/").pop()}` : null;

    const narrativeByPrompt = new Map<
      string,
      { promptId: string; promptText: string | null; text: string | null; transcription: string | null; audioUrl: string | null; language: string | null; status: string }
    >();
    for (const n of obs.narratives) {
      narrativeByPrompt.set(n.promptId, {
        promptId: n.promptId,
        promptText: promptText.get(n.promptId) ?? null,
        text: n.textResponse ?? null,
        transcription: n.transcription ?? null,
        audioUrl: n.audioUrl ?? null,
        language: n.language ?? null,
        status: n.status,
      });
    }
    // Typed narrative text lives in ObservationResponse under NP##/SNP## keys.
    for (const r of obs.responses) {
      if (!/^(NP|SNP)\d+$/.test(r.fieldId)) continue;
      const v = r.value as NarrativeAnswerShape | string | null;
      const text = typeof v === "string" ? v : v && typeof v === "object" ? v.text ?? null : null;
      const audio = v && typeof v === "object" ? v.audioUrl ?? null : null;
      const existing = narrativeByPrompt.get(r.fieldId);
      if (existing) {
        if (text && text.trim()) existing.text = text;
        if (!existing.audioUrl && audio) existing.audioUrl = audio;
      } else if ((text && text.trim()) || audio) {
        narrativeByPrompt.set(r.fieldId, {
          promptId: r.fieldId,
          promptText: promptText.get(r.fieldId) ?? null,
          text: text && text.trim() ? text : null,
          transcription: null,
          audioUrl: audio,
          language: null,
          status: "completed",
        });
      }
    }
    const narratives = [...narrativeByPrompt.values()]
      .sort((a, b) => a.promptId.localeCompare(b.promptId))
      .map((n) => ({
        promptId: n.promptId,
        promptText: n.promptText,
        text: n.text,
        transcription: n.transcription,
        hasAudio: Boolean(n.audioUrl),
        audioUrl: stewardAudioUrl(n.audioUrl),
        language: n.language,
        status: n.status,
      }));

    // -- Signals (patterns = meaning; raw signals = source fields) ----------
    const signals = (run?.patterns ?? [])
      .slice()
      .sort((a, b) => b.observationConfidence - a.observationConfidence)
      .map((p) => ({
        id: p.businessId,
        name: p.name,
        domain: p.domain,
        role: p.role,
        confidence: p.confidence,
        meaning: p.meaning,
        atlasNote: p.atlasNote,
        watchOverTime: p.watchOverTime,
      }));
    const sourceSignals = (run?.signals ?? []).map((s) => ({
      id: s.businessId,
      label: s.label,
      signalType: s.signalType,
      fieldId: s.fieldId,
    }));

    // -- History (record created, intelligence run, steward review, audit) --
    const auditRows = await prisma.auditLog.findMany({
      where: { entityId: { in: [record.id, obs.id] } },
      orderBy: { timestamp: "desc" },
      take: 50,
    });
    const history: { id: string; type: "created" | "run" | "reviewed" | "audit"; label: string; detail: string | null; at: string }[] = [];
    history.push({
      id: `rec-${record.id}`,
      type: "created",
      label: "Atlas Record created",
      detail: record.burdenLevel ? `Burden level: ${record.burdenLevel}` : null,
      at: record.createdAt.toISOString(),
    });
    if (run) {
      history.push({
        id: `run-${run.id}`,
        type: "run",
        label: "Atlas Intelligence run",
        detail: `Pipeline ${run.pipelineVersion} · governance ${run.governancePassed ? "passed" : "flagged"}`,
        at: run.createdAt.toISOString(),
      });
    }
    if (obs.stewardReview) {
      const sr = obs.stewardReview;
      history.push({
        id: `review-${sr.id}`,
        type: "reviewed",
        label: `Steward review — ${sr.status}`,
        detail: sr.steward?.name ? `by ${sr.steward.name}` : null,
        at: sr.reviewedAt.toISOString(),
      });
    }
    for (const a of auditRows) {
      history.push({
        id: `audit-${a.id}`,
        type: "audit",
        label: `${a.actionType} ${a.entityType}`,
        detail: null,
        at: a.timestamp.toISOString(),
      });
    }
    history.sort((a, b) => (a.at < b.at ? 1 : -1));

    // -- Timeline (this contributor's records over time) --------------------
    const sibling = await prisma.atlasRecord.findMany({
      where: { observation: { userId: obs.user?.id } },
      orderBy: { createdAt: "asc" },
      include: { observation: { select: { flowKey: true } } },
    });
    const timeline = sibling.map((s) => ({
      id: s.id,
      displayId: displayId(s.id, s.createdAt.getFullYear()),
      burdenLevel: s.burdenLevel ?? "Low",
      submittedAt: s.createdAt.toISOString(),
      source: s.observation?.flowKey === "atlas_checkin" ? "Atlas Check-In" : "Observatory Session",
      isCurrent: s.id === record.id,
    }));

    const reflection = record.reflection_summary as { source?: string } | null;

    return NextResponse.json({
      detail: {
        id: record.id,
        narratives,
        observations,
        signals,
        sourceSignals,
        history,
        timeline,
        meta: {
          traceId: run?.traceId ?? null,
          pipelineVersion: run?.pipelineVersion ?? null,
          governancePassed: run?.governancePassed ?? null,
          reflectionSource: reflection?.source ?? null,
        },
      },
    });
  } catch (error) {
    console.error("Failed to load steward record detail:", error);
    return NextResponse.json({ error: "Failed to load record detail" }, { status: 500 });
  }
}
