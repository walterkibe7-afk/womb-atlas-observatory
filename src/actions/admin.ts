"use server";

import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { logAuditEvent } from "@/lib/audit-logger";
import { ActionType } from "@prisma/client";

export async function createUser(data: {
  email: string;
  name: string;
  role: string;
  password?: string;
}) {
  try {
    const session = await auth();
    const currentUserId = session?.user?.id;

    const existing = await prisma.user.findUnique({
      where: { email: data.email },
    });

    if (existing) {
      return { success: false, error: "User already exists with this email" };
    }

    let hashedPassword = null;
    if (data.password) {
      // In a real app we'd want to configure salt rounds securely, 10 is standard
      hashedPassword = await bcrypt.hash(data.password, 10);
    }

    const user = await prisma.user.create({
      data: {
        email: data.email,
        name: data.name,
        role: data.role,
        password: hashedPassword,
      },
    });

    logAuditEvent({
      entityId: user.id,
      entityType: "User",
      actionType: ActionType.CREATE,
      dataAfter: {
        email: user.email,
        name: user.name,
        role: user.role,
      },
      userId: currentUserId,
    });

    revalidatePath("/admin/access");
    return { success: true, user };
  } catch (error) {
    console.error("Failed to create user:", error);
    return { success: false, error: "Failed to create user" };
  }
}

export async function updateUserRole(userId: string, newRole: string) {
  try {
    const session = await auth();
    const currentUserId = session?.user?.id;

    if (!currentUserId) {
      return { success: false, error: "Unauthorized" };
    }

    const oldUser = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!oldUser) {
      return { success: false, error: "User not found" };
    }

    if (oldUser.role === newRole) {
      return { success: true, role: oldUser.role };
    }

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: { role: newRole },
    });

    logAuditEvent({
      entityId: updatedUser.id,
      entityType: "User",
      actionType: ActionType.UPDATE,
      dataBefore: { role: oldUser.role },
      dataAfter: { role: updatedUser.role },
      userId: currentUserId,
    });

    revalidatePath("/admin/access");
    return { success: true, role: updatedUser.role };
  } catch (error) {
    console.error("Failed to update user role:", error);
    return { success: false, error: "Failed to update role" };
  }
}
