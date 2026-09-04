// Forma simplificada de EventoDeCompra usada pelos componentes de
// visualização (GastoTotal, SpendTimeline) — evita passar o objeto Prisma
// completo (com relations) só pra somar/agrupar números.
export type EventoSimples = {
  data: string; // ISO
  loja: string;
  productFamily: string;
  precoPago: number;
};
