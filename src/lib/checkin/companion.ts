// The Atlas Check-In Companion: a warm, structured agent that walks a participant
// through how each of their previously-tracked signals has evolved, and maps their
// free-text answers to a bounded CheckinChange per signal — capturing the
// participant's own words as evidence ("why Atlas believes it").
//
// This is a SEPARATE agent from Aminata (the open-ended chat companion). Its only
// job is to produce EvidencedDelta[] the existing check-in pipeline consumes:
// applyCheckinDeltas() -> /api/checkin -> /api/observation/intelligence. It never
// submits anything itself — the participant reviews/overrides the mapping in the
// Observatory Briefing before the record regenerates (confirm-then-submit).
import { Type, type Schema } from "@google/genai";
import { generateContent } from "@/lib/gemini";
import { languageInstruction } from "@/lib/ai/language-instruction";
import { v43Text } from "@/lib/observation/intelligence/v43/v43-i18n";
import type {
  CheckinChange,
  SignalQuestionContext,
  TrackedSignal,
} from "@/lib/observation/checkin";

const VALID_CHANGES: readonly CheckinChange[] = ["worsened", "no_change", "improved", "resolved"];

/** A per-signal change enriched with the evidence that produced it. */
export interface EvidencedDelta {
  domain: string;
  label: string;
  change: CheckinChange;
  /** The participant's own words that led to this mapping (verbatim, trimmed). */
  evidenceQuote: string;
  /** The companion's question that elicited the answer. */
  sourceQuestion: string;
}

/** One structured turn from the companion. */
export interface CompanionTurn {
  /** The warm message shown to the participant (a question, or a wrap-up). */
  reply: string;
  /** True once every tracked signal has been assessed and deltas are ready. */
  done: boolean;
  /** Free-text "new developments" note to carry into the check-in. */
  note: string;
  /** The companion's current best mapping for signals it is confident about. */
  deltas: EvidencedDelta[];
}

export interface CompanionMessage {
  role: "user" | "model";
  text: string;
}

const MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash";

/** JSON schema constraining the companion's structured output to valid domains + changes. */
export function checkinResponseSchema(domains: string[]): Schema {
  return {
    type: Type.OBJECT,
    properties: {
      reply: {
        type: Type.STRING,
        description: "The warm, conversational message to show the participant this turn.",
      },
      done: {
        type: Type.BOOLEAN,
        description: "True only once every tracked signal has been discussed and mapped.",
      },
      note: {
        type: Type.STRING,
        description: "A short summary of any NEW developments the participant raised, or an empty string.",
      },
      deltas: {
        type: Type.ARRAY,
        description: "Per-signal change mappings for domains assessed so far.",
        items: {
          type: Type.OBJECT,
          properties: {
            domain: { type: Type.STRING, enum: domains },
            change: { type: Type.STRING, enum: [...VALID_CHANGES] },
            evidenceQuote: {
              type: Type.STRING,
              description: "The participant's own words that support this change (verbatim, brief).",
            },
            sourceQuestion: {
              type: Type.STRING,
              description: "The question you asked that elicited this answer.",
            },
          },
          required: ["domain", "change", "evidenceQuote", "sourceQuestion"],
          propertyOrdering: ["domain", "change", "evidenceQuote", "sourceQuestion"],
        },
      },
    },
    required: ["reply", "done", "note", "deltas"],
    propertyOrdering: ["reply", "done", "note", "deltas"],
  };
}

/** Render the grounded observation questions (with prior answers + rule
 *  direction) the companion should revisit, one block per tracked signal. */
function renderQuestionContext(context: SignalQuestionContext[]): string {
  if (!context.length) return "";
  const blocks = context.map((c) => {
    if (!c.questions.length) {
      return `### ${c.domain}\nNo specific answer is currently flagged here — gently check whether this signal has come back since last time.`;
    }
    const lines = c.questions
      .map((q) => {
        const heavier = q.heavierAnswers.length ? q.heavierAnswers.join(", ") : "(n/a)";
        const lighter = q.lighterAnswers.length ? q.lighterAnswers.join(", ") : "(n/a)";
        const options = q.answerOptions.length ? q.answerOptions.join(" / ") : "(free text)";
        return `- Original question: "${q.questionText}"\n  Their last answer: "${q.priorAnswer}"\n  Possible answers to offer: ${options}\n  (Heavier/worse now if: ${heavier} — Lighter/eased now if: ${lighter})`;
      })
      .join("\n");
    return `### ${c.domain}\nThese specific answers flagged this signal last time — ask how each has changed since:\n${lines}`;
  });
  return blocks.join("\n\n");
}

