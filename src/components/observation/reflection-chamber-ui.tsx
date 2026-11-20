"use client";

// Reflection Chamber tabbed UI — ported from participant-app
// (reflection-card.tsx + reflection-chamber-ui.tsx), restyled to
// observatory-system's dark/gold design tokens instead of mobile's `wao-*` classes.
import { useState, type ReactNode } from "react";
import type {
  ConfidenceKind,
  ConfidenceLevel,
  ReflectionChamberConnection,
  ReflectionChamberIntelligence,
  ReflectionChamberPattern,
  ReflectionChamberSignalContribution,
  ReflectionChamberUnderstanding,
  WatchStatus,
} from "@/lib/observation/intelligence/v43/reflection-chamber";
import { useUiStrings } from "@/lib/observation/ui-strings-context";
import {
  observatoryConfidenceLabel,
  observatoryConfidenceStars,
  watchStatusLabel,
} from "@/lib/observation/intelligence/v43/reflection-chamber";

type ChamberTabId = "observation" | "observed" | "understanding" | "watch" | "evidence";

/**
 * The AI-written prose for this observation.
 *
 * Deliberately a separate prop rather than part of ReflectionChamberIntelligence:
 * the chamber is the deterministic, reproducible evidence surface, and this is
 * the one part of it a model wrote. Keeping them apart is what lets the card be
 * labelled honestly and lets the rest of the chamber stay explainable.
 */
export interface ChamberReflectionProse {
  openingInsight?: string;
  whatExperienceMayMean?: string;
  whatAppearsConnected?: string[];
  bodyLiteracyNote?: string;
}

const CHAMBER_TAB_IDS: ChamberTabId[] = ["observation", "observed", "understanding", "watch", "evidence"];

// Tab labels and the hint under them are locale-resolved, so they are built
// from the current UI strings rather than held as module constants.
function chamberTabsFor(ui: ReturnType<typeof useUiStrings>): Array<{ id: ChamberTabId; label: string }> {
  const labels = [ui.tabObservation, ui.tabObserved, ui.tabUnderstanding, ui.tabWatch, ui.tabEvidence];
  return CHAMBER_TAB_IDS.map((id, i) => ({ id, label: labels[i] }));
}

function pipelineHintsFor(ui: ReturnType<typeof useUiStrings>): string[] {
  return [ui.hintNoticed, ui.hintUnderstood, ui.hintConnected, ui.hintWatch, ui.hintBelieves];
}

function listItemKey(parts: Array<string | number | undefined | null>) {
  return parts.filter(Boolean).join("-");
}

// Signal contributions come one-per-observation-answer from the pipeline, so
// the same theme (e.g. "Pain spread") legitimately appears more than once —
// each occurrence carries its own single evidence item. Grouping by label
// before rendering turns those into one card with a combined evidence list
// instead of several near-identical cards repeating the same heading.
const CONFIDENCE_RANK: Record<ConfidenceLevel, number> = {
  baseline: 0,
  emerging: 1,
  moderate: 2,
  strong: 3,
  very_strong: 4,
};
const CONTRIBUTION_RANK: Record<ReflectionChamberSignalContribution["contributionLevel"], number> = {
  light: 0,
  moderate: 1,
  high: 2,
};

function groupSignalContributions(contributions: ReflectionChamberSignalContribution[]): ReflectionChamberSignalContribution[] {
  const byLabel = new Map<string, ReflectionChamberSignalContribution>();
  for (const contribution of contributions) {
    const existing = byLabel.get(contribution.signalLabel);
    if (!existing) {
      byLabel.set(contribution.signalLabel, { ...contribution });
      continue;
    }
    existing.evidenceItems = [...existing.evidenceItems, ...contribution.evidenceItems];
    if (CONFIDENCE_RANK[contribution.confidence] > CONFIDENCE_RANK[existing.confidence]) {
      existing.confidence = contribution.confidence;
    }
    if (CONTRIBUTION_RANK[contribution.contributionLevel] > CONTRIBUTION_RANK[existing.contributionLevel]) {
      existing.contributionLevel = contribution.contributionLevel;
    }
  }
  return [...byLabel.values()];
}

