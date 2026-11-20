"use client";

import { useCallback, useState } from "react";

// Shared write path for steward decisions: POST /api/steward/records/[id]/review.
// Used by the record detail's own buttons and by the dashboard's Reviewer
// Actions row, so both go through identical request/pending/error handling.

export type ReviewAction = "approve" | "flag" | "reject" | "reopen";

export type ReviewPayload = { notes?: string; flagReason?: string };

export function useStewardReview(recordId: string | null, onReviewed?: () => void) {
  // Which action is in flight (null when idle) — drives per-button spinners.
  const [submitting, setSubmitting] = useState<ReviewAction | null>(null);
  const [reviewStatus, setReviewStatus] = useState<string | null>(null);
  const [reviewError, setReviewError] = useState<string | null>(null);

  const submit = useCallback(
    async (action: ReviewAction, payload: ReviewPayload = {}) => {
      if (!recordId) return;
      setSubmitting(action);
      setReviewError(null);
      try {
        const res = await fetch(`/api/steward/records/${recordId}/review`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action, ...payload }),
        });
        if (!res.ok) throw new Error("Failed to save review");
        const data = (await res.json()) as { review: { status: string } };
        setReviewStatus(data.review.status);
        onReviewed?.();
      } catch (err) {
        setReviewError(err instanceof Error ? err.message : "Failed to save review");
      } finally {
        setSubmitting(null);
      }
    },
    [recordId, onReviewed],
  );

  return { submit, submitting, reviewStatus, reviewError };
}
