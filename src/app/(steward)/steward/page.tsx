"use client";

import { useEffect, useMemo, useState, useRef, useCallback } from "react";
import {
  Bell, ChevronDown, Sparkles, LogOut, FileText, Loader2, Activity,
  CalendarClock, Flag, CircleCheckBig, Award, Radio, Timer,
} from "lucide-react";
import { useSession } from "next-auth/react";
import { ReviewQueue } from "@/components/steward/ReviewQueue";
import { RecordDetail } from "@/components/steward/RecordDetail";
import type { StewardRecord } from "@/components/steward/types";
import { logout } from "@/lib/logout";
import { Card, SectionCard, SectionLink, MetricCard, Sparkline, Badge, Avatar, IconTile, DateRangeFilter } from "@/components/ui";
import { rangeQuery, type DateRangeValue } from "@/lib/date-range";
import { RecentAlerts, DataQualityCard, PortalFooter } from "@/components/steward/dashboard/StaticSections";
import { ReviewerActionsRow } from "@/components/steward/dashboard/ReviewerActionsRow";
import { GrowthDashboard } from "@/components/steward/dashboard/GrowthDashboard";
import { ObservationReturnRate } from "@/components/steward/dashboard/ObservationReturnRate";
import { MeaningSignals } from "@/components/steward/dashboard/MeaningSignals";
import { compact, trendText } from "@/components/steward/dashboard/format";
import type { StewardAnalytics } from "@/lib/steward/analytics";

// The queue and the record detail are locked to one height so the two columns
// stay aligned; each scrolls internally when its content overflows.
const PANEL_HEIGHT = "h-[560px]";

// Same treatment for the row beneath: the growth dashboard and the return-rate
// panel are locked to one height and scroll internally.
const SECTION_HEIGHT = "h-[420px] flex flex-col";
const SECTION_BODY = "flex-1 min-h-0 overflow-y-auto";

// Shape of GET /api/steward/stats.
type StewardStats = {
  metrics: {
    pending: number;
    pendingHighPriority: number;
    flagged: number;
    approved: number;
    rejected: number;
    reviewedToday: number;
    approvedThisWeek: number;
    flaggedThisWeek: number;
    signalsIdentified: number;
    avgReviewMinutes: number | null;
  };
  signalSnapshot: { name: string; count: number; trendPct: number; series: number[] }[];
  emergingConcepts: { term: string; country: string | null; count: number }[];
};

const formatMinutes = (m: number | null) => {
  if (m == null) return "—";
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  const rem = m % 60;
  return rem ? `${h}h ${rem}m` : `${h}h`;
};

// Per-row accent for the Signal Snapshot (cycles through the brand palette).
const SNAPSHOT_COLORS = [
  "var(--color-brand-purple)",
  "var(--color-brand-gold)",
  "var(--color-brand-green)",
  "var(--color-danger)",
  "var(--color-brand-blue)",
];

