import Link from "next/link";
import { formatMoeda, type Moeda } from "@/lib/moeda";
import type { PrecoPorLoja } from "@/lib/precos";
import { baseDeComparacao, CHAVE_PACOTE } from "@/lib/unidades";

type ProdutoComparado = {
  id: string;
  nome: string;
  unidadeDeMedida: string | null;
  conteudoEmbalagem: number | null;
};

type Celula = { lojaId: string; valor: number | null };

type Linha = {
  produto: ProdutoComparado;
  celulas: Celula[];
  /// Melhor (menor) preço na base entre as lojas — null se o produto não tem
  /// preço em loja nenhuma.
  melhor: number | null;
  ehMelhorDoGrupo: boolean;
  /// Quanto o melhor preço desta linha fica acima do melhor do grupo (0.12 =
  /// 12% mais caro). null pra linha vencedora ou sem preço.
  acimaDoMelhor: number | null;
};

type Grupo = {
  chave: string;
  label: string;
  linhas: Linha[];
  /// Preço em que TODOS os produtos com preço do grupo empataram — nesse caso
  /// ninguém é coroado (ver montarGrupos).
  empateEm: number | null;
};

// Matriz produto × loja com preço já normalizado pra mesma base (ver
// lib/unidades). Dois sinais visuais, com pesos deliberadamente diferentes:
//
//   • melhor loja DAQUELA linha — acende em toda linha, então é só peso de
//     fonte + texto mais escuro, sem cor;
//   • melhor produto do grupo — acende uma vez só, então pode gastar cor
//     (linha verde clara + chip "best value").
//
// A unidade aparece uma vez no cabeçalho do grupo, não em cada célula: é o
// que mantém a tabela curta o bastante pra caber num celular.
export function TabelaComparacao({
  produtos,
  lojas,
  precos,
  moeda,
}: {
  produtos: ProdutoComparado[];
  lojas: { id: string; nome: string }[];
  precos: Record<string, PrecoPorLoja[]>;
  moeda: Moeda;
}) {
  const grupos = montarGrupos(produtos, lojas, precos);
  const temVencedor = grupos.some((g) => g.linhas.some((l) => l.ehMelhorDoGrupo));

  return (
    <div className="space-y-2">
      <div className="overflow-x-auto rounded-lg border border-slate-200">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="bg-white">
              <th className="sticky left-0 z-10 border-b border-slate-200 bg-white px-3 py-2 text-left text-xs font-medium text-slate-500">
                product
              </th>
              {lojas.map((loja) => (
                <th
                  key={loja.id}
                  className="border-b border-slate-200 px-2 py-2 text-right text-xs font-medium text-slate-500"
                >
                  {loja.nome}
                </th>
              ))}
            </tr>
          </thead>
          {grupos.map((grupo) => (
            <tbody key={grupo.chave}>
              <tr className="bg-slate-50">
                <td
                  colSpan={lojas.length + 1}
                  className="border-b border-slate-200 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500"
                >
                  per {grupo.label}
                  {grupo.chave === CHAVE_PACOTE && (
                    <span className="font-normal normal-case tracking-normal text-slate-400">
                      {" "}
                      — pack size not set, so these compare only to each other
                    </span>
                  )}
                  {grupo.empateEm !== null && (
                    <span className="font-normal normal-case tracking-normal text-slate-400">
                      {" "}
                      — all tied at {formatMoeda(grupo.empateEm, moeda)}
                    </span>
                  )}
                </td>
              </tr>
              {grupo.linhas.map((linha) => (
                <tr
                  key={linha.produto.id}
                  className={linha.ehMelhorDoGrupo ? "bg-emerald-50" : "bg-white"}
                >
                  <td className="sticky left-0 z-10 border-b border-slate-100 bg-inherit px-3 py-2 align-top">
                    <Link
                      href={`/market-shelf?q=${encodeURIComponent(linha.produto.nome)}`}
                      className="block font-medium text-slate-900 hover:underline"
                    >
                      {linha.produto.nome}
                    </Link>
                    <span className="block text-[11px] text-slate-400">
                      {tamanhoEmbalagem(linha.produto)}
                    </span>
                    {linha.ehMelhorDoGrupo ? (
                      <span className="mt-1 inline-block rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-800">
                        best value
                      </span>
                    ) : (
                      linha.acimaDoMelhor !== null && (
                        <span className="block text-[11px] tabular-nums text-slate-400">
                          +{Math.round(linha.acimaDoMelhor * 100)}%
                        </span>
                      )
                    )}
                  </td>
                  {linha.celulas.map((celula) => {
                    const ehMelhorDaLinha =
                      celula.valor !== null && celula.valor === linha.melhor;
                    return (
                      <td
                        key={celula.lojaId}
                        className={`border-b border-slate-100 px-2 py-2 text-right align-top tabular-nums ${
                          celula.valor === null
                            ? "text-slate-300"
                            : ehMelhorDaLinha
                              ? linha.ehMelhorDoGrupo
                                ? "font-semibold text-emerald-700"
                                : "font-semibold text-slate-900"
                              : "text-slate-500"
                        }`}
                      >
                        {celula.valor === null
                          ? "—"
                          : formatMoeda(celula.valor, moeda)}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          ))}
        </table>
      </div>

      <p className="text-[11px] text-slate-400">
        <span className="font-semibold text-slate-600">bold</span> = cheapest
        store for that product
        {temVencedor && (
          <>
            {" · "}
            <span className="font-semibold text-emerald-700">green</span> = best
            value in the family
          </>
        )}
        {" · tap a product to open it in market/shelf"}
      </p>
    </div>
  );
}

function tamanhoEmbalagem(produto: ProdutoComparado) {
  if (!produto.conteudoEmbalagem || !produto.unidadeDeMedida) {
    return "no pack size";
  }
  return `${produto.conteudoEmbalagem} ${produto.unidadeDeMedida}`;
}

function montarGrupos(
  produtos: ProdutoComparado[],
  lojas: { id: string; nome: string }[],
  precos: Record<string, PrecoPorLoja[]>,
): Grupo[] {
  const porBase = new Map<string, { label: string; linhas: Linha[] }>();

  for (const produto of produtos) {
    const base = baseDeComparacao(
      produto.unidadeDeMedida,
      produto.conteudoEmbalagem,
    );
    const precoPorLoja = new Map(
      (precos[produto.id] ?? []).map((p) => [p.lojaId, p.preco]),
    );
    const celulas: Celula[] = lojas.map((loja) => {
      const preco = precoPorLoja.get(loja.id) ?? null;
      return {
        lojaId: loja.id,
        valor: preco === null ? null : preco / base.conteudo,
      };
    });
    const valores = celulas
      .map((c) => c.valor)
      .filter((v): v is number => v !== null);

    const grupo = porBase.get(base.chave) ?? { label: base.label, linhas: [] };
    grupo.linhas.push({
      produto,
      celulas,
      melhor: valores.length > 0 ? Math.min(...valores) : null,
      ehMelhorDoGrupo: false,
      acimaDoMelhor: null,
    });
    porBase.set(base.chave, grupo);
  }

  const grupos: Grupo[] = [];
  for (const [chave, { label, linhas }] of porBase) {
    // Sem preço vai pro fim; entre os que têm, do mais barato pro mais caro.
    linhas.sort((a, b) => {
      if (a.melhor === null || b.melhor === null) {
        if (a.melhor === b.melhor) return a.produto.nome.localeCompare(b.produto.nome);
        return a.melhor === null ? 1 : -1;
      }
      if (a.melhor !== b.melhor) return a.melhor - b.melhor;
      return a.produto.nome.localeCompare(b.produto.nome);
    });

    // Já ordenado por preço, então o melhor do grupo é o primeiro com preço.
    const comPreco = linhas.filter((l) => l.melhor !== null);
    const melhorDoGrupo = comPreco[0]?.melhor ?? null;
    // Dois casos em que coroar não informa nada e só suja a tela:
    // um produto só com preço (não há com quem comparar) e empate geral
    // (pintar a tabela inteira de verde é o mesmo que não destacar nada —
    // aí o empate vira texto no cabeçalho do grupo).
    const empateGeral =
      comPreco.length > 1 && comPreco.every((l) => l.melhor === melhorDoGrupo);
    const podeCoroar = comPreco.length > 1 && !empateGeral;

    for (const linha of linhas) {
      if (melhorDoGrupo === null || linha.melhor === null) continue;
      if (linha.melhor === melhorDoGrupo) {
        linha.ehMelhorDoGrupo = podeCoroar;
      } else {
        linha.acimaDoMelhor = linha.melhor / melhorDoGrupo - 1;
      }
    }

    grupos.push({
      chave,
      label,
      linhas,
      empateEm: empateGeral ? melhorDoGrupo : null,
    });
  }

  // Grupo maior primeiro (é a comparação principal); empate resolve pelo
  // rótulo, e "per pack" sempre por último por ser o mais fraco dos blocos.
  return grupos.sort((a, b) => {
    if (a.chave === CHAVE_PACOTE) return 1;
    if (b.chave === CHAVE_PACOTE) return -1;
    if (a.linhas.length !== b.linhas.length) return b.linhas.length - a.linhas.length;
    return a.label.localeCompare(b.label);
  });
}
