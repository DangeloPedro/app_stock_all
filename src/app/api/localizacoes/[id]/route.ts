import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { atualizarLocalizacaoSchema } from "@/lib/validation";

// PATCH /api/localizacoes/:id — renomear e/ou ativar/desativar (soft-delete,
// mesmo raciocínio de /api/lojas/:id).
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const body = await request.json();
  const parsed = atualizarLocalizacaoSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.flatten() },
      { status: 400 },
    );
  }

  try {
    const localizacao = await prisma.localizacao.update({
      where: { id },
      data: parsed.data,
    });
    return NextResponse.json(localizacao);
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError) {
      if (e.code === "P2025") {
        return NextResponse.json(
          { error: "location not found" },
          { status: 404 },
        );
      }
      if (e.code === "P2002") {
        return NextResponse.json(
          { error: "a location with that name already exists" },
          { status: 409 },
        );
      }
    }
    throw e;
  }
}