function ChamberCard({
  title,
  children,
  className = "",
  plain = false,
}: {
  title?: string;
  children: ReactNode;
  className?: string;
  plain?: boolean;
}) {
  if (plain) {
    return (
      <section className={className}>
        {title ? <h3 className="mb-2 font-mono text-[9px] uppercase tracking-[0.12em] text-[var(--color-brand-gold)]">{title}</h3> : null}
        {children}
      </section>
    );
  }
  return (
    <section className={`rounded-xl border border-[var(--color-border)] bg-[var(--color-background)] px-4 py-3 ${className}`}>
      {title ? <h3 className="font-mono text-[9px] uppercase tracking-[0.12em] text-[var(--color-brand-gold)]">{title}</h3> : null}
      <div className={title ? "mt-2" : ""}>{children}</div>
    </section>
  );
}

function ObservatoryConfidence({ level, kind, compact = false }: { level: ConfidenceLevel; kind: ConfidenceKind; compact?: boolean }) {
  const ui = useUiStrings();
  const kindLabel = { signal: ui.confidenceSignal, pattern: ui.confidencePattern, connection: ui.confidenceConnection }[kind];

  return (
    <div className="flex flex-col gap-0.5">
      {!compact ? <span className="font-mono text-[8px] uppercase tracking-[0.08em] text-[var(--color-brand-gold)]">{kindLabel}</span> : null}
      <span aria-label={`${kindLabel}: ${observatoryConfidenceLabel(level, ui)}`} className="text-[11px] tracking-[0.06em] text-muted">
        {observatoryConfidenceStars(level)}{" "}
        <span className="font-mono text-[9px] uppercase tracking-[0.08em] text-[var(--color-brand-gold)]">{observatoryConfidenceLabel(level, ui)}</span>
      </span>
    </div>
  );
}

function PatternChip({ label }: { label: string }) {
  return (
    <span className="inline-flex rounded-full border border-[var(--color-border)] bg-[var(--color-surface)] px-2.5 py-1 font-mono text-[8px] uppercase tracking-[0.06em] text-[var(--color-brand-gold)]">
      {label}
    </span>
  );
}

const WATCH_STATUS_DOT_CLASS: Record<WatchStatus, string> = {
  watching: "bg-brand-orange",
  stable: "bg-brand-green",
  emerging: "bg-brand-purple",
  baseline: "bg-faint",
};

function WatchStatusIcon({ status }: { status: WatchStatus }) {
  return <span aria-hidden="true" className={`inline-block h-2 w-2 rounded-full ${WATCH_STATUS_DOT_CLASS[status]}`} />;
}

function ObservedBecauseList({ items }: { items: string[] }) {
  const ui = useUiStrings();
  if (items.length === 0) return null;
  return (
    <div>
      <p className="font-mono text-[8px] uppercase tracking-[0.08em] text-[var(--color-brand-gold)]">{ui.chamberObservedBecause}</p>
      <div className="mt-1 flex flex-wrap gap-1.5">
        {items.map((item, index) => (
          <span className="text-xs leading-[18px] text-muted" key={listItemKey(["observed-because", item, index])}>
            ✓ {item}
          </span>
        ))}
      </div>
    </div>
  );
}

