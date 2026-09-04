// Popula o catálogo de Produto a partir do export bruto do Notion
// (prisma/seed-data/produtos-notion-export.csv — não commitado, ver
// .gitignore). Só migra o catálogo: os campos de preço por loja do Notion
// (*-price, *-sum) NÃO viram EventoDeCompra aqui, porque um EventoDeCompra
// representa uma compra real (data + quantidade efetivamente comprada), e a
// base do Notion não tem essa informação — só "último preço visto", sem
// data nem quantidade. Ver docs/revisao-modelo-dados.md, seção 2.4.
//
// Rodar com: npm run db:seed (só numa base vazia — ver checagem abaixo).

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parse } from "csv-parse/sync";
import { prisma } from "../src/lib/prisma";
import { StatusProduto } from "@prisma/client";
import { LOJAS_INICIAIS } from "../src/lib/lojas";
import { LOCALIZACOES_INICIAIS } from "../src/lib/localizacoes";

const CSV_PATH = join(
  __dirname,
  "seed-data",
  "produtos-notion-export.csv",
);

type RawRow = {
  product: string;
  "where in shelf": string;
  "small category": string;
  "where in stock?": string;
  quantity: string;
};

// Correções pontuais identificadas em docs/revisao-modelo-dados.md (achado
// 2.2): "small category" fragmentava a família "Iogurte" em 4 rótulos
// diferentes por 4 critérios (teor de gordura, sabor, nome comercial),
// escondendo o agrupamento na lista de compras. Aqui já entram corrigidas.
// (O valor de variante que "small category" carregava pra esses casos foi
// descartado de propósito — ver decisão de remover variantAttributes do
// schema: já duplicava informação que o próprio `nome` do produto carrega.)
const FAMILY_OVERRIDES: Record<string, { productFamily: string }> = {
  "Actimel - pacote com 6": { productFamily: "Iogurte" },
  "Iogurte Desnatado Nestle": { productFamily: "Iogurte" },
  "Iogurte Grego Desnatado YoPro": { productFamily: "Iogurte" },
  "Iogurte Grego Light Morango Nestle - 4 potes": { productFamily: "Iogurte" },
  "Iogurte Integral Nestle": { productFamily: "Iogurte" },
};

// Valor bruto de "where in shelf" no Notion -> nome canônico em Localizacao.
// "Refrigerator" virou "Fridge" (mesmo conceito, nome que o usuário prefere).
const LOCALIZACAO_RAW_MAP: Record<string, string> = {
  Refrigerator: "Fridge",
  Freezer: "Freezer",
  Laundry: "Laundry",
  "Bottom Shelf": "Bottom Shelf",
  "Under the Sink": "Under The Sink",
  Rack: "Rack",
};

const STATUS_MAP: Record<string, StatusProduto> = {
  Market: StatusProduto.catalogado, // no mercado, conhecido — não em casa nem na lista
  Shelf: StatusProduto.em_casa, // em estoque
  "To Buy": StatusProduto.na_lista, // selecionado pra próxima compra
};

function parseQuantidade(raw: string): number | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const n = Number(trimmed);
  return Number.isFinite(n) ? n : null;
}

async function seedLojas() {
  // Idempotente (upsert por nome único) — pode rodar de novo mesmo depois
  // do usuário já ter editado a lista pela tela /lojas, sem duplicar nem
  // reverter uma desativação manual.
  for (const nome of LOJAS_INICIAIS) {
    await prisma.loja.upsert({
      where: { nome },
      update: {},
      create: { nome },
    });
  }
}

async function seedLocalizacoes(): Promise<Map<string, string>> {
  // Mesmo raciocínio de seedLojas: idempotente, seguro rodar de novo.
  // Retorna um mapa nome -> id, pra resolver localizacaoId dos produtos.
  const porNome = new Map<string, string>();
  for (const nome of LOCALIZACOES_INICIAIS) {
    const loc = await prisma.localizacao.upsert({
      where: { nome },
      update: {},
      create: { nome },
    });
    porNome.set(nome, loc.id);
  }
  return porNome;
}

async function main() {
  await seedLojas();
  const localizacaoIdPorNome = await seedLocalizacoes();

  const existing = await prisma.produto.count();
  if (existing > 0) {
    throw new Error(
      `Base já tem ${existing} produto(s) — seed é só para carga inicial numa base vazia. ` +
        `Abortando para não arriscar duplicar/misturar com dados reais.`,
    );
  }

  const csvContent = readFileSync(CSV_PATH, "utf-8");
  const rows = parse(csvContent, {
    columns: true,
    bom: true,
    skip_empty_lines: true,
  }) as RawRow[];

  let semFamiliaOriginal = 0;

  const data = rows.map((row) => {
    const nome = row.product.trim();
    const status = STATUS_MAP[row["where in stock?"].trim()];
    if (!status) {
      throw new Error(
        `Valor inesperado em "where in stock?" para "${nome}": ${JSON.stringify(row["where in stock?"])}`,
      );
    }

    const override = FAMILY_OVERRIDES[nome];
    const smallCategory = row["small category"].trim();
    if (!override && !smallCategory) semFamiliaOriginal += 1;

    // "||", não "??": smallCategory vazia é "" (falsy), não null/undefined —
    // com "??" o fallback pro nome nunca disparava e productFamily ficava "".
    const productFamily = override?.productFamily || smallCategory || nome;

    const localizacaoRaw = row["where in shelf"].trim();
    const localizacaoNome = localizacaoRaw
      ? LOCALIZACAO_RAW_MAP[localizacaoRaw]
      : undefined;
    if (localizacaoRaw && !localizacaoNome) {
      throw new Error(
        `Valor inesperado em "where in shelf" para "${nome}": ${JSON.stringify(localizacaoRaw)}`,
      );
    }
    const localizacaoId = localizacaoNome
      ? (localizacaoIdPorNome.get(localizacaoNome) ?? null)
      : null;

    const quantidadePadrao = parseQuantidade(row.quantity);
    // Estoque inicial: melhor estimativa disponível é a mesma "quantity" do
    // Notion quando o item já estava marcado como Shelf (não temos uma
    // contagem de estoque separada na base de origem) — 0 pros demais.
    const quantidadeEmEstoque =
      status === StatusProduto.em_casa ? (quantidadePadrao ?? 0) : 0;

    return {
      nome,
      productFamily,
      status,
      localizacaoId,
      quantidadePadrao,
      quantidadeEmEstoque,
    };
  });

  const result = await prisma.produto.createMany({ data });

  console.log(`Seed concluído: ${result.count} produtos criados.`);
  if (semFamiliaOriginal > 0) {
    console.log(
      `Aviso: ${semFamiliaOriginal} produto(s) vieram sem "small category" no Notion — ` +
        `caiu o nome do produto como productFamily provisório (família de 1). ` +
        `Vale revisar/agrupar manualmente (docs/revisao-modelo-dados.md, seção 2.6).`,
    );
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
