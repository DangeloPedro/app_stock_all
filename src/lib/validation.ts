import { z } from "zod";

export const statusProdutoSchema = z.enum([
  "catalogado",
  "na_lista",
  "em_casa",
]);

export const criarProdutoSchema = z.object({
  nome: z.string().trim().min(1, "name is required"),
  productFamily: z.string().trim().min(1, "family is required"),
  status: statusProdutoSchema.default("catalogado"),
  localizacaoId: z.string().min(1).nullish(),
  unidadeDeMedida: z.string().trim().min(1).nullish(),
  conteudoEmbalagem: z.coerce.number().positive().nullish(),
  quantidadePadrao: z.coerce.number().positive().nullish(),
  quantidadeEmEstoque: z.coerce.number().min(0).optional(),
  lojaPreferidaId: z.string().min(1).nullish(),
});

// Update é parcial — cada campo enviado sobrescreve, ausente mantém o atual.
//
// BUG histórico corrigido aqui: `criarProdutoSchema.partial()` NÃO remove o
// `.default("catalogado")` do campo `status` — no Zod, `.partial()` só torna
// o campo opcional de *fornecer*, mas ausência ainda dispara o `.default()`
// durante o parse. Resultado: todo PATCH que não mandava `status`
// explicitamente (editar família, editar estoque, atribuir mercado
// preferido) sobrescrevia silenciosamente o status real de volta pra
// "catalogado". `status: statusProdutoSchema.optional()` abaixo sobrescreve
// esse campo no `.extend()`, sem `.default()`, corrigindo o problema.
export const atualizarProdutoSchema = criarProdutoSchema.partial().extend({
  status: statusProdutoSchema.optional(),
  ativo: z.boolean().optional(),
  pegoNoMercado: z.boolean().optional(),
});

export const criarEventoSchema = z.object({
  produtoId: z.string().min(1),
  lojaId: z.string().min(1, "choose a store"),
  precoPago: z.coerce.number().positive("price paid must be greater than zero"),
  quantidadeComprada: z.coerce
    .number()
    .positive("quantity purchased must be greater than zero"),
  data: z.coerce.date().optional(),
  // false só pro fluxo "ate out" (/to-buy/ate-fora): o item já foi comprado
  // E comido fora de casa, então não faz sentido incrementar estoque nem
  // mexer no status do produto — é só um registro histórico pro log/gasto.
  // Default true preserva o comportamento normal de "confirm purchase".
  afetaEstoque: z.boolean().optional().default(true),
  // Mesmo valor repetido em todos os itens de uma confirmação (gerado no
  // client com crypto.randomUUID()) — é o que separa duas compras na
  // mesma loja no mesmo dia em /historico. Opcional pra não quebrar
  // chamadas antigas/externas que não mandam esse campo.
  grupoCompraId: z.string().min(1).optional(),
});

// Corrige só a data de uma ou mais EventoDeCompra já registradas (usado em
// /historico pra editar a data de uma "compra" inteira — todos os ids do
// grupo recebem a mesma data nova, mantendo preço/quantidade intactos).
export const atualizarDataEventosSchema = z.object({
  ids: z.array(z.string().min(1)).min(1),
  data: z.coerce.date(),
});

export const criarLojaSchema = z.object({
  nome: z.string().trim().min(1, "name is required"),
});

export const atualizarLojaSchema = z.object({
  nome: z.string().trim().min(1).optional(),
  ativo: z.boolean().optional(),
});

export const atualizarPrecoReferenciaSchema = z.object({
  lojaId: z.string().min(1, "choose a store"),
  preco: z.coerce.number().positive("price must be greater than zero"),
});

export const criarLocalizacaoSchema = z.object({
  nome: z.string().trim().min(1, "name is required"),
});

export const atualizarLocalizacaoSchema = z.object({
  nome: z.string().trim().min(1).optional(),
  ativo: z.boolean().optional(),
});

export const atualizarConfiguracaoSchema = z.object({
  moeda: z.enum(["BRL", "USD", "EUR", "GBP"]),
});

// productFamily é texto livre em Produto, não uma entidade própria (decisão
// documentada em docs/revisao-modelo-dados.md — evita over-engineering pra
// uso pessoal). Renomear é um bulk update em todos os produtos que usam o
// nome antigo; renomear pra um nome que já existe funciona como merge.
export const renomearFamiliaSchema = z.object({
  de: z.string().trim().min(1),
  para: z.string().trim().min(1),
});

// Define (ou remove, com "") a unidade travada de uma família inteira — ver
// FamiliaUnidade no schema. "" propositalmente não passa no
// .min(1)/.trim().min(1) usado nos outros campos de unidade: aqui uma
// string vazia É um valor válido, o gatilho de "destravar".
export const definirUnidadeFamiliaSchema = z.object({
  nome: z.string().trim().min(1),
  unidadeDeMedida: z.string().trim(),
});

// Deletar família = desassociar: os produtos que usavam esse nome ficam com
// productFamily = "" (sem família), nunca são apagados. "" é o valor que
// representa "sem família" em toda a UI (market-shelf joga esses produtos na
// seção "other", igual já fazia com famílias de 1 produto só).
export const deletarFamiliaSchema = z.object({
  nome: z.string().trim().min(1),
});
