import { auth } from "@/auth";
import { getObservatoryGrowthStats } from "@/lib/admin/observatory-growth-stats";

export async function GET() {
  const session = await auth();
  const role = (session?.user as { role?: string } | undefined)?.role;

  if (!session || role !== "admin") {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const stats = await getObservatoryGrowthStats();
    return Response.json(stats);
  } catch (error) {
    console.error("Observatory growth stats error:", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
