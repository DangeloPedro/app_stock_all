import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { criarLocalizacaoSchema } from "@/lib/validation";

// GET /api/localizacoes?ativo=true — lista de locais em casa (fridge,
// freezer, etc.). Por padrão traz tudo; ?ativo=true filtra só ativos.
export async function GET(request: NextRequest) {
  const ativoParam = request.nextUrl.searchParams.get("ativo");
  const localizacoes = await prisma.localizacao.findMany({
    where: ativoParam !== null ? { ativo: ativoParam === "true" } : undefined,
    orderBy: { nome: "asc" },
  });
  return NextResponse.json(localizacoes);
}

// POST /api/localizacoes — cadastra um local novo.
export async function POST(request: NextRequest) {
  const body = await request.json();
  const parsed = criarLocalizacaoSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.flatten() },
      { status: 400 },
    );
  }

  try {
    const localizacao = await prisma.localizacao.create({ data: parsed.data });
    return NextResponse.json(localizacao, { status: 201 });
  } catch (e) {
    if (
      e instanceof Prisma.PrismaClientKnownRequestError &&
      e.code === "P2002"
    ) {
      return NextResponse.json(
        { error: "a location with that name already exists" },
        { status: 409 },
      );
    }
    throw e;
  }
}
