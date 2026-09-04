// Heurística de segmentação de linha de nota fiscal: cada linha de item de
// recibo termina, quase sempre, com o preço total daquela linha (ex.
// "MILK 2PT SEMI SKIMMED        1.15"). Não tentamos entender layout de
// colunas nem quantidade × preço unitário — é o suficiente pra dar um
// candidato por linha pro usuário confirmar/corrigir na tela de preview.
// Fica documentado aqui como o ponto óbvio de melhoria futura se o OCR de
// recibos reais provar que a heurística erra demais.
export type LinhaNota = {
  id: string;
  textoOriginal: string;
  precoLido: number | null;
};

// OCR de recibo real confunde dígito com letra parecida com frequência
// (O~0, l/I~1, S~5) — sem isso, "1.I5" (que devia ser "1.15") não batia
// com \d puro e a linha inteira perdia o preço, obrigando o usuário a
// digitar manualmente todo item que passava por essa confusão.
const CLASSE_DIGITO_OCR = "[0-9OolIS]";
// UK till receipts (Tesco, Lidl, Sainsbury's...) quase sempre imprimem uma
// letra de categoria de IVA colada depois do preço de cada linha (ex.
// "1.15 A" ou "1.15A") — sem tolerar isso, o preço nunca ficava no fim
// "puro" da linha e a regra inteira falhava silenciosamente pra quase todo
// item real. */"*" também aparece marcando promoção multi-compra.
const PRECO_NO_FIM = new RegExp(
  `(${CLASSE_DIGITO_OCR}{1,4}[.,]${CLASSE_DIGITO_OCR}{2})\\s*[A-Za-z*]{0,2}\\s*$`,
);

function normalizarDigitosOcr(texto: string): string {
  return texto
    .replace(/[Oo]/g, "0")
    .replace(/[IlL]/g, "1")
    .replace(/S/g, "5");
}

// Linhas que claramente não são item comprado — totalizadores, forma de
// pagamento, cabeçalho fiscal. Filtradas fora dos candidatos pra não virar
// "produto" na tela de matching.
const PALAVRAS_RUIDO =
  /\b(total|subtotal|change|cash|card|balance|tender|amount|vat|tax|payment|visa|mastercard|debit|credit|receipt|thank)\b/i;

export function extrairLinhasDaNota(textoOcr: string): LinhaNota[] {
  const linhas = textoOcr
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  const candidatas: LinhaNota[] = [];
  let contador = 0;
  for (const linha of linhas) {
    if (PALAVRAS_RUIDO.test(linha)) continue;

    const match = linha.match(PRECO_NO_FIM);
    const textoSemPreco = match
      ? linha.slice(0, match.index).trim()
      : linha;

    // Sem texto sobrando (linha só com número) não dá pra associar a nada —
    // descarta.
    if (textoSemPreco.replace(/[^a-zA-Z]/g, "").length < 2) continue;

    candidatas.push({
      id: `linha-${contador++}`,
      textoOriginal: textoSemPreco,
      precoLido: match
        ? Number(normalizarDigitosOcr(match[1]).replace(",", "."))
        : null,
    });
  }
  return candidatas;
}
