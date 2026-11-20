"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  TrendingUp,
  TrendingDown,
  Minus,
  ArrowRight,
  Flag,
  Milestone,
  Sparkles,
  Stethoscope,
  FileText,
  MessageSquare,
  Activity,
  Baby,
  Moon,
  CloudSun,
  Sun,
  Heart,
  Download,
  Share2,
  Printer,
} from "lucide-react";
import { useParticipantData } from "@/components/ParticipantDataProvider";
import { SignalEvolutionChart } from "@/components/participant/SignalEvolutionChart";
import { EVENT_ICON } from "@/components/participant/TimelineEvents";
import { generateTimelinePdf } from "@/lib/pdf/atlas-pdf";
import type {
  CareJourney,
  LifeStage,
  TimelineEvent,
  TrajectorySummary,
} from "@/lib/observation/summary";
import { useUiStrings } from "@/lib/observation/ui-strings-context";
import type { UiStrings } from "@/lib/observation/ui-strings";
import { useLocale } from "@/lib/observation/use-locale";
import { domainLabel } from "@/components/participant/signal-domains";

const RANGES: { key: string; days: number | null }[] = [
  { key: "3M", days: 90 },
  { key: "6M", days: 180 },
  { key: "12M", days: 365 },
  { key: "24M", days: 730 },
  { key: "All", days: null },
];

function tocSections(strings: UiStrings) {
  return [
    { href: "#health-journey", label: strings.timelineTocHealthJourney },
    { href: "#signal-evolution", label: strings.timelineTocSignalEvolution },
    { href: "#care-journey", label: strings.timelineTocCareJourney },
    { href: "#life-stage", label: strings.timelineTocLifeStage },
    { href: "#trajectory", label: strings.timelineTocTrajectory },
    { href: "#check-in-widget", label: strings.timelineTocCheckIns },
    { href: "#milestones", label: strings.timelineTocMilestones },
  ];
}

function lifeStages(strings: UiStrings): { key: string; label: string; Icon: typeof Sparkles }[] {
  return [
    { key: "adolescence", label: strings.lifeStageAdolescence, Icon: Sparkles },
    { key: "reproductive", label: strings.lifeStageReproductive, Icon: Activity },
    { key: "pregnancy", label: strings.lifeStagePregnancy, Icon: Baby },
    { key: "postpartum", label: strings.lifeStagePostpartum, Icon: Moon },
    { key: "perimenopause", label: strings.lifeStagePerimenopause, Icon: CloudSun },
    { key: "menopause", label: strings.lifeStageMenopause, Icon: Sun },
  ];
}

const CARE_PHASE_ICON: Record<string, typeof Sparkles> = {
  observation: Sparkles,
  care_outreach: Stethoscope,
  atlas_record: FileText,
  check_ins: MessageSquare,
  monitoring: Activity,
};

async function shareJourney(events: TimelineEvent[]) {
  const text = events
    .filter((e) => !e.pending)
    .map((e) => `${e.date} — ${e.title}: ${e.description}`)
    .join("\n");
  if (!text) return;
  try {
    const nav = navigator as Navigator & { share?: (data: { title: string; text: string }) => Promise<void> };
    if (nav.share) await nav.share({ title: "My Atlas Timeline", text });
    else await navigator.clipboard.writeText(text);
  } catch {
    // Share cancelled or unsupported — no-op.
  }
}

function overallTrendMeta(trend: TrajectorySummary["overallTrend"], strings: UiStrings) {
  if (trend === "improving") return { label: strings.timelineTrendImproving, className: "text-[var(--color-brand-green)]", Icon: TrendingDown };
  if (trend === "needs_attention") return { label: strings.timelineTrendNeedsAttention, className: "text-[var(--color-brand-orange)]", Icon: TrendingUp };
  return { label: strings.timelineTrendStable, className: "text-muted", Icon: Minus };
}

