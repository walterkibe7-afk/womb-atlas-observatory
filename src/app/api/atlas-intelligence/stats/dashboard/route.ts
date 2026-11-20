import { auth } from "@/auth";
import { getDashboardStats } from "@/lib/atlas-intelligence/dashboard-stats";

export async function GET() {
  const session = await auth();
  const role = (session?.user as { role?: string } | undefined)?.role;

  if (!session || role !== "admin") {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const stats = await getDashboardStats();
    return Response.json(stats);
  } catch (error) {
    console.error("Dashboard stats error:", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
