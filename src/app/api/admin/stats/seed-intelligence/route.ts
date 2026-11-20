import { auth } from "@/auth";
import { getSeedIntelligenceStats } from "@/lib/admin/seed-intelligence-stats";

export async function GET(req: Request) {
  const session = await auth();
  const role = (session?.user as { role?: string } | undefined)?.role;

  if (!session || role !== "admin") {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const range = new URL(req.url).searchParams.get("range") ?? "all";
    const stats = await getSeedIntelligenceStats(range);
    return Response.json(stats);
  } catch (error) {
    console.error("Seed intelligence stats error:", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