function HealthJourneyRow({ events }: { events: TimelineEvent[] }) {
  const strings = useUiStrings();
  const sorted = useMemo(
    () => [...events].filter((e) => !e.pending).sort((a, b) => new Date(a.iso).getTime() - new Date(b.iso).getTime()),
    [events],
  );

  if (sorted.length === 0) {
    return (
      <p className="text-sm text-faint py-6 text-center">
        {strings.timelineHealthJourneyEmpty}
      </p>
    );
  }

  return (
    <div className="relative">
      <span aria-hidden="true" className="absolute left-0 right-0 top-5 h-px bg-[var(--color-border)]" />
      <div className="relative flex gap-1 overflow-x-auto pb-2">
        {sorted.map((event) => {
          const Icon = EVENT_ICON[event.type] ?? Sparkles;
          return (
            <div key={event.id} className="flex flex-col items-center text-center px-3" style={{ minWidth: 148 }}>
              <span className="relative z-10 grid h-10 w-10 shrink-0 place-items-center rounded-full border-2 border-[var(--color-brand-gold)]/60 bg-[var(--color-surface)] text-[var(--color-brand-gold)]">
                <Icon size={17} />
              </span>
              <p className="mt-2 font-mono text-[10px] uppercase tracking-wide text-faint">{event.date}</p>
              <p className="text-sm text-fg font-medium mt-0.5">{event.title}</p>
              <p className="text-xs text-faint mt-0.5 leading-snug">{event.description}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function CareJourneyCard({ careJourney }: { careJourney: CareJourney | null }) {
  const strings = useUiStrings();
  return (
    <div id="care-journey" className="border border-[var(--color-border)] rounded-2xl bg-[var(--color-surface)] p-6 scroll-mt-8">
      <p className="font-mono text-[10px] text-[var(--color-brand-gold)] tracking-widest uppercase mb-4">{strings.timelineCareJourney}</p>
      {!careJourney ? (
        <p className="text-sm text-faint">{strings.timelineCareJourneyEmpty}</p>
      ) : (
        <>
          <div className="flex justify-between">
            {careJourney.phases.map((phase) => {
              const Icon = CARE_PHASE_ICON[phase.key] ?? Sparkles;
              return (
                <div key={phase.key} className="flex flex-col items-center gap-1.5 flex-1">
                  <span
                    className={`grid h-8 w-8 place-items-center rounded-full border ${
                      phase.done
                        ? "border-[var(--color-brand-gold)] bg-[var(--color-brand-gold)]/10 text-[var(--color-brand-gold)]"
                        : "border-[var(--color-border)] text-faint"
                    }`}
                  >
                    <Icon size={14} />
                  </span>
                  <span className="text-[9px] text-center text-faint leading-tight">{phase.label}</span>
                </div>
              );
            })}
          </div>
          <p className="mt-5 text-sm text-fg">{strings.timelineCurrentPhase} {careJourney.currentLabel}</p>
          <p className="text-xs text-muted mt-1 leading-relaxed">{careJourney.description}</p>
        </>
      )}
    </div>
  );
}

function LifeStageCard({ lifeStage }: { lifeStage: LifeStage | null }) {
  const strings = useUiStrings();
  return (
    <div id="life-stage" className="border border-[var(--color-border)] rounded-2xl bg-[var(--color-surface)] p-6 scroll-mt-8">
      <p className="font-mono text-[10px] text-[var(--color-brand-gold)] tracking-widest uppercase mb-4">{strings.timelineLifeStage}</p>
      <div className="flex justify-between">
        {lifeStages(strings).map((stage) => {
          const active = stage.key === lifeStage?.stageKey;
          const Icon = stage.Icon;
          return (
            <div key={stage.key} className="flex flex-col items-center gap-1.5 flex-1">
              <span
                className={`grid h-8 w-8 place-items-center rounded-full border ${
                  active
                    ? "border-[var(--color-brand-gold)] bg-[var(--color-brand-gold)]/10 text-[var(--color-brand-gold)]"
                    : "border-[var(--color-border)] text-faint"
                }`}
              >
                <Icon size={14} />
              </span>
              <span className="text-[9px] text-center text-faint leading-tight">{stage.label}</span>
            </div>
          );
        })}
      </div>
      {lifeStage ? (
        <>
          <p className="mt-5 text-sm text-fg">{strings.timelineYouAreIn} {lifeStage.label}</p>
          <p className="text-xs text-muted mt-1 leading-relaxed">{lifeStage.description}</p>
        </>
      ) : (
        <p className="mt-5 text-sm text-faint">{strings.timelineLifeStageEmpty}</p>
      )}
    </div>
  );
}

function TrajectoryCard({ trajectory }: { trajectory: TrajectorySummary | undefined }) {
  const strings = useUiStrings();
  const locale = useLocale();
  const t = trajectory ?? {
    observationsTotal: 0,
    checkinsCompleted: 0,
    domainsTracked: 0,
    mostImpacted: [],
    stillTracking: [],
    overallTrend: "stable" as const,
  };
  const trend = overallTrendMeta(t.overallTrend, strings);
  const TrendIcon = trend.Icon;

  return (
    <div id="trajectory" className="border border-[var(--color-border)] rounded-2xl bg-[var(--color-surface)] p-6 scroll-mt-8">
      <p className="font-mono text-[10px] text-[var(--color-brand-gold)] tracking-widest uppercase mb-4">{strings.timelineTrajectoryOverview}</p>
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-background)] p-3">
          <p className="text-xl font-serif text-[var(--color-brand-gold)]">{t.observationsTotal}</p>
          <p className="text-[10px] text-faint mt-0.5">{strings.timelineObservationsTotal}</p>
        </div>
        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-background)] p-3">
          <p className="text-xl font-serif text-fg">{t.checkinsCompleted}</p>
          <p className="text-[10px] text-faint mt-0.5">{strings.timelineCheckinsCompleted}</p>
        </div>
        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-background)] p-3">
          <p className="text-xl font-serif text-fg">{t.domainsTracked}</p>
          <p className="text-[10px] text-faint mt-0.5">{strings.timelineDomainsTracked}</p>
        </div>
        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-background)] p-3">
          <p className={`flex items-center gap-1.5 text-sm font-medium ${trend.className}`}>
            <TrendIcon size={15} /> {trend.label}
          </p>
          <p className="text-[10px] text-faint mt-0.5">{strings.timelineOverallTrend}</p>
        </div>
      </div>
      {t.mostImpacted.length > 0 && (
        <p className="mt-3 text-xs text-muted">
          {strings.timelineMostImpacted} <span className="text-muted">{t.mostImpacted.map((d) => domainLabel(d, locale)).join(", ")}</span>
        </p>
      )}
      {t.stillTracking.length > 0 && (
        <p className="text-xs text-faint mt-1">{strings.timelineStillTracking} {t.stillTracking.map((d) => domainLabel(d, locale)).join(", ")}</p>
      )}
    </div>
  );
}

