import { prisma } from "@/lib/prisma";
import { ActionType, Prisma } from "@prisma/client";

export interface AuditLogParams {
  entityId: string;
  entityType: string;
  actionType: ActionType;
  dataBefore?: Prisma.InputJsonValue;
  dataAfter?: Prisma.InputJsonValue;
  userId?: string;
}

/**
 * Helper function to log audit events to the database.
 * 
 * It asynchronously creates an audit log entry.
 * It is wrapped in a try/catch block so that auditing failures 
 * do not break the main application flow.
 */
export async function logAuditEvent(params: AuditLogParams): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        entityId: params.entityId,
        entityType: params.entityType,
        actionType: params.actionType,
        dataBefore: params.dataBefore ?? Prisma.DbNull,
        dataAfter: params.dataAfter ?? Prisma.DbNull,
        userId: params.userId,
      },
    });
  } catch (error) {
    // Ideally this goes to an error tracking service (e.g. Sentry/Datadog)
    console.error("[AuditLogger] Failed to write audit log:", error);
  }
}
