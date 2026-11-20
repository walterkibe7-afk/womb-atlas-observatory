"use client";

import { Check, FileText, Disc, Flag, X } from "lucide-react";
import { Card, Badge, Button, SeverityTag, Avatar, normalizeSeverity } from "@/components/ui";
import type { StewardRecord } from "../types";
import type { ReviewAction } from "../useStewardReview";

// AtlasRecord.status -> how the decision reads in prose.
const DECISION_VERB: Record<string, string> = {
  Reviewed: "approved",
  Flagged: "flagged for follow-up",
  Rejected: "rejected",
};

function formatSubmitted(iso: string) {
  const d = new Date(iso);
  return {
    date: d.toLocaleDateString("en-US", { day: "numeric", month: "short", year: "numeric" }),
    time: d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }),
  };
}

/** Overview tab: metadata, observed themes, reflection summary, signals, steward notes. */
export function OverviewTab({
  record,
  notes,
  onNotesChange,
  onApprove,
  onFlag,
  onReject,
  submitting,
  reviewError,
  decided,
}: {
  record: StewardRecord;
  notes: string;
  onNotesChange: (value: string) => void;
  onApprove: () => void;
  onFlag: () => void;
  onReject: () => void;
  submitting: ReviewAction | null;
  reviewError: string | null;
  /** True once a steward decision is in effect — it can still be changed. */
  decided: boolean;
}) {
  const submitted = formatSubmitted(record.submittedAt);
  // Offer every decision except the one already in effect. Reject only appears
  // here for decided records; pending ones reject from the header button.
  const showApprove = record.status !== "Reviewed";
  const showFlag = record.status !== "Flagged";
  const showReject = decided && record.status !== "Rejected";
  const visibleThemes = record.themes.slice(0, 5);
  const extraThemes = record.themes.length - visibleThemes.length;
  const visibleSignals = record.signals.slice(0, 4);
  const extraSignals = record.signals.length - visibleSignals.length;

  return (
    <div className="space-y-4">
      {/* Metadata grid */}
      <div className="flex flex-wrap gap-2.5">
        <Card variant="inset" className="flex-1 min-w-[160px]">
          <p className="text-[11px] text-faint mb-2">Observatory Contributor</p>
          <div className="flex items-center gap-2.5">
            <Avatar initials={(record.contributor.name || "AN").substring(0, 2).toUpperCase()} size={32} />
            <div>
              <p className="text-[13px] text-secondary">{record.contributor.name}</p>
              <p className="text-[11px] text-muted">
                {record.contributor.ageRange ?? "—"}
                {record.contributor.country ? ` · ${record.contributor.country}` : ""}
              </p>
            </div>
          </div>
        </Card>
        <Card variant="inset" className="flex-1 min-w-[130px]">
          <p className="text-[11px] text-faint mb-2">Life Stage</p>
          <p className="text-[13px] text-secondary">{record.contributor.lifeStage ?? "—"}</p>
        </Card>
        <Card variant="inset" className="flex-1 min-w-[130px]">
          <p className="text-[11px] text-faint mb-2">Record Type</p>
          <p className="flex items-center gap-1.5 text-[13px] text-secondary">
            <FileText size={14} className="text-brand-gold" /> Atlas Record
          </p>
        </Card>
        <Card variant="inset" className="flex-1 min-w-[130px]">
          <p className="text-[11px] text-faint mb-2">Source</p>
          <p className="flex items-center gap-1.5 text-[13px] text-secondary">
            <Disc size={14} className="text-brand-gold" /> {record.source}
          </p>
        </Card>
        <Card variant="inset" className="flex-1 min-w-[130px]">
          <p className="text-[11px] text-faint mb-2">Submitted</p>
          <p className="text-[13px] text-secondary">{submitted.date}</p>
          <p className="text-[11px] text-muted">{submitted.time}</p>
        </Card>
      </div>

      {/* Observed Themes */}
      <div>
        <p className="text-xs text-muted mb-2">Observed Themes</p>
        <div className="flex flex-wrap gap-2">
          {visibleThemes.length === 0 && <span className="text-xs text-faint">No themes recorded.</span>}
          {visibleThemes.map((tag, i) => (
            <Badge key={tag} variant={i === 0 ? "accent" : "neutral"} className="rounded-[7px]">
              {tag}
            </Badge>
          ))}
          {extraThemes > 0 && <span className="text-xs text-faint self-center">+{extraThemes} more</span>}
        </div>
      </div>

      {/* Summary + Meaning & Signals */}
      <div className="flex flex-wrap gap-3">
        <Card variant="inset" className="flex-[1.5] min-w-[260px]">
          <p className="text-[13px] font-semibold text-secondary mb-2">Summary</p>
          <p className="text-[13px] text-muted leading-relaxed whitespace-pre-line">
            {record.summary || "No reflection summary was generated for this record."}
          </p>
        </Card>
        <Card variant="inset" className="flex-1 min-w-[200px]">
          <p className="text-[13px] font-semibold text-secondary mb-2.5">Meaning &amp; Signals</p>
          <div className="flex flex-col gap-2.5">
            {visibleSignals.length === 0 && <p className="text-xs text-faint">No signals were extracted.</p>}
            {visibleSignals.map((sig) => (
              <div key={sig.signalId} className="flex items-center justify-between text-[13px]">
                <SeverityTag level={sig.severity} showLabel={false} />
                <span className="flex-1 ml-0.5 text-secondary">{sig.name}</span>
                <span
                  className="text-xs"
                  style={{ color: severityColor(sig.severity) }}
                >
                  {normalizeSeverity(sig.severity)}
                </span>
              </div>
            ))}
            {extraSignals > 0 && <p className="text-xs text-faint">+{extraSignals} more signals</p>}
          </div>
        </Card>
      </div>

      {/* Steward Notes + actions */}
      <div>
        <p className="text-xs text-muted mb-2">Steward Notes (Internal)</p>
        <textarea
          className="w-full h-20 resize-none rounded-[10px] bg-[var(--color-surface-inset)] border border-[var(--color-border-subtle)] text-secondary p-2.5 text-[13px] outline-none focus:border-brand-gold"
          placeholder="Add internal notes..."
          value={notes}
          onChange={(e) => onNotesChange(e.target.value)}
        />

        {/* A decision is already in effect — say what these buttons overwrite. */}
        {decided && (
          <p className="text-xs text-muted mt-3 text-right">
            This record was {DECISION_VERB[record.status] ?? record.status.toLowerCase()}
            {record.reviewedBy ? <> by <span className="text-secondary">{record.reviewedBy}</span></> : ""}
            {record.reviewedAt
              ? ` on ${new Date(record.reviewedAt).toLocaleDateString("en-US", { day: "numeric", month: "short", year: "numeric" })}`
              : ""}
            . Choosing another decision replaces it — or use{" "}
            <span className="text-brand-gold">Return to Pending</span> to send it back to the queue.
          </p>
        )}
        {reviewError && <p className="text-xs text-danger mt-3 text-right">{reviewError}</p>}
        <div className="flex justify-end gap-3 mt-4">
          {showReject && (
            <Button
              variant="danger"
              size="sm"
              icon={<X size={14} />}
              loading={submitting === "reject"}
              onClick={onReject}
              disabled={submitting !== null}
            >
              Reject Record
            </Button>
          )}
          {showFlag && (
            <Button
              variant="secondary"
              size="sm"
              icon={<Flag size={14} />}
              loading={submitting === "flag"}
              onClick={onFlag}
              disabled={submitting !== null}
            >
              Flag for Follow-up
            </Button>
          )}
          {showApprove && (
            <Button
              variant="primary"
              size="sm"
              icon={<Check size={14} />}
              loading={submitting === "approve"}
              onClick={onApprove}
              disabled={submitting !== null}
            >
              Approve &amp; Add to Atlas
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

function severityColor(sev: string): string {
  const s = normalizeSeverity(sev);
  return s === "High"
    ? "var(--color-danger)"
    : s === "Medium"
      ? "var(--color-brand-orange)"
      : "var(--color-brand-green)";
}
