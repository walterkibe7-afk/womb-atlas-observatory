import { prisma } from "@/lib/prisma";

export interface KnowledgeGovernanceStats {
  totalSignals: Metric;
  activeSignals: Metric;
  newThisMonth: Metric;
  mergedThisMonth: Metric;
  recentActivity: SignalActivity[];
}

interface Metric {
  value: number;
  change: number;
}

export interface SignalActivity {
  signalId: string;
  signalName: string;
  action: string;
  timestamp: string;
  userId?: string;
}

function calcChange(current: number, previous: number): number {
  if (previous === 0) {
    if (current === 0) return 0;
    return 100;
  }
  return Math.round(((current - previous) / previous) * 1000) / 10;
}

export async function getKnowledgeGovernanceStats(): Promise<KnowledgeGovernanceStats> {
  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const [totalSignals, totalSignalsPrev, signalRules, recentAuditLogs] =
    await Promise.all([
      prisma.signalRule.count(),
      prisma.signalRule.count(),
      prisma.signalRule.findMany({
        select: { signalId: true, name: true },
      }),
      prisma.auditLog.findMany({
        where: { entityType: "signal_rule" },
        orderBy: { timestamp: "desc" },
        take: 20,
      }),
    ]);

  const signalNameById = new Map(signalRules.map((r) => [r.signalId, r.name]));

  const newThisMonth = recentAuditLogs.filter(
    (l) => l.actionType === "CREATE" && l.timestamp >= startOfMonth,
  ).length;
  const mergedThisMonth = recentAuditLogs.filter(
    (l) => l.actionType === "MERGE" && l.timestamp >= startOfMonth,
  ).length;

  const lastMonthStart = new Date(
    startOfMonth.getTime() - 30 * 24 * 60 * 60 * 1000,
  );

  const newThisMonthPrev = recentAuditLogs.filter(
    (l) =>
      l.actionType === "CREATE" &&
      l.timestamp >= lastMonthStart &&
      l.timestamp < startOfMonth,
  ).length;
  const mergedThisMonthPrev = recentAuditLogs.filter(
    (l) =>
      l.actionType === "MERGE" &&
      l.timestamp >= lastMonthStart &&
      l.timestamp < startOfMonth,
  ).length;

  const recentActivity: SignalActivity[] = recentAuditLogs.map((l) => ({
    signalId: l.entityId,
    signalName: signalNameById.get(l.entityId) ?? l.entityId,
    action: l.actionType,
    timestamp: l.timestamp.toISOString(),
    userId: l.userId ?? undefined,
  }));

  return {
    totalSignals: {
      value: totalSignals,
      change: calcChange(totalSignals, totalSignalsPrev),
    },
    activeSignals: {
      value: totalSignals,
      change: calcChange(totalSignals, totalSignalsPrev),
    },
    newThisMonth: {
      value: newThisMonth,
      change: calcChange(newThisMonth, newThisMonthPrev),
    },
    mergedThisMonth: {
      value: mergedThisMonth,
      change: calcChange(mergedThisMonth, mergedThisMonthPrev),
    },
    recentActivity,
  };
}
