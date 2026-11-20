import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const body = await request.json();

  const existing = await prisma.formTranslation.findUnique({
    where: { id },
    include: { values: true },
  });

  if (!existing) {
    return NextResponse.json({ error: "Translation not found" }, { status: 404 });
  }

  if (body.translationValues && Array.isArray(body.translationValues)) {
    for (const tv of body.translationValues) {
      const existingValue = existing.values.find((v) => v.locale === tv.locale);
      if (existingValue) {
        await prisma.formTranslationData.update({
          where: { id: existingValue.id },
          data: { value: tv.value },
        });
      } else if (tv.locale && tv.value) {
        await prisma.formTranslationData.create({
          data: {
            translationId: id,
            locale: tv.locale,
            value: tv.value,
          },
        });
      }
    }
  }

  if (body.key && body.key !== existing.key) {
    const conflict = await prisma.formTranslation.findUnique({ where: { key: body.key } });
    if (conflict) {
      return NextResponse.json({ error: "Translation key already exists" }, { status: 409 });
    }
    await prisma.formTranslation.update({
      where: { id },
      data: { key: body.key },
    });
  }

  const updated = await prisma.formTranslation.findUnique({
    where: { id },
    include: { values: { orderBy: { locale: "asc" } } },
  });

  if (!updated) {
    return NextResponse.json({ error: "Translation not found after update" }, { status: 404 });
  }

  return NextResponse.json({
    id: updated.id,
    key: updated.key,
    translationValues: updated.values.map((v) => ({
      id: v.id,
      locale: v.locale,
      value: v.value,
    })),
  });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const existing = await prisma.formTranslation.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "Translation not found" }, { status: 404 });
  }

  await prisma.formTranslation.delete({ where: { id } });

  return NextResponse.json({ success: true });
}
