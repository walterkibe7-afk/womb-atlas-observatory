"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowRight, SkipForward, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { computeSignals, firedSignalIds } from "@/lib/observation/signals";
import { computeBurden } from "@/lib/observation/reflection";
import {
  firstScreen,
  firstScreenOfSection,
  getScreen,
  isSectionSkippable,
  nextSectionStart,
  resolveNextScreen,
  sectionFieldIds,
  sectionProgress,
} from "@/lib/observation/router";
import type { AnswerMap, AnswerValue, FormDefinition } from "@/lib/observation/types";
import { useParticipantData } from "@/components/ParticipantDataProvider";
import ScreenRenderer, { type RecordResult } from "./screens/ScreenRenderer";
import { UiStringsProvider } from "@/lib/observation/ui-strings-context";
import { ObservationBackgroundVideo, type ObservationBackgroundKind } from "@/components/observation/ObservationBackgroundVideo";

/**
 * Render kinds whose screens display the generated Atlas Record, and therefore
 * the ones that must trigger `finalize()` before they render.
 *
 * This must stay in step with the render kinds in ScreenRenderer that read
 * `record`. It silently fell out of step once already: the LOER alignment
 * merged S72 (kind `reflection`) and S73 (`reflection_expansion`) into S74
 * (`reflection_review`), so no screen carried a kind in this set any more.
 * Nothing called finalize, `record` stayed null, and the reflection screen sat
 * on "Preparing your record…" forever — while the record itself generated fine
 * on the next screen, so the Reflections tab looked correct.
 *
 * `reflection` and `reflection_expansion` are kept for databases still holding
 * a pre-merge flow.
 */
const RECORD_KINDS = new Set([
  "reflection",
  "reflection_expansion",
  "reflection_review",
  "constellation",
  "observed_patterns",
  "atlas_record",
]);

