"use client";

import { Check, MessageCircle, Flag, CircleX, Loader2, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/cn";
import type { StewardRecord } from "../types";
import { useStewardReview, type ReviewAction, type ReviewPayload } from "../useStewardReview";

/* ── Reviewer Actions row ─────────────────────────────────────────────────────
   The dashboard's action band. Each tile decides the record currently open in
   the Record Detail panel (the queue's selected row) through the same review
   endpoint the detail panel uses, so nothing can bypass a record's status.

   "Request More Info" has no messaging channel in the product yet, so it files
   the record under Flagged with an explicit flagReason — that keeps it in the
   steward's follow-up queue and distinguishes it from a plain flag in the data.
   ------------------------------------------------------------------------- */

type ActionTile = {
  icon: LucideIcon;
  title: string;
  sub: string;
  action: ReviewAction;
  payload?: ReviewPayload;
  /** AtlasRecord.status this action results in — used to mark the current one. */
  resultStatus: string;
  cta?: boolean;
  iconColor?: string;
};

const REVIEWER_ACTIONS: ActionTile[] = [
  {
    icon: Check,
    title: "Integrate Into Atlas",
    sub: "Approve & Add to Atlas",
    action: "approve",
    resultStatus: "Reviewed",
    cta: true,
  },
  {
    icon: MessageCircle,
    title: "Request More Info",
    sub: "Message Contributor",
    action: "flag",
    payload: { flagReason: "More information requested" },
    resultStatus: "Flagged",
  },
  {
    icon: Flag,
    title: "Flag for Follow-up",
    sub: "Needs Attention",
    action: "flag",
    payload: { flagReason: "Needs attention" },
    resultStatus: "Flagged",
    iconColor: "text-brand-orange",
  },
  {
    icon: CircleX,
    title: "Exclude from Atlas",
    sub: "Remove from Atlas",
    action: "reject",
    resultStatus: "Rejected",
    iconColor: "text-danger",
  },
];

export function ReviewerActionsRow({
  record,
  onReviewed,
}: {
  /** The record selected in the Review Queue, or null when none is open. */
  record: StewardRecord | null;
  onReviewed?: () => void;
}) {
  const { submit, submitting, reviewError } = useStewardReview(record?.id ?? null, onReviewed);
  const busy = submitting !== null;

  return (
    <div>
      <div className="flex items-center justify-between gap-3 mb-2 text-[11px]">
        <span className="text-faint">
          {record ? (
            <>
              Acting on <span className="text-secondary">{record.displayId}</span> ·{" "}
              {record.contributor.name}
            </>
          ) : (
            "Select a record in the Review Queue to use these actions."
          )}
        </span>
        {reviewError && <span className="text-danger">{reviewError}</span>}
      </div>

      <div className="flex flex-wrap gap-3">
        {REVIEWER_ACTIONS.map((a) => {
          const current = !!record && record.status === a.resultStatus;
          const disabled = !record || busy;
          const pending = submitting === a.action;

          return (
            <button
              key={a.title}
              type="button"
              onClick={() => submit(a.action, a.payload)}
              disabled={disabled}
              aria-current={current || undefined}
              className={cn(
                "flex-1 min-w-[210px] flex items-center gap-3 p-4 rounded-[var(--radius-card)] border text-left transition-colors",
                a.cta
                  ? "bg-cta border-[var(--color-cta-border)]"
                  : "bg-surface-card border-[var(--color-border)]",
                !disabled && "hover:border-brand-gold cursor-pointer",
                disabled && "opacity-50 cursor-not-allowed",
                current && "border-[var(--color-border-active)]",
              )}
            >
              <span
                className={cn(
                  "w-9 h-9 rounded-full flex items-center justify-center shrink-0",
                  a.cta
                    ? "bg-accent-strong text-on-accent"
                    : cn("bg-[var(--color-surface-hover)]", a.iconColor ?? "text-secondary"),
                )}
              >
                {pending ? <Loader2 size={18} className="animate-spin" /> : <a.icon size={18} />}
              </span>
              <div className="min-w-0">
                <div className="text-sm font-semibold text-fg truncate">{a.title}</div>
                <div className="text-[11px] text-muted truncate">
                  {current ? "Current status" : a.sub}
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