function NextStepsCard() {
  const strings = useUiStrings();
  const steps = [
    { label: strings.timelineStepContinueCheckIns, href: "/check-in", Icon: MessageSquare },
    { label: strings.timelineStepTrackSignals, href: "#signal-evolution", Icon: Activity },
    { label: strings.timelineStepAddReflection, href: "/reflections", Icon: Heart },
    { label: strings.timelineStepViewCareJourney, href: "#care-journey", Icon: Stethoscope },
  ];
  return (
    <div className="border border-[var(--color-border)] rounded-2xl bg-[var(--color-surface)] p-6">
      <p className="font-mono text-[10px] text-[var(--color-brand-gold)] tracking-widest uppercase mb-4">{strings.timelineNextSteps}</p>
      <div>
        {steps.map((step) => (
          <Link
            key={step.label}
            href={step.href}
            className="flex items-center justify-between py-2.5 border-b border-[var(--color-border)]/50 last:border-0 text-sm text-muted hover:text-fg transition-colors"
          >
            <span className="flex items-center gap-2.5">
              <step.Icon size={14} className="text-[var(--color-brand-gold)]" />
              {step.label}
            </span>
            <ArrowRight size={14} />
          </Link>
        ))}
      </div>
    </div>
  );
}

export default function Timeline() {
  const { summary } = useParticipantData();
  const strings = useUiStrings();
  const locale = useLocale();
  const [range, setRange] = useState<string>("All");
  // Stable reference "now" captured at mount, so the range filter stays pure across renders.
  const [nowMs] = useState(() => Date.now());

  const allEvents = useMemo(() => summary?.timelineEvents ?? [], [summary?.timelineEvents]);
  const signalSeries = summary?.signalSeries ?? [];
  const signalDomains = summary?.signalDomains ?? [];
  const signalTrends = summary?.signalTrends ?? [];

  const events = useMemo(() => {
    const days = RANGES.find((r) => r.key === range)?.days;
    if (!days) return allEvents;
    const cutoff = nowMs - days * 24 * 60 * 60 * 1000;
    // Always keep the pending next-check-in node visible.
    return allEvents.filter((e) => e.pending || new Date(e.iso).getTime() >= cutoff);
  }, [allEvents, range, nowMs]);

  const dateRangeLabel = useMemo(() => {
    const real = events.filter((e) => !e.pending);
    if (real.length === 0) return null;
    return `${real[0].date} – ${real[real.length - 1].date}`;
  }, [events]);

  const milestones = events.filter(
    (e) =>
      e.type === "first_observation" ||
      e.type === "record_created" ||
      e.type === "checkin_completed" ||
      e.type === "observation_edited",
  );

  return (
    <div className="p-4 sm:p-8 pb-20 max-w-350 mx-auto">
      {/* Header */}
      <header className="flex flex-col md:flex-row md:justify-between md:items-start gap-4 mb-6">
        <div>
          <h1 className="text-3xl font-serif text-fg mb-2 flex items-center">
            {strings.timelineTitle} <span className="text-[var(--color-brand-gold)] ml-2">✧</span>
          </h1>
          <p className="text-muted text-sm">
            {strings.timelineSubtitle}
          </p>
        </div>
        <div className="flex flex-col items-end gap-2">
          <div className="flex items-center gap-3">
            <div className="flex items-center rounded-full border border-[var(--color-border)] p-1">
              {RANGES.map((r) => (
                <button
                  key={r.key}
                  onClick={() => setRange(r.key)}
                  className={`px-3 py-1 text-xs rounded-full transition-colors ${
                    range === r.key ? "bg-[var(--color-brand-purple-dark)] text-[var(--color-brand-gold)]" : "text-muted hover:text-fg"
                  }`}
                >
                  {r.key === "All" ? strings.timelineRangeAll : r.key}
                </button>
              ))}
            </div>
            <Link
              href="/check-in"
              className="flex items-center gap-2 border border-[var(--color-brand-gold)] text-[var(--color-brand-gold)] px-4 py-1.5 rounded-full text-xs hover:bg-[var(--color-brand-gold)] hover:text-on-gold transition-colors"
            >
              {strings.timelineNewCheckIn} <ArrowRight size={14} />
            </Link>
          </div>
          {dateRangeLabel && <p className="text-[11px] text-faint">{dateRangeLabel}</p>}
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-[180px_1fr_320px] gap-6 items-start">
        {/* Local table-of-contents + tools */}
        <aside className="hidden lg:block">
          <div className="sticky top-8 space-y-6">
            <nav className="space-y-1">
              <p className="font-mono text-[10px] text-[var(--color-brand-gold)] tracking-widest uppercase mb-2">{strings.timelineTocAtlasTimeline}</p>
              {tocSections(strings).map((section) => (
                <a
                  key={section.href}
                  href={section.href}
                  className="block text-xs text-muted hover:text-fg py-1 transition-colors"
                >
                  {section.label}
                </a>
              ))}
            </nav>
            <div>
              <p className="font-mono text-[10px] text-[var(--color-brand-gold)] tracking-widest uppercase mb-2">{strings.timelineTools}</p>
              <div className="space-y-1">
                <button
                  onClick={() =>
                    generateTimelinePdf({
                      events: allEvents,
                      signalSeries,
                      signalDomains,
                      careJourney: summary?.careJourney ?? null,
                      lifeStage: summary?.lifeStage ?? null,
                      locale,
                    }).catch((err) => console.error("Failed to generate Timeline PDF:", err))
                  }
                  className="flex items-center gap-2 text-xs text-muted hover:text-fg py-1 transition-colors"
                >
                  <Download size={12} /> {strings.timelineExport}
                </button>
                <button
                  onClick={() => shareJourney(allEvents)}
                  className="flex items-center gap-2 text-xs text-muted hover:text-fg py-1 transition-colors"
                >
                  <Share2 size={12} /> {strings.timelineShare}
                </button>
                <button
                  onClick={() => window.print()}
                  className="flex items-center gap-2 text-xs text-muted hover:text-fg py-1 transition-colors"
                >
                  <Printer size={12} /> {strings.timelinePrint}
                </button>
              </div>
            </div>
          </div>
        </aside>

        {/* Main column */}
        <div className="space-y-6 min-w-0">
          <div id="health-journey" className="border border-[var(--color-border)] rounded-2xl bg-[var(--color-surface)] p-6 scroll-mt-8">
            <p className="font-mono text-[10px] text-[var(--color-brand-gold)] tracking-widest uppercase mb-5">{strings.timelineHealthJourney}</p>
            <HealthJourneyRow events={events} />
          </div>

          <div id="signal-evolution" className="border border-[var(--color-border)] rounded-2xl bg-[var(--color-surface)] p-6 scroll-mt-8">
            <p className="font-mono text-[10px] text-[var(--color-brand-gold)] tracking-widest uppercase">{strings.timelineSignalEvolutionOverTime}</p>
            <p className="text-xs text-muted mt-1 mb-6">{strings.timelineSignalEvolutionSub}</p>
            <SignalEvolutionChart series={signalSeries} domains={signalDomains} height={260} grid legend />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <CareJourneyCard careJourney={summary?.careJourney ?? null} />
            <LifeStageCard lifeStage={summary?.lifeStage ?? null} />
            <TrajectoryCard trajectory={summary?.trajectory} />
            <NextStepsCard />
          </div>
        </div>

        {/* Right rail */}
        <div className="space-y-6">
          <div id="check-in-widget" className="border border-[var(--color-border)] rounded-2xl bg-[var(--color-surface)] p-6 scroll-mt-8">
            <p className="font-mono text-[10px] text-[var(--color-brand-gold)] tracking-widest uppercase mb-3">{strings.timelineCheckInWidgetTitle}</p>
            <p className="text-sm text-muted mb-4">{strings.timelineCheckInWidgetBody}</p>
            {signalTrends.length > 0 && (
              <div className="space-y-2 mb-4">
                {signalTrends.slice(0, 4).map((t) => (
                  <div key={t.domain} className="flex items-center justify-between text-xs">
                    <span className="text-muted">{domainLabel(t.domain, locale)}</span>
                    <span
                      className={
                        t.direction === "improving"
                          ? "text-[var(--color-brand-green)]"
                          : t.direction === "increasing"
                            ? "text-[var(--color-brand-orange)]"
                            : "text-faint"
                      }
                    >
                      {t.direction === "improving" ? strings.timelineTrendImproving : t.direction === "increasing" ? strings.trendIncreasing : strings.timelineTrendStable}
                    </span>
                  </div>
                ))}
              </div>
            )}
            <Link
              href="/check-in"
              className="w-full py-2.5 border border-[var(--color-brand-gold)] text-[var(--color-brand-gold)] rounded-lg text-xs flex items-center justify-center gap-2 hover:bg-[var(--color-brand-gold)] hover:text-on-gold transition-colors"
            >
              {strings.timelineStartCheckIn} <ArrowRight size={14} />
            </Link>
          </div>

          <div id="milestones" className="border border-[var(--color-border)] rounded-2xl bg-[var(--color-surface)] p-6 scroll-mt-8">
            <div className="flex items-center gap-2 mb-4">
              <Milestone size={14} className="text-[var(--color-brand-gold)]" />
              <p className="font-mono text-[10px] text-[var(--color-brand-gold)] tracking-widest uppercase">{strings.timelineMilestones}</p>
            </div>
            {milestones.length === 0 ? (
              <p className="text-sm text-faint">{strings.timelineMilestonesEmpty}</p>
            ) : (
              <ul className="space-y-3">
                {milestones.slice(0, 6).map((m) => (
                  <li key={m.id} className="flex items-start gap-3">
                    <Flag size={14} className="text-[var(--color-brand-gold)] mt-0.5 shrink-0" />
                    <div>
                      <p className="text-sm text-fg">{m.title}</p>
                      <p className="text-xs text-faint">{m.date}</p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
