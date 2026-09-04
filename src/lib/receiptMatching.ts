import type { LinhaNota } from "./receiptParsing";

// Associação linha-da-nota ↔ Produto do catálogo via embeddings semânticos
// locais (transformers.js, modelo MiniLM ~90MB baixado uma vez do Hugging
// Face Hub e cacheado pelo navegador — sem chamada a API de IA, sem custo
// por uso). Preferido a fuzzy matching de string puro porque OCR de recibo
// costuma abreviar de um jeito que não bate caractere a caractere com o
// nome do produto no catálogo (ex. "MILK 2PT SEMI SKMD" vs "Semi-Skimmed
// Milk 2 Pints") — similaridade semântica lida melhor com isso do que
// distância de edição.
//
// Import dinâmico pelo mesmo motivo do OCR: modelo pesado, só deve carregar
// quando o usuário efetivamente abre a tela de scan.

export type ProdutoParaMatch = {
  id: string;
  nome: string;
  productFamily: string;
};

export type ResultadoMatch = {
  produtoId: string;
  linhaId: string;
  score: number;
  confiavel: boolean;
};

// Abaixo disso o match ainda é sugerido (o usuário pediu pra sempre
// preencher um palpite e corrigir o que estiver errado, em vez de deixar
// "— not on receipt —" e forçar escolha manual), mas entra marcado como
// baixa confiança na revisão pra chamar atenção pra conferir. Valor
// escolhido por inspeção manual de alguns casos com MiniLM (textos curtos,
// mesmo idioma, mesmo domínio de produto de mercado); ajustar aqui se, na
// prática, estiver deixando passar match errado ou descartando acerto.
const LIMIAR_CONFIANCA = 0.55;

let extratorPromise: Promise<
  (texto: string) => Promise<Float32Array>
> | null = null;

async function getExtrator() {
  if (!extratorPromise) {
    extratorPromise = (async () => {
      const { pipeline } = await import("@huggingface/transformers");
      const extrator = await pipeline(
        "feature-extraction",
        "Xenova/all-MiniLM-L6-v2",
      );
      return async (texto: string) => {
        const saida = await extrator(texto, { pooling: "mean", normalize: true });
        return saida.data as Float32Array;
      };
    })();
  }
  return extratorPromise;
}

function similaridadeCosseno(a: Float32Array, b: Float32Array): number {
  let produto = 0;
  for (let i = 0; i < a.length; i++) produto += a[i] * b[i];
  // Ambos os vetores já vêm normalizados (normalize: true acima), então o
  // produto escalar já É a similaridade de cosseno.
  return produto;
}

// Pré-carrega o modelo — chamar assim que o usuário entra na tela de scan,
// pra sobrepor o download com o tempo que ele leva pra tirar/escolher a
// foto, em vez de esperar até precisar do primeiro match.
export async function preAquecerModeloDeMatching() {
  await getExtrator();
}

// Um-pra-um: cada linha da nota é usada no máximo uma vez, cada produto
// recebe no máximo um match — o melhor score global vence em caso de
// disputa (guloso, mas suficiente pro tamanho de uma lista de compras
// pessoal).
export async function associarNotaAosProdutos(
  linhas: LinhaNota[],
  produtos: ProdutoParaMatch[],
): Promise<ResultadoMatch[]> {
  if (linhas.length === 0 || produtos.length === 0) return [];
  const embed = await getExtrator();

  const embeddingsLinhas = await Promise.all(
    linhas.map((l) => embed(l.textoOriginal)),
  );
  const embeddingsProdutos = await Promise.all(
    produtos.map((p) => embed(`${p.nome} ${p.productFamily}`)),
  );

  // Sem corte por limiar aqui: todo par produto/linha vira candidato, pra
  // sempre haver um palpite pra atribuir (o corte de confiança só decide o
  // rótulo "confiavel" abaixo, não se o match acontece).
  const candidatos: ResultadoMatch[] = [];
  for (let i = 0; i < produtos.length; i++) {
    for (let j = 0; j < linhas.length; j++) {
      const score = similaridadeCosseno(
        embeddingsProdutos[i],
        embeddingsLinhas[j],
      );
      candidatos.push({
        produtoId: produtos[i].id,
        linhaId: linhas[j].id,
        score,
        confiavel: score >= LIMIAR_CONFIANCA,
      });
    }
  }
  candidatos.sort((a, b) => b.score - a.score);

  const produtoUsado = new Set<string>();
  const linhaUsada = new Set<string>();
  const resultado: ResultadoMatch[] = [];
  for (const c of candidatos) {
    if (produtoUsado.has(c.produtoId) || linhaUsada.has(c.linhaId)) continue;
    produtoUsado.add(c.produtoId);
    linhaUsada.add(c.linhaId);
    resultado.push(c);
  }
  return resultado;
}
