import { RecordsWorkspace } from "@/components/steward/RecordsWorkspace";

export default function FlaggedPage() {
  return (
    <RecordsWorkspace
      statusParam="flagged"
      title="Flagged"
      description="Atlas Records flagged for follow-up or secondary clinical review."
    />
  );
}
