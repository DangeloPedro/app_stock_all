import type { CompraExport } from "./ExportHistorico";

// Compras agrupadas em dia → loja, na ordem em que aparecem em `compras`
// (mais recente primeiro, já vem assim de page.tsx). Cada "loja" dentro de
// um dia pode ter mais de uma compra desde que o agrupamento em page.tsx
// passou a ser por grupoCompraId (uma confirmação de compra) em vez de
// dia+loja — é isso que permite duas idas ao mesmo mercado no mesmo dia
// aparecerem separadas. Compartilhado entre a navegação normal
// (HistoricoClient) e o painel de export (ExportHistorico) pra manter a
// mesma hierarquia visual nos dois lugares.
export function agruparPorDiaELoja(compras: CompraExport[]) {
  const porDia = new Map<string, Map<string, CompraExport[]>>();
  for (const c of compras) {
    let porLoja = porDia.get(c.dataISO);
    if (!porLoja) {
      porLoja = new Map();
      porDia.set(c.dataISO, porLoja);
    }
    const lista = porLoja.get(c.loja);
    if (lista) lista.push(c);
    else porLoja.set(c.loja, [c]);
  }
  return Array.from(porDia.entries()).map(([dataISO, porLoja]) => ({
    dataISO,
    lojas: Array.from(porLoja.entries()).map(([loja, itens]) => ({ loja, itens })),
  }));
}
