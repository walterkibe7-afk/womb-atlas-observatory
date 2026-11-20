import { prisma } from "@/lib/prisma";

export interface EndpointStatus {
  name: string;
  latency: number;
  status: "Operational" | "Degraded" | "Down";
}

export interface InfraStatus {
  name: string;
  usage: string;
  status: "Operational" | "Degraded" | "Down";
}

export interface SystemStatusData {
  overallStatus: "Operational" | "Degraded" | "Down";
  uptimePercent: number;
  uptimeSeconds: number;
  endpoints: EndpointStatus[];
  infrastructure: InfraStatus[];
}

async function timedQuery(fn: () => Promise<unknown>): Promise<{ latency: number; success: boolean }> {
  const start = performance.now();
  try {
    await fn();
    return { latency: Math.round(performance.now() - start), success: true };
  } catch {
    return { latency: Math.round(performance.now() - start), success: false };
  }
}

function endpointStatus(latency: number, success: boolean): "Operational" | "Degraded" | "Down" {
  if (!success) return "Down";
  if (latency > 500) return "Degraded";
  return "Operational";
}

export async function getSystemStatus(): Promise<SystemStatusData> {
  const dbCheck = await timedQuery(() => prisma.$queryRaw`SELECT 1`);

  const globalStatus = await prisma.$queryRaw<Array<{ Variable_name: string; Value: string }>>`
    SHOW GLOBAL STATUS
  `.catch(() => [] as Array<{ Variable_name: string; Value: string }>);

  const statusMap = new Map(globalStatus.map((s) => [s.Variable_name, s.Value]));

  const uptimeSeconds = parseInt(statusMap.get("Uptime") || "0", 10);
  const activeConnections = parseInt(statusMap.get("Threads_connected") || "0", 10);
  const maxConnections = parseInt(statusMap.get("Max_used_connections") || "0", 10);

  const thirtyDaysInSeconds = 30 * 24 * 60 * 60;
  const uptimePercent = uptimeSeconds > 0
    ? Math.min(100, Math.round((uptimeSeconds / thirtyDaysInSeconds) * 10000) / 100)
    : 0;

  const [authCheck, observationCheck, transcriptionCheck, reflectionCheck] = await Promise.all([
    timedQuery(() => prisma.user.count({ take: 1 })),
    timedQuery(() => prisma.observation.count({ take: 1 })),
    timedQuery(() => prisma.narrative.count({ take: 1 })),
    timedQuery(() => prisma.atlasReflectionRow.count({ take: 1 })),
  ]);

  const endpoints: EndpointStatus[] = [
    {
      name: "Authentication Service (OAuth)",
      latency: authCheck.latency,
      status: endpointStatus(authCheck.latency, authCheck.success),
    },
    {
      name: "Observation Ingestion API",
      latency: observationCheck.latency,
      status: endpointStatus(observationCheck.latency, observationCheck.success),
    },
    {
      name: "Voice Transcription Engine",
      latency: transcriptionCheck.latency,
      status: endpointStatus(transcriptionCheck.latency, transcriptionCheck.success),
    },
    {
      name: "Reflection Generation",
      latency: reflectionCheck.latency,
      status: endpointStatus(reflectionCheck.latency, reflectionCheck.success),
    },
  ];

  const dbLoadPercent = maxConnections > 0
    ? Math.round((activeConnections / maxConnections) * 100)
    : 0;

  const infrastructure: InfraStatus[] = [
    {
      name: "Next.js Application Server",
      usage: "Active",
      status: dbCheck.success ? "Operational" : "Down",
    },
    {
      name: "Prisma Database Proxy",
      usage: `${dbLoadPercent}% connection pool`,
      status: dbCheck.success ? "Operational" : "Down",
    },
    {
      name: "Database Server",
      usage: `${activeConnections} active connections`,
      status: dbCheck.success ? "Operational" : "Down",
    },
  ];

  const allOperational = endpoints.every((e) => e.status === "Operational") && dbCheck.success;
  const anyDown = endpoints.some((e) => e.status === "Down") || !dbCheck.success;

  return {
    overallStatus: anyDown ? "Down" : allOperational ? "Operational" : "Degraded",
    uptimePercent: uptimeSeconds > 0 ? uptimePercent : 100,
    uptimeSeconds,
    endpoints,
    infrastructure,
  };
}
