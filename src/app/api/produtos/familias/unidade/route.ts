import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { definirUnidadeFamiliaSchema } from "@/lib/validation";
import { unidadeTravadaDaFamilia } from "@/lib/familias";

// GET /api/produtos/familias/unidade?nome=X — unidade travada da família,
// null se ainda livre (nenhum produto decidiu uma ainda). Consultado pelos
// formulários de produto (NovoProdutoForm, EditForm em ProdutoCard) pra
// desabilitar o campo "unit of measurement" quando a família já tem dona.
export async function GET(request: NextRequest) {
  const nome = request.nextUrl.searchParams.get("nome")?.trim();
  if (!nome) {
    return NextResponse.json({ error: "nome is required" }, { status: 400 });
  }
  const unidadeDeMedida = await unidadeTravadaDaFamilia(nome);
  return NextResponse.json({ unidadeDeMedida });
}

// PUT /api/produtos/familias/unidade — único lugar (fora do primeiro produto
// de uma família nova) que pode mudar a unidade travada. Usado em
// /configuracoes/familias. unidadeDeMedida "" destrava a família (produtos
// já cadastrados mantêm o que já tinham, só voltam a poder divergir);
// qualquer outro valor trava/retrava e propaga pra TODO produto já
// cadastrado na família, não só os futuros — é o que evita a família ficar
// com produtos antigos apontando pra unidade errada depois da mudança.
export async function PUT(request: NextRequest) {
  const body = await request.json();
  const parsed = definirUnidadeFamiliaSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const { nome, unidadeDeMedida } = parsed.data;

  if (!unidadeDeMedida) {
    await prisma.familiaUnidade.deleteMany({ where: { nome } });
    return NextResponse.json({ unidadeDeMedida: null });
  }

  await prisma.$transaction([
    prisma.familiaUnidade.upsert({
      where: { nome },
      update: { unidadeDeMedida },
      create: { nome, unidadeDeMedida },
    }),
    prisma.produto.updateMany({
      where: { productFamily: nome },
      data: { unidadeDeMedida },
    }),
  ]);

  return NextResponse.json({ unidadeDeMedida });
}
