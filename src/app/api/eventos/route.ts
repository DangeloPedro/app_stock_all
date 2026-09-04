import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { criarEventoSchema, atualizarDataEventosSchema } from "@/lib/validation";

// POST /api/eventos — registra uma compra (produto + loja + preço pago +
// quantidade), transiciona o produto pra em_casa, incrementa o estoque, e
// sincroniza o PrecoReferencia daquele produto/loja com o preço pago (quem
// quiser um valor diferente pode editar depois em /api/produtos/:id/precos
// — a referência é sempre editável, isso aqui só evita o usuário ter que
// atualizar na mão logo após comprar).
//
// IMPORTANTE: precoPago é sempre o TOTAL da linha (preço × quantidade),
// mas PrecoReferencia.preco é sempre POR UNIDADE (é nele que o resto do
// app se baseia pra multiplicar por quantidade e estimar totais — ver
// to-buy, sugestao, PrecosPorLoja). Sincronizar direto com precoPago sem
// dividir pela quantidade inflava a referência a cada compra com
// quantidade > 1 (bug real corrigido aqui; achado numa revisão de
// design+dataviz — ver docs/revisao-modelo-dados.md pro raciocínio geral
// do modelo). Preços de referência já salvos ANTES desse fix podem estar
// inflados pra produtos comprados em mais de 1 unidade — vale conferir em
// "prices by store" e corrigir à mão se necessário.
export async function POST(request: NextRequest) {
  const body = await request.json();
  const parsed = criarEventoSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const {
    produtoId,
    lojaId,
    precoPago,
    quantidadeComprada,
    data,
    afetaEstoque,
    grupoCompraId,
  } = parsed.data;

  try {
    const evento = await prisma.$transaction(async (tx) => {
      const criado = await tx.eventoDeCompra.create({
        data: {
          produtoId,
          lojaId,
          precoPago,
          quantidadeComprada,
          ...(data ? { data } : {}),
          ...(grupoCompraId ? { grupoCompraId } : {}),
        },
      });
      // afetaEstoque=false (fluxo "ate out") pula a transição de
      // status/estoque de propósito — o item foi comprado E comido fora,
      // nunca passou pelo estoque de casa. O preço de referência ainda é
      // atualizado logo abaixo, porque é um preço real pago e continua
      // útil pra planejamento futuro.
      if (afetaEstoque) {
        await tx.produto.update({
          where: { id: produtoId },
          data: {
            status: "em_casa",
            quantidadeEmEstoque: { increment: quantidadeComprada },
            // Sai de na_lista → pegoNoMercado não tem mais sentido nesse
            // produto até ele voltar pra lista (ver comentário no schema).
            pegoNoMercado: false,
          },
        });
      }
      const precoUnitario = precoPago / quantidadeComprada;
      await tx.precoReferencia.upsert({
        where: { produtoId_lojaId: { produtoId, lojaId } },
        update: { preco: precoUnitario },
        create: { produtoId, lojaId, preco: precoUnitario },
      });
      return criado;
    });
    return NextResponse.json(evento, { status: 201 });
  } catch {
    return NextResponse.json(
      { error: "product or store not found" },
      { status: 404 },
    );
  }
}

// GET /api/eventos?produtoId=... — histórico de compras (opcionalmente de
// um produto só), mais recentes primeiro.
export async function GET(request: NextRequest) {
  const produtoId = request.nextUrl.searchParams.get("produtoId");
  const eventos = await prisma.eventoDeCompra.findMany({
    where: produtoId ? { produtoId } : undefined,
    include: { produto: true, loja: true },
    orderBy: { data: "desc" },
  });
  return NextResponse.json(eventos);
}

// DELETE /api/eventos — apaga um ou mais EventoDeCompra (usado em /historico
// pra excluir uma "compra" inteira, que é um grupo de eventos do mesmo
// dia+loja — ver page.tsx). Desfaz o efeito no estoque: decrementa
// quantidadeEmEstoque de cada produto pela quantidadeComprada daquele
// evento, sem deixar negativo (usuário pode já ter consumido o item antes de
// perceber que a compra estava errada). Não mexe em status/pegoNoMercado nem
// em PrecoReferencia — reverter isso exigiria saber o estado anterior, que
// não é guardado; o usuário ajusta à mão se precisar.
export async function DELETE(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const ids: unknown = body?.ids;
  if (!Array.isArray(ids) || ids.length === 0 || !ids.every((id) => typeof id === "string")) {
    return NextResponse.json(
      { error: "ids must be a non-empty array of strings" },
      { status: 400 },
    );
  }

  await prisma.$transaction(async (tx) => {
    const eventos = await tx.eventoDeCompra.findMany({
      where: { id: { in: ids } },
      select: { id: true, produtoId: true, quantidadeComprada: true },
    });

    for (const evento of eventos) {
      const produto = await tx.produto.findUnique({
        where: { id: evento.produtoId },
        select: { quantidadeEmEstoque: true },
      });
      if (produto) {
        await tx.produto.update({
          where: { id: evento.produtoId },
          data: {
            quantidadeEmEstoque: Math.max(
              0,
              produto.quantidadeEmEstoque - evento.quantidadeComprada,
            ),
          },
        });
      }
    }

    await tx.eventoDeCompra.deleteMany({ where: { id: { in: ids } } });
  });

  return new NextResponse(null, { status: 204 });
}

// PATCH /api/eventos — corrige a data de uma "compra" inteira de uma vez
// (usado em /historico, tanto no log quanto no painel de export CSV — ver
// CompraItem.tsx). Uma "compra" é um grupo de EventoDeCompra que compartilha
// grupoCompraId (ou dia+loja, pro fallback de eventos antigos — ver
// page.tsx), então todos os ids do grupo recebem a mesma data nova de uma
// vez. Só a data muda; preço, quantidade e efeito no estoque ficam intactos.
export async function PATCH(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const parsed = atualizarDataEventosSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.flatten() },
      { status: 400 },
    );
  }
  const { ids, data } = parsed.data;

  const resultado = await prisma.eventoDeCompra.updateMany({
    where: { id: { in: ids } },
    data: { data },
  });
  if (resultado.count === 0) {
    return NextResponse.json(
      { error: "no matching purchase found" },
      { status: 404 },
    );
  }
  return NextResponse.json({ count: resultado.count });
}
