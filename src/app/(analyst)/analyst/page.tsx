"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import {
  Users,
  FileText,
  MessageSquare,
  Activity,
  Globe,
  Repeat,
  ArrowRight,
  Share2,
  Download,
  Bell,
  ChevronDown,
  Calendar,
  BrainCircuit,
  Flame,
  Pill,
  Clock,
  Zap,
  MessageCircle,
  Shield,
  ShieldCheck,
  Lock,
  User,
  Search,
  ScanSearch,
  TrendingUp,
  Sparkles,
  Minus,
} from "lucide-react";
import { Card, SectionLink, Sparkline, Donut, Avatar, Badge } from "@/components/ui";
import { cn } from "@/lib/cn";

// ─── Types ──────────────────────────────────────────────────────────
interface TopStat {
  label: string;
  value: string;
  change: string;
  trend: "up" | "down" | "neutral";
  icon: React.ElementType;
  live: boolean;
}

interface PatternRow {
  name: string;
  description: string;
  count: string;
  change: string;
  icon: React.ElementType;
}

interface TrajectorySignal {
  name: string;
  trend: number[];
  change: string;
  direction: "Increasing" | "Decreasing";
}

interface RelationshipNode {
  name: string;
  x: number;
  y: number;
  size: number;
  strength?: number;
}

// ─── API payload shapes (computed server-side) ─────────────────────
interface StatDelta {
  pct: number;
  trend: "up" | "down" | "neutral";
  label: string;
}

interface ApiPattern {
  name: string;
  domain: string;
  description: string;
  count: string;
  change: string;
}

interface ApiTrajectory {
  name: string;
  trend: number[];
  change: string;
  direction: "Increasing" | "Decreasing";
}

interface ApiRelationships {
  central: string;
  nodes: { name: string; strength: number; size: number }[];
}

interface ApiEmerging {
  expression: string;
  regions: number;
  mentions: string;
  change: string;
}

interface ApiLanguage {
  language: string;
  region: string;
  phrases: string;
  usage: string;
  trend: string;
}

interface ApiQuestion {
  question: string;
  signals: number;
  women: number;
  womenLabel: string;
}

interface ApiJourney {
  stages: { label: string; count: number }[];
  donutPercent: number;
  insights: string[];
}

interface AnalystStats {
  totalContributors: number;
  atlasRecords: number;
  observations: number;
  signals: number;
  regionsActive: number;
  repeatRate: number;
  deltas: Record<
    "totalContributors" | "atlasRecords" | "observations" | "signals" | "regionsActive" | "repeatRate",
    StatDelta
  >;
  patterns: ApiPattern[];
  trajectory: ApiTrajectory[];
  trajectoryRegions: { code: string; name: string }[];
  trajectoryByRegion: Record<string, ApiTrajectory[]>;
  relationships: ApiRelationships | null;
  emerging: ApiEmerging[];
  languages: ApiLanguage[];
  questions: ApiQuestion[];
  journey: ApiJourney | null;
  statsLoaded: boolean;
}

// Map an AIKB pattern domain to an icon for the Pattern Intelligence card.
const DOMAIN_ICONS: Record<string, React.ElementType> = {
  Body: Activity,
  Function: Zap,
  Care: Clock,
  Narrative: MessageCircle,
  Protective: Shield,
  Trajectory: TrendingUp,
  "Cross-Domain": Sparkles,
  Research: BrainCircuit,
};

// Lay computed relationship nodes out radially around a central hub so
// they render in the same SVG the static placeholder used.
function layoutRelationshipNodes(rel: ApiRelationships): RelationshipNode[] {
  const central: RelationshipNode = { name: rel.central, x: 50, y: 50, size: 60 };
  const spokes = rel.nodes.map((n, i) => {
    const angle = (i / rel.nodes.length) * Math.PI * 2 - Math.PI / 2;
    return {
      name: n.name,
      x: 50 + Math.cos(angle) * 36,
      y: 50 + Math.sin(angle) * 36,
      size: n.size,
      strength: n.strength,
    };
  });
  return [central, ...spokes];
}

interface LanguageRow {
  language: string;
  region: string;
  phrases: string;
  usage: string;
  trend: string;
}

interface JourneyStep {
  label: string;
  icon: React.ElementType;
}

interface AtlasQuestion {
  question: string;
  signals: number;
  women: string;
  icon: React.ElementType;
}

interface EmergingExpression {
  expression: string;
  regions: number;
  mentions: string;
  change: string;
}

// ─── Static data (sections where DB stats can't be computed yet) ───
const STATIC_PATTERNS: PatternRow[] = [
  { name: "Structural Burden Pattern", description: "Heavy bleeding, pelvic pressure, enlargement, back pain", count: "38,621", change: "▲ 14%", icon: Activity },
  { name: "Inflammatory Pattern", description: "Pain, abdominal/lower symptoms, fatigue, sleep disruption", count: "27,314", change: "▲ 11%", icon: Flame },
  { name: "Hormonal Pattern", description: "Irregular cycles, acne, mood changes, hair changes, fatigue", count: "19,876", change: "▲ 9%", icon: Pill },
  { name: "Care Delay Pattern", description: "Dismissal, normalization, delay in care, worsening symptoms", count: "22,109", change: "▲ 7%", icon: Clock },
];

