import { redirect } from "next/navigation";

// A ação mais frequente é a lista de compras no mercado — manda direto pra
// lá em vez de uma home vazia.
export default function HomePage() {
  redirect("/to-buy");
}
