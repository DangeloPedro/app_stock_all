// Lista inicial de mercados, usada só pelo seed pra popular a tabela `Loja`
// na primeira carga. Depois disso, a lista de mercados é editável pelo
// usuário na tela /configuracoes (banco de dados é a fonte de verdade, não
// este arquivo) — adicionar um mercado novo ou desativar um que não
// frequenta mais não exige mexer em código.
export const LOJAS_INICIAIS = [
  "Market A",
  "Market B",
  "Market C",
] as const;
