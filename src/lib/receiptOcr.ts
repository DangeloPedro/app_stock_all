// OCR de foto de nota fiscal — roda inteiramente no navegador (Tesseract.js,
// WASM), a foto NUNCA sobe pro servidor. Import dinâmico porque o worker +
// core wasm de Tesseract.js são pesados (não devem entrar no bundle inicial
// do app, só carregam quando o usuário de fato abre /to-buy/scan e envia uma
// foto). Primeira execução baixa o modelo de idioma (~4MB) de um CDN público
// (jsDelivr, grátis, sem chave) e o navegador cacheia sozinho depois disso —
// não há chamada a nenhum serviço de IA pago em nenhum ponto.
export async function reconhecerTextoDaNota(
  arquivo: File,
  onProgresso?: (fracao: number) => void,
): Promise<string> {
  const { createWorker, PSM } = await import("tesseract.js");
  const worker = await createWorker("eng", undefined, {
    logger: onProgresso
      ? (m) => {
          if (m.status === "recognizing text") onProgresso(m.progress);
        }
      : undefined,
  });
  try {
    // Modo de segmentação de página: por padrão (AUTO) o Tesseract tenta
    // detectar múltiplos blocos/colunas, o que numa nota fiscal real
    // (nome do produto à esquerda, preço à direita, separados por um
    // espaço largo) confunde a ordem de leitura e "embaralha" linhas —
    // exatamente o sintoma visto no primeiro teste com foto real.
    // SINGLE_COLUMN trata a imagem como uma única coluna de texto de
    // tamanhos variados, o que é a recomendação padrão pra recibos.
    await worker.setParameters({ tessedit_pageseg_mode: PSM.SINGLE_COLUMN });
    const {
      data: { text },
    } = await worker.recognize(arquivo);
    return text;
  } finally {
    await worker.terminate();
  }
}
