"use client";

import { useEffect, useState } from "react";
import { Loader2, AlertTriangle, RotateCcw } from "lucide-react";
import { Tabs, Badge, Button, type TabItem } from "@/components/ui";
import type { StewardRecord, StewardRecordDetail } from "./types";
import { useStewardReview, type ReviewAction } from "./useStewardReview";
import { OverviewTab } from "./tabs/OverviewTab";
import { NarrativeTab } from "./tabs/NarrativeTab";
import { SignalsTab } from "./tabs/SignalsTab";
import { HistoryTab } from "./tabs/HistoryTab";
import { TimelineTab } from "./tabs/TimelineTab";

// Tab order matches the Atlas Record Spec §9 (Steward View). Overview renders
// from the queue payload; the rest lazy-load the record's detail on demand.
const TABS: TabItem[] = [
  { id: "Overview", label: "Overview" },
  { id: "Narrative", label: "Narrative" },
  { id: "Signals", label: "Signals" },
  { id: "History", label: "History" },
  { id: "Timeline", label: "Timeline", isNew: true },
];
type Tab = "Overview" | "Narrative" | "Signals" | "History" | "Timeline";

// Statuses that mean a steward has already decided. None of them are final: a
// decision can be mis-clicked or made on a misread signal, so a decided record
// can be re-decided (approve / flag / reject) or sent back to the pending queue
// via `reopen`. Every change is written to the AuditLog by the review route.
const DECIDED_STATUSES = ["Reviewed", "Flagged", "Rejected"];

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", { day: "numeric", month: "short", year: "numeric" });
}

/** Accent colour for the current-decision chip. */
function statusColor(status: string): string {
  return status === "Rejected"
    ? "var(--color-danger)"
    : status === "Flagged"
      ? "var(--color-brand-orange)"
      : "var(--color-brand-green)";
}

/** Center panel: the full Atlas Record under review, with its tab navigation. */
export function RecordDetail({
  record,
  onReviewed,
}: {
  record: StewardRecord;
  onReviewed?: () => void;
}) {
  // Callers mount this with key={record.id}, so selecting a different record
  // remounts the component and all state below initialises fresh — no reset
  // effect needed. A post-review refetch keeps the same id (same key), so the
  // reviewer's notes and success badge survive it.
  const [activeTab, setActiveTab] = useState<Tab>("Overview");
  const [detail, setDetail] = useState<StewardRecordDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // -- Steward review state (shared by the header Reject / Return to Pending
  //    button and the OverviewTab decision buttons) -----------------------
  const [notes, setNotes] = useState(record.stewardNotes ?? "");
  const { submit, submitting, reviewStatus, reviewError } = useStewardReview(record.id, onReviewed);

  const decided = DECIDED_STATUSES.includes(record.status);

  const submitReview = (action: ReviewAction) => submit(action, { notes });

  // Fetch the heavy detail payload once on mount (Overview needs none of it).
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await fetch(`/api/steward/records/${record.id}`);
        if (!res.ok) throw new Error("Failed to load record detail");
        const data = (await res.json()) as { detail: StewardRecordDetail };
        if (active) setDetail(data.detail);
      } catch (err) {
        if (active) setError(err instanceof Error ? err.message : "Failed to load record detail");
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [record.id]);

  return (
    <>
      <div className="flex justify-between items-start gap-4 mb-4">
        <div>
          <div className="flex items-center gap-3 flex-wrap">
            <h2 className="font-serif text-[22px] font-semibold text-fg">{record.displayId}</h2>
            <Badge variant="outline">Atlas Record</Badge>
            {record.priority === "High" && (
              <span className="inline-flex items-center gap-1.5 text-xs text-danger">
                <span className="w-[7px] h-[7px] rounded-full bg-danger" />
                High Priority
              </span>
            )}
            {reviewStatus && !decided && <Badge variant="accent">{reviewStatus}</Badge>}
          </div>
          {decided && record.reviewedBy && (
            <p className="text-xs text-muted mt-2">
              Reviewer: <span className="text-secondary">{record.reviewedBy}</span>
              {record.reviewedAt && <> · {formatDate(record.reviewedAt)}</>}
            </p>
          )}
        </div>
        {/* Decided records swap the Reject button for the current decision plus
            an undo; the remaining decisions move into the Overview action row. */}
        {decided ? (
          <div className="flex items-center gap-2.5 shrink-0">
            <span
              className="text-xs border border-[var(--color-border)] px-3 py-1.5 rounded-md"
              style={{ color: statusColor(record.status) }}
            >
              {record.status}
            </span>
            <Button
              variant="secondary"
              size="sm"
              icon={<RotateCcw size={14} />}
              loading={submitting === "reopen"}
              onClick={() => submitReview("reopen")}
              disabled={submitting !== null}
            >
              Return to Pending
            </Button>
          </div>
        ) : (
          <Button
            variant="danger"
            size="sm"
            loading={submitting === "reject"}
            onClick={() => submitReview("reject")}
            disabled={submitting !== null}
            className="shrink-0"
          >
            Reject Record
          </Button>
        )}
      </div>

      <Tabs
        tabs={TABS}
        active={activeTab}
        onChange={(id) => setActiveTab(id as Tab)}
        className="mb-5"
      />

      {activeTab === "Overview" ? (
        <OverviewTab
          record={record}
          notes={notes}
          onNotesChange={setNotes}
          onApprove={() => submitReview("approve")}
          onFlag={() => submitReview("flag")}
          onReject={() => submitReview("reject")}
          submitting={submitting}
          reviewError={reviewError}
          decided={decided}
        />
      ) : (
        <DetailTab tab={activeTab} detail={detail} loading={loading} error={error} />
      )}
    </>
  );
}

/** Renders one of the detail-backed tabs, with shared loading/error handling. */
function DetailTab({
  tab,
  detail,
  loading,
  error,
}: {
  tab: Exclude<Tab, "Overview">;
  detail: StewardRecordDetail | null;
  loading: boolean;
  error: string | null;
}) {
  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-7 h-7 text-brand-gold animate-spin" />
      </div>
    );
  }
  if (error || !detail) {
    return (
      <div className="flex flex-col items-center justify-center text-center py-20">
        <AlertTriangle className="w-7 h-7 text-danger mb-2" />
        <p className="text-sm text-secondary">{error ?? "No detail available"}</p>
      </div>
    );
  }

  switch (tab) {
    case "Narrative":
      return <NarrativeTab narratives={detail.narratives} />;
    case "Signals":
      return <SignalsTab signals={detail.signals} sourceSignals={detail.sourceSignals} />;
    case "History":
      return <HistoryTab history={detail.history} />;
    case "Timeline":
      return <TimelineTab timeline={detail.timeline} />;
  }
}
