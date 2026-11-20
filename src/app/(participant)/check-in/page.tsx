"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Save, Loader2, ArrowRight, Sparkles, Send, AlertTriangle, Quote, Mic, Square } from "lucide-react";
import { useParticipantData } from "@/components/ParticipantDataProvider";
import type { CheckinChange, TrackedSignal } from "@/lib/observation/checkin";
import type { CompanionMessage, CompanionTurn, EvidencedDelta } from "@/lib/checkin/companion";
import type { CheckinDraftPayload } from "@/lib/checkin/draft";
import { useUiStrings } from "@/lib/observation/ui-strings-context";
import type { UiStrings } from "@/lib/observation/ui-strings";

const CANDIDATE_MIME = ["audio/webm;codecs=opus", "audio/webm", "audio/ogg"];
function pickMimeType(): string | undefined {
  if (typeof MediaRecorder === "undefined") return undefined;
  return CANDIDATE_MIME.find((m) => MediaRecorder.isTypeSupported(m));
}

interface CheckinContext {
  previousObservationId: string;
  previousAtlasRecordId: string;
  priorDate: string;
  trackedSignals: TrackedSignal[];
  /** The participant's in-progress draft for THIS baseline (cross-device resume). */
  draft: CheckinDraftPayload | null;
}

function changeOptionsFor(
  strings: UiStrings,
): { value: CheckinChange; label: string; activeClass: string }[] {
  return [
    { value: "worsened", label: strings.checkinChangeWorsened, activeClass: "border-danger bg-danger/15 text-[var(--color-brand-gold)]" },
    { value: "no_change", label: strings.checkinChangeNoChange, activeClass: "border-[var(--color-brand-gold)] bg-[var(--color-surface-hover)] text-[var(--color-brand-gold)]" },
    { value: "improved", label: strings.checkinChangeImproved, activeClass: "border-[var(--color-brand-green)] bg-[var(--color-surface-hover)] text-[var(--color-brand-green)]" },
    { value: "resolved", label: strings.checkinChangeResolved, activeClass: "border-[var(--color-brand-green)] bg-brand-green/15 text-[var(--color-brand-green)]" },
  ];
}

const SEVERITY_CLASS: Record<TrackedSignal["severity"], string> = {
  High: "text-[var(--color-brand-gold)] bg-danger/20",
  Moderate: "text-[var(--color-brand-orange)] bg-brand-orange/20",
  Low: "text-[var(--color-brand-gold)] bg-[var(--color-brand-gold)]/15",
  Baseline: "text-muted bg-[var(--color-surface-hover)]",
};

function severityLabel(severity: TrackedSignal["severity"], strings: UiStrings): string {
  switch (severity) {
    case "High":
      return strings.burdenHigh;
    case "Moderate":
      return strings.burdenModerate;
    case "Low":
      return strings.burdenLow;
    case "Baseline":
      return strings.confidenceBaseline;
  }
}

type Phase = "chat" | "briefing";

// The same-device fast path for the in-progress draft (survives reload without a
// round-trip). The DB row saved via /api/checkin/draft is the cross-device source
// of truth; both are scoped by the previous observation id so a fresh baseline (a
// new record) doesn't restore a stale conversation.
const DRAFT_KEY = "atlas-checkin-draft";

// How long the conversation must be quiet before the draft is mirrored to the DB.
const DRAFT_SAVE_DEBOUNCE_MS = 800;

interface CheckinDraft extends CheckinDraftPayload {
  previousObservationId: string;
}

