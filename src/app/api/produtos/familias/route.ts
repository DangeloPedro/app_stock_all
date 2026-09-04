import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { deletarFamiliaSchema, renomearFamiliaSchema } from "@/lib/validation";

// GET /api/produtos/familias — valores distintos de productFamily já
// existentes, pra alimentar autocomplete (FamilyInput) e evitar
// fragmentação (ver docs/revisao-modelo-dados.md, achado 2.2).
// ?comContagem=true traz também quantos produtos usam cada família (nome +
// quantidade), pra tela de gestão em /configuracoes/familias.
export async function GET(request: NextRequest) {
  const comContagem = request.nextUrl.searchParams.get("comContagem") === "true";

  if (comContagem) {
    const grupos = await prisma.produto.groupBy({
      by: ["productFamily"],
      _count: { _all: true },
      orderBy: { productFamily: "asc" },
    });
    return NextResponse.json(
      grupos.map((g) => ({ nome: g.productFamily, quantidade: g._count._all })),
    );
  }

  // "" ("sem família", produto que teve a família deletada) não entra no
  // autocomplete — não é um valor que faça sentido escolher de novo.
  const rows = await prisma.produto.findMany({
    where: { productFamily: { not: "" } },
    distinct: ["productFamily"],
    select: { productFamily: true },
    orderBy: { productFamily: "asc" },
  });
  return NextResponse.json(rows.map((r) => r.productFamily));
}

// PATCH /api/produtos/familias — renomeia uma família em todos os produtos
// que a usam de uma vez só (não é uma entidade própria, é texto livre em
// Produto — ver renomearFamiliaSchema). Renomear pra um nome que já existe
// funciona como merge das duas famílias, o que é desejável pra corrigir
// fragmentação acidental (ex.: "Iogurte" vs "iogurte").
export async function PATCH(request: NextRequest) {
  const body = await request.json();
  const parsed = renomearFamiliaSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const { de, para } = parsed.data;

  const resultado = await prisma.produto.updateMany({
    where: { productFamily: de },
    data: { productFamily: para },
  });

  if (resultado.count === 0) {
    return NextResponse.json(
      { error: "no product found with that family" },
      { status: 404 },
    );
  }

  // A trava de unidade (FamiliaUnidade, ver schema) é indexada pelo NOME da
  // família — sem isto, renomear deixaria a trava velha apontando pra um
  // nome que não existe mais, e a família renomeada voltaria a ficar livre.
  const [travaOrigem, travaDestino] = await Promise.all([
    prisma.familiaUnidade.findUnique({ where: { nome: de } }),
    prisma.familiaUnidade.findUnique({ where: { nome: para } }),
  ]);
  if (travaOrigem && !travaDestino) {
    // Só a origem tinha trava: ela "muda de nome" junto com os produtos.
    await prisma.familiaUnidade.update({
      where: { nome: de },
      data: { nome: para },
    });
  } else if (travaOrigem && travaDestino) {
    // Merge entre duas famílias já travadas: a trava do destino vence (é a
    // que já valia pros produtos que já estavam lá); descarta a da origem e
    // realinha os produtos recém-chegados pra unidade do destino, senão
    // ficariam com a unidade errada gravada.
    await prisma.$transaction([
      prisma.familiaUnidade.delete({ where: { nome: de } }),
      prisma.produto.updateMany({
        where: { productFamily: para },
        data: { unidadeDeMedida: travaDestino.unidadeDeMedida },
      }),
    ]);
  }

  return NextResponse.json({ atualizados: resultado.count });
}

// DELETE /api/produtos/familias — apaga a família (não é uma entidade
// própria, então "apagar" = desassociar): todo produto que usava esse nome
// fica com productFamily = "" (sem família), nunca é apagado ou perde outro
// dado. "" é o valor reservado pra "sem família" em toda a UI.
export async function DELETE(request: NextRequest) {
  const body = await request.json();
  const parsed = deletarFamiliaSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const { nome } = parsed.data;

  const resultado = await prisma.produto.updateMany({
    where: { productFamily: nome },
    data: { productFamily: "" },
  });

  if (resultado.count === 0) {
    return NextResponse.json(
      { error: "no product found with that family" },
      { status: 404 },
    );
  }

  // Família deixou de existir — a trava de unidade dela (se tinha) não tem
  // mais o que travar. Produtos ficam soltos (sem família), livres pra
  // divergir de unidade até entrarem numa família de novo.
  await prisma.familiaUnidade.deleteMany({ where: { nome } });

  return NextResponse.json({ desassociados: resultado.count });
}
