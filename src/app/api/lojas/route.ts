import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { criarLojaSchema } from "@/lib/validation";

// GET /api/lojas?ativo=true — lista de mercados. Por padrão traz só os
// ativos (usados nos selects de compra); ?ativo=false ou omitido sem filtro
// traz todos, pra tela de gestão poder reativar um mercado.
export async function GET(request: NextRequest) {
  const ativoParam = request.nextUrl.searchParams.get("ativo");
  const lojas = await prisma.loja.findMany({
    where: ativoParam !== null ? { ativo: ativoParam === "true" } : undefined,
    orderBy: { nome: "asc" },
  });
  return NextResponse.json(lojas);
}

// POST /api/lojas — cadastra um mercado novo.
export async function POST(request: NextRequest) {
  const body = await request.json();
  const parsed = criarLojaSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.flatten() },
      { status: 400 },
    );
  }

  try {
    const loja = await prisma.loja.create({ data: parsed.data });
    return NextResponse.json(loja, { status: 201 });
  } catch (e) {
    if (
      e instanceof Prisma.PrismaClientKnownRequestError &&
      e.code === "P2002"
    ) {
      return NextResponse.json(
        { error: "a store with that name already exists" },
        { status: 409 },
      );
    }
    throw e;
  }
}
