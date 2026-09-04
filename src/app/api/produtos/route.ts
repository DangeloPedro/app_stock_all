import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { criarProdutoSchema, statusProdutoSchema } from "@/lib/validation";
import { aplicarUnidadeDaFamilia } from "@/lib/familias";

// GET /api/produtos?status=na_lista&q=leite&ativo=true
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const statusParam = params.get("status");
  const q = params.get("q")?.trim();
  const ativoParam = params.get("ativo");

  const statusParsed = statusParam
    ? statusProdutoSchema.safeParse(statusParam)
    : null;
  if (statusParsed && !statusParsed.success) {
    return NextResponse.json(
      { error: "invalid status" },
      { status: 400 },
    );
  }

  const produtos = await prisma.produto.findMany({
    where: {
      ...(statusParsed ? { status: statusParsed.data } : {}),
      ...(ativoParam !== null ? { ativo: ativoParam === "true" } : {}),
      ...(q
        ? {
            OR: [
              { nome: { contains: q, mode: "insensitive" } },
              { productFamily: { contains: q, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    orderBy: [{ productFamily: "asc" }, { nome: "asc" }],
  });

  return NextResponse.json(produtos);
}

// POST /api/produtos — cria um novo produto no catálogo.
export async function POST(request: NextRequest) {
  const body = await request.json();
  const parsed = criarProdutoSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.flatten() },
      { status: 400 },
    );
  }

  // Se a família já tem unidade travada, ignora o que veio no request e usa
  // a travada; se é a primeira vez que essa família recebe um produto com
  // unidade preenchida, esta chamada É o que trava. Ver lib/familias.ts.
  const unidadeDeMedida = await aplicarUnidadeDaFamilia(
    parsed.data.productFamily,
    parsed.data.unidadeDeMedida ?? null,
  );

  const produto = await prisma.produto.create({
    data: { ...parsed.data, unidadeDeMedida },
  });
  return NextResponse.json(produto, { status: 201 });
}
