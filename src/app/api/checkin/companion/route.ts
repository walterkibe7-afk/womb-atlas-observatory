import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import {
  buildSignalQuestionContext,
  checkinDriverFieldIds,
  deriveTrackedSignals,
  type DriverQuestionMeta,
  type SignalQuestionContext,
} from "@/lib/observation/checkin";
import {
  generateCompanionTurn,
  type CompanionMessage,
  type CompanionTurn,
  type EvidencedDelta,
} from "@/lib/checkin/companion";
import { transcribeAudio } from "@/lib/media/stt";
import { synthesizeSpeech } from "@/lib/media/tts";
import type { AnswerMap } from "@/lib/observation/types";
import { v43Text } from "@/lib/observation/intelligence/v43/v43-i18n";

export const runtime = "nodejs";

async function resolveUser(): Promise<{ userId: string; locale: string | undefined } | null> {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return null;
  const exists = await prisma.user.findUnique({ where: { id: userId }, select: { id: true } });
  if (!exists) return null;
  return { userId, locale: session?.user?.locale ?? undefined };
}

function sanitizeHistory(raw: unknown): CompanionMessage[] {
  if (!Array.isArray(raw)) return [];
  const out: CompanionMessage[] = [];
  for (const m of raw) {
    if (typeof m !== "object" || m === null) continue;
    const rec = m as Record<string, unknown>;
    const role = rec.role === "model" ? "model" : rec.role === "user" ? "user" : null;
    const text = typeof rec.text === "string" ? rec.text.trim() : "";
    if (!role || !text) continue;
    out.push({ role, text });
  }
  // Keep the tail — the companion only needs recent context, and this bounds cost.
  return out.slice(-40);
}

/**
 * Mappings the client has already collected. The client is the source of truth
 * for the running transcript, so it also holds the deltas mapped so far; passing
 * them back lets a turn whose model output is unusable keep earlier progress
 * instead of restarting the check-in.
 */
function sanitizeDeltas(raw: unknown): EvidencedDelta[] {
  if (!Array.isArray(raw)) return [];
  const out: EvidencedDelta[] = [];
  for (const d of raw) {
    if (typeof d !== "object" || d === null) continue;
    const rec = d as Record<string, unknown>;
    const domain = typeof rec.domain === "string" ? rec.domain.trim() : "";
    const change = typeof rec.change === "string" ? rec.change.trim() : "";
    if (!domain || !change) continue;
    out.push({
      domain,
      label: typeof rec.label === "string" ? rec.label : "",
      change: change as EvidencedDelta["change"],
      evidenceQuote: typeof rec.evidenceQuote === "string" ? rec.evidenceQuote : "",
      sourceQuestion: typeof rec.sourceQuestion === "string" ? rec.sourceQuestion : "",
    });
  }
  return out;
}

/** Parse the two input modes; returns the running history, plus (for voice) the
 *  transcribed message to append and a flag that the reply should be spoken. */
async function readInput(
  req: Request,
  locale: string | undefined,
): Promise<
  | {
      ok: true;
      history: CompanionMessage[];
      priorDeltas: EvidencedDelta[];
      voiceTranscript?: string;
      wantsVoiceReply: boolean;
    }
  | { ok: false; status: number; error: string }
> {
  const contentType = req.headers.get("content-type") ?? "";

  if (contentType.includes("multipart/form-data")) {
    const form = await req.formData();
    const audio = form.get("audio");
    const historyRaw = form.get("history");
    const deltasRaw = form.get("deltas");
    let history: CompanionMessage[] = [];
    let priorDeltas: EvidencedDelta[] = [];
    try {
      history = sanitizeHistory(typeof historyRaw === "string" ? JSON.parse(historyRaw) : []);
    } catch {
      history = [];
    }
    try {
      priorDeltas = sanitizeDeltas(typeof deltasRaw === "string" ? JSON.parse(deltasRaw) : []);
    } catch {
      priorDeltas = [];
    }
    if (!(audio instanceof Blob)) return { ok: false, status: 400, error: "audio is required" };
    if (audio.size > 10 * 1024 * 1024) {
      return {
        ok: false,
        status: 413,
        error: v43Text("_template", "voiceMessageTooLarge", "Voice message is too large (max 10MB).", locale),
      };
    }
    const buffer = Buffer.from(await audio.arrayBuffer());
    const { transcription } = await transcribeAudio(buffer, audio.type || "audio/webm");
    if (!transcription?.trim()) {
      return {
        ok: false,
        status: 422,
        error: v43Text(
          "_template",
          "couldNotMakeOutVoice",
          "Couldn't make out that voice message — please try again or type instead.",
          locale,
        ),
      };
    }
    const voiceTranscript = transcription.trim();
    return {
      ok: true,
      history: [...history, { role: "user", text: voiceTranscript }],
      priorDeltas,
      voiceTranscript,
      wantsVoiceReply: true,
    };
  }

  const body = (await req.json().catch(() => ({}))) as { history?: unknown; deltas?: unknown };
  return {
    ok: true,
    history: sanitizeHistory(body.history),
    priorDeltas: sanitizeDeltas(body.deltas),
    wantsVoiceReply: false,
  };
}

