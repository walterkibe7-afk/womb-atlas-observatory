"use client";

import { useEffect, useState, type ReactNode } from "react";
import { ShieldAlert, Loader2, CheckCircle2, ChevronDown, Sparkles, Heart, Activity, Download } from "lucide-react";
import QuestionFields, { specifyFieldId } from "./QuestionFields";
import { isScreenVisible } from "@/lib/observation/router";
import NarrativePromptCard from "./NarrativePrompt";
import { AtlasConstellationMap } from "@/components/observation/atlas-constellation-map";
import { ReflectionChamber } from "@/components/observation/reflection-chamber-ui";
import { burdenBadgeClass, burdenLabel } from "@/components/observation/burden-style";
import { useUiStrings } from "@/lib/observation/ui-strings-context";
import { UI_STRINGS } from "@/lib/observation/ui-strings";
import { generateAtlasRecordPdf } from "@/lib/pdf/atlas-pdf";
import { useLocale } from "@/lib/observation/use-locale";
import type { ConstellationNodeContent } from "@/lib/observation/intelligence/v43/constellation-node-content";
import type { ReflectionChamberIntelligence } from "@/lib/observation/intelligence/v43/reflection-chamber";
import type {
  AtlasDownloadRecord,
  AtlasExperienceLayer,
  AtlasObservedPatternCard,
  AtlasReflectionCompass,
  AtlasSignalLandscape,
  AtlasStrength,
} from "@/lib/observation/intelligence/v43/atlas-intelligence-service";
import { narrativeAnswerText } from "@/lib/observation/types";
import type {
  AnswerMap,
  AnswerValue,
  FormDefinition,
  NarrativeAnswer,
  Question,
  Screen,
} from "@/lib/observation/types";

// The full Atlas Intelligence v4.3 archetype (mobile-app parity) — populated
// whenever the intelligence pipeline runs.
interface ArchetypeDetail {
  name: string;
  description?: string;
  whatThisMeans: string;
  whyAtlasChose: string;
  archetypeLogic: string[];
  archetypeLogicSummary: string;
  strengthsSummary: string;
}

// Everything the "Observed Patterns" and "Your Atlas Record" screens need
// beyond what's already in `reflectionContent`/`archetype` (mobile-app parity).
interface AtlasRecordDetail {
  generatedAt: string;
  observationPortrait: string;
  dominantPattern: string | null;
  supportingPatterns: string[];
  signalLandscape: AtlasSignalLandscape;
  experienceLayers: AtlasExperienceLayer[];
  strengths: AtlasStrength[];
  reflectionCompass: AtlasReflectionCompass;
  narrativeThemes: string[];
  bodyLiteracyNote: string;
  whatAtlasWillWatch: string[];
  disclaimer: string;
  subduedPatternMessages: string[];
  observedPatternCards: AtlasObservedPatternCard[];
  downloadRecord: AtlasDownloadRecord;
}

export interface RecordResult {
  burden: string;
  reflectionType: string;
  reflectionCopy: string[];
  signals: { signalId: string; name: string; domain: string; severity: string }[];
  constellation: { domain: string; score: number; evidenceCount: number }[];
  constellationNodes: ConstellationNodeContent[];
  observedPatterns: { domain: string; signals: string[] }[];
  atlasRecordDetail: AtlasRecordDetail;
  reflectionChamber?: ReflectionChamberIntelligence;
  // Atlas Intelligence v4.3 fields (present when the intelligence pipeline runs).
  archetype?: ArchetypeDetail;
  reflectionContent?: {
    openingInsight: string;
    whatExperienceMayMean: string;
    whatAppearsConnected: string[];
    strengthsObserved: string[];
    bodyLiteracyNote: string;
    whatAtlasWillWatch: string[];
    dominantPattern?: string;
    dominantPatternSummary?: string;
  };
  reflectionSource?: "openai" | "deterministic";
}

interface Props {
  screen: Screen;
  definition: FormDefinition;
  answers: AnswerMap;
  onChange: (fieldId: string, value: AnswerValue) => void;
  onContinue: () => void;
  onJump: (section: string) => void;
  ensureObservationId: () => Promise<string | undefined>;
  record: RecordResult | null;
  finalizing: boolean;
}

