import { auth } from "@/auth";
import { getSystemStatus } from "@/lib/admin/system-status";

export async function GET() {
  const session = await auth();
  const role = (session?.user as { role?: string } | undefined)?.role;

  if (!session || role !== "admin") {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const stats = await getSystemStatus();
    return Response.json(stats);
  } catch (error) {
    console.error("System status error:", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