/**
 * POST /api/checkin/companion — one structured turn of the Atlas Check-In
 * Companion. Stateless: the client holds the transcript and sends it back each
 * turn. Derives the participant's tracked signals server-side (authoritative),
 * asks the model for the next warm question + its running per-signal mapping, and
 * returns { turn, trackedSignals }. Nothing is submitted here — the client shows
 * the Observatory Briefing on `turn.done` and confirms before /api/checkin runs.
 *
 * Two input modes:
 *   - JSON: { history: { role: "user" | "model"; text: string }[] } — typed text.
 *   - multipart/form-data: { audio: Blob, history: string } — a voice answer.
 *     Transcribed server-side; the transcript is echoed back (so the UI can show
 *     what was heard) and the reply is also returned as inline base64 TTS audio.
 */
export async function POST(req: Request) {
  let locale: string | undefined;
  try {
    const resolved = await resolveUser();
    if (!resolved) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
    const { userId } = resolved;
    locale = resolved.locale;

    const input = await readInput(req, locale);
    if (!input.ok) return NextResponse.json({ error: input.error }, { status: input.status });
    const { history, priorDeltas, voiceTranscript, wantsVoiceReply } = input;

    const [user, observations] = await Promise.all([
      prisma.user.findUnique({ where: { id: userId }, select: { name: true } }),
      prisma.observation.findMany({
        where: { userId, atlasRecord: { isNot: null } },
        include: { atlasRecord: true, safety: true },
        orderBy: { startedAt: "asc" },
      }),
    ]);

    if (observations.length === 0) {
      return NextResponse.json(
        { error: v43Text("_template", "noPriorAtlasRecord", "No prior Atlas Record to check in against", locale) },
        { status: 400 },
      );
    }

    const latest = observations[observations.length - 1];
    const rawFlags = latest.safety?.safety_flags;
    const latestSafetyFlags = Array.isArray(rawFlags)
      ? rawFlags.filter((f): f is string => typeof f === "string")
      : [];
    const trackedSignals = deriveTrackedSignals(
      observations.map((o) => o.atlasRecord!),
      { latestSafetyFlags, locale },
    );

    // Build the grounded question context: the participant's ACTUAL last answers
    // to the observation questions that flagged each tracked signal, so the
    // companion revisits those instead of asking generic questions. Uses the same
    // prior observation the /api/checkin delta pipeline clones (most recent with a
    // record), so what's asked and what's nudged stay in lock-step.
    let questionContext: SignalQuestionContext[] = [];
    if (trackedSignals.length > 0) {
      const domains = trackedSignals.map((s) => s.domain);
      const fieldIds = checkinDriverFieldIds(domains);
      const [priorObs, questions] = await Promise.all([
        prisma.observation.findFirst({
          where: { userId, atlasRecord: { isNot: null } },
          include: { responses: true },
          orderBy: { startedAt: "desc" },
        }),
        prisma.formQuestion.findMany({
          where: { fieldId: { in: fieldIds } },
          select: {
            fieldId: true,
            questionText: true,
            options: { select: { value: true, label: true } },
          },
        }),
      ]);

      const priorAnswers: AnswerMap = {};
      for (const r of priorObs?.responses ?? []) priorAnswers[r.fieldId] = r.value as AnswerMap[string];
      const meta = new Map<string, DriverQuestionMeta>(
        questions.map((q) => [q.fieldId, { questionText: q.questionText, options: q.options }]),
      );
      questionContext = buildSignalQuestionContext(domains, priorAnswers, meta);
    }

    let turn: CompanionTurn;
    if (trackedSignals.length === 0) {
      // No strong signals to walk through — go straight to "any new developments?"
      // so the participant can still record a check-in from a free-text note.
      turn = {
        reply: v43Text(
          "_template",
          "companionNoSignalsWelcome",
          "Welcome back. Your last record didn't carry any strong ongoing signals, so let's keep it simple — has anything new come up for you since then?",
          locale,
        ),
        done: history.some((m) => m.role === "user"),
        note: history.filter((m) => m.role === "user").map((m) => m.text).join(" ").trim(),
        deltas: [],
      };
    } else {
      turn = await generateCompanionTurn(
        trackedSignals,
        history,
        user?.name,
        questionContext,
        priorDeltas,
        locale,
      );
    }

    // Voice-originated turn -> synthesize the reply and return it inline (base64
    // data). A check-in conversation is transient, so we don't persist clips the
    // way Aminata does; the client plays the reply from the data URI directly.
    let replyAudio: { base64: string; mimeType: string } | undefined;
    if (wantsVoiceReply && turn.reply) {
      try {
        const { audio, mimeType } = await synthesizeSpeech(turn.reply);
        if (audio) replyAudio = { base64: audio.toString("base64"), mimeType };
      } catch (ttsError) {
        console.error("Companion voice reply synthesis failed (text still returned):", ttsError);
      }
    }

    return NextResponse.json({ turn, trackedSignals, transcript: voiceTranscript, replyAudio });
  } catch (error) {
    console.error("Check-in companion turn failed:", error);
    return NextResponse.json(
      { error: v43Text("_template", "companionUnavailable", "Companion is unavailable right now.", locale) },
      { status: 500 },
    );
  }
}