export default function ScreenRenderer(props: Props) {
  const { screen, definition, answers, onChange, onContinue, onJump, ensureObservationId, record, finalizing } = props;

  switch (screen.renderKind) {
    // `purpose` on a question screen is the blueprint's Support Copy — the
    // explanatory line under the question. The question text itself is rendered
    // by the field, so this is additive, not a heading.
    case "question":
      return (
        <div className="space-y-5">
          <QuestionScreen screen={screen} answers={answers} onChange={onChange} />
          {screen.purpose.trim() && (
            <p className="text-sm text-muted leading-relaxed whitespace-pre-line">{screen.purpose}</p>
          )}
        </div>
      );

    case "safety_check":
      return (
        <div className="space-y-6">
          <div className="flex items-start space-x-3 bg-brand-orange/15 border border-brand-orange/40 p-4 rounded-xl">
            <ShieldAlert className="text-brand-orange shrink-0 mt-0.5" size={20} />
            <p className="text-sm text-fg">{definition.ui.safetyCheckNotice}</p>
          </div>
          <QuestionScreen screen={screen} answers={answers} onChange={onChange} />
        </div>
      );

    case "safety_alert":
      return (
        <div className="space-y-6">
          <div className="flex flex-col items-center text-center space-y-4 bg-danger/15 border border-danger/40 p-8 rounded-2xl">
            <ShieldAlert className="text-danger" size={40} />
            <h2 className="text-xl font-serif text-fg">{screen.name}</h2>
            <p className="text-sm text-muted max-w-md">{screen.purpose}</p>
            <p className="text-sm text-fg max-w-md">{definition.ui.safetyAlertGuidance}</p>
          </div>
          {/* LOER S04 input type is a guidance acknowledgement, so the screen
              records that the guidance was seen (safety_alert_viewed). */}
          {screen.questions.length > 0 && (
            <QuestionScreen screen={screen} answers={answers} onChange={onChange} />
          )}
        </div>
      );

    // S00 — welcome. The first line of `purpose` is the strapline; the rest is
    // body copy. The observation boundary is fixed brand/legal wording, so it
    // lives here rather than in the seed (same pattern as the consent screen).
    case "landing": {
      const [strapline, ...body] = screen.purpose.split("\n\n");
      return (
        <div className="space-y-6 py-4">
          <div className="space-y-2">
            <h2 className="text-3xl font-serif text-fg leading-tight">{screen.name}</h2>
            <p className="text-brand-gold">{strapline}</p>
          </div>
          {body.map((p, i) => (
            <p key={i} className="text-muted leading-relaxed whitespace-pre-line">
              {p}
            </p>
          ))}
          <div className="flex items-start space-x-3 bg-[var(--color-surface)] border border-[var(--color-border)] p-5 rounded-2xl">
            <ShieldAlert className="text-brand-gold shrink-0 mt-0.5" size={20} />
            <p className="text-sm text-muted">
              <span className="text-fg">{definition.ui.landingBoundaryLead}</span>{" "}
              {definition.ui.landingBoundaryRest}
            </p>
          </div>
        </div>
      );
    }

    case "consent":
      return <ConsentScreen screen={screen} answers={answers} onChange={onChange} ui={definition.ui} />;

    case "narrative":
      return (
        <div className="space-y-5">
          <NarrativeScreen
            screen={screen}
            answers={answers}
            onChange={onChange}
            ensureObservationId={ensureObservationId}
            ui={definition.ui}
          />
          {screen.purpose.trim() && (
            <p className="text-sm text-muted leading-relaxed whitespace-pre-line">{screen.purpose}</p>
          )}
        </div>
      );

    case "review":
      return <ReviewScreen definition={definition} answers={answers} onJump={onJump} />;

    case "processing":
      return <ProcessingScreen screen={screen} onContinue={onContinue} finalizing={finalizing} />;

    case "reflection":
      return <ReflectionScreen record={record} ui={definition.ui} />;

    // LOER S73 — domain observations kept visually separate from general
    // education, so a participant can tell the two apart.
    case "reflection_expansion":
      return (
        <div className="space-y-6">
          <div className="space-y-2">
            <h2 className="text-2xl font-serif text-fg">{screen.name}</h2>
            <p className="text-muted leading-relaxed whitespace-pre-line">{screen.purpose}</p>
          </div>
          <ReflectionScreen record={record} ui={definition.ui} />
        </div>
      );

    // LOER S74 — participant review. Disagreement is recorded and carries no
    // credibility penalty, so the questions render alongside the reflection.
    case "reflection_review":
      return (
        <div className="space-y-6">
          <ReflectionScreen record={record} ui={definition.ui} />
          <div className="border-t border-line pt-6">
            <QuestionScreen screen={screen} answers={answers} onChange={onChange} />
          </div>
        </div>
      );

    // LOER S79 — storage, contribution and sharing reviewed before the record
    // is saved. Saving is separate from contribution; no consent broadening.
    case "record_privacy":
      return (
        <div className="space-y-6">
          <div className="space-y-2">
            <h2 className="text-2xl font-serif text-fg">{screen.name}</h2>
            <p className="text-muted leading-relaxed whitespace-pre-line">{screen.purpose}</p>
          </div>
          <QuestionScreen screen={screen} answers={answers} onChange={onChange} />
        </div>
      );

    case "constellation":
      return <ConstellationScreen record={record} ui={definition.ui} />;

    case "observed_patterns":
      return <ObservedPatternsScreen record={record} ui={definition.ui} />;

    case "atlas_record":
      return <AtlasRecordScreen record={record} ui={definition.ui} />;

    case "confirmation":
      return (
        <div className="flex flex-col items-center text-center space-y-4 py-8">
          <CheckCircle2 className="text-brand-green" size={40} />
          <h2 className="text-2xl font-serif text-fg">{screen.name}</h2>
          <p className="text-muted max-w-md">{screen.purpose}</p>
        </div>
      );

    case "information":
    case "comparison":
    default:
      return (
        <div className="space-y-4 py-6">
          <h2 className="text-2xl font-serif text-fg">{screen.name}</h2>
          <p className="text-muted leading-relaxed whitespace-pre-line">{screen.purpose}</p>
        </div>
      );
  }
}

