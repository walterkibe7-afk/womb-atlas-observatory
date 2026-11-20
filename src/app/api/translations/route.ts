import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const searchParams = request.nextUrl.searchParams;
  const searchQuery = searchParams.get("search") ?? "";
  const locale = searchParams.get("locale") ?? "";
  const entityType = searchParams.get("entityType") ?? "";
  const fetchAll = searchParams.get("fetchAll") === "true";
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));
  const size = Math.min(100, Math.max(1, parseInt(searchParams.get("size") ?? "20", 10)));

  const where: Record<string, unknown> = {};

  if (entityType) {
    where.key = { startsWith: entityType };
  }

  if (searchQuery && locale) {
    where.AND = [
      { values: { some: { locale } } },
      {
        OR: [
          { key: { contains: searchQuery } },
          { values: { some: { value: { contains: searchQuery } } } },
        ],
      },
    ];
  } else if (searchQuery) {
    where.OR = [
      { key: { contains: searchQuery } },
      { values: { some: { value: { contains: searchQuery } } } },
    ];
  } else if (locale) {
    where.values = { some: { locale } };
  }

  const [translations, total] = await Promise.all([
    prisma.formTranslation.findMany({
      where,
      include: {
        values: {
          orderBy: { locale: "asc" },
        },
      },
      orderBy: { key: "asc" },
      skip: fetchAll ? 0 : (page - 1) * size,
      take: fetchAll ? undefined : size,
    }),
    prisma.formTranslation.count({ where }),
  ]);

  return NextResponse.json({
    content: translations.map((t) => ({
      id: t.id,
      key: t.key,
      translationValues: t.values.map((v) => ({
        id: v.id,
        locale: v.locale,
        value: v.value,
      })),
    })),
    total,
    page: fetchAll ? 1 : page,
    size: fetchAll ? total : size,
    totalPages: fetchAll ? 1 : Math.ceil(total / size),
  });
}

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();

  if (!body.key || typeof body.key !== "string") {
    return NextResponse.json({ error: "key is required" }, { status: 400 });
  }

  if (!body.translationValues || !Array.isArray(body.translationValues) || body.translationValues.length === 0) {
    return NextResponse.json({ error: "translationValues is required" }, { status: 400 });
  }

  for (const tv of body.translationValues) {
    if (!tv.locale || !tv.value) {
      return NextResponse.json({ error: "each translationValue must have locale and value" }, { status: 400 });
    }
  }

  const existing = await prisma.formTranslation.findUnique({ where: { key: body.key } });
  if (existing) {
    return NextResponse.json({ error: "Translation key already exists" }, { status: 409 });
  }

  const translation = await prisma.formTranslation.create({
    data: {
      key: body.key,
      values: {
        create: body.translationValues.map((tv: { locale: string; value: string }) => ({
          locale: tv.locale,
          value: tv.value,
        })),
      },
    },
    include: { values: true },
  });

  return NextResponse.json({
    id: translation.id,
    key: translation.key,
    translationValues: translation.values.map((v) => ({
      id: v.id,
      locale: v.locale,
      value: v.value,
    })),
  }, { status: 201 });
}