/** System prompt: a warm midwife-style guide that maps answers to bounded changes. */
export function buildCheckinSystemPrompt(
  trackedSignals: TrackedSignal[],
  userName?: string | null,
  questionContext: SignalQuestionContext[] = [],
  locale?: string,
): string {
  const greeting = userName ? `The participant's name is ${userName}.` : "";

  const signalLines = trackedSignals
    .map((s) => {
      const evidence = s.evidence?.length ? ` (baseline observed because: ${s.evidence.join("; ")})` : "";
      const urgent = s.urgentMarker ? " [URGENT MARKER active in last record]" : "";
      return `- ${s.domain}: "${s.label}", currently ${s.severity} intensity${evidence}${urgent}`;
    })
    .join("\n");

  const questionBlock = renderQuestionContext(questionContext);

  return `${languageInstruction(locale)}You are the Atlas Check-In Companion, a warm, compassionate midwife-style guide within the Womb Atlas Observatory. You help a returning participant reflect on how their previously-tracked signals have evolved since their last observation.

${greeting}

## Your Goal
Guide a short, gentle conversation covering EACH tracked signal below, one at a time. For every signal, understand whether it has Worsened, stayed the same (No Change), Improved, or Resolved since last time — based on the participant's own words. Also capture any NEW developments they mention.

## Previously Tracked Signals
${signalLines || "- (No strong signals were tracked last time — focus on any new developments.)"}
${
  questionBlock
    ? `
## Grounded Questions — revisit the participant's ACTUAL last answers
For each signal below, DO NOT ask a generic "how has your X been?" question. Instead, base your question on the participant's ORIGINAL observation question(s) and their own last answer, then ask what has changed. Reference their prior answer naturally, e.g. "Last time you mentioned <their last answer> — how is that now?". Ask about ONE signal per turn using its question(s) here. Use the heavier/lighter hints to judge which change to map — but always ground the mapping in the participant's own words, never in the raw option codes.

ALWAYS offer a few possible answers inline so the participant can reply with a quick choice instead of composing a sentence. Pick 2–4 of the "Possible answers to offer" for that question (favour their last answer plus a lighter and a heavier option), and present them conversationally, e.g. "— would you say it's about the same, easier, or heavier now? (e.g. Never / Occasionally / Frequently)". Keep it warm and short; they can still answer freely.

${questionBlock}
`
    : ""
}
## How to Map Answers
For each signal, decide exactly one change:
- "worsened" — the experience is more intense, more frequent, or more disruptive than before.
- "no_change" — roughly the same as last time.
- "improved" — less intense, less frequent, or less disruptive (but still present).
- "resolved" — the participant says it is essentially gone.

### Interpret generously — do not make them repeat themselves
The participant is having a conversation, not filling in a form. Accept the
answer and map it whenever their meaning is reasonably clear:
- A bare word or fragment ("frequently", "about the same", "a bit better", "yeah",
  "worse I think") is a complete answer to the question you just asked. Map it.
- Match loosely to the offered options: near-matches, synonyms, paraphrases,
  partial words, plurals, typos and different casing all count. "heavier",
  "more often", "every day" all map to worsened for a frequency question.
- The participant never has to use your exact wording or the option text. If
  they describe it in their own words, map that.
- If they answer more than one signal at once, map them all in this turn.
- If they answer a signal you have not asked about yet, take it and skip ahead.
- Only ask again when you genuinely cannot tell the direction — and when you do,
  ask a simple either/or ("would you say that's easier or harder than last
  time?") rather than repeating the original question. Never say you did not
  understand; never ask the same question twice in a row.
- If an answer is ambiguous but leans one way, map it and reflect your reading
  back in the reply so they can correct you ("sounds a bit heavier than last
  time — I've noted that") rather than blocking the conversation on it.
When you have mapped a signal, add it to "deltas" with the participant's own words as "evidenceQuote" and the question you asked as "sourceQuestion". Carry forward deltas from earlier turns — the "deltas" array should always contain every signal you have mapped so far.

## Conversation Rules
- Ask about ONE signal per turn. Keep "reply" to 1-3 short sentences, warm and plain-language.
- Open your first turn with a brief welcome, then ask about the first (highest-intensity) signal, grounded in its question above.
- If a signal carries an URGENT MARKER, gently check whether that urgent symptom is still happening; if the participant reports an active emergency-type symptom, encourage them to contact a healthcare provider — never diagnose.
- Set "done" to true ONLY after every tracked signal has a mapped change AND you have asked whether anything new has come up. On that final turn, "reply" should warmly summarize what you heard and invite them to review.
- Put any new developments into "note".

## Absolute Rules (never break)
1. NEVER diagnose, predict disease, or name a condition. Use observational language only.
2. NEVER say "you have..." or "this could be [condition]".
3. NEVER minimize or dismiss what the participant shares.
4. NEVER show confidence scores or medical risk levels.

Respond ONLY with the structured JSON object defined by the schema.`;
}