function QuestionScreen({
  screen,
  answers,
  onChange,
}: {
  screen: Screen;
  answers: AnswerMap;
  onChange: (fieldId: string, value: AnswerValue) => void;
}) {
  // A single_select whose only option is "prefer not to say" (e.g.
  // preferred_language_disclosure) is meant as an opt-out for a free-text
  // sibling question on the same screen (e.g. preferred_language) — without
  // linking them, both can be filled in at once. Detected structurally
  // (single option, that exact value) rather than by fieldId, so it still
  // works if the content changes.
  const disclosureQuestion = screen.questions.find(
    (q) => q.fieldType === "single_select" && q.options.length === 1 && q.options[0].value === "prefer_not_to_say",
  );
  const disclosureTextSibling = disclosureQuestion
    ? screen.questions.find((q) => q.fieldType === "text" && q.fieldId !== disclosureQuestion.fieldId)
    : undefined;
  const disclosed = disclosureQuestion ? answers[disclosureQuestion.fieldId] === "prefer_not_to_say" : false;

  return (
    <div className="space-y-8">
      {screen.questions
        .filter((q) => !["text_audio", "generated_json"].includes(q.fieldType))
        .map((q) => {
          if (disclosureQuestion && q.fieldId === disclosureQuestion.fieldId) {
            return (
              <QuestionFields
                key={q.fieldId}
                question={q}
                value={answers[q.fieldId]}
                onChange={(fieldId, val) => {
                  onChange(fieldId, val);
                  if (val === "prefer_not_to_say" && disclosureTextSibling) {
                    onChange(disclosureTextSibling.fieldId, "");
                  }
                }}
              />
            );
          }
          if (disclosureTextSibling && q.fieldId === disclosureTextSibling.fieldId) {
            return (
              <QuestionFields
                key={q.fieldId}
                question={q}
                value={answers[q.fieldId]}
                disabled={disclosed}
                onChange={(fieldId, val) => {
                  onChange(fieldId, val);
                  if (val && disclosureQuestion) onChange(disclosureQuestion.fieldId, null);
                }}
              />
            );
          }
          return (
            <QuestionFields
              key={q.fieldId}
              question={q}
              value={answers[q.fieldId]}
              otherValue={answers[specifyFieldId(q.fieldId)]}
              onChange={onChange}
            />
          );
        })}
    </div>
  );
}

function ConsentScreen({
  screen,
  answers,
  onChange,
  ui,
}: {
  screen: Screen;
  answers: AnswerMap;
  onChange: (fieldId: string, value: AnswerValue) => void;
  ui: FormDefinition["ui"];
}) {
  // LOER S01 states four mandatory acknowledgements plus optional research and
  // re-contact preferences, each its own control with nothing preselected
  // (ADP-1001, and the QA rule "no prechecked boxes").
  const booleans = screen.questions.filter((q) => q.fieldType === "boolean");
  const required = booleans.filter((q) => q.required === "Required");
  const optional = booleans.filter((q) => q.required !== "Required");

  const Check = ({ q }: { q: Screen["questions"][number] }) => {
    const on = answers[q.fieldId] === true;
    return (
      <button
        type="button"
        onClick={() => onChange(q.fieldId, !on)}
        aria-pressed={on}
        className={`w-full flex items-start space-x-3 p-4 rounded-xl border text-left transition-colors ${
          on
            ? "bg-[var(--color-brand-purple-dark)] border-[var(--color-brand-gold)]"
            : "bg-[var(--color-background)] border-[var(--color-border)] hover:border-border-strong"
        }`}
      >
        <span
          className={`w-5 h-5 shrink-0 mt-0.5 rounded border flex items-center justify-center ${
            on ? "bg-[var(--color-brand-gold)] border-[var(--color-brand-gold)]" : "border-border"
          }`}
        >
          {on && <CheckCircle2 size={14} className="text-on-gold" />}
        </span>
        <span className="text-fg">{q.questionText}</span>
      </button>
    );
  };

  return (
    <div className="space-y-6">
      <p className="text-muted leading-relaxed whitespace-pre-line">{screen.purpose}</p>
      <div className="bg-[var(--color-surface)] border border-[var(--color-border)] p-5 rounded-2xl text-sm text-muted space-y-2">
        <p>{ui.consentNotice}</p>
      </div>
      <div className="space-y-3">
        {required.map((q) => (
          <Check key={q.fieldId} q={q} />
        ))}
      </div>
      {optional.length > 0 && (
        <div className="space-y-3 pt-2">
          <p className="text-sm text-muted">{ui.consentOptionalNote}</p>
          {optional.map((q) => (
            <Check key={q.fieldId} q={q} />
          ))}
        </div>
      )}
    </div>
  );
}

