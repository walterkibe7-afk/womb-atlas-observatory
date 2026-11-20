"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { FileText, Loader2 } from "lucide-react";
import { ReviewQueue } from "./ReviewQueue";
import { RecordDetail } from "./RecordDetail";
import type { StewardRecord } from "./types";

/**
 * Shared steward records browser: the left Review Queue + center Record Detail,
 * scoped to one AtlasRecord status. Powers the status sidebar pages (In Review,
 * Reviewed, Flagged, Rejected). RecordDetail derives its own action controls
 * from the record's status — including the correction controls for records that
 * already carry a decision — so no `readOnly` flag is needed here.
 */
export function RecordsWorkspace({
  statusParam,
  title,
  description,
}: {
  statusParam: string;
  title: string;
  description: string;
}) {
  const [records, setRecords] = useState<StewardRecord[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadRecords = useCallback(async () => {
    try {
      const res = await fetch(`/api/steward/records?status=${encodeURIComponent(statusParam)}`);
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
  }, [statusParam]);

  useEffect(() => {
    // loadRecords sets state only after `await`, not synchronously.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadRecords();
  }, [loadRecords]);

  const selected = useMemo(
    () => records.find((r) => r.id === selectedId) ?? null,
    [records, selectedId],
  );

  return (
    <div className="p-4 sm:p-8 pb-20 max-w-[1600px] mx-auto space-y-6 text-white">
      <header className="mb-2">
        <h1 className="text-2xl sm:text-3xl font-serif text-white mb-2">{title}</h1>
        <p className="text-sm text-gray-400">{description}</p>
      </header>

      <div className="grid grid-cols-12 gap-4 lg:gap-6">
        <ReviewQueue
          records={records}
          selectedId={selectedId}
          onSelect={setSelectedId}
          loading={loading}
          error={error}
          className="col-span-12 lg:col-span-3 h-[440px] lg:h-[800px]"
          listClassName="flex-1"
        />

        <div className="col-span-12 lg:col-span-9 rounded-[var(--radius-card)] border border-[var(--color-border)] bg-surface-card p-4 sm:p-6 h-[600px] lg:h-[800px] overflow-y-auto [&::-webkit-scrollbar]:hidden">
          {!selected ? (
            <div className="h-full flex flex-col items-center justify-center text-center">
              {loading ? (
                <Loader2 className="w-8 h-8 text-brand-gold animate-spin" />
              ) : (
                <>
                  <FileText className="w-8 h-8 text-faint mb-3" />
                  <p className="text-sm text-secondary">No record selected</p>
                </>
              )}
            </div>
          ) : (
            <RecordDetail key={selected.id} record={selected} onReviewed={loadRecords} />
          )}
        </div>
      </div>
    </div>
  );
}
