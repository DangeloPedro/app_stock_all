import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { atualizarProdutoSchema } from "@/lib/validation";
import { aplicarUnidadeDaFamilia } from "@/lib/familias";

// PATCH /api/produtos/:id — atualização parcial (edição no catálogo, ou
// mudança manual de status fora do fluxo de compra: ex. "acabou" volta pra
// na_lista sem precisar registrar um EventoDeCompra).
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const body = await request.json();
  const parsed = atualizarProdutoSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const data = { ...parsed.data };

  // Só entra em jogo quando família ou unidade estão de fato no PATCH — o
  // resto (estoque, localização, status, etc.) não precisa tocar em nada
  // disso. Quando um dos dois muda, o outro precisa do valor atual do banco
  // pra decidir contra qual família aplicar a trava (ver
  // aplicarUnidadeDaFamilia): mover produto pra outra família reavalia a
  // trava contra a família NOVA, com a unidade que o produto já tinha
  // quando "unidadeDeMedida" não veio nesse PATCH.
  if ("productFamily" in data || "unidadeDeMedida" in data) {
    const atual = await prisma.produto.findUnique({
      where: { id },
      select: { productFamily: true, unidadeDeMedida: true },
    });
    if (!atual) {
      return NextResponse.json({ error: "product not found" }, { status: 404 });
    }
    const familiaAlvo = data.productFamily ?? atual.productFamily;
    const unidadeInformada =
      "unidadeDeMedida" in data ? (data.unidadeDeMedida ?? null) : atual.unidadeDeMedida;
    data.unidadeDeMedida = await aplicarUnidadeDaFamilia(
      familiaAlvo,
      unidadeInformada,
    );
  }

  try {
    const produto = await prisma.produto.update({
      where: { id },
      data,
    });
    return NextResponse.json(produto);
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2025") {
      return NextResponse.json(
        { error: "product not found" },
        { status: 404 },
      );
    }
    throw e;
  }
}