function asNarrative(raw: AnswerValue | undefined): NarrativeAnswer {
  if (raw && typeof raw === "object" && !Array.isArray(raw)) return raw as NarrativeAnswer;
  if (typeof raw === "string") return { text: raw }; // legacy text-only value
  return {};
}

function NarrativeScreen({
  screen,
  answers,
  onChange,
  ensureObservationId,
  ui,
}: {
  ui: FormDefinition["ui"];
  screen: Screen;
  answers: AnswerMap;
  onChange: (fieldId: string, value: AnswerValue) => void;
  ensureObservationId: () => Promise<string | undefined>;
}) {
  return (
    <div className="space-y-6">
      <p className="text-muted whitespace-pre-line">{screen.purpose}</p>
      <p className="text-xs text-faint">{ui.narrativeHelp}</p>
      {screen.narrativePrompts.map((p, i) => (
        <NarrativePromptCard
          key={p.promptId}
          prompt={p}
          value={asNarrative(answers[p.promptId])}
          onChange={onChange}
          ensureObservationId={ensureObservationId}
          index={i}
          total={screen.narrativePrompts.length}
        />
      ))}
    </div>
  );
}

// Render a stored narrative answer for humans: typed text wins; a voice-only
// answer falls back to its transcription, then to a generic "audio saved" note
// if transcription isn't available yet.
function displayNarrativeAnswer(raw: AnswerValue): string {
  const text = narrativeAnswerText(raw).trim();
  if (text) return text;
  const audioUrl = raw && typeof raw === "object" && !Array.isArray(raw) ? (raw as NarrativeAnswer).audioUrl : undefined;
  return audioUrl ? "Audio response saved" : "";
}

// Render a stored answer for humans: option *values* (snake_case codes like
// `every_1_2_hours`) are mapped back to their labels; arrays are joined; booleans
// become Yes/No.
function displayAnswer(q: Question, raw: AnswerValue, ui: FormDefinition["ui"]): string {
  // An answer saved before the option list changed no longer matches any
  // option, and printing the stored code put raw slugs like "whole_body" in
  // front of the participant. Fall back to a readable form of the value —
  // the underlying answer still needs the CR §8 migration, but the review
  // screen should never show a database code.
  const label = (v: string) =>
    q.options.find((o) => o.value === v)?.label ?? v.replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase());
  if (Array.isArray(raw)) return raw.map((v) => label(String(v))).join(", ");
  if (typeof raw === "boolean") return raw ? ui.yes : ui.no;
  return label(String(raw));
}

