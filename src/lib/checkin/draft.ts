// The DB-backed check-in draft: the shape persisted in CheckinDraft.payload and
// shared by the draft API route and the check-in page. A draft is the in-progress
// companion conversation + its running per-signal mapping — the check-in twin of
// the observation wizard's in_progress Observation rows, so a check-in started on
// one device resumes on another instead of living only in that browser's
// localStorage.
import type { CheckinChange } from "@/lib/observation/checkin";
import type { CompanionMessage, EvidencedDelta } from "@/lib/checkin/companion";

export type CheckinPhase = "chat" | "briefing";

export interface CheckinDraftPayload {
  messages: CompanionMessage[];
  deltasByDomain: Record<string, EvidencedDelta>;
  notes: string;
  phase: CheckinPhase;
}

const VALID_CHANGES: readonly CheckinChange[] = ["worsened", "no_change", "improved", "resolved"];

// Same tail bound the companion route applies to its history — the draft never
// needs more context than the companion itself would read back.
const MAX_MESSAGES = 40;
const MAX_TEXT = 4000;

function asString(value: unknown, max = MAX_TEXT): string {
  return typeof value === "string" ? value.slice(0, max) : "";
}

function sanitizeMessages(raw: unknown): CompanionMessage[] {
  if (!Array.isArray(raw)) return [];
  const out: CompanionMessage[] = [];
  for (const m of raw) {
    if (typeof m !== "object" || m === null) continue;
    const rec = m as Record<string, unknown>;
    const role = rec.role === "model" ? "model" : rec.role === "user" ? "user" : null;
    const text = asString(rec.text).trim();
    if (!role || !text) continue;
    out.push({ role, text });
  }
  return out.slice(-MAX_MESSAGES);
}

function sanitizeDeltas(raw: unknown): Record<string, EvidencedDelta> {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return {};
  const out: Record<string, EvidencedDelta> = {};
  for (const [domain, value] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof value !== "object" || value === null) continue;
    const rec = value as Record<string, unknown>;
    const change = VALID_CHANGES.find((c) => c === rec.change);
    if (!change) continue;
    out[domain] = {
      domain,
      label: asString(rec.label, 200),
      change,
      evidenceQuote: asString(rec.evidenceQuote, 1000),
      sourceQuestion: asString(rec.sourceQuestion, 500),
    };
  }
  return out;
}

/** Clamp an untrusted draft payload (client body or stored Json) to the known
 *  shape — never trust either side verbatim. */
export function sanitizeDraftPayload(raw: unknown): CheckinDraftPayload {
  const rec = (typeof raw === "object" && raw !== null ? raw : {}) as Record<string, unknown>;
  return {
    messages: sanitizeMessages(rec.messages),
    deltasByDomain: sanitizeDeltas(rec.deltasByDomain),
    notes: asString(rec.notes).trim(),
    phase: rec.phase === "briefing" ? "briefing" : "chat",
  };
}

/** True when there is nothing worth persisting — used to avoid writing (or to
 *  clear) an empty draft row. */
export function isDraftEmpty(payload: CheckinDraftPayload): boolean {
  return (
    payload.messages.length === 0 &&
    Object.keys(payload.deltasByDomain).length === 0 &&
    !payload.notes &&
    payload.phase === "chat"
  );
}