const STATIC_TRAJECTORY_SIGNALS: TrajectorySignal[] = [
  { name: "Pain", trend: [4, 5, 3, 7, 6, 8, 9], change: "▲ 24%", direction: "Increasing" },
  { name: "Fatigue", trend: [3, 4, 5, 4, 6, 7, 7], change: "▲ 18%", direction: "Increasing" },
  { name: "Heavy Bleeding", trend: [5, 4, 6, 5, 7, 6, 7], change: "▲ 12%", direction: "Increasing" },
  { name: "Dismissal / Not Taken Seriously", trend: [8, 7, 7, 6, 6, 5, 5], change: "▼ 7%", direction: "Decreasing" },
  { name: "Care Access Barriers", trend: [6, 6, 5, 5, 5, 4, 4], change: "▼ 3%", direction: "Decreasing" },
  { name: "Sleep Disruption", trend: [3, 3, 4, 4, 5, 5, 6], change: "▲ 9%", direction: "Increasing" },
];

const STATIC_RELATIONSHIP_NODES: RelationshipNode[] = [
  { name: "Heavy Bleeding", x: 50, y: 50, size: 60 },
  { name: "Fatigue", x: 15, y: 25, size: 32, strength: 0.78 },
  { name: "Anemia", x: 78, y: 18, size: 28, strength: 0.71 },
  { name: "Pelvic Pressure", x: 88, y: 42, size: 26, strength: 0.82 },
  { name: "Sleep Disruption", x: 12, y: 52, size: 24, strength: 0.67 },
  { name: "Back Pain", x: 85, y: 68, size: 22, strength: 0.64 },
  { name: "Mood Changes", x: 22, y: 78, size: 26, strength: 0.61 },
  { name: "Work Impact", x: 58, y: 88, size: 20, strength: 0.58 },
];

const STATIC_LANGUAGES: LanguageRow[] = [
  { language: "Swahili", region: "Kenya", phrases: '"kuuma", "moto", "uchungu"', usage: "12,431", trend: "▲ 16%" },
  { language: "Portuguese", region: "Brazil", phrases: '"queimação", "dor forte"', usage: "9,842", trend: "▲ 11%" },
  { language: "Spanish", region: "Mexico", phrases: '"ardor", "dolor fuerte"', usage: "8,210", trend: "▲ 9%" },
  { language: "English", region: "USA", phrases: '"burning", "cramping", "stabbing"', usage: "7,654", trend: "▲ 7%" },
];

const JOURNEY_STEPS: JourneyStep[] = [
  { label: "Normalization of Symptoms", icon: Minus },
  { label: "Delayed Care", icon: Clock },
  { label: "High Burden", icon: Activity },
  { label: "Seeking Care", icon: Search },
  { label: "Diagnosis & Management", icon: Shield },
];

const STATIC_QUESTIONS: AtlasQuestion[] = [
  { question: "Why is dismissal increasing in certain regions?", signals: 12, women: "142K", icon: ScanSearch },
  { question: "Why is fatigue increasing across age 30–39?", signals: 8, women: "98K", icon: Flame },
  { question: "Why are women delaying care despite high symptom burden?", signals: 15, women: "131K", icon: FileText },
];

const STATIC_EMERGING: EmergingExpression[] = [
  { expression: "Appetite Changes", regions: 8, mentions: "1,243", change: "▲ 62%" },
  { expression: "Brain Fog", regions: 6, mentions: "987", change: "▲ 48%" },
  { expression: "Joint Pain", regions: 7, mentions: "856", change: "▲ 41%" },
  { expression: "Bloating", regions: 9, mentions: "1,102", change: "▲ 38%" },
  { expression: "Heat Sensitivity", regions: 5, mentions: "612", change: "▲ 32%" },
];

const RECENT_QUESTIONS = [
  "Why are women delaying care in East Africa?",
  "What are the top factors in dismissal?",
  "Compare heavy bleeding in East Africa vs South Asia",
  "What are emerging symptoms in adolescents?",
  "How does care access impact outcomes?",
];

const FOOTER_ITEMS = [
  { icon: Lock, title: "Data is Encrypted", sub: "Your privacy is protected." },
  { icon: ShieldCheck, title: "We Do Not Provide Medical Advice", sub: "This is not a diagnostic tool." },
  { icon: User, title: "Context Matters", sub: "Insights are based on self-reported data." },
  { icon: Users, title: "You Are in Control", sub: "You can delete or export your data anytime." },
];

// Header date-range filter — scopes the whole dashboard server-side.
type RangeKey = "7d" | "30d" | "90d" | "all";
const RANGE_OPTIONS: { key: RangeKey; label: string; short: string }[] = [
  { key: "7d", label: "Last 7 days", short: "7 Days" },
  { key: "30d", label: "Last 30 days", short: "30 Days" },
  { key: "90d", label: "Last 90 days", short: "90 Days" },
  { key: "all", label: "All time", short: "All Time" },
];

// Fixed illustrative sparkline for the top-stat tiles (no per-stat series yet).
const STAT_SPARK = [3, 5, 4, 7, 6, 8, 7];

// Top-stat deltas read as a warm coral accent; only "up" carries it, matching
// the design. Down cools to green, no-change recedes to a muted tone.
function trendClass(trend: "up" | "down" | "neutral") {
  if (trend === "up") return "text-danger";
  if (trend === "down") return "text-brand-green";
  return "text-subtle";
}

// ─── Relationship-map helpers ──────────────────────────────────────
// Per-spoke ring colours, cycled to echo the Figma's multi-hued nodes.
const NODE_COLORS = [
  "var(--color-brand-gold)",
  "var(--color-brand-purple)",
  "var(--color-danger)",
  "var(--color-brand-green)",
  "var(--color-brand-orange)",
  "var(--color-brand-blue)",
];

// Connectors run warm (strong) → cool (weak), matching the legend gradient.
function strengthColor(s?: number) {
  if (s == null || s >= 0.75) return "var(--color-brand-gold)";
  if (s >= 0.6) return "var(--color-brand-orange)";
  return "var(--color-brand-purple)";
}