function ReviewScreen({
  definition,
  answers,
  onJump,
}: {
  definition: FormDefinition;
  answers: AnswerMap;
  onJump: (section: string) => void;
}) {
  // Group by section (chamber), not by individual screen — most screens hold a
  // single question, so grouping per-screen made the review list look like one
  // "Edit" per question instead of per section. Order follows each section's
  // first appearance in the (already order-sorted) screen list.
  const sections: { section: string; items: { label: string; value: string }[] }[] = [];
  const bySection = new Map<string, (typeof sections)[number]>();

  // Life-stage suppression is answer-driven, so review has to re-evaluate it:
  // a section hidden for this participant (e.g. bleeding while pregnant) was
  // never offered, and must not be listed — least of all as "Skipped", which
  // would invite them to fill in questions that do not apply to them.
  const reviewCtx = { answers, signals: [] };

  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(new Set());
  const toggleSection = (section: string) => {
    setCollapsedSections((prev) => {
      const next = new Set(prev);
      if (next.has(section)) next.delete(section);
      else next.add(section);
      return next;
    });
  };

  for (const s of definition.screens) {
    if (s.renderKind === "consent") continue; // must not be editable after the fact
    if (!isScreenVisible(s, reviewCtx)) continue;
    // Every section that asks for something gets a group, even when it holds no
    // answers. A skipped section used to produce zero items and get dropped here,
    // which took its Edit button with it and left no route back in to fill it.
    // Intros, processing, record and reflection screens ask nothing, so they stay out.
    if (s.questions.length === 0 && s.narrativePrompts.length === 0) continue;

    const items = [
      ...s.questions
        .filter((q) => answers[q.fieldId] != null && answers[q.fieldId] !== "")
        .map((q) => ({ label: q.questionText, value: displayAnswer(q, answers[q.fieldId], definition.ui) })),
      ...s.narrativePrompts
        .filter((p) => answers[p.promptId] != null)
        .map((p) => ({ label: p.promptText, value: displayNarrativeAnswer(answers[p.promptId]) })),
    ].filter((it) => it.value !== "");

    let group = bySection.get(s.section);
    if (!group) {
      group = { section: s.section, items: [] };
      bySection.set(s.section, group);
      sections.push(group);
    }
    group.items.push(...items);
  }

  return (
    <div className="space-y-4">
      <p className="text-muted">{definition.ui.reviewIntro}</p>
      {sections.map((g) => {
        const skipped = g.items.length === 0;
        const collapsed = !skipped && collapsedSections.has(g.section);
        return (
          <div key={g.section} className="bg-[var(--color-surface)] border border-[var(--color-border)] p-5 rounded-2xl">
            <div className={`flex items-center justify-between gap-3 ${skipped || collapsed ? "" : "mb-3"}`}>
              <button
                onClick={() => !skipped && toggleSection(g.section)}
                disabled={skipped}
                className="flex items-center gap-2.5 min-w-0 text-left disabled:cursor-default"
              >
                {!skipped && (
                  <ChevronDown
                    size={16}
                    className={`shrink-0 text-faint transition-transform ${collapsed ? "-rotate-90" : ""}`}
                  />
                )}
                <h3 className="text-fg font-medium">{g.section}</h3>
                {skipped && (
                  <span className="shrink-0 rounded-full border border-[var(--color-border)] px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-faint">
                    {definition.ui.skipped}
                  </span>
                )}
              </button>
              <button
                onClick={() => onJump(g.section)}
                className="shrink-0 text-xs text-[var(--color-brand-gold)] hover:underline"
              >
                {skipped ? definition.ui.answer : definition.ui.edit}
              </button>
            </div>
            {/* A skipped section shows its heading and tag only — no question list,
                since there are no answers to review, just a way back in. */}
            {!skipped && !collapsed && (
              <dl className="space-y-2">
                {g.items.map((it, i) => (
                  <div key={i} className="text-sm">
                    <dt className="text-faint">{it.label}</dt>
                    <dd className="text-fg">{it.value}</dd>
                  </div>
                ))}
              </dl>
            )}
          </div>
        );
      })}
    </div>
  );
}

function ProcessingScreen({
  screen,
  onContinue,
  finalizing,
}: {
  screen: Screen;
  onContinue: () => void;
  finalizing: boolean;
}) {
  useEffect(() => {
    if (finalizing) return; // wait for finalize to complete before auto-advancing
    const t = setTimeout(onContinue, 1600);
    return () => clearTimeout(t);
  }, [onContinue, finalizing]);
  return (
    <div className="flex flex-col items-center justify-center py-32 space-y-6">
      <Loader2 className="animate-spin text-[var(--color-brand-gold)]" size={44} />
      <h2 className="text-xl font-serif text-fg">{screen.name}</h2>
      <p className="text-muted text-sm text-center max-w-sm">{screen.purpose}</p>
    </div>
  );
}