export default function ObservationWizard({ flowKey }: { flowKey: string }) {
  const router = useRouter();
  const { refresh } = useParticipantData();
  // Locale is permanent and account-level, set once on /choose-language before
  // this component is ever reachable (ParticipantShell's gate guarantees it).
  // Both the definition and intelligence endpoints derive it server-side from
  // the session, so nothing here needs to read or pass it client-side.

  const [definition, setDefinition] = useState<FormDefinition | null>(null);
  const [loadingDefinition, setLoadingDefinition] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const loadDefinition = useCallback(async (): Promise<boolean> => {
    setLoadingDefinition(true);
    setLoadError(null);
    try {
      const res = await fetch("/api/observation/definition");
      if (!res.ok) throw new Error(`Failed to load definition: ${res.status}`);
      const def: FormDefinition = await res.json();
      setDefinition(def);
      return true;
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : "Failed to load form");
      return false;
    } finally {
      setLoadingDefinition(false);
    }
  }, []);

  useEffect(() => {
    if (definition || loadError || loadingDefinition) return;
    loadDefinition();
  }, [definition, loadError, loadingDefinition, loadDefinition]);

  const storageKey = definition ? `wa_obs_state_${definition.flowKey}` : null;

  const [answers, setAnswers] = useState<AnswerMap>({});
  const [currentScreenId, setCurrentScreenId] = useState<string | null>(null);
  const [history, setHistory] = useState<string[]>([]);
  const [observationId, setObservationId] = useState<string | null>(null);
  const [record, setRecord] = useState<RecordResult | null>(null);
  const [finalizing, setFinalizing] = useState(false);
  const [advancing, setAdvancing] = useState(false);
  const [alreadyCompleted, setAlreadyCompleted] = useState(false);
  const [editReturnTo, setEditReturnTo] = useState<string | null>(null);
  const [editingSection, setEditingSection] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    if (definition && currentScreenId === null) {
      setCurrentScreenId(firstScreen(definition).screenId);
    }
  }, [definition, currentScreenId]);

  // ---- Resume on mount: server draft (cross-device) reconciled with the local
  // cache (same-device, may hold the latest unsaved screen). Server is the source
  // of truth across devices; the local cache wins only for the same observation. --
  useEffect(() => {
    if (!definition || !storageKey) return;
    let cancelled = false;
    (async () => {
      let local: Partial<{
        answers: AnswerMap;
        currentScreenId: string;
        history: string[];
        observationId: string | null;
        record: RecordResult | null;
      }> | null = null;
      try {
        const raw = localStorage.getItem(storageKey);
        if (raw) local = JSON.parse(raw);
      } catch {
        /* ignore corrupt cache */
      }

      let server: {
        observationId: string;
        answers: AnswerMap;
        currentScreenId: string | null;
        completed?: boolean;
      } | null = null;
      let fetchOk = false;
      try {
        const res = await fetch("/api/observation");
        const data = await res.json();
        fetchOk = true;
        if (data.observation) server = data.observation;
      } catch {
        /* offline — fetchOk stays false, we fall back to local */
      }
      if (cancelled) return;

      const reviewScreen = definition.screens.find((s) => s.renderKind === "review");
      const isCompletedEdit = !!server?.completed && !!reviewScreen;
      if (isCompletedEdit) setAlreadyCompleted(true);

      let next: typeof local = null;
      if (server) {
        next = {
          answers: server.answers ?? {},
          currentScreenId: isCompletedEdit
            ? reviewScreen!.screenId
            : server.currentScreenId && getScreen(definition, server.currentScreenId)
              ? server.currentScreenId
              : firstScreen(definition).screenId,
          history: [],
          observationId: server.observationId,
          record: null,
        };
      }
      const localMatchesServer =
        !!local?.observationId && !!server && local.observationId === server.observationId;
      const localStale = fetchOk && !!local?.observationId && !localMatchesServer;
      if (localStale) {
        try {
          localStorage.removeItem(storageKey);
        } catch {
          /* quota / unavailable */
        }
      } else if (local) {
        next = { ...(next ?? {}), ...local };
        if (isCompletedEdit) next.currentScreenId = reviewScreen!.screenId;
      }

      if (next) {
        if (next.answers) setAnswers(next.answers);
        if (next.currentScreenId && getScreen(definition, next.currentScreenId)) {
          setCurrentScreenId(next.currentScreenId);
        }
        if (Array.isArray(next.history)) setHistory(next.history);
        if (next.observationId) setObservationId(next.observationId);
        if (next.record) setRecord(next.record);
      } else if (currentScreenId === null) {
        setCurrentScreenId(firstScreen(definition).screenId);
      }
      setHydrated(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [definition, storageKey]);

  // Mirror state to the local cache (edit mode deliberately excluded).
  useEffect(() => {
    if (!hydrated || !storageKey) return;
    try {
      localStorage.setItem(
        storageKey,
        JSON.stringify({ answers, currentScreenId, history, observationId, record }),
      );
    } catch {
      /* quota / unavailable */
    }
  }, [hydrated, answers, currentScreenId, history, observationId, record, storageKey]);

  const signals = useMemo(() => definition ? computeSignals(answers, definition.signals) : [], [answers, definition]);
  const burden = useMemo(() => computeBurden(signals), [signals]);
  const ctx = useMemo(
    () => ({ answers, signals: firedSignalIds(signals), burden }),
    [answers, signals, burden],
  );

  const screen = definition && currentScreenId ? getScreen(definition, currentScreenId) : null;

  const onChange = useCallback((fieldId: string, value: AnswerValue) => {
    setAnswers((prev) => ({ ...prev, [fieldId]: value }));
  }, []);

  const persistAnswers = useCallback(
    async (payload?: AnswerMap, progressScreenId?: string, completed?: boolean) => {
      if (!definition) return undefined;
      try {
        const res = await fetch("/api/observation", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            observationId,
            answers: payload ?? answers,
            flowKey: definition.flowKey,
            currentScreenId: progressScreenId,
            completed,
          }),
        });
        const data = await res.json();
        if (data.observationId && data.observationId !== observationId) {
          setObservationId(data.observationId);
        }
        return data.observationId as string | undefined;
      } catch (e) {
        console.error("Failed to save responses", e);
        return observationId ?? undefined;
      }
    },
    [answers, observationId, definition],
  );

  const finalize = useCallback(async (obsId: string) => {
    setFinalizing(true);
    try {
      // Locale is no longer sent — the server derives it from the session,
      // which is the participant's permanent, account-level choice now, not
      // per-request client state.
      const res = await fetch("/api/observation/intelligence", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ observationId: obsId }),
      });
      const data = await res.json();
      if (data.success) setRecord(data as RecordResult);
    } catch (e) {
      console.error("Failed to finalize", e);
    } finally {
      setFinalizing(false);
    }
  }, []);

  // Resuming directly on a record screen (e.g. new device) re-derives the record.
  useEffect(() => {
    if (!hydrated || !observationId || record || finalizing) return;
    if (screen && RECORD_KINDS.has(screen.renderKind)) finalize(observationId);
  }, [hydrated, observationId, record, finalizing, screen, finalize]);

  const completeAndExit = useCallback(async () => {
    try {
      if (observationId) await persistAnswers(undefined, currentScreenId ?? undefined, true);
    } catch {
      /* best effort */
    }
    if (storageKey) {
      localStorage.removeItem(storageKey);
    }
    localStorage.setItem("hasCompletedFirstObservation", "true");
    try {
      await refresh();
    } catch {
      /* the localStorage hint still unblocks the dashboard */
    }
    router.push("/dashboard");
  }, [observationId, persistAnswers, currentScreenId, router, storageKey, refresh]);

  const goNext = useCallback(async () => {
    if (!screen || !definition) return;
    setAdvancing(true);
    try {
      const next = resolveNextScreen(currentScreenId!, definition, ctx);
      const obsId = (await persistAnswers(undefined, next ?? currentScreenId!)) ?? observationId;

      const nextKind = next ? getScreen(definition, next)?.renderKind ?? "" : "";
      const enteringRecordFlow = !RECORD_KINDS.has(screen.renderKind) && RECORD_KINDS.has(nextKind);
      if (next && enteringRecordFlow && obsId) {
        setRecord(null);
        await finalize(obsId);
      }
      if (!next) {
        await completeAndExit();
        return;
      }
      setHistory((h) => [...h, currentScreenId!]);
      setCurrentScreenId(next);
    } finally {
      setAdvancing(false);
    }
  }, [screen, persistAnswers, observationId, currentScreenId, definition, ctx, finalize, completeAndExit]);

  const skipSection = useCallback(async () => {
    if (!screen || !definition) return;
    setAdvancing(true);
    try {
      const cleared = { ...answers };
      for (const f of sectionFieldIds(definition, screen.section)) delete cleared[f];
      setAnswers(cleared);
      const target = nextSectionStart(screen, definition, ctx);
      await persistAnswers(cleared, target ?? currentScreenId!);
      if (!target) {
        await completeAndExit();
        return;
      }
      setHistory((h) => [...h, currentScreenId!]);
      setCurrentScreenId(target);
    } finally {
      setAdvancing(false);
    }
  }, [screen, answers, definition, ctx, currentScreenId, persistAnswers, completeAndExit]);

  const goBack = useCallback(() => {
    setHistory((h) => {
      if (h.length === 0) return h;
      setCurrentScreenId(h[h.length - 1]);
      return h.slice(0, -1);
    });
  }, []);

  const jumpTo = useCallback(
    (section: string) => {
      if (!definition) return;
      const target = firstScreenOfSection(definition, section);
      if (!target) return;
      setEditReturnTo(currentScreenId);
      setEditingSection(section);
      setCurrentScreenId(target.screenId);
    },
    [currentScreenId, definition],
  );

  const editAdvance = useCallback(async () => {
    if (!definition) return;
    setAdvancing(true);
    try {
      const reviewScreenId = editReturnTo ?? currentScreenId!;
      const next = resolveNextScreen(currentScreenId!, definition, ctx);
      const nextScreen = next ? getScreen(definition, next) : undefined;
      const stayInSection = !!nextScreen && nextScreen.section === editingSection;

      await persistAnswers(undefined, stayInSection ? next! : reviewScreenId);
      if (stayInSection) {
        setCurrentScreenId(next!);
      } else {
        setCurrentScreenId(reviewScreenId);
        setEditReturnTo(null);
        setEditingSection(null);
      }
    } finally {
      setAdvancing(false);
    }
  }, [persistAnswers, editReturnTo, editingSection, currentScreenId, definition, ctx]);

  const cancelEdit = useCallback(() => {
    if (editReturnTo) {
      setCurrentScreenId(editReturnTo);
      setEditReturnTo(null);
      setEditingSection(null);
    }
  }, [editReturnTo]);

  const ensureObservationId = useCallback(async () => {
    if (observationId) return observationId;
    return await persistAnswers(undefined, currentScreenId ?? undefined);
  }, [observationId, persistAnswers, currentScreenId]);

  if (loadingDefinition) {
    return (
      <div className="flex flex-col items-center justify-center py-40 space-y-4">
        <Loader2 className="animate-spin text-[var(--color-brand-gold)]" size={32} />
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="flex flex-col items-center justify-center py-24 space-y-4">
        <p className="text-danger text-sm">{loadError}</p>
        <button
          onClick={() => loadDefinition()}
          className="text-[var(--color-brand-gold)] underline text-sm"
        >
          Try again
        </button>
      </div>
    );
  }

  if (!hydrated || !screen || !definition || !storageKey) {
    return (
      <div className="flex flex-col items-center justify-center py-40 space-y-4">
        <Loader2 className="animate-spin text-[var(--color-brand-gold)]" size={32} />
      </div>
    );
  }

  const editing = !!editReturnTo;

  const backgroundKind: ObservationBackgroundKind | null =
    screen.renderKind === "question" || screen.renderKind === "safety_check"
      ? "question"
      // "information" covers the section intro/transition screens between
      // question blocks (e.g. s05-context-intro, s21-bleeding-patterns);
      // "processing" covers the loading screens late in the flow.
      : screen.renderKind === "processing" || screen.renderKind === "information"
        ? "transition"
        : null;

  const canContinue = (() => {
    if (screen.renderKind === "consent") {
      // LOER S01 / ADP-1001: Continue is blocked while ANY mandatory
      // acknowledgement is false or unanswered, not just the first one.
      const mandatory = screen.questions.filter(
        (q) => q.fieldType === "boolean" && q.required === "Required",
      );
      if (mandatory.length === 0) return answers["CONSENT_ACK"] === true;
      return mandatory.every((q) => answers[q.fieldId] === true);
    }
    if (screen.renderKind === "question" || screen.renderKind === "safety_check") {
      return screen.questions
        .filter((q) => q.required === "Required")
        .every((q) => {
          const v = answers[q.fieldId];
          return Array.isArray(v) ? v.length > 0 : v != null && v !== "";
        });
    }
    return true;
  })();

  // Question/narrative/safety-check screens are usually short (a title + a
  // handful of options), so top-anchored flow left them stranded near the top
  // of the viewport — center them in the available space instead. Longer,
  // list-like screens (review, records-style, reflection, etc.) keep normal
  // top-down flow.
  const centerContent =
    screen.renderKind === "question" || screen.renderKind === "safety_check" || screen.renderKind === "narrative";

  const resolvedNextScreenId = resolveNextScreen(currentScreenId!, definition, ctx);
  const isTerminal = resolvedNextScreenId === null;
  const hideNav = screen.renderKind === "processing";
  const canSkip = !editing && isSectionSkippable(screen, definition);
  const progress = sectionProgress(screen, definition);
  const editContinuesSection =
    editing && !!resolvedNextScreenId && getScreen(definition, resolvedNextScreenId)?.section === editingSection;

  return (
    <div className="relative isolate min-h-screen">
      <ObservationBackgroundVideo kind={backgroundKind} />
      <div className="relative z-10 flex min-h-screen flex-col p-8 pb-20 max-w-2xl mx-auto space-y-8 pt-12">
      <div className="flex items-start justify-end gap-4 mb-2 shrink-0">
        {editing || alreadyCompleted ? (
          <span className="self-center font-mono text-xs text-faint">
            {editing ? definition.ui.wizardEditingSection : definition.ui.wizardEditingFirstObservation}
          </span>
        ) : (
          progress && (
            <div className="flex w-40 flex-col items-end gap-2">
              <span className="font-mono text-[11px] uppercase tracking-[0.2em] text-fg">
                {definition.ui.wizardSectionWord} {progress.index} / {progress.total}
              </span>
              <div
                className="h-[3px] w-full overflow-hidden rounded-full bg-[var(--color-border)]"
                role="progressbar"
                aria-valuenow={progress.index}
                aria-valuemin={1}
                aria-valuemax={progress.total}
                aria-label={`${definition.ui.wizardSectionWord} ${progress.index} ${definition.ui.wizardOfWord} ${progress.total}`}
              >
                <div
                  className="h-full rounded-full bg-[var(--color-brand-gold)] transition-[width] duration-500 ease-out"
                  style={{ width: `${(progress.index / progress.total) * 100}%` }}
                />
              </div>
            </div>
          )
        )}
      </div>

      {alreadyCompleted && !editing && (
        <div className="shrink-0 text-xs text-muted bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl px-4 py-3">
          {definition.ui.wizardAlreadyRecordedBanner}
        </div>
      )}

      <div
        className={`animate-in fade-in slide-in-from-bottom-4 flex-1 ${
          centerContent ? "flex flex-col justify-center min-h-[55vh]" : ""
        }`}
      >
        <UiStringsProvider value={definition.ui}>
          <ScreenRenderer
            screen={screen}
            definition={definition}
            answers={answers}
            onChange={onChange}
            onContinue={goNext}
            onJump={jumpTo}
            ensureObservationId={ensureObservationId}
            record={record}
            finalizing={finalizing}
          />
        </UiStringsProvider>
      </div>

      {!hideNav && (
        <div className="shrink-0 flex justify-between items-center mt-12 pt-6 border-t border-[var(--color-border)]">
          <button
            onClick={editing ? cancelEdit : goBack}
            disabled={advancing || finalizing || (!editing && history.length === 0)}
            className="text-muted hover:text-fg px-4 py-2 disabled:opacity-30 disabled:hover:text-muted"
          >
            {editing ? definition.ui.cancel : definition.ui.back}
          </button>

          <div className="flex items-center gap-3">
            {canSkip && (
              <button
                onClick={skipSection}
                disabled={advancing || finalizing}
                className="flex items-center space-x-2 text-muted border border-[var(--color-border)] px-4 py-3 rounded-xl hover:border-border-strong transition-colors disabled:opacity-40"
              >
                <span>{definition.ui.skipSection}</span>
                {advancing ? <Loader2 size={16} className="animate-spin" /> : <SkipForward size={16} />}
              </button>
            )}
            <button
              onClick={editing ? editAdvance : goNext}
              disabled={!canContinue || finalizing || advancing}
              className="flex items-center space-x-2 bg-[var(--color-brand-gold)] text-on-gold px-6 py-3 rounded-xl font-medium hover:bg-[var(--color-brand-gold)]/85 transition-colors shadow-lg disabled:opacity-40"
            >
              <span>
                {advancing || finalizing
                  ? definition.ui.saving
                  : editing
                    ? editContinuesSection
                      ? definition.ui.saveAndContinue
                      : definition.ui.saveSelection
                    : isTerminal
                      ? screen.primaryActionLabel || definition.ui.finish
                      : screen.primaryActionLabel || definition.ui.continue}
              </span>
              {advancing || finalizing ? <Loader2 size={16} className="animate-spin" /> : <ArrowRight size={16} />}
            </button>
          </div>
        </div>
      )}
      </div>
    </div>
  );
}
