import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { LANGUAGES } from "@/lib/observation/languages";
import { NextResponse } from "next/server";

const VALID_CODES = new Set(LANGUAGES.map((l) => l.code));

/**
 * Sets a participant's locale exactly once. Permanent by design — the
 * client's whole basis for this feature is that a participant's answers,
 * reflections and chat history all end up written in this language, so
 * changing it later would leave one account split across languages. There
 * is deliberately no override path, not even for admins.
 *
 * Enforced atomically via the WHERE clause (locale: null) rather than a
 * read-then-write, so a double-click or a second tab can't race past the
 * lock.
 */
export async function PATCH(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { locale } = (await req.json()) as { locale?: string };
  if (!locale || !VALID_CODES.has(locale)) {
    return NextResponse.json({ error: "Invalid locale" }, { status: 400 });
  }

  const result = await prisma.user.updateMany({
    where: { id: session.user.id, locale: null },
    data: { locale },
  });

  if (result.count === 0) {
    const existing = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { locale: true },
    });
    return NextResponse.json(
      { error: "Language already set", locale: existing?.locale ?? null },
      { status: 409 },
    );
  }

  return NextResponse.json({ success: true, locale });
}
