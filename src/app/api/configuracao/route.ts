import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { atualizarConfiguracaoSchema } from "@/lib/validation";

// GET /api/configuracao — configuração global do app (hoje só a moeda usada
// pra exibir preços). Singleton: sem registro ainda = default BRL.
export async function GET() {
  const config = await prisma.configuracao.findUnique({
    where: { id: "singleton" },
  });
  return NextResponse.json({ moeda: config?.moeda ?? "BRL" });
}

// PATCH /api/configuracao — upsert do singleton (pode não existir ainda na
// primeira troca de moeda).
export async function PATCH(request: NextRequest) {
  const body = await request.json();
  const parsed = atualizarConfiguracaoSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const config = await prisma.configuracao.upsert({
    where: { id: "singleton" },
    update: parsed.data,
    create: { id: "singleton", ...parsed.data },
  });
  return NextResponse.json(config);
}