// SVG has no auto-wrap; greedily pack words into lines of <= maxChars so node
// labels sit inside their circles.
function wrapLabel(name: string, maxChars: number): string[] {
  const lines: string[] = [];
  let cur = "";
  for (const w of name.split(/\s+/)) {
    if (!cur) cur = w;
    else if ((cur + " " + w).length <= maxChars) cur += " " + w;
    else {
      lines.push(cur);
      cur = w;
    }
  }
  if (cur) lines.push(cur);
  return lines;
}

const HUB_RADIUS = 13;
const spokeRadius = (size: number) => Math.max(7, Math.min(9, size / 6));

// ─── Loading skeleton (shown while stats are being fetched) ─────────
function SectionLoading({ rows = 4 }: { rows?: number }) {
  return (
    <div className="space-y-3 animate-pulse" aria-busy="true" aria-live="polite">
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          className="h-12 rounded-[var(--radius-panel)] border border-[var(--color-border)] bg-[var(--color-surface-inset)]"
        />
      ))}
    </div>
  );
}

// ─── Static badge (marks placeholder sections) ─────────────────────
function StaticBadge() {
  return (
    <span className="text-[9px] bg-[var(--color-surface-hover)] border border-[var(--color-border)] text-subtle px-1.5 py-0.5 rounded-[5px] whitespace-nowrap">
      Static
    </span>
  );
}

// ─── Section header (numbered gold title + subtitle + action) ───────
function SectionHeader({
  number,
  title,
  subtitle,
  isNew,
  actionLabel,
  actionHref,
  isStatic,
}: {
  number: number;
  title: string;
  subtitle: string;
  isNew?: boolean;
  actionLabel?: string;
  actionHref?: string;
  isStatic?: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-2 mb-4">
      <div>
        <div className="flex items-center gap-2 mb-1 flex-wrap">
          <span className="font-serif text-[11px] text-brand-gold uppercase tracking-[0.12em] font-semibold">
            {number}. {title}
          </span>
          {isNew && <Badge variant="new">NEW</Badge>}
          {isStatic && <StaticBadge />}
        </div>
        <p className="text-xs text-muted">{subtitle}</p>
      </div>
      {actionLabel && (
        <SectionLink href={actionHref || "#"} className="shrink-0 flex items-center gap-1">
          {actionLabel} <ArrowRight size={12} />
        </SectionLink>
      )}
    </div>
  );
}

// ─── Explore footer link (repeats at the bottom of each card) ──────
function ExploreLink({ children }: { children: React.ReactNode }) {
  return (
    <a
      href="#"
      className="mt-4 text-[11px] text-muted hover:text-fg flex items-center justify-end gap-1 transition-colors"
    >
      <span>{children}</span>
      <ArrowRight size={12} />
    </a>
  );
}

// ─── Top-stat tile ─────────────────────────────────────────────────
// Shares the steward MetricCard's horizontal layout (bare icon on the left,
// label/value/delta stacked beside it) and adds the Atlas Intelligence
// sparkline on the right plus a coral delta line.
function TopStatCard({ stat }: { stat: TopStat }) {
  const Icon = stat.icon;
  return (
    <Card className="flex items-center gap-3">
      <Icon size={28} strokeWidth={1.4} className="text-brand-gold shrink-0" />
      <div className="min-w-0 flex-1">
        <p className="text-[11px] text-muted leading-tight">{stat.label}</p>
        <p className="font-serif text-[26px] leading-none font-semibold text-fg mt-1 mb-1">
          {stat.value}
        </p>
        <p className={cn("text-[10px]", trendClass(stat.trend))}>{stat.change}</p>
      </div>
      {/* Decorative — hidden on the narrowest 2-up mobile grid so the label/value
          keep room instead of wrapping word-by-word. */}
      <span className="hidden sm:block shrink-0">
        <Sparkline data={STAT_SPARK} color="var(--color-brand-gold)" width={58} height={30} />
      </span>
    </Card>
  );
}

const journeyDonutData = { percent: 41 };