function ObservedPatternCard({ pattern, onViewReasoning }: { pattern: ReflectionChamberPattern; onViewReasoning?: () => void }) {
  const ui = useUiStrings();
  const [expanded, setExpanded] = useState(false);
  const words = pattern.whyThisMatters.split(/\s+/);
  const whyPreview = words.length > 22 && !expanded ? `${words.slice(0, 22).join(" ")}…` : pattern.whyThisMatters;

  return (
    <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2.5">
      <p className="text-[15px] leading-[22px] text-fg">{pattern.participantLabel}</p>
      {pattern.role === "dominant" ? (
        <p className="mt-0.5 font-mono text-[8px] uppercase tracking-[0.08em] text-[var(--color-brand-gold)]">{ui.chamberDominantPattern}</p>
      ) : null}

      <div className="mt-2">
        <ObservatoryConfidence kind="pattern" level={pattern.confidence} />
      </div>

      <div className="mt-2">
        <ObservedBecauseList items={pattern.observedBecause} />
      </div>

      <div className="mt-2">
        <p className="font-mono text-[8px] uppercase tracking-[0.08em] text-[var(--color-brand-gold)]">{ui.chamberWhyThisMatters}</p>
        <p className="mt-1 text-[13px] leading-[20px] text-muted">{whyPreview}</p>
        {words.length > 22 ? (
          <button
            className="mt-1 font-mono text-[8px] uppercase tracking-[0.08em] text-[var(--color-brand-gold)]"
            onClick={() => setExpanded((current) => !current)}
            type="button"
          >
            {expanded ? ui.chamberShowLess : ui.chamberLearnMore}
          </button>
        ) : null}
      </div>

      {onViewReasoning ? (
        <button className="mt-2.5 font-mono text-[8px] uppercase tracking-[0.08em] text-[var(--color-brand-gold)]" onClick={onViewReasoning} type="button">
          {ui.chamberViewReasoning}
        </button>
      ) : null}
    </div>
  );
}

function ObservationPanel({
  intelligence,
  prose,
  proseIsAi,
}: {
  intelligence: ReflectionChamberIntelligence;
  prose?: ChamberReflectionProse;
  proseIsAi?: boolean;
}) {
  const ui = useUiStrings();
  const proseParagraphs = [
    prose?.openingInsight,
    prose?.whatExperienceMayMean,
    ...(prose?.whatAppearsConnected ?? []),
    prose?.bodyLiteracyNote,
  ].filter((p): p is string => typeof p === "string" && p.trim().length > 0);

  return (
    <div className="grid gap-2.5">
      <ChamberCard>
        <p className="font-serif text-[22px] font-light leading-[28px] text-fg">{intelligence.story.headline}</p>
        {/* The written record: the model's prose when it produced any, and the
            deterministic narrative when it did not. One or the other, never
            both — showing them together said the same thing twice. */}
        {proseParagraphs.length > 0 ? (
          proseParagraphs.map((paragraph, index) => (
            <p
              className="mt-2 text-[15px] leading-[24px] text-muted"
              key={listItemKey(["reflection-prose", index])}
            >
              {paragraph}
            </p>
          ))
        ) : (
          <p className="mt-2 text-[15px] leading-[24px] text-muted">{intelligence.story.narrative}</p>
        )}
        {intelligence.story.participantVoice.length > 0 ? (
          <div className="mt-2.5 border-l border-[var(--color-border)] pl-2.5">
            {intelligence.story.participantVoice.map((snippet, index) => (
              <p className="text-[13px] italic leading-[20px] text-muted" key={listItemKey(["participant-voice", snippet, index])}>
                &ldquo;{snippet}&rdquo;
              </p>
            ))}
          </div>
        ) : null}
        {intelligence.story.narrativeThemeLabels.length > 0 ? (
          <div className="mt-2 flex flex-wrap gap-1">
            {intelligence.story.narrativeThemeLabels.map((label, index) => (
              <PatternChip key={listItemKey(["narrative-theme", label, index])} label={label} />
            ))}
          </div>
        ) : null}
        {intelligence.story.patternChips.length > 0 ? (
          <div className="mt-2.5 flex flex-wrap gap-1.5">
            {intelligence.story.patternChips.map((chip, index) => (
              <PatternChip key={listItemKey(["story-chip", chip, index])} label={chip} />
            ))}
          </div>
        ) : null}
        {/* LOER requires AI-assisted text to say so where it appears, so the
            label lives on the card that now carries the prose. */}
        {proseParagraphs.length > 0 ? (
          <p className="mt-2.5 font-mono text-[10px] uppercase tracking-[0.08em] text-muted">
            {proseIsAi ? ui.proseAiAssisted : ui.proseDeterministic}
          </p>
        ) : null}
      </ChamberCard>

      <ChamberCard title={ui.cardArchetype}>
        <div className="flex items-start justify-between gap-2.5">
          <p className="font-serif text-lg font-light leading-6 text-fg">{intelligence.archetype.name}</p>
          <ObservatoryConfidence compact kind="pattern" level={intelligence.archetype.confidence} />
        </div>
        <p className="mt-1.5 text-[13px] leading-[20px] text-muted">{intelligence.archetype.coreTheme}</p>
        {intelligence.archetype.shapedByPatterns.length > 0 ? (
          <div className="mt-2 flex flex-wrap gap-1">
            {intelligence.archetype.shapedByPatterns.map((pattern, index) => (
              <PatternChip key={listItemKey(["archetype-pattern", pattern, index])} label={pattern} />
            ))}
          </div>
        ) : null}
      </ChamberCard>
    </div>
  );
}