function BurdenBadge({ burden }: { burden?: string }) {
  const strings = useUiStrings();
  const color = burdenBadgeClass(burden);
  return (
    <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs border ${color}`}>
      {strings.burdenLabelPrefix} {burden ? burdenLabel(burden, strings) : "—"}
    </span>
  );
}

function ReflectionScreen({ record, ui }: { record: RecordResult | null; ui: FormDefinition["ui"] }) {
  if (!record) return <EmptyRecord ui={ui} />;
  if (record.reflectionChamber) {
    // The chamber is deterministic; the prose beside it is the one part a model
    // wrote, so it is passed separately and labelled as such.
    return (
      <ReflectionChamber
        intelligence={record.reflectionChamber}
        prose={record.reflectionContent}
        proseIsAi={record.reflectionSource === "openai"}
      />
    );
  }
  const rc = record.reflectionContent;
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-serif text-fg flex items-center gap-2">
          <Sparkles size={20} className="text-[var(--color-brand-purple)]" /> {ui.reflectionScreenTitle}
        </h2>
        <BurdenBadge burden={record.burden} />
      </div>

      {record.archetype?.name && (
        <div className="bg-[var(--color-brand-purple-dark)] border border-[var(--color-border)] p-4 rounded-2xl">
          <p className="font-mono text-[10px] tracking-widest uppercase text-[var(--color-brand-gold)] mb-1">
            {ui.sectionAtlasArchetype}
          </p>
          <p className="text-fg font-medium">{record.archetype.name}</p>
          {record.archetype.whatThisMeans && (
            <p className="text-sm text-muted mt-1">{record.archetype.whatThisMeans}</p>
          )}
        </div>
      )}

      {rc ? (
        <div className="bg-[var(--color-surface)] border border-[var(--color-border)] p-6 rounded-2xl space-y-5 text-fg leading-relaxed">
          {rc.openingInsight && <p className="whitespace-pre-line">{rc.openingInsight}</p>}
          {rc.whatExperienceMayMean && (
            <div>
              <h3 className="text-sm text-[var(--color-brand-gold)] mb-1">{ui.reflectionsWhatThisMayMean}</h3>
              <p>{rc.whatExperienceMayMean}</p>
            </div>
          )}
          {rc.whatAppearsConnected?.length > 0 && (
            <div>
              <h3 className="text-sm text-[var(--color-brand-gold)] mb-1">{ui.reflectionWhatAppearsConnected}</h3>
              <ul className="list-disc list-inside space-y-1 text-muted">
                {rc.whatAppearsConnected.map((t, i) => <li key={i}>{t}</li>)}
              </ul>
            </div>
          )}
          {rc.strengthsObserved?.length > 0 && (
            <div>
              <h3 className="text-sm text-[var(--color-brand-gold)] mb-1">{ui.reflectionStrengthsObserved}</h3>
              <ul className="list-disc list-inside space-y-1 text-muted">
                {rc.strengthsObserved.map((t, i) => <li key={i}>{t}</li>)}
              </ul>
            </div>
          )}
          {rc.bodyLiteracyNote && (
            <p className="text-sm text-muted border-t border-[var(--color-border)] pt-4">{rc.bodyLiteracyNote}</p>
          )}
        </div>
      ) : (
        <div className="bg-[var(--color-surface)] border border-[var(--color-border)] p-6 rounded-2xl space-y-4 text-fg leading-relaxed">
          {record.reflectionCopy.length === 0 ? (
            <p>{ui.reflectionFallback}</p>
          ) : (
            record.reflectionCopy.map((p, i) => <p key={i}>{p}</p>)
          )}
        </div>
      )}

      <p className="text-xs text-faint">
        {ui.recordDisclaimer}
        {record.reflectionSource === "deterministic" ? ui.recordDisclaimerOffline : ui.recordDisclaimerEnd}
      </p>
    </div>
  );
}

function ConstellationScreen({ record, ui }: { record: RecordResult | null; ui: FormDefinition["ui"] }) {
  if (!record) return <EmptyRecord ui={ui} />;
  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-serif text-fg flex items-center gap-2">
        <Activity size={20} className="text-[var(--color-brand-gold)]" /> {ui.constellationRecordTitle}
      </h2>
      <div className="bg-[var(--color-surface)] border border-[var(--color-border)] p-4 rounded-2xl">
        <AtlasConstellationMap nodes={record.constellationNodes} />
      </div>
    </div>
  );
}

function RecordSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="bg-[var(--color-surface)] border border-[var(--color-border)] p-5 rounded-2xl">
      <p className="font-mono text-[10px] uppercase tracking-widest text-[var(--color-brand-gold)]">{title}</p>
      <div className="mt-2">{children}</div>
    </section>
  );
}

function ObservedPatternsScreen({ record, ui }: { record: RecordResult | null; ui: FormDefinition["ui"] }) {
  if (!record) return <EmptyRecord ui={ui} />;
  const detail = record.atlasRecordDetail;
  const archetype = record.archetype;
  const patternCards = detail?.observedPatternCards ?? [];
  const subdued = detail?.subduedPatternMessages ?? [];

  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-serif text-fg flex items-center gap-2">
        <Heart size={20} className="text-[var(--color-brand-purple)]" /> {ui.observedPatternsTitle}
      </h2>

      {archetype && (
        <>
          <RecordSection title={ui.sectionAtlasArchetype}>
            <p className="text-fg font-medium">{archetype.name}</p>
          </RecordSection>

          <RecordSection title={ui.sectionArchetypeMeaning}>
            <p className="text-sm text-muted leading-relaxed">{archetype.whatThisMeans}</p>
          </RecordSection>

          <RecordSection title={ui.sectionArchetypeReason}>
            <p className="text-sm text-muted leading-relaxed">{archetype.whyAtlasChose}</p>
            {archetype.archetypeLogic.length > 0 && (
              <div className="mt-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-background)] px-4 py-3 space-y-1">
                <p className="font-mono text-[9px] uppercase tracking-widest text-[var(--color-brand-gold)]">{ui.atlasObservedLabel}</p>
                {archetype.archetypeLogic.map((item) => (
                  <p className="text-sm text-muted" key={item}>{item}</p>
                ))}
                <p className="text-sm text-muted pt-1">{archetype.archetypeLogicSummary}</p>
              </div>
            )}
          </RecordSection>
        </>
      )}

      {detail && detail.strengths.length > 0 && (
        <RecordSection title={ui.sectionStrengths}>
          <div className="space-y-1">
            {detail.strengths.map((s) => (
              <p className="text-sm text-fg" key={s.name}>{s.label ?? s.name}</p>
            ))}
          </div>
          {archetype?.strengthsSummary && (
            <p className="mt-2 text-sm text-muted">{archetype.strengthsSummary}</p>
          )}
        </RecordSection>
      )}

      <RecordSection title={ui.sectionWhatWeObserve}>
        <p className="text-sm text-muted leading-relaxed">{ui.patternsIntro}</p>
      </RecordSection>

      {patternCards.length > 0 ? (
        patternCards.map((pattern, index) => (
          <div className="bg-[var(--color-surface)] border border-[var(--color-border)] p-5 rounded-2xl" key={pattern.name}>
            <div className="flex items-start gap-3">
              <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full border border-[var(--color-brand-gold)]/60 text-xs text-[var(--color-brand-gold)]">
                {index + 1}
              </span>
              <div className="min-w-0 flex-1 space-y-2">
                <h3 className="text-fg font-medium">{pattern.name}</h3>
                <p className="text-sm text-muted leading-relaxed">{pattern.plainLanguageMeaning}</p>
                {pattern.relatedPattern && (
                  <p className="text-xs text-muted">{ui.relatedPatternPrefix} {pattern.relatedPattern}</p>
                )}
                <p className="text-xs text-muted">{pattern.atlasNote}</p>
                {pattern.watchOverTime && (
                  <p className="text-xs italic text-faint">{pattern.watchOverTime}</p>
                )}
                {pattern.supportingObservations.length > 0 && (
                  <ul className="list-disc list-inside text-xs text-muted space-y-0.5 pt-1">
                    {pattern.supportingObservations.map((o, i) => <li key={i}>{o}</li>)}
                  </ul>
                )}
              </div>
            </div>
          </div>
        ))
      ) : (
        <div className="bg-[var(--color-surface)] border border-[var(--color-border)] p-5 rounded-2xl">
          <p className="text-sm text-muted">
            {record.reflectionContent?.openingInsight ??
              ui.noStrongPatterns}
          </p>
        </div>
      )}

      {subdued.length > 0 && (
        <div className="bg-[var(--color-background)] border border-[var(--color-border)] p-4 rounded-2xl">
          <p className="font-mono text-[10px] uppercase tracking-widest text-[var(--color-brand-gold)]">
            {ui.subduedHeading}
          </p>
          <div className="mt-2 space-y-1">
            {subdued.map((m) => (
              <p className="text-xs text-muted" key={m}>{m}</p>
            ))}
          </div>
        </div>
      )}

      {detail?.disclaimer && (
        <p className="text-center text-xs text-faint border border-[var(--color-border)] rounded-xl px-4 py-3">
          {detail.disclaimer}
        </p>
      )}
    </div>
  );
}

function AtlasRecordScreen({ record, ui }: { record: RecordResult | null; ui: FormDefinition["ui"] }) {
  const locale = useLocale();
  if (!record) return <EmptyRecord ui={ui} />;
  const detail = record.atlasRecordDetail;
  const archetype = record.archetype;
  const rc = record.reflectionContent;
  const whatAtlasWillWatch = detail?.whatAtlasWillWatch?.length
    ? detail.whatAtlasWillWatch
    : rc?.whatAtlasWillWatch ?? [];
  const bodyLiteracyNote = detail?.bodyLiteracyNote ?? rc?.bodyLiteracyNote;

  async function downloadRecord() {
    if (!record || !detail) return;
    try {
      await generateAtlasRecordPdf(record, locale);
    } catch (err) {
      console.error("Failed to generate Atlas Record PDF:", err);
    }
  }

  return (
    <div className="space-y-4">
      <header className="space-y-2">
        <h2 className="text-3xl font-serif text-fg">{ui.yourAtlasRecordTitle}</h2>
        <div className="flex items-center gap-3">
          <div className="inline-flex items-center space-x-2 bg-brand-green/15 text-brand-green px-3 py-1 rounded-full text-xs border border-brand-green/40">
            <CheckCircle2 size={12} />
            <span>{ui.observationValidated}</span>
          </div>
          <BurdenBadge burden={record.burden} />
        </div>
      </header>

      {detail?.observationPortrait && (
        <RecordSection title={ui.sectionObservationPortrait}>
          <p className="text-sm text-fg leading-relaxed">{detail.observationPortrait}</p>
        </RecordSection>
      )}

      <RecordSection title={ui.sectionDominantPattern}>
        <p className="text-fg font-medium">{detail?.dominantPattern ?? rc?.dominantPattern ?? "—"}</p>
        {rc?.dominantPatternSummary && (
          <p className="mt-1 text-sm text-muted">{rc.dominantPatternSummary}</p>
        )}
      </RecordSection>

      {detail && detail.supportingPatterns.length > 0 && (
        <RecordSection title={ui.cardSupportingPatterns}>
          <div className="space-y-1">
            {detail.supportingPatterns.map((p) => (
              <p className="text-sm text-fg" key={p}>{p}</p>
            ))}
          </div>
        </RecordSection>
      )}

      {archetype && (
        <>
          <RecordSection title={ui.sectionAtlasArchetype}>
            <p className="text-fg font-medium">{archetype.name}</p>
          </RecordSection>
          <RecordSection title={ui.sectionArchetypeMeaning}>
            <p className="text-sm text-muted leading-relaxed">{archetype.whatThisMeans}</p>
          </RecordSection>
        </>
      )}

      {detail && (
        <RecordSection title={ui.sectionSignalLandscape}>
          <p className="text-fg font-medium">{detail.signalLandscape.label ?? detail.signalLandscape.name}</p>
          <p className="mt-1 text-sm text-muted">{detail.signalLandscape.description}</p>
        </RecordSection>
      )}

      {detail && detail.narrativeThemes.length > 0 && (
        <RecordSection title={ui.cardNarrativeThemes}>
          <div className="space-y-1">
            {detail.narrativeThemes.map((t, i) => (
              <p className="text-sm text-fg" key={`${t}-${i}`}>{t}</p>
            ))}
          </div>
        </RecordSection>
      )}

      {detail && detail.experienceLayers.length > 0 && (
        <RecordSection title={ui.sectionExperienceLayers}>
          <div className="space-y-3">
            {detail.experienceLayers.map((layer) => (
              <div key={layer.name}>
                <p className="text-fg font-medium">{layer.label ?? layer.name}</p>
                <p className="mt-1 text-sm text-muted">{layer.description}</p>
              </div>
            ))}
          </div>
        </RecordSection>
      )}

      {detail && detail.strengths.length > 0 && (
        <RecordSection title={ui.sectionStrengths}>
          <div className="space-y-1">
            {detail.strengths.map((s) => (
              <p className="text-sm text-fg" key={s.name}>
                {s.label ?? s.name}: {s.reflectionText}
              </p>
            ))}
          </div>
        </RecordSection>
      )}

      <RecordSection title={ui.sectionReflection}>
        <div className="space-y-2">
          {(rc ? [rc.openingInsight, rc.whatExperienceMayMean] : record.reflectionCopy)
            .filter(Boolean)
            .map((p, i) => (
              <p className="text-sm text-muted leading-relaxed whitespace-pre-line" key={i}>{p}</p>
            ))}
        </div>
      </RecordSection>

      {bodyLiteracyNote && (
        <RecordSection title={ui.sectionBodyLiteracy}>
          <p className="text-sm text-muted leading-relaxed">{bodyLiteracyNote}</p>
        </RecordSection>
      )}

      {whatAtlasWillWatch.length > 0 && (
        <RecordSection title={ui.sectionWhatAtlasWillWatch}>
          <ul className="list-disc list-inside text-sm text-muted space-y-1">
            {whatAtlasWillWatch.map((t, i) => <li key={i}>{t}</li>)}
          </ul>
        </RecordSection>
      )}

      {detail && (
        <RecordSection title={ui.sectionReflectionCompass}>
          <div className="space-y-2">
            {[
              { label: ui.compassStrongestTheme, value: detail.reflectionCompass.strongestTheme },
              { label: ui.compassEmergingTheme, value: detail.reflectionCompass.emergingTheme },
              { label: ui.compassStrengthObserved, value: detail.reflectionCompass.strengthObserved },
              { label: ui.sectionWhatAtlasWillWatch, value: detail.reflectionCompass.whatAtlasWillWatch },
            ].map((item) => (
              <div key={item.label}>
                <p className="font-mono text-[9px] uppercase tracking-widest text-[var(--color-brand-gold)]">{item.label}</p>
                <p className="mt-0.5 text-sm text-muted">{item.value}</p>
              </div>
            ))}
          </div>
        </RecordSection>
      )}

      <button
        className="w-full flex items-center justify-center gap-2 border border-[var(--color-brand-gold)] text-[var(--color-brand-gold)] px-4 py-3 rounded-xl font-medium hover:bg-[var(--color-brand-gold)]/10 transition-colors disabled:opacity-40"
        disabled={!detail}
        onClick={downloadRecord}
        type="button"
      >
        <Download size={16} /> {ui.downloadRecordButton}
      </button>

      <p className="text-xs text-faint">
        {detail?.disclaimer ?? `${ui.recordDisclaimer}${ui.recordDisclaimerEnd}`}
      </p>
    </div>
  );
}

function EmptyRecord({ ui }: { ui?: FormDefinition["ui"] }) {
  return (
    <div className="flex flex-col items-center justify-center py-24 space-y-4">
      <Loader2 className="animate-spin text-[var(--color-brand-gold)]" size={32} />
      <p className="text-muted text-sm">{ui?.preparingRecord ?? UI_STRINGS.preparingRecord}</p>
    </div>
  );
}
