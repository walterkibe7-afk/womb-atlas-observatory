import { RecordsWorkspace } from "@/components/steward/RecordsWorkspace";

export default function RejectedPage() {
  return (
    <RecordsWorkspace
      statusParam="rejected"
      title="Rejected"
      description="Atlas Records that were rejected and excluded from the intelligence layer."
    />
  );
}
