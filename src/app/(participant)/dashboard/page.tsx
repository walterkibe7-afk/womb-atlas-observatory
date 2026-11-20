"use client";

import {
  ChevronDown,
  Sparkles,
  ArrowRight,
  LineChart,
  LogOut,
  Calendar,
  CalendarCheck,
  Folder,
  TrendingUp,
  AudioLines,
  Globe,
  Users,
  Shield,
  Lock,
  CloudDownload,
  ExternalLink,
  Brain,
  BookOpen,
  ChevronRight,
  type LucideIcon,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState, useRef } from "react";
import { useSession } from "next-auth/react";
import { logout } from "@/lib/logout";
import Link from "next/link";
import { useParticipantData } from "@/components/ParticipantDataProvider";
import { SignalSparklines } from "@/components/participant/SignalSparklines";
import { TimelineEventList } from "@/components/participant/TimelineEvents";
import { LivingConstellationPreview } from "@/components/participant/LivingConstellationPreview";
import { DominantPatternCard } from "@/components/participant/DominantPatternCard";
import { ArchetypeCard } from "@/components/participant/ArchetypeCard";
import { TopSignalsCard } from "@/components/participant/TopSignalsCard";
import { SupportingPatternsCard } from "@/components/participant/SupportingPatternsCard";
import { Card, SectionCard, SectionLink, Button, Badge, Donut, CompanionPortrait } from "@/components/ui";
import { useUiStrings } from "@/lib/observation/ui-strings-context";
import { burdenLabel } from "@/components/observation/burden-style";

function StatItem({ icon: Icon, value, lines }: { icon: LucideIcon; value: string; lines: string[] }) {
  return (
    <div className="text-center">
      <span className="grid h-13 w-13 mx-auto mb-3 place-items-center rounded-full border border-border-brand text-brand-gold">
        <Icon size={22} strokeWidth={1.5} />
      </span>
      <div className="text-brand-gold text-[15px] font-semibold">{value}</div>
      <div className="text-subtle text-[13px] mt-1.5 leading-tight">
        {lines.map((l) => (
          <div key={l}>{l}</div>
        ))}
      </div>
    </div>
  );
}

function IntelRow({
  icon: Icon,
  label,
  sub,
  href,
  chevron,
}: {
  icon: LucideIcon;
  label: string;
  sub: string;
  href?: string;
  chevron?: boolean;
}) {
  const content = (
    <>
      <Icon size={22} strokeWidth={1.4} className="text-brand-gold shrink-0 mt-0.5" />
      <div className="flex-1 min-w-0">
        <div className="text-fg text-[15px] font-semibold">{label}</div>
        <div className="text-subtle text-[13px] leading-snug">{sub}</div>
      </div>
      {chevron && <ChevronRight size={16} className="text-subtle shrink-0 mt-0.5" />}
    </>
  );
  if (href) {
    return (
      <Link href={href} className="flex gap-2.5 items-start hover:text-fg transition-colors">
        {content}
      </Link>
    );
  }
  return <div className="flex gap-2.5 items-start opacity-80">{content}</div>;
}

