import { RecordsWorkspace } from "@/components/steward/RecordsWorkspace";

export default function ReviewedPage() {
  return (
    <RecordsWorkspace
      statusParam="reviewed"
      title="Reviewed"
      description="Atlas Records that have been approved and added to the seed intelligence layer."
    />
  );
}