export default function StewardPortal() {
  const [records, setRecords] = useState<StewardRecord[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<StewardStats | null>(null);
  const [analytics, setAnalytics] = useState<StewardAnalytics | null>(null);

  // Header date filter (preset or custom from/to). Every dashboard fetch below
  // carries it, so the whole page — queue included — describes one window.
  const [range, setRange] = useState<DateRangeValue>({ key: "all" });
  const rangeParams = rangeQuery(range);

  const loadStats = useCallback(async () => {
    try {
      const res = await fetch(`/api/steward/stats?${rangeParams}`);
      if (!res.ok) return;
      setStats((await res.json()) as StewardStats);
    } catch {
      // Non-fatal: cards fall back to "—" placeholders.
    }
  }, [rangeParams]);

  // The growth / return-rate / meaning-signal aggregates load independently of
  // the review queue, so a slow scan of the Atlas never blocks the queue.
  const loadAnalytics = useCallback(async () => {
    try {
      const res = await fetch(`/api/steward/analytics?${rangeParams}`);
      if (!res.ok) return;
      setAnalytics((await res.json()) as StewardAnalytics);
    } catch {
      // Non-fatal: the sections keep showing their loading state.
    }
  }, [rangeParams]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadStats();
    loadAnalytics();
  }, [loadStats, loadAnalytics]);

  const loadRecords = useCallback(async () => {
    try {
      const res = await fetch(`/api/steward/records?${rangeParams}`);
      if (!res.ok) throw new Error("Failed to load records");
      const data = (await res.json()) as { records: StewardRecord[] };
      setRecords(data.records);
      setSelectedId((prev) =>
        prev && data.records.some((r) => r.id === prev) ? prev : data.records[0]?.id ?? null,
      );
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load records");
    } finally {
      setLoading(false);
    }
  }, [rangeParams]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadRecords();
  }, [loadRecords]);

  const selected = useMemo(
    () => records.find((r) => r.id === selectedId) ?? null,
    [records, selectedId],
  );

  const { data: session } = useSession();
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const userName = session?.user?.name || "Dr. Leila Hassan";
  const userInitials = userName.substring(0, 2).toUpperCase();

  const m = stats?.metrics;
  const bellCount = m?.pendingHighPriority ?? 0;

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const metricCards = [
    { icon: CalendarClock, label: "Pending Review", value: m ? String(m.pending) : "—", sub: undefined as string | undefined },
    { icon: Flag, label: "Flagged", value: m ? String(m.flagged) : "—", sub: m?.flaggedThisWeek ? `+${m.flaggedThisWeek} this week` : undefined },
    { icon: CircleCheckBig, label: "Reviewed Today", value: m ? String(m.reviewedToday) : "—", sub: undefined },
    { icon: Award, label: "Approved Records", value: m ? String(m.approved) : "—", sub: m?.approvedThisWeek ? `+${m.approvedThisWeek} this week` : undefined },
    { icon: Radio, label: "Signals Identified", value: m ? String(m.signalsIdentified) : "—", sub: "distinct patterns" },
    { icon: Timer, label: "Avg. Review Time", value: m ? formatMinutes(m.avgReviewMinutes) : "—", sub: "per record" },
  ];

  return (
    <div className="p-4 pb-10 w-full text-[var(--color-text-primary)]">

      {/* ============ HEADER ============ */}
      <header className="flex flex-wrap items-center gap-5 px-2 pt-1.5 pb-4">
        <div className="flex-1 min-w-[220px]">
          <div className="flex items-center gap-2.5">
            <h1 className="font-serif font-semibold text-[26px] text-fg">Atlas Steward Portal</h1>
            <Sparkles size={18} className="text-brand-gold" />
          </div>
          <div className="italic text-[13px] text-muted mt-0.5">
            Curate Records. Validate Meaning. Build Collective Intelligence.
          </div>
        </div>

        <div className="flex items-center gap-3.5 flex-wrap">
          <DateRangeFilter
            value={range}
            onChange={(next) => {
              if (rangeQuery(next) === rangeParams) return;
              setLoading(true);
              setRange(next);
            }}
          />

          <div
            className="relative w-[42px] h-[42px] rounded-[10px] bg-[var(--color-surface-inset)] border border-[var(--color-border)] flex items-center justify-center text-secondary"
            title="High-priority records awaiting review"
          >
            <Bell size={18} />
            {bellCount > 0 && (
              <span className="absolute -top-1.5 -right-1.5 min-w-5 h-5 px-1 rounded-full bg-danger text-white text-[11px] font-semibold flex items-center justify-center border-2 border-[var(--color-background)]">
                {bellCount}
              </span>
            )}
          </div>

          <div className="relative" ref={dropdownRef}>
            <button
              onClick={() => setIsDropdownOpen(!isDropdownOpen)}
              className="flex items-center gap-2.5 pl-1.5 pr-3 py-1.5 rounded-xl bg-[var(--color-surface-inset)] border border-[var(--color-border)] hover:border-brand-gold transition-colors"
            >
              <Avatar initials={userInitials} />
              <div className="text-left">
                <div className="text-[13px] font-semibold text-fg">{userName}</div>
                <div className="text-[11px] text-muted">Clinical Reviewer</div>
              </div>
              <ChevronDown size={15} className="text-subtle" />
            </button>

            {isDropdownOpen && (
              <div className="absolute right-0 mt-2 w-48 bg-surface-card border border-[var(--color-border)] rounded-xl shadow-2xl overflow-hidden z-50">
                <div className="p-3 border-b border-[var(--color-border-subtle)]">
                  <p className="text-sm font-medium text-fg truncate">{userName}</p>
                  <p className="text-xs text-muted truncate">{session?.user?.email}</p>
                </div>
                <div className="p-1">
                  <button
                    onClick={() => logout()}
                    className="w-full text-left flex items-center gap-2 px-3 py-2 text-sm text-danger hover:bg-[var(--color-surface-hover)] rounded-lg transition-colors"
                  >
                    <LogOut size={16} />
                    Log Out
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* ============ STAT CARDS ============ */}
      <div className="flex flex-wrap gap-3 mb-4">
        {metricCards.map((c) => (
          <MetricCard
            key={c.label}
            icon={c.icon}
            label={c.label}
            value={c.value}
            sub={c.sub}
            className="flex-1 min-w-[190px]"
          />
        ))}
      </div>

      {/* ============ THREE COLUMNS ============
          Columns stretch to a common height so the right column's last card can
          absorb the leftover space instead of leaving a gap under it. */}
      <div className="flex flex-wrap gap-4 items-stretch">

        {/* LEFT */}
        <div className="flex-1 min-w-[280px] basis-[300px] flex flex-col gap-4">
          <ReviewQueue
            records={records}
            selectedId={selectedId}
            onSelect={setSelectedId}
            loading={loading}
            error={error}
            className={PANEL_HEIGHT}
            listClassName="flex-1"
          />
          <GrowthDashboard
            data={analytics?.growth ?? null}
            className={SECTION_HEIGHT}
            bodyClassName={SECTION_BODY}
          />
        </div>

        {/* CENTER */}
        <div className="flex-[1.6] min-w-[320px] basis-[380px] flex flex-col gap-4">
          <Card padding={false} className={`p-[18px] overflow-y-auto ${PANEL_HEIGHT}`}>
            {!selected ? (
              <div className="h-full flex flex-col items-center justify-center text-center">
                {loading ? (
                  <Loader2 className="w-8 h-8 text-brand-gold animate-spin" />
                ) : (
                  <>
                    <FileText className="w-8 h-8 text-faint mb-3" />
                    <p className="text-sm text-secondary">Select a record to review</p>
                  </>
                )}
              </div>
            ) : (
              <RecordDetail key={selected.id} record={selected} onReviewed={() => { loadRecords(); loadStats(); }} />
            )}
          </Card>
          <ObservationReturnRate
            data={analytics?.returnRate ?? null}
            className={SECTION_HEIGHT}
            bodyClassName={SECTION_BODY}
          />
        </div>

        {/* RIGHT */}
        <div className="flex-1 min-w-[250px] basis-[270px] flex flex-col gap-4">
          <SignalSnapshotCard stats={stats} />
          <EmergingConceptsCard stats={stats} />
          <MeaningSignals data={analytics?.meaningSignals ?? null} />
          <DataQualityCard
            approved={m?.approved}
            rejected={m?.rejected}
            className="flex-1 min-h-[200px]"
          />
        </div>
      </div>

      {/* ============ BOTTOM FULL-WIDTH BANDS ============ */}
      <div className="mt-4">
        <RecentAlerts />
      </div>
      <div className="mt-4">
        <ReviewerActionsRow
          record={selected}
          onReviewed={() => { loadRecords(); loadStats(); }}
        />
      </div>

      <PortalFooter />
    </div>
  );
}