export default function MyObservatory() {
  const { data: session } = useSession();
  const { summary } = useParticipantData();
  const router = useRouter();
  const strings = useUiStrings();
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const userName = session?.user?.name || strings.participantFallbackName;
  const firstName = userName.split(" ")[0];
  const initial = userName.charAt(0).toUpperCase();

  const stats = summary?.stats;
  const progress = summary?.progress;
  const reflection = summary?.reflection;
  const topSignals = summary?.topSignals ?? [];
  const signalTrends = summary?.signalTrends ?? [];
  const timelineEvents = summary?.timelineEvents ?? [];
  const nextCheckIn = summary?.nextCheckIn;
  const contribution = summary?.contribution;
  const personalInsights = summary?.personalInsights ?? [];
  const observatoryInsights = summary?.observatoryInsights ?? [];
  const dominantPattern = summary?.dominantPattern ?? null;
  const supportingPatterns = summary?.supportingPatterns ?? [];
  const archetype = summary?.archetype ?? null;

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className="p-4 sm:p-8 pb-10 max-w-375 mx-auto space-y-5">
      {/* Header */}
      <header className="flex flex-col-reverse gap-4 sm:flex-row sm:justify-between sm:items-start">
        <div>
          <h1 className="font-serif text-[26px] sm:text-[32px] font-semibold text-fg flex items-center gap-3">
            {strings.dashboardWelcomeBack}, {firstName} <Sparkles size={26} strokeWidth={1.4} className="text-brand-gold shrink-0" />
          </h1>
          <p className="text-muted text-[15px] mt-2 max-w-xl leading-relaxed">
            {strings.dashboardIntro}
          </p>
        </div>
        <div className="flex items-center gap-4 shrink-0 self-end sm:self-auto">
          {/* <div className="relative w-12 h-12 rounded-full border border-border-active flex items-center justify-center">
            <Bell size={20} strokeWidth={1.6} className="text-brand-gold" />
            <span className="absolute -top-1 -right-1 w-5.5 h-5.5 rounded-full bg-danger text-fg text-xs font-bold flex items-center justify-center border-2 border-background">
              2
            </span>
          </div> */}
          <div className="relative" ref={dropdownRef}>
            <button
              onClick={() => setIsDropdownOpen((v) => !v)}
              className="flex items-center gap-3 pl-1.5 pr-4 py-1.5 rounded-full border border-border-active hover:bg-(--color-surface-hover) transition-colors max-w-full"
            >
              <span className="w-10.5 h-10.5 shrink-0 rounded-full bg-avatar flex items-center justify-center font-serif text-[22px] text-on-avatar">
                {initial}
              </span>
              <span className="text-[17px] text-fg truncate">{userName}</span>
              <ChevronDown size={18} className={`text-subtle transition-transform duration-200 ${isDropdownOpen ? "rotate-180" : ""}`} />
            </button>

            {isDropdownOpen && (
              <div className="absolute right-0 mt-2 min-w-45 bg-surface border border-border rounded-xl shadow-xl overflow-hidden z-50">
                <button
                  onClick={() => logout()}
                  className="w-full flex items-center gap-3 px-4 py-3 text-sm text-danger hover:bg-(--color-surface-hover) transition-colors text-left"
                >
                  <LogOut size={16} />
                  <span>{strings.logOut}</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Top row — three across only at 2xl. The sidebar becomes static at lg
          and takes 300px, so every multi-column row on this page has ~300px
          less to work with than the viewport implies; splitting at lg or xl
          left each card too narrow to hold its own content. */}
      <div className="grid grid-cols-1 md:grid-cols-2 2xl:grid-cols-[1fr_1.4fr_1fr] gap-5">
        {/* Continue Your Journey */}
        <SectionCard title={progress?.completed ? strings.dashboardYourJourney : strings.dashboardContinueYourJourney} className="relative overflow-hidden">
          <svg className="absolute top-6 right-3 opacity-40 pointer-events-none" width="140" height="110" viewBox="0 0 150 120" fill="none" aria-hidden="true">
            <g stroke="currentColor" className="text-brand-gold" strokeWidth="0.8">
              <line x1="20" y1="30" x2="70" y2="15" />
              <line x1="70" y1="15" x2="120" y2="40" />
              <line x1="20" y1="30" x2="55" y2="70" />
              <line x1="55" y1="70" x2="120" y2="40" />
              <line x1="55" y1="70" x2="95" y2="95" />
              <line x1="120" y1="40" x2="130" y2="85" />
              <line x1="95" y1="95" x2="130" y2="85" />
              <line x1="30" y1="95" x2="55" y2="70" />
            </g>
            <g fill="currentColor" className="text-brand-gold">
              <circle cx="20" cy="30" r="3" />
              <circle cx="70" cy="15" r="3.5" />
              <circle cx="120" cy="40" r="3" />
              <circle cx="55" cy="70" r="4" />
              <circle cx="95" cy="95" r="3" />
              <circle cx="130" cy="85" r="3" />
              <circle cx="30" cy="95" r="2.5" />
            </g>
          </svg>
          <h2 className="font-serif text-[26px] font-semibold text-fg mt-2 mb-2 relative">
            {progress?.completed ? strings.dashboardFirstObservationComplete : strings.dashboardContinueYourJourney}
          </h2>
          <p className="text-muted text-[15px] leading-relaxed mb-6 max-w-60 relative">
            {progress?.completed ? strings.dashboardJourneyRecordedBody : strings.dashboardJourneyOngoingBody}
          </p>
          <div className="h-1.75 rounded-full bg-surface-inset overflow-hidden mb-4 relative">
            <div
              className="h-full rounded-full bg-linear-to-r from-brand-gold to-brand-purple transition-all"
              style={{ width: `${progress?.percent ?? 0}%` }}
            />
          </div>
          <div className="flex items-center justify-between relative">
            <span className="text-brand-gold font-semibold text-[15px]">{progress?.percent ?? 0}% {strings.dashboardPercentComplete}</span>
            <Button variant="secondary" size="sm" onClick={() => router.push("/observation")}>
              {progress?.completed ? strings.dashboardReview : strings.dashboardContinue} <ArrowRight size={15} className="text-brand-gold" />
            </Button>
          </div>
        </SectionCard>

        {/* Your Health Journey */}
        <SectionCard title={strings.dashboardYourHealthJourney}>
          {/* 2-up, not 4-up: the page caps at max-w-375 and the sidebar takes
              300px, so this card tops out around 540px wide — four columns left
              each date ~60px and they overlapped. min-w drops the donut below
              the stats instead of squeezing them further. */}
          <div className="flex flex-wrap items-center justify-center gap-6">
            <div className="grid grid-cols-2 gap-4 flex-1 min-w-55">
              <StatItem icon={Calendar} value={stats?.firstObservationDate ?? "—"} lines={[strings.statFirst, strings.statObservation]} />
              <StatItem icon={CalendarCheck} value={stats?.latestObservationDate ?? "—"} lines={[strings.statLatest, strings.statObservation]} />
              <StatItem icon={Folder} value={String(stats?.totalAtlasRecords ?? 0)} lines={[strings.statAtlas, strings.statRecords]} />
              <StatItem icon={TrendingUp} value={stats?.streakLabel ?? "—"} lines={[strings.statObservation, strings.statObservationStreak]} />
            </div>
            <Donut percent={progress?.percent ?? 0} size={132} thickness={9}>
              <div className="font-serif text-[26px] font-semibold text-fg">{progress?.percent ?? 0}%</div>
              <div className="text-[11px] text-subtle leading-tight text-center mt-0.5">
                {strings.donutJourneyProgressLine1}
                <br />
                {strings.donutJourneyProgressLine2}
              </div>
            </Donut>
          </div>
        </SectionCard>

        {/* Your Companion — the portrait fills the card's leftover height and
            bleeds off the bottom/left edges, so it grows with the row. */}
        <SectionCard
          title={strings.dashboardYourCompanion}
          variant="plum"
          className="@container flex flex-col overflow-hidden"
          bodyClassName="flex-1 min-h-0 -mb-4"
        >
          <div className="flex h-full items-stretch gap-4">
            <CompanionPortrait className="-ml-4 -mt-1 w-[46%] min-w-25 max-w-70 min-h-50 shrink-0" />
            <div className="flex flex-1 min-w-0 flex-col justify-center pb-4">
              {/* Steps down when the card itself is narrow, so her name never
                  gets clipped by the portrait beside it. */}
              <div className="font-serif text-2xl @xs:text-[28px] font-semibold text-fg">Aminata</div>
              <p className="text-muted text-[15px] leading-snug my-1.5">
                {strings.sidebarCompanionRoleLine1}
                <br />
                {strings.sidebarCompanionRoleLine2}
              </p>
              <Button
                variant="secondary"
                size="sm"
                className="self-start"
                onClick={() => router.push("/chat")}
              >
                {strings.dashboardTalkToCompanion} <AudioLines size={16} className="text-brand-gold" />
              </Button>
            </div>
          </div>
        </SectionCard>
      </div>

      {/* Core insights — the three things the spec asks the observatory to lead
          with: what Atlas sees most strongly, who that makes her right now, and
          which signals are moving. Same 3-up breakpoint as the row above (the
          static sidebar takes 300px from lg, so splitting earlier leaves each
          card too narrow for its chips). items-stretch keeps the three the same
          height whichever has the longest copy. */}
      <div className="grid grid-cols-1 md:grid-cols-2 2xl:grid-cols-3 gap-5 items-stretch">
        <DominantPatternCard pattern={dominantPattern} />
        <ArchetypeCard archetype={archetype} />
        <TopSignalsCard signals={topSignals} />
      </div>

      {/* Left block + right column */}
      <div className="flex flex-col 2xl:flex-row gap-5 items-stretch">
        <div className="flex-1 min-w-0 flex flex-col gap-5">
          {/* Middle grid — all three cards share a fixed height so they line up
              evenly; each scrolls or centers internally rather than the row
              force-stretching a shorter card's content (which used to leave a
              dead gap at the bottom).

              Splits at 2xl, not xl: this row is really four columns wide once
              the 360px right column is counted, and at xl the 300px sidebar
              leaves ~536px for all three — the constellation collapsed to a
              sliver. minmax(0,…) rather than bare 1fr so a neighbour's
              min-content can't steal width and break the ratio; the
              constellation has no long words to defend itself with, so it was
              the track that got crushed. */}
          <div className="grid grid-cols-1 2xl:grid-cols-[minmax(0,1fr)_minmax(0,1.55fr)_minmax(0,1fr)] gap-5">
            <SectionCard
              title={strings.dashboardAtlasTimeline}
              action={
                <SectionLink href="/timeline" className="inline-flex items-center gap-1.5">
                  {strings.dashboardViewFullTimeline} <ArrowRight size={14} />
                </SectionLink>
              }
              className="2xl:h-150 flex flex-col"
              bodyClassName="2xl:flex-1 min-h-0 overflow-y-auto pr-1"
            >
              <TimelineEventList events={timelineEvents} max={5} order="asc" />
            </SectionCard>

            <Card variant="plum" padding={false} className="h-105 2xl:h-150">
              <LivingConstellationPreview />
            </Card>

            <SupportingPatternsCard patterns={supportingPatterns} />
          </div>

          {/* Bottom insight row */}
          {/* Cards stretch to a common height (no items-start) and each pins its
              footer link with mt-auto, so the four bottoms line up however much
              copy the insight text happens to be. */}
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5">
            <SectionCard title={strings.dashboardPersonalInsights} isNew className="flex flex-col" bodyClassName="flex flex-1 flex-col">
              <p className="text-subtle text-sm mb-4">{strings.dashboardPersonalInsightsIntro}</p>
              <div className="space-y-3">
                {personalInsights.slice(0, 2).map((insight, i) => (
                  <Card key={i} variant="inset" className="flex gap-3 items-center">
                    <Sparkles size={22} strokeWidth={1.4} className="text-brand-gold shrink-0" />
                    <p className="text-[14px] text-fg/90 leading-relaxed text-pretty">{insight}</p>
                  </Card>
                ))}
              </div>
              <SectionLink href="/reflections" className="mt-auto pt-4 inline-flex items-center gap-1.5">
                {strings.dashboardExploreMorePersonalInsights} <ArrowRight size={14} />
              </SectionLink>
            </SectionCard>

            <SectionCard title={strings.dashboardObservatoryInsights} className="flex flex-col" bodyClassName="flex flex-1 flex-col">
              <p className="text-subtle text-sm mb-4">{strings.dashboardObservatoryInsightsIntro}</p>
              <div className="space-y-3">
                {observatoryInsights.slice(0, 2).map((insight, i) => (
                  <Card key={i} variant="inset" className="flex gap-3 items-center">
                    <Users size={22} strokeWidth={1.4} className="text-brand-gold shrink-0" />
                    <p className="text-[14px] text-fg/90 leading-relaxed text-pretty">{insight}</p>
                  </Card>
                ))}
              </div>
              <SectionLink href="/timeline" className="mt-auto pt-4 inline-flex items-center gap-1.5">
                {strings.dashboardExploreObservatoryInsights} <ArrowRight size={14} />
              </SectionLink>
            </SectionCard>

            <SectionCard title={strings.dashboardNextCheckIn} isNew className="flex flex-col" bodyClassName="flex flex-1 flex-col">
              {/* Caption sits above the icon row rather than beside it — in a quarter
                  -width column there isn't room for both, which stranded "in" on its
                  own line. Full width also matches the sibling cards' intro line. */}
              <p className="text-subtle text-sm mb-4">{strings.dashboardNextCheckInDue}</p>
              <div className="flex items-center gap-3.5">
                <span className="grid h-12 w-12 shrink-0 place-items-center rounded-panel border border-border-brand text-brand-gold">
                  <Calendar size={22} strokeWidth={1.5} />
                </span>
                <div className="min-w-0">
                  {nextCheckIn?.daysRemaining != null ? (
                    <p className="font-serif text-[26px] text-fg leading-tight">
                      {nextCheckIn.ready ? strings.dashboardCheckInReadyNow : `${nextCheckIn.daysRemaining} ${strings.dashboardCheckInDays}`}
                    </p>
                  ) : (
                    <p className="font-serif text-lg text-fg leading-tight">{strings.dashboardCheckInAfterFirstRecord}</p>
                  )}
                  <p className="text-subtle text-[12px] leading-snug">{strings.dashboardCheckInWheneverReady}</p>
                </div>
              </div>
              <SectionLink href="/check-in" className="mt-auto pt-4 inline-flex items-center gap-1.5">
                {strings.dashboardStartCheckIn} <ArrowRight size={14} />
              </SectionLink>
            </SectionCard>

            <SectionCard title={strings.dashboardYourContribution} isNew className="flex flex-col" bodyClassName="flex flex-1 flex-col">
              <p className="text-subtle text-sm mb-4">{strings.dashboardContributionIntro}</p>
              {/* An even 2-up grid, not `flex gap-6` — equal columns keep the two
                  stats from crowding each other. The labels wrap on their own
                  instead of via hardcoded <br />, which was breaking them into
                  three ragged lines once the column got narrow. */}
              <div className="grid grid-cols-2 gap-4">
                <div className="flex items-center gap-3">
                  <Globe size={26} strokeWidth={1.3} className="text-brand-gold shrink-0" />
                  <div className="min-w-0">
                    <div className="font-serif text-[26px] font-semibold text-fg leading-none">
                      {contribution?.atlasRecordsContributed ?? 0}
                    </div>
                    <div className="text-subtle text-[12px] mt-1 leading-tight">{strings.dashboardAtlasRecordsContributed}</div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Users size={26} strokeWidth={1.3} className="text-brand-gold shrink-0" />
                  <div className="min-w-0">
                    <div className="font-serif text-[26px] font-semibold text-fg leading-none">
                      {contribution?.countriesRepresented ?? 0}
                    </div>
                    <div className="text-subtle text-[12px] mt-1 leading-tight">{strings.dashboardCountriesRepresented}</div>
                  </div>
                </div>
              </div>
              <SectionLink className="mt-auto pt-4 inline-flex items-center gap-1.5">
                {strings.dashboardSeeImpact} <ArrowRight size={14} />
              </SectionLink>
            </SectionCard>
          </div>
        </div>

        {/* Right column */}
        <div className="2xl:w-90 2xl:shrink-0 flex flex-col gap-5">
          <SectionCard
            title={strings.dashboardYourReflection}
            titleBadge={<Badge variant="gold-outline">{reflection?.burden ? `${burdenLabel(reflection.burden, strings)} ${strings.dashboardReflectionBurden}` : strings.dashboardReflectionLatest}</Badge>}
            action={
              <SectionLink href="/reflections" className="inline-flex items-center gap-1.5 text-[13px]">
                {strings.dashboardViewAllReflections} <ArrowRight size={13} />
              </SectionLink>
            }
          >
            <p className="text-muted text-[15px] leading-relaxed mb-4">
              {strings.dashboardReflectionIntro}
            </p>
            <Card variant="inset" className="flex gap-3 items-start mb-4">
              <Sparkles size={22} strokeWidth={1.4} className="text-brand-gold shrink-0 mt-0.5" />
              <p className="text-[14px] text-fg/90 leading-relaxed">
                {reflection?.summary ?? strings.dashboardReflectionFallback}
              </p>
            </Card>
            <Button variant="secondary" className="w-full mb-3" onClick={() => router.push("/reflections")}>
              <span className="flex w-full items-center gap-2.5">
                <LineChart size={17} className="text-brand-gold" /> {strings.dashboardCompareReflection}
              </span>
            </Button>
            <Button variant="secondary" className="w-full" onClick={() => router.push("/reflections")}>
              <span className="flex w-full items-center justify-between">
                {strings.dashboardViewReflection} <ArrowRight size={17} className="text-brand-gold" />
              </span>
            </Button>
          </SectionCard>

          {/* 2-up while this column is full width, but a single column once xl
              pins it to the 360px rail — two cells there left ~160px each, which
              wrapped "Observed Patterns" onto a second line and knocked it out of
              alignment with the single-line "Reflection" beside it. */}
          <SectionCard
            title={strings.dashboardAtlasIntelligence}
            bodyClassName="grid grid-cols-2 2xl:grid-cols-1 gap-x-4 gap-y-5 items-start"
          >
            <IntelRow icon={Sparkles} label={strings.intelObservedPatterns} sub={strings.intelObservedPatternsSub} href="/records" chevron />
            <IntelRow icon={Brain} label={strings.intelReflection} sub={strings.intelReflectionSub} href="/reflections" />
            <IntelRow icon={TrendingUp} label={strings.intelTrajectory} sub={strings.intelTrajectorySub} href="/timeline" />
            <IntelRow icon={BookOpen} label={strings.intelKnowledge} sub={strings.intelKnowledgeSub} />
          </SectionCard>

          {/* Domain rollups, not signals — distinct from "Your Top Signals"
              above, which lists the named register entries. These six are
              averaged from the *patterns* a record produced, so they answer
              "which areas of life are loudest over time" rather than "what did
              Atlas detect". The subtitle says so, because the two cards used to
              be told apart only by where they sat on the page. */}
          <SectionCard
            title={strings.dashboardSignalEvolution}
            action={
              <SectionLink href="/timeline" className="inline-flex items-center gap-1.5 text-[13px]">
                {strings.dashboardViewFullChart} <ArrowRight size={13} />
              </SectionLink>
            }
            bodyClassName="@container"
          >
            <p className="text-muted text-[14px] mb-5">
              {strings.dashboardSignalEvolutionIntro}
            </p>
            <SignalSparklines trends={signalTrends} />
            <p className="text-faint text-[12px] mt-5 leading-relaxed">
              {strings.dashboardSignalEvolutionDisclaimer}
            </p>
          </SectionCard>
        </div>
      </div>

      {/* Privacy Footer */}
      <div className="border-t border-border-subtle mt-2 pt-6 flex flex-col md:flex-row items-center justify-between gap-5">
        <div className="flex flex-wrap items-start gap-x-9 gap-y-3">
          <span className="flex items-start gap-2.5">
            <Shield size={20} strokeWidth={1.4} className="text-brand-gold shrink-0 mt-0.5" />
            <span className="text-muted text-sm leading-snug">
              {strings.privacyBelongsToYou}
              <br />
              <span className="text-subtle">{strings.privacyYouControlData}</span>
            </span>
          </span>
          <span className="flex items-start gap-2.5">
            <Lock size={20} strokeWidth={1.4} className="text-brand-gold shrink-0 mt-0.5" />
            <span className="text-muted text-sm leading-snug">
              {strings.privacyNeverSell}
              <br />
              <span className="text-subtle">{strings.privacyEver}</span>
            </span>
          </span>
          <span className="flex items-start gap-2.5">
            <CloudDownload size={20} strokeWidth={1.4} className="text-brand-gold shrink-0 mt-0.5" />
            <span className="text-muted text-sm leading-snug">
              {strings.privacyDeleteExport}
              <br />
              <span className="text-subtle">{strings.privacyYourDataAnytime}</span>
            </span>
          </span>
        </div>
        <SectionLink className="inline-flex items-center gap-2 text-[15px] shrink-0">
          {strings.privacyLearnMore} <ExternalLink size={16} />
        </SectionLink>
      </div>
    </div>
  );
}