function ObservedPanel({ intelligence, onViewReasoning }: { intelligence: ReflectionChamberIntelligence; onViewReasoning?: () => void }) {
  const ui = useUiStrings();
  if (!intelligence.dominantPattern) {
    return (
      <ChamberCard title={ui.cardNoticed}>
        <p className="text-sm leading-[22px] text-muted">{ui.chamberNoDominantPatternYet}</p>
      </ChamberCard>
    );
  }

  return (
    <div className="grid gap-4">
      <ChamberCard title={ui.cardNoticed} plain>
        <ObservedPatternCard onViewReasoning={onViewReasoning} pattern={intelligence.dominantPattern} />
      </ChamberCard>
      {intelligence.supportingPatterns.length > 0 ? (
        <ChamberCard title={ui.cardSupportingPatterns} plain>
          <div className="grid gap-2">
            {intelligence.supportingPatterns.map((pattern) => (
              <ObservedPatternCard key={pattern.scientificName} onViewReasoning={onViewReasoning} pattern={pattern} />
            ))}
          </div>
        </ChamberCard>
      ) : null}
    </div>
  );
}

function UnderstandingBlockCard({ block }: { block: ReflectionChamberUnderstanding }) {
  const ui = useUiStrings();
  const [expanded, setExpanded] = useState(false);
  const words = block.why.split(/\s+/);

  return (
    <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2.5">
      <p className="text-[15px] leading-[22px] text-fg">{block.participantLabel}</p>
      <div className="mt-1.5 text-center text-xs text-[var(--color-brand-gold)]">↓</div>

      {block.supportedBy.length > 0 ? (
        <div>
          <p className="font-mono text-[8px] uppercase tracking-[0.08em] text-[var(--color-brand-gold)]">{ui.chamberSupportedBy}</p>
          <div className="mt-1 flex flex-wrap gap-1">
            {block.supportedBy.map((name, index) => (
              <PatternChip key={listItemKey(["supported-by", block.patternName, name, index])} label={name} />
            ))}
          </div>
        </div>
      ) : null}

      <div className="mt-1.5 text-center text-xs text-[var(--color-brand-gold)]">↓</div>

      <div className="mt-1">
        <ObservatoryConfidence kind="pattern" level={block.confidence} />
      </div>

      <p className="mt-2 font-mono text-[8px] uppercase tracking-[0.08em] text-[var(--color-brand-gold)]">{ui.chamberWhy}</p>
      <p className="mt-1 text-[13px] leading-[20px] text-muted">
        {expanded ? block.why : `${words.slice(0, 18).join(" ")}${words.length > 18 ? "…" : ""}`}
      </p>

      {words.length > 18 ? (
        <button
          className="mt-1.5 font-mono text-[8px] uppercase tracking-[0.08em] text-[var(--color-brand-gold)]"
          onClick={() => setExpanded((current) => !current)}
          type="button"
        >
          {expanded ? ui.chamberCollapse : ui.chamberExpand}
        </button>
      ) : null}
    </div>
  );
}

