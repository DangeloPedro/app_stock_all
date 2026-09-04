import { prisma } from "@/lib/prisma";
import { getMoedaAtual } from "@/lib/moeda";
import type { CompraExport } from "./ExportHistorico";
import { HistoricoClient } from "./HistoricoClient";

export const dynamic = "force-dynamic";

export default async function HistoricoPage() {
  const moeda = await getMoedaAtual();
  const eventos = await prisma.eventoDeCompra.findMany({
    include: { produto: true, loja: true },
    orderBy: { data: "desc" },
  });

  // Versão simplificada pro filtro por janela de tempo (HistoricoClient) —
  // filtra e agrega no client, sem ida ao servidor a cada troca de período.
  const eventosSimples = eventos.map((e) => ({
    data: e.data.toISOString(),
    loja: e.loja.nome,
    productFamily: e.produto.productFamily,
    precoPago: e.precoPago,
  }));

  // Agrupa eventos em "compras": grupoCompraId (mesma ação de "confirm
  // purchase") quando existe — é o caso de tudo criado depois desse campo
  // existir. Eventos mais antigos não têm grupoCompraId (era null antes),
  // então caem no fallback antigo de dia+loja — não dá pra saber de que
  // confirmação exata vieram, e dia+loja é a melhor aproximação disponível.
  const compras = new Map<string, CompraExport & { dataOrdenacao: number }>();
  for (const e of eventos) {
    const dia = new Date(
      e.data.getFullYear(),
      e.data.getMonth(),
      e.data.getDate(),
    );
    const chave = e.grupoCompraId ?? `${dia.toISOString()}__${e.lojaId}`;
    const item = {
      id: e.id,
      produtoNome: e.produto.nome,
      productFamily: e.produto.productFamily,
      quantidadeComprada: e.quantidadeComprada,
      precoPago: e.precoPago,
    };
    const atual = compras.get(chave);
    if (atual) {
      atual.total += e.precoPago;
      atual.itens.push(item);
    } else {
      compras.set(chave, {
        chave,
        dataISO: dia.toISOString(),
        dataOrdenacao: dia.getTime(),
        loja: e.loja.nome,
        total: e.precoPago,
        itens: [item],
      });
    }
  }
  const comprasOrdenadas = Array.from(compras.values()).sort(
    (a, b) => b.dataOrdenacao - a.dataOrdenacao,
  );

  return (
    <div className="space-y-6">
      <h1 className="text-lg font-semibold text-slate-900">groceries log</h1>

      {eventos.length === 0 ? (
        <p className="rounded-lg border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500">
          no purchase registered yet. confirm a purchase from to buy to
          start the log.
        </p>
      ) : (
        <HistoricoClient
          eventos={eventosSimples}
          compras={comprasOrdenadas.map(({ dataOrdenacao: _dataOrdenacao, ...c }) => c)}
          moeda={moeda}
        />
      )}
    </div>
  );
}