// ─── Main Page ─────────────────────────────────────────────────────
export default function AtlasIntelligencePage() {
  const { data: session } = useSession();
  const [stats, setStats] = useState<AnalystStats | null>(null);

  const userName = session?.user?.name ?? "Analyst";
  const initials = userName
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const [loading, setLoading] = useState(true);
  const [range, setRange] = useState<RangeKey>("90d");
  const [rangeOpen, setRangeOpen] = useState(false);
  // Trajectory card's Region filter (client-side; "all" = every region).
  const [trajRegion, setTrajRegion] = useState<string>("all");
  const [trajRegionOpen, setTrajRegionOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/analyst/stats?range=${range}`)
      .then((r) => r.json())
      .then((data) => {
        if (!cancelled) setStats({ ...data, statsLoaded: true });
      })
      .catch(() => {
        if (!cancelled) setStats(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [range]);

  // If the current data no longer has the selected region (e.g. after a range
  // change), fall back to "All Regions" so the card never shows an empty view.
  useEffect(() => {
    if (trajRegion !== "all" && !stats?.trajectoryByRegion?.[trajRegion]) {
      setTrajRegion("all");
    }
  }, [stats, trajRegion]);

  const loaded = !!stats?.statsLoaded;
  const d = stats?.deltas;
  const topStats: TopStat[] = [
    {
      label: "Total Contributors",
      value: loaded ? stats!.totalContributors.toLocaleString() : "—",
      change: d?.totalContributors.label ?? "—",
      trend: d?.totalContributors.trend ?? "neutral",
      icon: Users,
      live: loaded,
    },
    {
      label: "Atlas Records",
      value: loaded ? stats!.atlasRecords.toLocaleString() : "—",
      change: d?.atlasRecords.label ?? "—",
      trend: d?.atlasRecords.trend ?? "neutral",
      icon: FileText,
      live: loaded,
    },
    {
      label: "Observations Preserved",
      value: loaded ? stats!.observations.toLocaleString() : "—",
      change: d?.observations.label ?? "—",
      trend: d?.observations.trend ?? "neutral",
      icon: MessageSquare,
      live: loaded,
    },
    {
      label: "Meanings Identified",
      value: loaded ? stats!.signals.toLocaleString() : "—",
      change: d?.signals.label ?? "—",
      trend: d?.signals.trend ?? "neutral",
      icon: Activity,
      live: loaded,
    },
    {
      label: "Regions Active",
      value: loaded ? stats!.regionsActive.toLocaleString() : "—",
      change: d?.regionsActive.label ?? "No change",
      trend: d?.regionsActive.trend ?? "neutral",
      icon: Globe,
      live: loaded,
    },
    {
      label: "Avg. Repeat Rate (90 Days)",
      value: loaded ? `${stats!.repeatRate}%` : "—",
      change: d?.repeatRate.label ?? "—",
      trend: d?.repeatRate.trend ?? "neutral",
      icon: Repeat,
      live: loaded,
    },
  ];

  // Resolve each dynamic section to computed data when present, else the
  // illustrative placeholder — `dyn` flags which is which for the badge.
  const patternData: PatternRow[] =
    stats?.patterns && stats.patterns.length > 0
      ? stats.patterns.map((p) => ({
          name: p.name,
          description: p.description,
          count: p.count,
          change: p.change,
          icon: DOMAIN_ICONS[p.domain] ?? Activity,
        }))
      : STATIC_PATTERNS;
  const patternsDyn = !!(stats?.patterns && stats.patterns.length > 0);

  const trajectoryData: TrajectorySignal[] =
    stats?.trajectory && stats.trajectory.length > 0
      ? stats.trajectory
      : STATIC_TRAJECTORY_SIGNALS;
  const trajectoryDyn = !!(stats?.trajectory && stats.trajectory.length > 0);

  // Region filter for the Trajectory card. Options come from the API (only
  // regions with real data); "all" shows the unscoped trajectory above.
  const trajRegions = stats?.trajectoryRegions ?? [];
  const trajectoryForRegion: TrajectorySignal[] =
    trajRegion !== "all" && stats?.trajectoryByRegion?.[trajRegion]
      ? stats.trajectoryByRegion[trajRegion]
      : trajectoryData;
  const trajRegionLabel =
    trajRegion === "all"
      ? "All Regions"
      : trajRegions.find((r) => r.code === trajRegion)?.name ?? "All Regions";

  const relationshipData: RelationshipNode[] = stats?.relationships
    ? layoutRelationshipNodes(stats.relationships)
    : STATIC_RELATIONSHIP_NODES;
  const relationshipsDyn = !!stats?.relationships;

  const emergingData: EmergingExpression[] =
    stats?.emerging && stats.emerging.length > 0
      ? stats.emerging
      : STATIC_EMERGING;
  const emergingDyn = !!(stats?.emerging && stats.emerging.length > 0);

  const languageData: LanguageRow[] =
    stats?.languages && stats.languages.length > 0
      ? stats.languages
      : STATIC_LANGUAGES;
  const languagesDyn = !!(stats?.languages && stats.languages.length > 0);

  // Atlas Questions — templated from rising signals; icons cycle so each row
  // still reads distinctly against the illustrative placeholder set.
  const QUESTION_ICONS = [ScanSearch, Flame, FileText];
  const questionsDyn = !!(stats?.questions && stats.questions.length > 0);
  const questionData: AtlasQuestion[] = questionsDyn
    ? stats!.questions.map((q, i) => ({
        question: q.question,
        signals: q.signals,
        women: q.womenLabel,
        icon: QUESTION_ICONS[i % QUESTION_ICONS.length],
      }))
    : STATIC_QUESTIONS;

  // Atlas Trajectories — real per-stage counts + donut + bullets when present,
  // else the fixed illustrative journey.
  const journeyDyn = !!stats?.journey;
  const journeyStages: { label: string; icon: React.ElementType; count?: number }[] = journeyDyn
    ? stats!.journey!.stages.map((s, i) => ({
        label: s.label,
        icon: JOURNEY_STEPS[i]?.icon ?? Activity,
        count: s.count,
      }))
    : JOURNEY_STEPS;
  const journeyPercent = journeyDyn ? stats!.journey!.donutPercent : journeyDonutData.percent;
  const journeyInsights: string[] = journeyDyn
    ? stats!.journey!.insights
    : [
        "This journey is most common in age 30–39.",
        "Average delay before seeking care: 2.4 years.",
        'Fatigue and pain increase significantly in the "High Burden" stage.',
      ];

  // Short label for windowed table headers ("Trend (30 Days)", etc.).
  const rangeShort = RANGE_OPTIONS.find((o) => o.key === range)?.short ?? "7 Days";

  return (
    <div className="p-4 sm:p-8 pb-20 max-w-[1600px] mx-auto space-y-6">
      {/* ─── Header ──────────────────────────────────────────────── */}
      <header className="flex justify-between items-start gap-4 flex-wrap mb-2">
        <div>
          <h1 className="font-serif text-2xl sm:text-[32px] text-fg mb-2 flex items-center gap-2">
            Atlas Intelligence
            <Sparkles size={22} className="text-brand-gold" />
          </h1>
          <p className="text-muted text-sm">
            Turning meaning into collective insight about women&apos;s health experiences.
          </p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          {/* Date range filter — scopes the whole dashboard */}
          <div className="relative">
            <button
              onClick={() => setRangeOpen((o) => !o)}
              className="flex items-center gap-2 px-4 py-2 rounded-full border border-[var(--color-border)] bg-[var(--color-surface-inset)] text-xs text-secondary hover:text-fg hover:border-brand-gold transition-colors"
              aria-haspopup="listbox"
              aria-expanded={rangeOpen}
            >
              <Calendar size={14} className="text-brand-gold" />
              <span>{RANGE_OPTIONS.find((o) => o.key === range)?.label}</span>
              <ChevronDown
                size={14}
                className={cn("text-subtle transition-transform", rangeOpen && "rotate-180")}
              />
            </button>
            {rangeOpen && (
              <>
                {/* Click-away overlay */}
                <div className="fixed inset-0 z-10" onClick={() => setRangeOpen(false)} />
                <ul
                  role="listbox"
                  className="absolute right-0 mt-2 z-20 min-w-[160px] rounded-[var(--radius-panel)] border border-[var(--color-border)] bg-[var(--color-surface)] py-1 shadow-lg"
                >
                  {RANGE_OPTIONS.map((o) => (
                    <li key={o.key}>
                      <button
                        role="option"
                        aria-selected={range === o.key}
                        onClick={() => {
                          if (o.key !== range) setLoading(true);
                          setRange(o.key);
                          setRangeOpen(false);
                        }}
                        className={cn(
                          "w-full text-left px-4 py-2 text-xs transition-colors hover:bg-[var(--color-surface-hover)]",
                          range === o.key ? "text-brand-gold" : "text-secondary",
                        )}
                      >
                        {o.label}
                      </button>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>
          {/* Share */}
          <button className="flex items-center gap-2 px-4 py-2 rounded-full border border-[var(--color-border)] bg-[var(--color-surface-inset)] text-xs text-secondary hover:text-fg hover:border-brand-gold transition-colors">
            <Share2 size={14} />
            <span>Share</span>
          </button>
          {/* Export */}
          <button className="flex items-center gap-2 px-4 py-2 rounded-full border border-[var(--color-border)] bg-[var(--color-surface-inset)] text-xs text-secondary hover:text-fg hover:border-brand-gold transition-colors">
            <Download size={14} />
            <span>Export</span>
          </button>
          {/* Notification bell */}
          <div className="relative">
            <button className="w-10 h-10 rounded-full border border-[var(--color-border)] bg-[var(--color-surface-inset)] flex items-center justify-center text-secondary hover:text-fg transition-colors">
              <Bell size={16} />
            </button>
            <span className="absolute -top-1 -right-1 w-5 h-5 bg-brand-orange rounded-full text-[10px] text-on-gold flex items-center justify-center font-semibold">
              7
            </span>
          </div>
          {/* User */}
          <div className="flex items-center gap-2.5 pl-1.5 pr-3 py-1.5 rounded-full border border-[var(--color-border)] bg-[var(--color-surface-inset)]">
            <Avatar initials={initials} size={32} />
            <div className="text-xs">
              <p className="font-semibold text-fg">{userName}</p>
              <p className="text-[10px] text-brand-gold">Analyst</p>
            </div>
            <ChevronDown size={12} className="text-subtle" />
          </div>
        </div>
      </header>

      {/* ─── Top Stats Row ───────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {topStats.map((stat, i) => (
          <TopStatCard key={i} stat={stat} />
        ))}
      </div>

      {/* ─── Row 1: Pattern + Trajectory + Relationships ─────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 1. Pattern Intelligence */}
        <Card className="flex flex-col">
          <SectionHeader
            number={1}
            title="Pattern Intelligence"
            subtitle="AI-identified patterns across signals and experiences."
            isNew
            actionLabel="View all"
            isStatic={!loading && !patternsDyn}
          />
          {loading ? (
            <SectionLoading />
          ) : (
            <div className="space-y-3">
              {patternData.map((p, i) => {
                const Icon = p.icon;
                return (
                  <div
                    key={i}
                    className="flex items-start gap-3 p-3 rounded-[var(--radius-panel)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-inset)]"
                  >
                    <span className="w-8 h-8 rounded-full bg-[var(--color-surface-hover)] border border-[var(--color-border)] flex items-center justify-center shrink-0 mt-0.5">
                      <Icon size={14} className="text-brand-gold" />
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-fg font-medium">{p.name}</p>
                      <p className="text-[10px] text-subtle leading-tight mt-0.5">
                        {p.description}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm text-fg font-medium">{p.count}</p>
                      <p className="text-[10px] text-subtle">Women</p>
                      <p className="text-[10px] text-brand-green mt-0.5">{p.change}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          <ExploreLink>Explore all patterns</ExploreLink>
        </Card>

        {/* 2. Trajectory Intelligence */}
        <Card className="flex flex-col">
          <SectionHeader
            number={2}
            title="Trajectory Intelligence"
            subtitle="How key signals are changing over time by region."
            isNew
            actionLabel="View all"
            isStatic={!loading && !trajectoryDyn}
          />

          <div className="flex items-center gap-2 mb-4">
            <span className="text-[10px] text-subtle">Region:</span>
            <div className="relative">
              <button
                onClick={() => setTrajRegionOpen((o) => !o)}
                disabled={loading || trajRegions.length === 0}
                className="text-xs text-secondary bg-[var(--color-surface-inset)] border border-[var(--color-border)] px-3 py-1 rounded-md flex items-center gap-1 hover:border-brand-gold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                aria-haspopup="listbox"
                aria-expanded={trajRegionOpen}
              >
                <span>{trajRegionLabel}</span>
                <ChevronDown
                  size={12}
                  className={cn("text-subtle transition-transform", trajRegionOpen && "rotate-180")}
                />
              </button>
              {trajRegionOpen && (
                <>
                  {/* Click-away overlay */}
                  <div className="fixed inset-0 z-10" onClick={() => setTrajRegionOpen(false)} />
                  <ul
                    role="listbox"
                    className="absolute left-0 mt-2 z-20 min-w-[150px] max-h-56 overflow-auto rounded-[var(--radius-panel)] border border-[var(--color-border)] bg-[var(--color-surface)] py-1 shadow-lg"
                  >
                    {[{ code: "all", name: "All Regions" }, ...trajRegions].map((r) => (
                      <li key={r.code}>
                        <button
                          role="option"
                          aria-selected={trajRegion === r.code}
                          onClick={() => {
                            setTrajRegion(r.code);
                            setTrajRegionOpen(false);
                          }}
                          className={cn(
                            "w-full text-left px-3 py-1.5 text-xs transition-colors hover:bg-[var(--color-surface-hover)]",
                            trajRegion === r.code ? "text-brand-gold" : "text-secondary",
                          )}
                        >
                          {r.name}
                        </button>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </div>
          </div>

          {/* Table header */}
          <div className="grid grid-cols-[minmax(0,1fr)_auto_auto_auto] gap-2 text-[10px] text-subtle uppercase tracking-wider mb-2 px-1">
            <span>Signal</span>
            <span className="text-center w-24">Trend ({rangeShort})</span>
            <span className="text-right w-14">Change</span>
            <span className="text-right w-20">Direction</span>
          </div>

          {loading ? (
            <SectionLoading rows={6} />
          ) : (
            <div className="space-y-2">
              {trajectoryForRegion.map((sig, i) => {
                const up = sig.direction === "Increasing";
                const color = up ? "text-brand-orange" : "text-brand-green";
                return (
                  <div
                    key={i}
                    className="grid grid-cols-[minmax(0,1fr)_auto_auto_auto] gap-2 items-center px-1 py-1.5"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span
                        className="w-1.5 h-1.5 shrink-0 rounded-full"
                        style={{ background: up ? "var(--color-brand-orange)" : "var(--color-brand-green)" }}
                      />
                      <span className="text-xs text-fg">{sig.name}</span>
                    </div>
                    <div className="w-24 flex justify-center">
                      <Sparkline
                        data={sig.trend}
                        color={up ? "var(--color-brand-orange)" : "var(--color-brand-green)"}
                        width={84}
                        height={22}
                      />
                    </div>
                    <span className={cn("text-xs text-right w-14", color)}>{sig.change}</span>
                    <span className={cn("text-[10px] text-right w-20", color)}>{sig.direction}</span>
                  </div>
                );
              })}
            </div>
          )}
          <ExploreLink>Explore trajectories</ExploreLink>
        </Card>

        {/* 3. Meaning & Signal Relationships */}
        <Card className="flex flex-col">
          <SectionHeader
            number={3}
            title="Meaning & Signal Relationships"
            subtitle="Relationship map of meanings and co-occurrence strength."
            isNew
            actionLabel="View full map"
            isStatic={!loading && !relationshipsDyn}
          />

          {loading ? (
            <div className="w-full flex-1 min-h-[420px] rounded-[var(--radius-panel)] border border-[var(--color-border)] bg-[var(--color-surface-inset)] animate-pulse" />
          ) : (
            <div className="relative w-full flex-1 min-h-[420px]">
              <svg viewBox="0 0 100 100" className="w-full h-full">
                <defs>
                  <radialGradient id="hubFill" cx="50%" cy="42%" r="62%">
                    <stop offset="0%" stopColor="#3d151a" />
                    <stop offset="100%" stopColor="#180a0f" />
                  </radialGradient>
                </defs>

                {(() => {
                  const hub = relationshipData[0];
                  const spokes = relationshipData.slice(1);
                  return (
                    <>
                      {/* Beaded connectors + strength labels */}
                      {spokes.map((node, i) => {
                        const dx = node.x - hub.x;
                        const dy = node.y - hub.y;
                        const len = Math.hypot(dx, dy) || 1;
                        const ux = dx / len;
                        const uy = dy / len;
                        const nodeR = spokeRadius(node.size);
                        const sx = hub.x + ux * HUB_RADIUS;
                        const sy = hub.y + uy * HUB_RADIUS;
                        const ex = node.x - ux * nodeR;
                        const ey = node.y - uy * nodeR;
                        const color = strengthColor(node.strength);
                        return (
                          <g key={`c-${i}`}>
                            <line
                              x1={sx}
                              y1={sy}
                              x2={ex}
                              y2={ey}
                              stroke={color}
                              strokeWidth="0.35"
                              strokeOpacity="0.55"
                            />
                            {[0.28, 0.5, 0.72].map((t, bi) => (
                              <circle
                                key={bi}
                                cx={sx + (ex - sx) * t}
                                cy={sy + (ey - sy) * t}
                                r="0.7"
                                fill={color}
                              />
                            ))}
                            {node.strength != null && (
                              <text
                                x={sx + (ex - sx) * 0.6 - uy * 2.6}
                                y={sy + (ey - sy) * 0.6 + ux * 2.6}
                                textAnchor="middle"
                                dominantBaseline="central"
                                fill={color}
                                fontSize="2.5"
                                fontWeight="600"
                              >
                                {node.strength.toFixed(2)}
                              </text>
                            )}
                          </g>
                        );
                      })}

                      {/* Central hub */}
                      <circle
                        cx={hub.x}
                        cy={hub.y}
                        r={HUB_RADIUS}
                        fill="url(#hubFill)"
                        stroke="var(--color-brand-orange)"
                        strokeWidth="0.7"
                      />
                      {(() => {
                        const lines = wrapLabel(hub.name, 10);
                        const lh = 3.4;
                        return (
                          <text
                            x={hub.x}
                            y={hub.y}
                            textAnchor="middle"
                            dominantBaseline="central"
                            fill="var(--color-fg)"
                            fontSize="3"
                            fontWeight="700"
                          >
                            {lines.map((ln, li) => (
                              <tspan key={li} x={hub.x} dy={li === 0 ? -((lines.length - 1) * lh) / 2 : lh}>
                                {ln}
                              </tspan>
                            ))}
                          </text>
                        );
                      })()}

                      {/* Spoke nodes */}
                      {spokes.map((node, i) => {
                        const nodeR = spokeRadius(node.size);
                        const color = NODE_COLORS[i % NODE_COLORS.length];
                        const lines = wrapLabel(node.name, Math.max(9, Math.round(nodeR * 1.7)));
                        const lh = 2.3;
                        return (
                          <g key={`n-${i}`}>
                            <circle
                              cx={node.x}
                              cy={node.y}
                              r={nodeR}
                              fill="var(--color-surface)"
                              stroke={color}
                              strokeWidth="0.6"
                            />
                            <text
                              x={node.x}
                              y={node.y}
                              textAnchor="middle"
                              dominantBaseline="central"
                              fill="var(--color-fg)"
                              fontSize="1.9"
                            >
                              {lines.map((ln, li) => (
                                <tspan key={li} x={node.x} dy={li === 0 ? -((lines.length - 1) * lh) / 2 : lh}>
                                  {ln}
                                </tspan>
                              ))}
                            </text>
                          </g>
                        );
                      })}
                    </>
                  );
                })()}
              </svg>

              {/* Legend — vertical gradient: High (warm) → Low (cool) */}
              <div className="absolute bottom-1 right-1 text-[10px] text-muted">
                <div className="text-secondary mb-1.5 leading-tight">
                  Connection
                  <br />
                  Strength
                </div>
                <div className="flex items-center gap-1.5">
                  <div
                    className="w-1.5 h-16 rounded-full"
                    style={{
                      background:
                        "linear-gradient(to bottom, var(--color-brand-orange) 0%, var(--color-danger) 45%, var(--color-brand-purple) 100%)",
                    }}
                  />
                  <div className="flex flex-col justify-between h-16 py-0.5">
                    <span>High</span>
                    <span>Low</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          <ExploreLink>Explore signal relationships</ExploreLink>
        </Card>
      </div>

      {/* ─── Row 2: Language + Trajectories + Questions + Emerging ─ */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* 4. Language Observatory */}
        <Card className="flex flex-col">
          <SectionHeader
            number={4}
            title="Language Observatory"
            subtitle="How women describe experiences across languages and cultures."
            isNew
            actionLabel="View all languages"
            isStatic={!loading && !languagesDyn}
          />

          {/* Active signal filter (matches the Figma's "Signal / Pain" tab). */}
          <div className="text-[11px] text-muted mb-3">
            Signal / <span className="text-secondary">Pain</span>
          </div>

          {loading ? (
            <SectionLoading rows={4} />
          ) : (
            <div>
              {/* Table header */}
              <div className="grid grid-cols-[minmax(0,1.1fr)_minmax(0,1.2fr)_auto_auto] gap-2 text-[10px] text-subtle uppercase tracking-wider pb-2 border-b border-[var(--color-border-subtle)]">
                <span>Language / Region</span>
                <span>Top Phrases</span>
                <span className="text-right">Usage ({rangeShort})</span>
                <span className="text-right">Trend</span>
              </div>
              <div className="divide-y divide-[var(--color-border-subtle)]">
                {languageData.map((lang, i) => (
                  <div
                    key={i}
                    className="grid grid-cols-[minmax(0,1.1fr)_minmax(0,1.2fr)_auto_auto] gap-2 items-center py-2.5"
                  >
                    <div className="text-xs leading-tight min-w-0">
                      <span className="text-fg font-medium">{lang.language}</span>
                      <span className="text-subtle"> ({lang.region})</span>
                    </div>
                    <div className="text-[10px] text-brand-gold italic leading-tight min-w-0">
                      {lang.phrases}
                    </div>
                    <div className="text-xs text-fg font-medium text-right whitespace-nowrap">
                      {lang.usage}
                    </div>
                    <div className="flex items-center justify-end gap-1 whitespace-nowrap">
                      <span className="text-[10px] text-brand-gold">{lang.trend}</span>
                      <Sparkline data={STAT_SPARK} color="var(--color-brand-gold)" width={26} height={12} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
          <ExploreLink>Explore language differences</ExploreLink>
        </Card>

        {/* 5. Atlas Trajectories */}
        <Card className="flex flex-col">
          <SectionHeader
            number={5}
            title="Atlas Trajectories"
            subtitle="Common health journeys discovered in the Atlas."
            isNew
            actionLabel="View all journeys"
            isStatic={!loading && !journeyDyn}
          />

          {loading ? (
            <SectionLoading rows={3} />
          ) : (
            <>
              {/* Journey step icons — each annotated with the participant count
                  reaching that stage when data is present. */}
              <div className="flex items-center justify-between mb-6">
                {journeyStages.map((step, i) => {
                  const StepIcon = step.icon;
                  return (
                    <div key={i} className="flex flex-col items-center gap-2">
                      <span className="w-10 h-10 rounded-xl bg-[var(--color-surface-inset)] border border-[var(--color-border)] flex items-center justify-center">
                        <StepIcon size={16} className="text-muted" />
                      </span>
                      {typeof step.count === "number" && (
                        <span className="text-[10px] text-brand-gold font-medium leading-none">
                          {step.count.toLocaleString()}
                        </span>
                      )}
                      <span className="text-[8px] text-subtle text-center leading-tight w-14">
                        {step.label}
                      </span>
                    </div>
                  );
                })}
              </div>

              {/* Donut chart */}
              <div className="flex items-center gap-4">
                <Donut
                  percent={journeyPercent}
                  size={120}
                  thickness={16}
                  color="var(--color-brand-gold)"
                  track="var(--color-border-subtle)"
                  rounded
                >
                  <span className="font-serif text-2xl text-fg">{journeyPercent}%</span>
                </Donut>
                <div className="text-[10px] text-muted space-y-1.5">
                  <p className="text-xs text-fg font-medium">
                    {journeyDyn ? "% reaching high burden" : "% of insights"}
                  </p>
                  {journeyInsights.map((line, i) => (
                    <p key={i}>• {line}</p>
                  ))}
                </div>
              </div>
            </>
          )}

          <ExploreLink>Explore all trajectories</ExploreLink>
        </Card>

        {/* 6. Atlas Questions */}
        <Card className="flex flex-col">
          <SectionHeader
            number={6}
            title="Atlas Questions"
            subtitle="Top open questions the Atlas is asking."
            isNew
            isStatic={!loading && !questionsDyn}
          />

          {loading ? (
            <SectionLoading rows={3} />
          ) : (
            <div className="divide-y divide-[var(--color-border-subtle)]">
              {questionData.map((q, i) => {
                const QIcon = q.icon;
                return (
                  <div key={i} className="flex gap-3 items-start py-3.5 first:pt-0">
                    <span className="w-10 h-10 rounded-full bg-[var(--color-surface-hover)] border border-[var(--color-border)] flex items-center justify-center shrink-0 mt-0.5">
                      <QIcon size={17} className="text-brand-gold" />
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] text-fg leading-snug mb-1.5">{q.question}</p>
                      <div className="flex items-center justify-between gap-2 text-[11px]">
                        <span className="text-subtle">{q.signals} related signals</span>
                        <span className="text-brand-gold whitespace-nowrap">↑ {q.women} women</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <ExploreLink>Explore all questions</ExploreLink>
        </Card>

        {/* 7. Emerging Expressions & Signals */}
        <Card className="flex flex-col">
          <SectionHeader
            number={7}
            title="Emerging Expressions & Signals"
            subtitle="New or rapidly rising expressions across the Atlas."
            isNew
            actionLabel="View all"
            isStatic={!loading && !emergingDyn}
          />

          {loading ? (
            <SectionLoading rows={5} />
          ) : (
            <>
              {/* Table header */}
              <div className="grid grid-cols-[minmax(0,1fr)_auto_auto_auto] gap-2 text-[10px] text-subtle uppercase tracking-wider mb-2">
                <span>Expression</span>
                <span className="text-center w-14">Regions</span>
                <span className="text-right w-16">Mentions</span>
                <span className="text-right w-14">Change</span>
              </div>

              <div className="space-y-2">
                {emergingData.map((e, i) => (
                  <div
                    key={i}
                    className="grid grid-cols-[minmax(0,1fr)_auto_auto_auto] gap-2 items-center py-1.5 border-b border-[var(--color-border-subtle)] last:border-0"
                  >
                    <span className="text-xs text-fg">{e.expression}</span>
                    <span className="text-xs text-muted text-center w-14">{e.regions}</span>
                    <span className="text-xs text-brand-gold text-right w-16">{e.mentions}</span>
                    <span className="text-[10px] text-brand-green text-right w-14">{e.change}</span>
                  </div>
                ))}
              </div>
            </>
          )}

          <ExploreLink>Explore emerging expressions</ExploreLink>
        </Card>
      </div>

      {/* ─── Recent Questions Bar ────────────────────────────────── */}
      <Card>
        <div className="flex items-center gap-6 overflow-x-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
          {RECENT_QUESTIONS.map((q, i) => (
            <div
              key={i}
              className="flex items-center gap-2 shrink-0 px-4 py-2 rounded-full border border-[var(--color-border)] bg-[var(--color-surface-inset)] hover:border-brand-gold transition-colors cursor-pointer"
            >
              <MessageCircle size={14} className="text-brand-gold" />
              <span className="text-xs text-secondary whitespace-nowrap">{q}</span>
              <span className="text-[10px] text-faint whitespace-nowrap">
                {i < 2 ? "2h ago" : i < 4 ? `${i}d ago` : "4d ago"}
              </span>
            </div>
          ))}
          <a
            href="#"
            className="text-xs text-muted hover:text-fg flex items-center gap-1 shrink-0 transition-colors"
          >
            <span>View all questions</span>
            <ArrowRight size={12} />
          </a>
        </div>
      </Card>

      {/* ─── Footer Disclaimers ──────────────────────────────────── */}
      <footer className="border-t border-[var(--color-border-subtle)] pt-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
          {FOOTER_ITEMS.map((f) => (
            <div key={f.title} className="flex items-start gap-3">
              <span className="rounded-full border border-[var(--color-border-brand)] text-brand-gold flex items-center justify-center shrink-0 mt-0.5" style={{ width: 32, height: 32 }}>
                <f.icon size={15} />
              </span>
              <div>
                <p className="text-xs text-fg font-medium">{f.title}</p>
                <p className="text-[10px] text-subtle">{f.sub}</p>
              </div>
            </div>
          ))}
        </div>
        <div className="mt-4 flex justify-end">
          <SectionLink href="#" className="flex items-center gap-1">
            Learn more about our data &amp; methods <ArrowRight size={12} />
          </SectionLink>
        </div>
      </footer>
    </div>
  );
}