function ConnectionCard({ connection }: { connection: ReflectionChamberConnection }) {
  const ui = useUiStrings();
  const [expanded, setExpanded] = useState(false);

  return (
    <button
      className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2.5 text-left"
      onClick={() => setExpanded((current) => !current)}
      type="button"
    >
      <p className="text-sm leading-5 text-fg">{connection.fromLabel}</p>
      <p className="my-1 text-center text-xs text-[var(--color-brand-gold)]">↓</p>
      <p className="text-sm leading-5 text-fg">{connection.toLabel}</p>

      <div className="mt-2">
        <ObservatoryConfidence compact kind="connection" level={connection.confidence} />
      </div>

      <p className="mt-2 font-mono text-[8px] uppercase tracking-[0.08em] text-[var(--color-brand-gold)]">{ui.chamberWhyConnected}</p>
      <p className="mt-1 text-xs leading-[18px] text-muted">{expanded ? connection.detailExplanation : connection.whyConnected}</p>

      {connection.detailExplanation !== connection.whyConnected ? (
        <span className="mt-1.5 inline-block font-mono text-[8px] uppercase tracking-[0.08em] text-[var(--color-brand-gold)]">
          {expanded ? ui.chamberCollapse : ui.chamberExpand}
        </span>
      ) : null}
    </button>
  );
}

function UnderstandingPanel({ intelligence }: { intelligence: ReflectionChamberIntelligence }) {
  const ui = useUiStrings();
  if (intelligence.understanding.length === 0) {
    return (
      <ChamberCard title={ui.cardUnderstoodThis}>
        <p className="text-sm leading-[22px] text-muted">{ui.chamberNoInterpretationYet}</p>
      </ChamberCard>
    );
  }

  return (
    <div className="grid gap-4">
      <ChamberCard title={ui.cardUnderstoodThis} plain>
        <div className="grid gap-2">
          {intelligence.understanding.map((block) => (
            <UnderstandingBlockCard block={block} key={block.patternName} />
          ))}
        </div>
      </ChamberCard>

      {intelligence.connections.length > 0 ? (
        <ChamberCard title={ui.cardConnectedThem} plain>
          <div className="grid gap-2">
            {intelligence.connections.map((connection) => (
              <ConnectionCard connection={connection} key={connection.id} />
            ))}
          </div>
        </ChamberCard>
      ) : null}
    </div>
  );
}