export default function AtlasCheckIn() {
  const router = useRouter();
  const strings = useUiStrings();
  const changeOptions = changeOptionsFor(strings);
  const { refresh } = useParticipantData();
  const [context, setContext] = useState<CheckinContext | null>(null);
  const [loading, setLoading] = useState(true);

  // Conversation state
  const [phase, setPhase] = useState<Phase>("chat");
  const [messages, setMessages] = useState<CompanionMessage[]>([]);
  const [input, setInput] = useState("");
  const [thinking, setThinking] = useState(false);
  // Companion's running per-signal mapping, merged across turns (latest wins).
  const [deltasByDomain, setDeltasByDomain] = useState<Record<string, EvidencedDelta>>({});
  const [notes, setNotes] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [recording, setRecording] = useState(false);
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const openedRef = useRef(false);
  const hydratedRef = useRef(false);
  const endRef = useRef<HTMLDivElement>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const audioReplyRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, thinking]);

  // Release the mic if the participant leaves mid-recording.
  useEffect(() => {
    return () => streamRef.current?.getTracks().forEach((t) => t.stop());
  }, []);

  // Load the check-in context (tracked signals) and restore any in-progress draft
  // for this baseline, then open the companion. Restoration runs here, AFTER the
  // await, so the setState calls are asynchronous — the same way the observation
  // wizard hydrates from localStorage (a synchronous setState in an effect body
  // trips react-hooks/set-state-in-effect).
  useEffect(() => {
    let active = true;
    (async () => {
      let ctx: CheckinContext | null = null;
      try {
        const res = await fetch("/api/participant/checkin-context");
        const data = await res.json();
        ctx = (data?.context ?? null) as CheckinContext | null;
      } catch {
        ctx = null;
      }
      if (!active) return;
      setContext(ctx);

      // Resume a draft belonging to the current baseline. Two sources: the DB
      // draft (cross-device source of truth, returned with the context) and the
      // local cache (same-device fast path). A conversation only grows, so the
      // richer of the two wins; on a tie the local copy does (it may hold newer
      // notes/phase the debounced server mirror hasn't caught up with yet).
      if (ctx) {
        let local: Partial<CheckinDraft> | null = null;
        try {
          const raw = localStorage.getItem(DRAFT_KEY);
          const saved = raw ? (JSON.parse(raw) as Partial<CheckinDraft>) : null;
          if (saved && saved.previousObservationId === ctx.previousObservationId) {
            local = saved;
          } else if (saved) {
            localStorage.removeItem(DRAFT_KEY); // stale baseline — a new record exists
          }
        } catch {
          /* ignore a malformed draft */
        }

        const server = ctx.draft;
        const localCount = local?.messages?.length ?? 0;
        const serverCount = server?.messages?.length ?? 0;
        const chosen = localCount >= serverCount ? local : server;
        if (chosen?.messages?.length) {
          setMessages(chosen.messages);
          setDeltasByDomain(chosen.deltasByDomain ?? {});
          setNotes(chosen.notes ?? "");
          setPhase(chosen.phase === "briefing" ? "briefing" : "chat");
          openedRef.current = true; // don't auto-open a fresh conversation
        }
      }
      hydratedRef.current = true;
      setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, []);

  // Merge a turn's cumulative deltas into our map and prefill the note.
  function absorbTurn(turn: CompanionTurn) {
    setMessages((prev) => [...prev, { role: "model", text: turn.reply }]);
    if (turn.deltas.length) {
      setDeltasByDomain((prev) => {
        const next = { ...prev };
        for (const d of turn.deltas) next[d.domain] = d;
        return next;
      });
    }
    if (turn.note) setNotes((prev) => (prev ? prev : turn.note));
    if (turn.done) setPhase("briefing");
  }

  async function callCompanion(history: CompanionMessage[]) {
    setThinking(true);
    setError(null);
    try {
      const res = await fetch("/api/checkin/companion", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // Send what we have already mapped so a turn the model returns
        // unusably does not restart the check-in from nothing.
        body: JSON.stringify({ history, deltas: Object.values(deltasByDomain) }),
      });
      const data = await res.json();
      if (!res.ok || !data?.turn) throw new Error(data?.error ?? strings.checkinCompanionUnavailable);
      absorbTurn(data.turn as CompanionTurn);
    } catch (e) {
      setError(e instanceof Error ? e.message : strings.errorSomethingWentWrong);
    } finally {
      setThinking(false);
    }
  }

  // Persist the draft on every change, once hydration has run (so we never write
  // an empty draft over a stored one before restoring it). localStorage is written
  // immediately (same-device reloads); the DB mirror is debounced — one PUT once
  // the conversation goes quiet — and is what makes the draft resume cross-device.
  useEffect(() => {
    if (!hydratedRef.current || !context) return;
    // Nothing worth saving yet — and importantly, don't overwrite a stored draft
    // with an empty one on the hydration commit (before restored state re-renders).
    if (!messages.length && phase === "chat" && !notes && Object.keys(deltasByDomain).length === 0) {
      return;
    }
    const draft: CheckinDraft = {
      previousObservationId: context.previousObservationId,
      messages,
      deltasByDomain,
      notes,
      phase,
    };
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
    } catch {
      /* quota / serialization — non-fatal */
    }
    const timer = setTimeout(() => {
      void fetch("/api/checkin/draft", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          previousObservationId: context.previousObservationId,
          payload: { messages, deltasByDomain, notes, phase },
        }),
      }).catch(() => {
        /* offline — localStorage still holds the draft; next change retries */
      });
    }, DRAFT_SAVE_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [messages, deltasByDomain, notes, phase, context]);

  // Open the conversation once the context loads and shows tracked signals.
  useEffect(() => {
    if (loading || !context || !hydratedRef.current || openedRef.current) return;
    openedRef.current = true;
    void callCompanion([]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, context]);

  async function send() {
    const text = input.trim();
    if (!text || thinking) return;
    const history: CompanionMessage[] = [...messages, { role: "user", text }];
    setMessages(history);
    setInput("");
    await callCompanion(history);
  }

  // Voice answer: POST the clip + prior transcript; the server transcribes it,
  // echoes back what it heard, and returns the next turn (+ a spoken reply).
  async function sendVoice(blob: Blob) {
    setThinking(true);
    setError(null);
    setVoiceError(null);
    try {
      const form = new FormData();
      form.append("history", JSON.stringify(messages));
      form.append("deltas", JSON.stringify(Object.values(deltasByDomain)));
      form.append("audio", blob, "voice.webm");
      const res = await fetch("/api/checkin/companion", { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok || !data?.turn) throw new Error(data?.error ?? strings.checkinCompanionUnavailable);
      if (data.transcript) setMessages((prev) => [...prev, { role: "user", text: data.transcript }]);
      absorbTurn(data.turn as CompanionTurn);
      if (data.replyAudio?.base64) {
        const src = `data:${data.replyAudio.mimeType};base64,${data.replyAudio.base64}`;
        if (!audioReplyRef.current) audioReplyRef.current = new Audio();
        audioReplyRef.current.src = src;
        void audioReplyRef.current.play().catch(() => {});
      }
    } catch (e) {
      setVoiceError(e instanceof Error ? e.message : strings.checkinVoiceMessageFailed);
    } finally {
      setThinking(false);
    }
  }

  async function startRecording() {
    if (thinking || recording) return;
    setVoiceError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const mimeType = pickMimeType();
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      chunksRef.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: mimeType || "audio/webm" });
        streamRef.current?.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
        if (blob.size > 0) void sendVoice(blob);
      };
      recorder.start();
      recorderRef.current = recorder;
      setRecording(true);
    } catch {
      setVoiceError(strings.checkinMicBlocked);
    }
  }

  function stopRecording() {
    recorderRef.current?.stop();
    recorderRef.current = null;
    setRecording(false);
  }

  async function submit() {
    if (!context) return;
    setSubmitting(true);
    setError(null);
    try {
      // Every tracked signal gets a delta: the companion's mapping (read-only in
      // the briefing), defaulting to "no_change" for any it didn't map.
      const deltas = context.trackedSignals.map((s) => {
        const inferred = deltasByDomain[s.domain];
        const change = inferred?.change ?? "no_change";
        return {
          domain: s.domain,
          label: s.label,
          change,
          evidenceQuote: inferred?.evidenceQuote ?? "",
          sourceQuestion: inferred?.sourceQuestion ?? "",
        };
      });

      const checkinRes = await fetch("/api/checkin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deltas, notes }),
      });
      const checkinData = await checkinRes.json();
      if (!checkinRes.ok || !checkinData?.observationId) {
        throw new Error(checkinData?.error ?? strings.checkinCouldNotSave);
      }

      // Locale is no longer sent — the server derives it from the participant's
      // permanent, account-level session locale, the same as the wizard's finalize().
      const intelRes = await fetch("/api/observation/intelligence", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ observationId: checkinData.observationId }),
      });
      if (!intelRes.ok) throw new Error(strings.checkinSavedButRecordFailed);

      // Check-in is submitted — clear the persisted draft so the next visit starts fresh.
      try {
        localStorage.removeItem(DRAFT_KEY);
      } catch {
        /* non-fatal */
      }

      await refresh();
      router.push("/records");
    } catch (e) {
      setError(e instanceof Error ? e.message : strings.errorSomethingWentWrong);
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-40 space-y-4">
        <Loader2 className="animate-spin text-[var(--color-brand-gold)]" size={32} />
        <p className="text-muted text-sm">{strings.checkinLoadingSignals}</p>
      </div>
    );
  }

  if (!context) {
    return (
      <div className="p-8 max-w-2xl mx-auto">
        <div className="border border-[var(--color-border)] rounded-2xl bg-[var(--color-surface)] p-10 text-center space-y-4">
          <Sparkles className="mx-auto text-[var(--color-brand-gold)]" size={32} />
          <h1 className="text-2xl font-serif text-fg">{strings.checkinNoRecordTitle}</h1>
          <p className="text-sm text-muted max-w-md mx-auto">{strings.checkinNoRecordBody}</p>
          <Link
            href="/observation"
            className="inline-flex items-center gap-2 border border-[var(--color-brand-gold)] text-[var(--color-brand-gold)] px-6 py-2.5 rounded-full text-sm hover:bg-[var(--color-brand-gold)] hover:text-on-gold transition-colors"
          >
            {strings.navBeginFirstObservation} <ArrowRight size={16} />
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-8 pb-20 max-w-4xl mx-auto space-y-8">
      <header className="mb-4 text-center">
        <h1 className="text-3xl font-serif text-fg mb-3">
          {strings.navCheckIn} <span className="text-[var(--color-brand-gold)] ml-2">✧</span>
        </h1>
        <p className="text-muted text-sm max-w-xl mx-auto">
          {strings.checkinHeaderBody} {context.priorDate}.
        </p>
      </header>

      {/* Previously Tracked Signals */}
      <div className="bg-[var(--color-brand-purple-dark)] p-4 rounded-xl border border-[var(--color-border)]">
        <p className="font-mono text-xs text-[var(--color-brand-gold)] uppercase tracking-widest mb-3">{strings.checkinTrackedSignalsTitle}</p>
        {context.trackedSignals.length === 0 ? (
          <p className="text-sm text-muted">{strings.checkinNoTrackedSignals}</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {context.trackedSignals.map((signal) => (
              <div
                key={signal.domain}
                className="bg-[var(--color-background)] p-3 rounded-lg border border-[var(--color-border)] space-y-2"
              >
                <div className="flex justify-between items-center gap-2">
                  <span className="text-sm text-fg">{signal.label}</span>
                  <span className={`text-xs px-2 py-0.5 rounded whitespace-nowrap ${SEVERITY_CLASS[signal.severity]}`}>
                    {severityLabel(signal.severity, strings)} {strings.checkinIntensitySuffix}
                  </span>
                </div>
                {signal.urgentMarker && (
                  <span className="inline-flex items-center gap-1 text-[11px] text-[var(--color-brand-gold)] bg-danger/15 border border-danger/40 px-2 py-0.5 rounded">
                    <AlertTriangle size={11} /> {strings.checkinUrgentMarker}
                  </span>
                )}
                {signal.evidence && signal.evidence.length > 0 && (
                  <p className="text-[11px] text-faint leading-relaxed">
                    {strings.checkinObservedBecausePrefix} {signal.evidence.join("; ")}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {phase === "chat" && (
        <div className="border border-[var(--color-border)] rounded-2xl bg-[var(--color-surface)] flex flex-col overflow-hidden">
          <div className="p-6 space-y-4 min-h-[320px] max-h-[52vh] overflow-y-auto">
            {messages.map((m, i) => (
              <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[80%] px-4 py-3 rounded-2xl text-sm leading-relaxed ${
                    m.role === "user"
                      ? "bg-[var(--color-brand-gold)] text-on-gold"
                      : "bg-[var(--color-background)] text-fg border border-[var(--color-border)]"
                  }`}
                >
                  {m.text}
                </div>
              </div>
            ))}
            {thinking && (
              <div className="flex justify-start">
                <div className="px-4 py-3 rounded-2xl bg-[var(--color-background)] border border-[var(--color-border)] text-muted text-sm inline-flex items-center gap-2">
                  <Loader2 size={14} className="animate-spin" /> {strings.checkinCompanionThinking}
                </div>
              </div>
            )}
            <div ref={endRef} />
          </div>

          {(error || voiceError) && <p className="px-6 text-sm text-danger">{error || voiceError}</p>}

          <div className="border-t border-[var(--color-border)] p-4 flex items-end gap-3">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void send();
                }
              }}
              rows={1}
              disabled={recording}
              placeholder={recording ? strings.checkinListeningPlaceholder : strings.checkinSharePlaceholder}
              className="flex-1 bg-[var(--color-background)] border border-[var(--color-border)] rounded-xl p-3 text-sm text-fg focus:outline-none focus:border-[var(--color-brand-gold)] resize-none max-h-32 disabled:opacity-60"
            />
            <button
              onClick={() => (recording ? stopRecording() : void startRecording())}
              disabled={thinking}
              className={`p-3 rounded-xl transition-colors disabled:opacity-40 ${
                recording
                  ? "bg-danger text-fg hover:bg-danger/85 animate-pulse"
                  : "border border-[var(--color-border)] text-muted hover:bg-[var(--color-surface-hover)]"
              }`}
              aria-label={recording ? strings.checkinStopRecordingAria : strings.checkinRecordAnswerAria}
            >
              {recording ? <Square size={16} /> : <Mic size={16} />}
            </button>
            <button
              onClick={() => void send()}
              disabled={thinking || recording || !input.trim()}
              className="bg-[var(--color-brand-gold)] text-on-gold p-3 rounded-xl hover:bg-[var(--color-brand-gold)]/85 transition-colors disabled:opacity-40"
              aria-label={strings.checkinSendAria}
            >
              <Send size={16} />
            </button>
          </div>
          <div className="px-4 pb-4">
            <button
              onClick={() => setPhase("briefing")}
              disabled={Object.keys(deltasByDomain).length === 0}
              className="text-xs text-muted hover:text-[var(--color-brand-gold)] disabled:opacity-40 transition-colors"
            >
              {strings.checkinSkipAheadReview}
            </button>
          </div>
        </div>
      )}

      {phase === "briefing" && (
        <div className="border border-[var(--color-border)] rounded-2xl bg-[var(--color-surface)] p-8 space-y-8">
          <div>
            <p className="font-mono text-xs text-[var(--color-brand-gold)] uppercase tracking-widest mb-1">{strings.chamberEyebrow}</p>
            <h2 className="text-lg font-medium text-fg">{strings.checkinBriefingTitle}</h2>
            <p className="text-sm text-muted mt-1">{strings.checkinBriefingBody}</p>
          </div>

          <div className="space-y-4">
            {context.trackedSignals.map((signal) => {
              const inferred = deltasByDomain[signal.domain];
              const change = inferred?.change ?? "no_change";
              const mapped = changeOptions.find((o) => o.value === change) ?? changeOptions[1];
              return (
                <div key={signal.domain} className="p-4 border border-[var(--color-border)] rounded-xl bg-[var(--color-background)] space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm text-fg">{signal.label}</span>
                    {signal.urgentMarker && (
                      <span className="inline-flex items-center gap-1 text-[11px] text-[var(--color-brand-gold)]">
                        <AlertTriangle size={11} /> {strings.checkinUrgentBadge}
                      </span>
                    )}
                  </div>

                  {inferred?.evidenceQuote && (
                    <div className="text-xs text-muted bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg p-3 space-y-1">
                      <span className="inline-flex items-center gap-1 text-[var(--color-brand-gold)]">
                        <Quote size={11} /> {strings.hintBelieves}
                      </span>
                      <p className="italic text-muted">&ldquo;{inferred.evidenceQuote}&rdquo;</p>
                      {inferred.sourceQuestion && (
                        <p className="text-[11px] text-faint">{strings.checkinInResponseToPrefix} {inferred.sourceQuestion}</p>
                      )}
                    </div>
                  )}

                  <div className="flex items-center gap-2">
                    <span className="font-mono text-[11px] uppercase tracking-widest text-faint">{strings.checkinMappedAsLabel}</span>
                    <span className={`px-3 py-1 text-xs rounded border ${mapped.activeClass}`}>{mapped.label}</span>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="space-y-3 pt-6 border-t border-[var(--color-border)]">
            <h3 className="text-sm font-medium text-fg">{strings.checkinNewDevelopmentsTitle}</h3>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full bg-[var(--color-background)] border border-[var(--color-border)] rounded-xl p-4 text-sm text-fg focus:outline-none focus:border-[var(--color-brand-gold)] h-28 resize-none"
              placeholder={strings.checkinNotesPlaceholder}
            />
          </div>

          {error && <p className="text-sm text-danger">{error}</p>}

          <div className="flex justify-between items-center pt-2">
            <button
              onClick={() => setPhase("chat")}
              className="text-xs text-muted hover:text-[var(--color-brand-gold)] transition-colors"
            >
              {strings.checkinBackToConversation}
            </button>
            <button
              onClick={submit}
              disabled={submitting}
              className="flex items-center space-x-2 bg-[var(--color-brand-gold)] text-on-gold px-6 py-3 rounded-lg text-sm font-medium hover:bg-[var(--color-brand-gold)]/85 transition-colors shadow-[0_0_15px_rgba(200,154,82,0.3)] disabled:opacity-60"
            >
              {submitting ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
              <span>{submitting ? strings.checkinGeneratingRecord : strings.checkinConfirmSubmit}</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