/* ── Signal Snapshot (dynamic) ────────────────────────────────────────────── */
function SignalSnapshotCard({ stats }: { stats: StewardStats | null }) {
  return (
    <SectionCard title="Signal Snapshot" action={<SectionLink>View all signals →</SectionLink>}>
      <div className="flex flex-col gap-3">
        {!stats ? (
          <div className="flex justify-center py-6"><Loader2 className="w-5 h-5 text-brand-gold animate-spin" /></div>
        ) : stats.signalSnapshot.length === 0 ? (
          <p className="text-xs text-faint py-2">No signals recorded yet.</p>
        ) : (
          stats.signalSnapshot.map((s, i) => {
            const color = SNAPSHOT_COLORS[i % SNAPSHOT_COLORS.length];
            return (
              <div key={s.name} className="flex items-center gap-2.5">
                <Activity size={15} style={{ color }} />
                <span className="flex-1 text-[13px] text-secondary truncate" title={s.name}>{s.name}</span>
                <Sparkline data={s.series} color={color} />
                <span className="text-[13px] text-fg w-[34px] text-right">{compact(s.count)}</span>
                <span className={`text-[11px] w-[38px] text-right ${s.trendPct < 0 ? "text-brand-orange" : "text-brand-green"}`}>
                  {trendText(s.trendPct)}
                </span>
              </div>
            );
          })
        )}
      </div>
      <div className="text-center mt-3.5 pt-3 border-t border-[var(--color-border-subtle)]">
        <SectionLink className="text-[13px]">View full signal registry →</SectionLink>
      </div>
    </SectionCard>
  );
}

/* ── Emerging Concepts (dynamic) ──────────────────────────────────────────── */
function EmergingConceptsCard({ stats }: { stats: StewardStats | null }) {
  return (
    <SectionCard title="Emerging Concepts" isNew action={<SectionLink>View all →</SectionLink>}>
      <div className="flex flex-col gap-3">
        {!stats ? (
          <div className="flex justify-center py-6"><Loader2 className="w-5 h-5 text-brand-gold animate-spin" /></div>
        ) : stats.emergingConcepts.length === 0 ? (
          <p className="text-xs text-faint py-2">No emerging concepts yet.</p>
        ) : (
          stats.emergingConcepts.map((c, i) => (
            <div key={i} className="flex items-center gap-2.5">
              <IconTile>
                <Activity size={16} />
              </IconTile>
              <div className="flex-1 min-w-0">
                <div className="text-[13px] text-secondary truncate">{c.term}</div>
                <div className="text-[11px] text-faint">{c.country ?? "Various"} · {c.count} records</div>
              </div>
              <Badge variant="outline">Under Review</Badge>
            </div>
          ))
        )}
      </div>
    </SectionCard>
  );
}