/** Lowercase, strip everything that isn't a letter or digit. */
const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

/**
 * Resolve whatever the model called a domain onto one we actually track.
 *
 * The schema constrains `domain` to an enum, but models still return casing and
 * punctuation variants ("Daily life", "daily-life", "Care Access "). An exact
 * `Map.has` lookup dropped those deltas silently, so the signal never got
 * mapped, the companion asked about it again, and the participant saw the same
 * question after answering it correctly.
 */
function resolveDomain(value: unknown, tracked: string[]): string | null {
  if (typeof value !== "string" || !value.trim()) return null;
  const want = norm(value);
  if (!want) return null;
  const exact = tracked.find((d) => norm(d) === want);
  if (exact) return exact;
  // "Daily Life Impact" -> "Daily Life", "care" -> "Care Access".
  const partial = tracked.filter((d) => norm(d).includes(want) || want.includes(norm(d)));
  return partial.length === 1 ? partial[0] : null;
}

/** Words models reach for instead of the four governed change values. */
const CHANGE_SYNONYMS: Record<string, CheckinChange> = {
  worse: "worsened", worsening: "worsened", increased: "worsened", heavier: "worsened",
  same: "no_change", nochange: "no_change", unchanged: "no_change", stable: "no_change",
  better: "improved", improving: "improved", easier: "improved", lighter: "improved",
  gone: "resolved", resolve: "resolved", ended: "resolved", stopped: "resolved",
};

function coerceChange(value: unknown): CheckinChange | null {
  if (typeof value !== "string") return null;
  const n = norm(value);
  const direct = (VALID_CHANGES as readonly string[]).find((v) => norm(v) === n);
  if (direct) return direct as CheckinChange;
  return CHANGE_SYNONYMS[n] ?? null;
}

/**
 * Pull a JSON object out of a model response that may not be clean JSON.
 *
 * Handles the three ways this fails in practice: a ```json fence, prose either
 * side of the object, and truncation when the turn runs into the output token
 * budget (the deltas array grows every turn, so late turns are the ones that
 * get cut). Truncation is repaired by closing any open string and unwound
 * brackets, which recovers the reply and the deltas completed before the cut.
 */
