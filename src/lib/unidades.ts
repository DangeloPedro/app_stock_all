/// Normalização de unidade pra comparar preço entre produtos da MESMA
/// família (ex. arroz 500 g vs 1 kg vs 2 kg). Sem isto, "preço por unidade"
/// de um produto cadastrado em g não é comparável com o de outro em kg — a
/// tabela de /compare elegeria o "mais barato" errado por um fator de 1000.
///
/// A ideia: cada produto vira (base de comparação, conteúdo nessa base).
/// Preço na base = preço da embalagem ÷ conteúdo na base. Só produtos que
/// caem na MESMA base entram no mesmo ranking; o resto é comparado à parte,
/// com o rótulo dizendo em cima de qual base cada bloco foi calculado.

type Fator = { chave: string; label: string; porBase: number };

// porBase = quantas unidades desta medida cabem em 1 unidade da base
// exibida (g → kg = 1000). A base foi escolhida pra dar números legíveis na
// tabela: massa em kg, volume em L, contagem por unidade — £2.35/kg lê bem,
// £0.00235/g não.
const FATORES: Record<string, Fator> = {
  // massa → kg
  g: { chave: "massa", label: "kg", porBase: 1000 },
  gr: { chave: "massa", label: "kg", porBase: 1000 },
  gram: { chave: "massa", label: "kg", porBase: 1000 },
  grams: { chave: "massa", label: "kg", porBase: 1000 },
  grama: { chave: "massa", label: "kg", porBase: 1000 },
  gramas: { chave: "massa", label: "kg", porBase: 1000 },
  kg: { chave: "massa", label: "kg", porBase: 1 },
  kgs: { chave: "massa", label: "kg", porBase: 1 },
  quilo: { chave: "massa", label: "kg", porBase: 1 },
  quilos: { chave: "massa", label: "kg", porBase: 1 },
  kilo: { chave: "massa", label: "kg", porBase: 1 },
  kilos: { chave: "massa", label: "kg", porBase: 1 },
  // volume → L
  ml: { chave: "volume", label: "L", porBase: 1000 },
  mls: { chave: "volume", label: "L", porBase: 1000 },
  mililitro: { chave: "volume", label: "L", porBase: 1000 },
  mililitros: { chave: "volume", label: "L", porBase: 1000 },
  millilitre: { chave: "volume", label: "L", porBase: 1000 },
  millilitres: { chave: "volume", label: "L", porBase: 1000 },
  cl: { chave: "volume", label: "L", porBase: 100 },
  l: { chave: "volume", label: "L", porBase: 1 },
  lt: { chave: "volume", label: "L", porBase: 1 },
  litro: { chave: "volume", label: "L", porBase: 1 },
  litros: { chave: "volume", label: "L", porBase: 1 },
  litre: { chave: "volume", label: "L", porBase: 1 },
  litres: { chave: "volume", label: "L", porBase: 1 },
  liter: { chave: "volume", label: "L", porBase: 1 },
  liters: { chave: "volume", label: "L", porBase: 1 },
  // contagem → unidade
  un: { chave: "contagem", label: "unit", porBase: 1 },
  und: { chave: "contagem", label: "unit", porBase: 1 },
  uni: { chave: "contagem", label: "unit", porBase: 1 },
  unidade: { chave: "contagem", label: "unit", porBase: 1 },
  unidades: { chave: "contagem", label: "unit", porBase: 1 },
  unit: { chave: "contagem", label: "unit", porBase: 1 },
  units: { chave: "contagem", label: "unit", porBase: 1 },
  pc: { chave: "contagem", label: "unit", porBase: 1 },
  pcs: { chave: "contagem", label: "unit", porBase: 1 },
  piece: { chave: "contagem", label: "unit", porBase: 1 },
  pieces: { chave: "contagem", label: "unit", porBase: 1 },
};

/// Base usada quando o produto não tem unidade + conteúdo cadastrados: cada
/// embalagem vale 1, então "preço na base" é o preço da embalagem inteira.
/// Fica num grupo próprio de propósito — comparar preço de pacote contra
/// preço por kg não diz nada, e o rótulo "per pack" avisa o usuário de que
/// aquele bloco só é honesto se as embalagens tiverem tamanho parecido.
export const CHAVE_PACOTE = "pack";

export type BaseComparacao = {
  /// Agrupa quem é comparável entre si.
  chave: string;
  /// Rótulo exibido no cabeçalho do grupo ("kg", "L", "unit", "pack").
  label: string;
  /// Conteúdo da embalagem expresso na base (450 g → 0.45 kg).
  conteudo: number;
};

export function baseDeComparacao(
  unidadeDeMedida: string | null,
  conteudoEmbalagem: number | null,
): BaseComparacao {
  const bruta = (unidadeDeMedida ?? "").trim().toLowerCase();
  // conteudoEmbalagem <= 0 cairia numa divisão que gera Infinity/negativo e
  // envenenaria o ranking inteiro — trata como "não cadastrado".
  if (!bruta || !conteudoEmbalagem || conteudoEmbalagem <= 0) {
    return { chave: CHAVE_PACOTE, label: "pack", conteudo: 1 };
  }
  // Unidade fora da tabela (usuário digitou algo próprio, ex. "roll"): vira
  // grupo dela mesma, comparada só com produtos que usam a mesma palavra.
  const fator: Fator = FATORES[bruta] ?? {
    chave: `outra:${bruta}`,
    label: bruta,
    porBase: 1,
  };
  return {
    chave: fator.chave,
    label: fator.label,
    conteudo: conteudoEmbalagem / fator.porBase,
  };
}
