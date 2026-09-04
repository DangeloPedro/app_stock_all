// Itens de navegação compartilhados entre o header desktop (layout.tsx) e
// a bottom nav mobile (AppNav.tsx) — mesmo destino, rótulo mais curto no
// mobile por causa do espaço apertado em 5 colunas.
export const NAV_ITEMS = [
  { href: "/to-buy", label: "to buy", shortLabel: "buy" },
  { href: "/shelf", label: "shelf", shortLabel: "shelf" },
  { href: "/market-shelf", label: "market/shelf", shortLabel: "market" },
  { href: "/historico", label: "groceries log", shortLabel: "log" },
  { href: "/configuracoes", label: "settings", shortLabel: "settings" },
] as const;