function WatchPanel({ intelligence }: { intelligence: ReflectionChamberIntelligence }) {
  const ui = useUiStrings();
  return (
    <ChamberCard title={ui.cardWillWatch} plain>
      <div className="grid gap-3">
        {intelligence.watchGroups.map((group) => (
          <div key={group.groupLabel}>
            <p className="font-mono text-[9px] uppercase tracking-[0.1em] text-[var(--color-brand-gold)]">{group.groupLabel}</p>
            <div className="mt-1.5 grid gap-1.5">
              {group.items.map((item, index) => (
                <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-2.5 py-2" key={listItemKey([group.groupLabel, item.label, index])}>
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm leading-5 text-fg">{item.label}</p>
                    <span className="flex items-center gap-1.5 font-mono text-[8px] uppercase tracking-[0.08em] text-[var(--color-brand-gold)]">
                      <WatchStatusIcon status={item.status} />
                      {watchStatusLabel(item.status, ui)}
                    </span>
                  </div>
                  <p className="mt-1 text-xs leading-[18px] text-muted">{item.compareNote}</p>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </ChamberCard>
  );
}

function EvidenceSection({ title, defaultOpen = false, children }: { title: string; defaultOpen?: boolean; children: ReactNode }) {
  return (
    <details className="group" open={defaultOpen}>
      <summary className="flex cursor-pointer list-none items-center gap-1.5 border-b border-[var(--color-border)] pb-2 font-mono text-[9px] uppercase tracking-[0.1em] text-[var(--color-brand-gold)] [&::-webkit-details-marker]:hidden">
        <span className="inline-block transition-transform duration-150 group-open:rotate-90">›</span>
        {title}
      </summary>
      <div className="grid gap-2 pt-2.5">{children}</div>
    </details>
  );
}

function LearningChainCard({ participantLabel, steps }: { participantLabel: string; steps: string[] }) {
  const ui = useUiStrings();
  return (
    <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-2.5 py-2">
      <p className="text-sm leading-5 text-fg">{participantLabel}</p>
      <p className="mt-1.5 font-mono text-[8px] uppercase tracking-[0.08em] text-[var(--color-brand-gold)]">{ui.cardLearnedThis}</p>
      <div className="mt-1 grid justify-items-center gap-0.5">
        {steps.map((step, index) => (
          <div className="grid justify-items-center gap-0.5" key={listItemKey([participantLabel, step, index])}>
            <p className="text-xs leading-[18px] text-muted">{step}</p>
            {index < steps.length - 1 ? <span className="text-[11px] text-[var(--color-brand-gold)]">↓</span> : null}
          </div>
        ))}
      </div>
    </div>
  );
}

function EvidencePanel({ intelligence }: { intelligence: ReflectionChamberIntelligence }) {
  const ui = useUiStrings();
  const groupedContributions = groupSignalContributions(intelligence.signalContributions);
  return (
    <div className="grid gap-4">
      <EvidenceSection defaultOpen title={ui.cardBelievesThis}>
        {groupedContributions.length > 0 ? (
          groupedContributions.map((contribution) => (
            <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-2.5 py-2" key={contribution.signalLabel}>
              <p className="text-sm leading-5 text-fg">{contribution.signalLabel}</p>

              <p className="mt-1.5 font-mono text-[8px] uppercase tracking-[0.08em] text-[var(--color-brand-gold)]">{ui.chamberEvidence}</p>
              <ul className="mt-0.5 grid gap-0.5">
                {contribution.evidenceItems.map((item, evidenceIndex) => (
                  <li className="text-xs leading-[18px] text-muted" key={listItemKey([contribution.signalLabel, "evidence", item, evidenceIndex])}>
                    • {item}
                  </li>
                ))}
              </ul>

              <p className="mt-1.5 font-mono text-[8px] uppercase tracking-[0.08em] text-[var(--color-brand-gold)]">{ui.chamberContribution}</p>
              <p className="mt-0.5 text-xs leading-[18px] text-muted">
                {contribution.contributionLevel === "high" ? ui.contributionHigh : contribution.contributionLevel === "moderate" ? ui.contributionModerate : ui.contributionLight}
              </p>

              <div className="mt-1.5">
                <ObservatoryConfidence kind="signal" level={contribution.confidence} />
              </div>

              <p className="mt-1.5 font-mono text-[8px] uppercase tracking-[0.08em] text-[var(--color-brand-gold)]">{ui.chamberPatternInfluenced}</p>
              <p className="mt-0.5 text-xs leading-[18px] text-muted">
                {contribution.patternInfluenced}
                {contribution.secondaryPatternInfluenced ? ` · ${ui.chamberAlso} ${contribution.secondaryPatternInfluenced}` : ""}
              </p>
            </div>
          ))
        ) : (
          <p className="text-[13px] leading-5 text-muted">{ui.chamberNoSignalEvidenceYet}</p>
        )}
      </EvidenceSection>

      {intelligence.narrativeEvidence.length > 0 ? (
        <EvidenceSection title={ui.cardNarrativeThemes}>
          {intelligence.narrativeEvidence.map((item) => (
            <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-2.5 py-2" key={item.themeId}>
              <p className="text-sm leading-5 text-fg">{item.scientificName}</p>

              <p className="mt-1.5 font-mono text-[8px] uppercase tracking-[0.08em] text-[var(--color-brand-gold)]">{ui.chamberParticipantFacingLabel}</p>
              <p className="mt-0.5 text-xs leading-[18px] text-muted">{item.participantLabel}</p>

              {item.sourceSnippet ? (
                <>
                  <p className="mt-1.5 font-mono text-[8px] uppercase tracking-[0.08em] text-[var(--color-brand-gold)]">{ui.chamberSourceSnippet}</p>
                  <p className="mt-0.5 text-xs italic leading-[18px] text-muted">&ldquo;{item.sourceSnippet}&rdquo;</p>
                </>
              ) : null}

              <p className="mt-1.5 font-mono text-[8px] uppercase tracking-[0.08em] text-[var(--color-brand-gold)]">{ui.chamberRelatedPattern}</p>
              <p className="mt-0.5 text-xs leading-[18px] text-muted">{item.relatedPatternLabel || "—"}</p>

              <div className="mt-1.5">
                <ObservatoryConfidence kind="signal" level={item.confidence} />
              </div>

              <p className="mt-1.5 font-mono text-[8px] uppercase tracking-[0.08em] text-[var(--color-brand-gold)]">{ui.chamberBriefingInfluence}</p>
              <p className="mt-0.5 text-xs leading-[18px] text-muted">{item.briefingInfluence}</p>
            </div>
          ))}
        </EvidenceSection>
      ) : null}

      <EvidenceSection title={ui.cardLearnedThis}>
        {intelligence.learningTraces.length > 0 ? (
          intelligence.learningTraces.map((trace) => (
            <LearningChainCard key={trace.patternName} participantLabel={trace.participantLabel} steps={trace.steps} />
          ))
        ) : (
          <p className="text-[13px] leading-5 text-muted">{ui.chamberNoLearningChainsYet}</p>
        )}
      </EvidenceSection>

      <EvidenceSection title={ui.cardCompleteRecord}>
        {intelligence.atlasRecordSections.length > 0 ? (
          intelligence.atlasRecordSections.map((section) => (
            <details className="rounded-lg border border-[var(--color-border)] bg-[var(--color-background)]" key={section.sectionId}>
              <summary className="cursor-pointer list-none px-2.5 py-2 text-[13px] leading-5 text-fg [&::-webkit-details-marker]:hidden">
                ▼ {section.label}
              </summary>
              <ul className="grid gap-0.5 border-t border-[var(--color-border)] px-2.5 py-2">
                {section.observations.map((observation, index) => (
                  <li className="text-xs leading-[18px] text-muted" key={listItemKey([section.sectionId, observation, index])}>
                    {observation}
                  </li>
                ))}
              </ul>
            </details>
          ))
        ) : (
          <p className="text-[13px] leading-5 text-muted">{ui.chamberRecordWillPopulate}</p>
        )}
      </EvidenceSection>
    </div>
  );
}

export function ReflectionChamber({
  intelligence,
  prose,
  proseIsAi,
}: {
  intelligence: ReflectionChamberIntelligence;
  prose?: ChamberReflectionProse;
  proseIsAi?: boolean;
}) {
  const ui = useUiStrings();
  const chamberTabs = chamberTabsFor(ui);
  const pipelineHint = pipelineHintsFor(ui);
  const [activeTab, setActiveTab] = useState<ChamberTabId>("observation");
  const activeTabIndex = chamberTabs.findIndex((tab) => tab.id === activeTab);

  return (
    <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-background)] px-5 py-5">
      <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--color-brand-gold)]">{ui.chamberEyebrow}</p>
      <h2 className="mt-1.5 font-serif text-2xl font-light text-fg">{ui.chamberTitle}</h2>
      <p className="mt-1 text-xs leading-[18px] text-faint">{pipelineHint[activeTabIndex]}</p>

      <div className="mt-3 flex gap-1.5 overflow-x-auto pb-0.5" role="tablist">
        {chamberTabs.map((tab) => (
          <button
            aria-selected={activeTab === tab.id}
            className={`shrink-0 rounded-full border px-3 py-1.5 font-mono text-[9px] uppercase tracking-[0.08em] transition-colors ${
              activeTab === tab.id
                ? "border-[var(--color-brand-gold)] bg-[var(--color-brand-purple-dark)] text-fg"
                : "border-[var(--color-border)] text-muted hover:border-border-strong"
            }`}
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            role="tab"
            type="button"
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="mt-3">
        {activeTab === "observation" ? <ObservationPanel intelligence={intelligence} prose={prose} proseIsAi={proseIsAi} /> : null}
        {activeTab === "observed" ? <ObservedPanel intelligence={intelligence} onViewReasoning={() => setActiveTab("evidence")} /> : null}
        {activeTab === "understanding" ? <UnderstandingPanel intelligence={intelligence} /> : null}
        {activeTab === "watch" ? <WatchPanel intelligence={intelligence} /> : null}
        {activeTab === "evidence" ? <EvidencePanel intelligence={intelligence} /> : null}
      </div>
    </div>
  );
}
