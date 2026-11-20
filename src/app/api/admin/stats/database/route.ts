import { auth } from "@/auth";
import { getDatabaseStats } from "@/lib/admin/database-stats";

export async function GET() {
  const session = await auth();
  const role = (session?.user as { role?: string } | undefined)?.role;

  if (!session || role !== "admin") {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const stats = await getDatabaseStats();
    return Response.json(stats);
  } catch (error) {
    console.error("Database stats error:", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
