import { RecordsWorkspace } from "@/components/steward/RecordsWorkspace";

export default function InReviewPage() {
  return (
    <RecordsWorkspace
      statusParam="in-review"
      title="In Review"
      description="Atlas Records awaiting a steward decision. Approve, flag, or reject each record to move it forward."
    />
  );
}
