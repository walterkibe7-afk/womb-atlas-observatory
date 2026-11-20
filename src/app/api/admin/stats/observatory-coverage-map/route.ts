import { auth } from "@/auth";
import { getObservatoryCoverageStats } from "@/lib/admin/observatory-coverage-stats";

export async function GET() {
  const session = await auth();
  const role = (session?.user as { role?: string } | undefined)?.role;

  if (!session || role !== "admin") {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const stats = await getObservatoryCoverageStats();
    return Response.json(stats);
  } catch (error) {
    console.error("Observatory coverage stats error:", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