function extractJsonObject(raw: string): unknown {
  const text = raw.replace(/^\s*```(?:json)?/i, "").replace(/```\s*$/, "").trim();
  const start = text.indexOf("{");
  if (start === -1) return null;

  const direct = text.slice(start);

  // Walk the object, tracking strings and nesting. If depth returns to zero the
  // object is complete and anything after it is commentary to be discarded; if
  // it never does, the response was cut short and needs closing.
  let inString = false;
  let escaped = false;
  const stack: string[] = [];
  let endIndex = -1;
  for (let i = 0; i < direct.length; i++) {
    const ch = direct[i];
    if (escaped) { escaped = false; continue; }
    if (ch === "\\") { escaped = true; continue; }
    if (ch === '"') { inString = !inString; continue; }
    if (inString) continue;
    if (ch === "{" || ch === "[") stack.push(ch === "{" ? "}" : "]");
    else if (ch === "}" || ch === "]") {
      stack.pop();
      if (stack.length === 0) { endIndex = i; break; }
    }
  }

  if (endIndex !== -1) {
    try {
      return JSON.parse(direct.slice(0, endIndex + 1));
    } catch {
      return null;
    }
  }

  let repaired = direct;
  if (inString) repaired += '"';
  // Drop a dangling key or comma the cut may have left behind.
  repaired = repaired.replace(/,\s*("[^"]*"\s*:?\s*)?$/, "");
  while (stack.length) repaired += stack.pop();
  try {
    return JSON.parse(repaired);
  } catch {
    return null;
  }
}

/**
 * Parse + validate a raw model JSON string into a safe CompanionTurn.
 *
 * `priorDeltas` are the mappings already established earlier in the
 * conversation. A turn that fails to parse used to return an empty delta list,
 * which threw away every signal mapped so far — and because the usual cause
 * (output truncation) recurs on the next turn too, the check-in could never
 * reach `done` and the participant was asked the same questions indefinitely.
 * Prior mappings are now carried forward and only overwritten by a fresh
 * mapping for the same domain.
 */
export function parseCompanionTurn(
  raw: string,
  trackedSignals: TrackedSignal[],
  priorDeltas: EvidencedDelta[] = [],
  locale?: string,
): CompanionTurn {
  const labelByDomain = new Map(trackedSignals.map((s) => [s.domain, s.label] as const));
  const domains = trackedSignals.map((s) => s.domain);

  // Seed with what is already known, so a bad turn costs a turn, not the session.
  const byDomain = new Map<string, EvidencedDelta>();
  for (const d of priorDeltas) {
    if (labelByDomain.has(d.domain)) byDomain.set(d.domain, d);
  }

  // The participant answered fine — this is our end that failed, so the copy no
  // longer implies they were unclear or asks them to repeat themselves. This
  // bypasses the model entirely (its own output is what failed to parse), so it
  // needs its own translation rather than relying on languageInstruction.
  const fallbackReply = v43Text(
    "_template",
    "companionFallbackReply",
    "Sorry — that one didn't come through on my end. Could you say a little more about how you've been feeling?",
    locale,
  );

  const parsed = extractJsonObject(raw);
  if (typeof parsed !== "object" || parsed === null) {
    return { reply: fallbackReply, done: false, note: "", deltas: [...byDomain.values()] };
  }
  const obj = parsed as Record<string, unknown>;

  // Keep only deltas that resolve to a tracked domain; dedupe by domain (last wins).
  if (Array.isArray(obj.deltas)) {
    for (const d of obj.deltas) {
      if (typeof d !== "object" || d === null) continue;
      const rec = d as Record<string, unknown>;
      const domain = resolveDomain(rec.domain, domains);
      const change = coerceChange(rec.change);
      if (!change || !domain) continue;
      byDomain.set(domain, {
        domain,
        label: labelByDomain.get(domain)!,
        change,
        evidenceQuote: typeof rec.evidenceQuote === "string" ? rec.evidenceQuote.trim() : "",
        sourceQuestion: typeof rec.sourceQuestion === "string" ? rec.sourceQuestion.trim() : "",
      });
    }
  }

  const deltas = [...byDomain.values()];
  // Never report completion while a tracked signal is still unmapped — a
  // truncated turn can drop the flag's context and strand the briefing.
  const done = obj.done === true && deltas.length >= trackedSignals.length;

  return {
    reply: typeof obj.reply === "string" && obj.reply.trim() ? obj.reply.trim() : fallbackReply,
    done,
    note: typeof obj.note === "string" ? obj.note.trim() : "",
    deltas,
  };
}

/**
 * Run one companion turn. `history` is the running conversation (participant +
 * companion messages, oldest first). Returns the next structured turn. When the
 * history is empty, the companion opens the check-in.
 */
export async function generateCompanionTurn(
  trackedSignals: TrackedSignal[],
  history: CompanionMessage[],
  userName?: string | null,
  questionContext: SignalQuestionContext[] = [],
  priorDeltas: EvidencedDelta[] = [],
  locale?: string,
): Promise<CompanionTurn> {
  const domains = trackedSignals.map((s) => s.domain);
  const contents =
    history.length > 0
      ? history.map((m) => ({ role: m.role, parts: [{ text: m.text }] }))
      : [{ role: "user" as const, parts: [{ text: "I'm ready to start my check-in." }] }];

  const res = await generateContent({
    model: MODEL,
    config: {
      systemInstruction: buildCheckinSystemPrompt(trackedSignals, userName, questionContext, locale),
      temperature: 0.6,
      // The deltas array is cumulative — every mapped signal is re-sent each
      // turn with its quote and source question — so the response grows as the
      // check-in progresses. 1024 was enough for the opening turns and ran out
      // on the later ones, truncating the JSON exactly when the most work had
      // been done. Scaled to the number of signals, with headroom.
      maxOutputTokens: Math.min(4096, 1024 + trackedSignals.length * 400),
      responseMimeType: "application/json",
      responseSchema: checkinResponseSchema(domains),
    },
    contents,
  });

  return parseCompanionTurn(res.text ?? "", trackedSignals, priorDeltas, locale);
}
