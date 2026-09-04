// Janelas de tempo pré-definidas, compartilhadas entre o filtro de "total
// spent" (GastoTotal) e a seleção de compras pro export CSV
// (ExportHistorico) — mesmo rótulo, mesmo significado nos dois lugares.
export const JANELAS = [
  { label: "last month", dias: 30 },
  { label: "last 3 months", dias: 90 },
  { label: "last 6 months", dias: 180 },
  { label: "last year", dias: 365 },
] as const;
