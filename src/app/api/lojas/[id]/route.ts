import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { atualizarLojaSchema } from "@/lib/validation";

// PATCH /api/lojas/:id — renomear e/ou ativar/desativar. Desativar é
// soft-delete: "parei de ir nesse mercado" — some das opções de compra nova,
// mas EventoDeCompra antigos continuam íntegros (ver schema.prisma).
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const body = await request.json();
  const parsed = atualizarLojaSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.flatten() },
      { status: 400 },
    );
  }

  try {
    const loja = await prisma.loja.update({ where: { id }, data: parsed.data });
    return NextResponse.json(loja);
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError) {
      if (e.code === "P2025") {
        return NextResponse.json(
          { error: "store not found" },
          { status: 404 },
        );
      }
      if (e.code === "P2002") {
        return NextResponse.json(
          { error: "a store with that name already exists" },
          { status: 409 },
        );
      }
    }
    throw e;
  }
}
