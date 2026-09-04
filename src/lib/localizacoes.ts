// Lista inicial de localizações em casa, usada só pelo seed pra popular a
// tabela `Localizacao` na primeira carga. Depois disso, editável pelo
// usuário na tela /configuracoes/locais (banco é a fonte de verdade, não
// este arquivo).
export const LOCALIZACOES_INICIAIS = [
  "Fridge",
  "Freezer",
  "Laundry",
  "Bottom Shelf",
  "Under The Sink",
  "Rack",
] as const;
