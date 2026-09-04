import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { atualizarPrecoReferenciaSchema } from "@/lib/validation";

// GET /api/produtos/:id/precos — preço de referência por mercado ativo. Se
// não há referência salva ainda, cai pro último preço realmente pago nesse
// mercado (só como sugestão de partida pro usuário editar, dividido pela
// quantidade — precoPago é sempre total, referência é sempre por unidade);
// se não há nem isso, vem null.
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: produtoId } = await params;

  const [lojas, referencias, ultimosEventos] = await Promise.all([
    prisma.loja.findMany({ where: { ativo: true }, orderBy: { nome: "asc" } }),
    prisma.precoReferencia.findMany({ where: { produtoId } }),
    prisma.eventoDeCompra.findMany({
      where: { produtoId },
      orderBy: { data: "desc" },
    }),
  ]);

  const referenciaPorLoja = new Map(referencias.map((r) => [r.lojaId, r.preco]));
  const ultimoEventoPorLoja = new Map<string, number>();
  for (const evento of ultimosEventos) {
    if (!ultimoEventoPorLoja.has(evento.lojaId)) {
      ultimoEventoPorLoja.set(
        evento.lojaId,
        evento.precoPago / evento.quantidadeComprada,
      );
    }
  }

  const precos = lojas.map((loja) => ({
    lojaId: loja.id,
    lojaNome: loja.nome,
    preco:
      referenciaPorLoja.get(loja.id) ?? ultimoEventoPorLoja.get(loja.id) ?? null,
  }));

  return NextResponse.json(precos);
}

// PUT /api/produtos/:id/precos — cria/atualiza o preço de referência de um
// mercado pra esse produto. Sempre editável, independente de já ter
// histórico de compra ou não.
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: produtoId } = await params;
  const body = await request.json();
  const parsed = atualizarPrecoReferenciaSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const { lojaId, preco } = parsed.data;

  const referencia = await prisma.precoReferencia.upsert({
    where: { produtoId_lojaId: { produtoId, lojaId } },
    update: { preco },
    create: { produtoId, lojaId, preco },
  });

  return NextResponse.json(referencia);
}
