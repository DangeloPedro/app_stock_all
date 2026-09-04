# Revisão do modelo de dados — Fase 1

Relatório produzido por um subagente com persona de especialista em teoria da
informação e biblioteconomia, solicitado antes do início da implementação da
Fase 1. Ver [README.md](../README.md) para o esquema final já incorporando as
recomendações abaixo.

## 1. Resumo Executivo

**Veredito: pronto com ajustes.**

A decisão estrutural mais importante do modelo — separar "catálogo de produto" (dados relativamente estáveis) de "evento de compra" (transação com preço, loja e data) — está correta e é exatamente o que falta hoje na base do Notion. Não é preciso redesenhar a espinha dorsal do modelo.

Mas há três pontos que, se implementados como descritos, vão reproduzir dentro do app os mesmos problemas que já existem na base do Notion (e que motivaram a saída dela):

1. **`small category` como texto livre único** vai continuar fragmentando famílias de produto silenciosamente — a própria base já mostra isso acontecendo (iogurte virou 3 categorias diferentes por 3 critérios diferentes, sem que ninguém tenha decidido isso conscientemente).
2. **Preço fica declarado em dois lugares conflitantes** — como atributo do catálogo (item 6 da proposta) e como evento de transação (item 7) — o que recria o padrão exato das colunas "sum" do Notion, que ficaram obsoletas por serem mantidas paralelamente aos dados-fonte.
3. **`quantity` não tem um dono claro** — a proposta guarda quantidade no produto, mas as funcionalidades pedidas (gasto total, comparação de preço por unidade) exigem quantidade no evento, não no catálogo.

Nenhum desses três pontos exige jogar o modelo fora; são ajustes de escopo limitado, detalhados abaixo, com uma proposta de esquema revisado na seção 3.

---

## 2. Achados

### 2.1 Estado tripartite como campo único — correto na forma, com um risco de acoplamento a monitorar

**O problema.** O campo único (`em casa` / `na lista` / `no mercado`) é mutuamente exclusivo por natureza — e os dados confirmam isso: nas 80 linhas amostradas, `where in stock?` sempre assume exatamente um entre `Market`/`Shelf`/`To Buy`, nunca uma combinação. Não há evidência, em ~80 linhas de uso real, de que o usuário já tenha precisado representar um estado composto. Isso valida a escolha de um enum único em vez de dois booleanos independentes.

**Por que importa concretamente.** O risco real não é a cardinalidade do campo, é *quem escreve nele*. Se esse status for um campo de texto/seleção editado livremente pelo usuário (como era `where in stock?` no Notion), ele vai divergir do histórico de compras assim que o usuário esquecer de atualizá-lo depois de marcar algo como comprado — exatamente o tipo de drift que o app quer eliminar. Há também um caso de uso real não coberto pelo enum: "tenho 1 ovo em casa mas já quero recolocar na lista" — hoje isso não é representável sem abandonar prematuramente a informação de que o item ainda está fisicamente em casa.

**Recomendação.**
- Manter o campo único, mas tratá-lo como **efeito colateral de ações da UI**, nunca como campo digitado livremente: marcar como comprado → transiciona automaticamente para `em casa`; adicionar à lista → transiciona para `na lista`. Isso remove a superfície de drift manual.
- Aceitar como limitação de Fase 1 o caso "pouco estoque + já quero comprar mais" (não modelar agora); se incomodar na prática, a extensão de baixo custo é um flag opcional `estoque_baixo` independente do status, não a quebra da exclusividade mútua.
- Não é preciso modelar o status tripartite como uma terceira entidade — ele pertence ao catálogo de produto porque é 1:1 com o produto e mutável no tempo, o que é diferente de cardinalidade de eventos de compra (N:1).

### 2.2 `small category` como texto livre — o ponto central (achado com maior risco)

**O problema, com evidência concreta da base.** Cinco produtos de iogurte na base recebem três valores de `small category` diferentes, por três critérios diferentes de agrupamento aplicados de forma inconsistente:

| Produto | small category | Critério usado |
|---|---|---|
| Actimel - pacote com 6 | Lactobacilos | (nem é "iogurte" nominalmente) |
| Iogurte Desnatado Nestle | Iogurte Desnatado | teor de gordura |
| Iogurte Grego Desnatado YoPro | Iogurte Desnatado | teor de gordura (agrupou certo com o de cima) |
| Iogurte Grego Light Morango Nestle | Iogurte morango | sabor (ignorou que também é "Light"/Grego) |
| Iogurte Integral Nestle | Iogurte Integral | teor de gordura |

Ou seja: o mesmo produto ("Iogurte Grego Light Morango") poderia legitimamente ter sido rotulado por teor (`Desnatado`/`Light`), por sabor (`Morango`) ou por estilo (`Grego`) — três eixos válidos, e o texto livre escolheu um arbitrariamente, sem nenhuma regra. Isso não é um erro de digitação isolado; é a demonstração de que **`small category`, como está, mistura "família do produto" (o que ele é) com "atributo distintivo da variante" (o que o diferencia dentro da família)** em um único campo string.

**Por que importa concretamente para a funcionalidade descrita no item 4.** A proposta diz que `small category` será usada para agrupar variantes na hora de montar a lista de compras ("qual marca/tamanho de iogurte comprar hoje"). Com o campo fragmentado como está, uma consulta por `small category = "Iogurte Desnatado"` traz 2 dos 5 iogurtes e esconde os outros 3 como se fossem produtos de outra prateleira — o agrupamento que a funcionalidade promete simplesmente não vai funcionar para essa família assim que ela crescer. E o inverso também falha: se o usuário digitar uma variação de grafia nova (`Iogurte`, `iogurte`, `Yogurt`), o app não tem como saber que deveria juntar com o que já existe.

Vale notar, por justiça aos dados: a maioria das outras famílias (`Leite` com 3 produtos, `Ovos` com 3, `Azeite` com 3, `Ketchup` com 3, `Farinha Panko` com 2, `Água de Côco` com 2) está **corretamente** agrupada hoje — o texto livre não é um problema universal na base atual, é um problema que aparece exatamente quando há mais de um eixo de variação possível (o caso do iogurte), e que só vai piorar conforme a base cresce sem um segundo campo para absorver esse segundo eixo.

Achado correlato de grafia (mesma causa raiz): `"Paçoquita 144g Helena Zero Açúcar"` vs `"Paçoquita zero Santa Helena - 432g"` — provavelmente a mesma marca ("Santa Helena"), grafada de duas formas diferentes em nome de produto, dentro de uma base com menos de 100 linhas mantida por uma única pessoa.

**Recomendação concreta: separar "família" de "atributo de variante" em dois campos.**
- `product_family` (obrigatório): o rótulo curto e reutilizável usado **exclusivamente** para agrupamento na lista de compras (o "Leite", "Iogurte", "Azeite", "Ovos"...). Preenchido via autocomplete sobre valores já existentes — não é obrigatório ser uma taxonomia pré-definida fechada (seria over-engineering para uso pessoal), mas a UI deve sugerir/forçar reuso do que já existe em vez de aceitar digitação livre sem sugestão.
- `variant_attributes` (opcional): o texto livre que hoje vive dentro de `small category` para o que diferencia a variante dentro da família (teor de gordura, sabor, tamanho, "zero açúcar"). Não participa do agrupamento; aparece só como rótulo secundário na hora de escolher qual variante comprar.
- Mitigação de baixo esforço para drift de grafia: normalizar por trim/acentos/caixa na comparação de `product_family` ao salvar, e manter uma revisão periódica (manual, não automatizada) das famílias com contagem = 1, para pegar fragmentações acidentais cedo.

### 2.3 Descartar categoria grande (`category`) — seguro, mas sob uma condição

**Os dados confirmam a decisão de baixo uso**: `category` está vazia em 70/80 linhas (87,5%) mesmo depois de meses de uso real no Notion — evidência direta de que o esforço de manutenção desse campo não compensou para este usuário, o que valida abandoná-lo como *input manual* na Fase 1.

**Mas a pergunta pedida era sobre reversibilidade, e a resposta é condicional.** Descartar o campo de categoria grande em si é seguro e reversível, **desde que** `product_family` (recomendação 2.2) seja mantido limpo. Departamento/categoria grande (Dairy, Beverages, Household Essentials...) é, na prática, uma função de `product_family` — dá para construir depois uma tabela pequena de mapeamento `family → departamento` (algumas dezenas de linhas, não 80+) e popular retroativamente todos os produtos de uma vez, sem precisar voltar a editar cada item manualmente. Isso só funciona se a família estiver normalizada; se `small category` continuar fragmentada como hoje, o mapeamento futuro herda a mesma fragmentação e o retrabalho vira o mesmo de recategorizar item a item.

Não é preciso nenhum campo extra agora — só registrar essa dependência como decisão de design consciente (a categoria grande é "diferida", não "perdida").

### 2.4 Catálogo vs. evento de compra — separação correta na ideia, com uma lacuna na proposta

**O que está certo.** A ideia central do item 7 — não sobrescrever um "preço do produto", e sim registrar cada compra como evento (loja + preço + data) — é a decisão de modelagem mais importante deste projeto, e está correta em espírito. É a diferença clássica entre dado-mestre (catálogo) e fato transacional (evento), e é exatamente o que falta na base atual, que só guarda "o preço mais recente conhecido" por loja, sem histórico.

**A inconsistência concreta na proposta.** O item 6 mantém preço por loja como atributo do *produto* ("preço por loja mantidos por produto"), enquanto o item 7 propõe preço como atributo do *evento*. Ter os dois ao mesmo tempo recria, dentro do app novo, o mesmo padrão que já falhou no Notion: as colunas `Zona Sul - sum`, `Ultra- sum`, `Super Market- sum` na base bruta são campos derivados (preço × quantidade, calculados por fórmula do Notion) que ficam zerados/obsoletos assim que os campos-fonte mudam sem que a fórmula seja reprocessada — evidência direta, nos próprios dados, de que campo "preço atual" mantido em paralelo a um evento tende a dessincronizar.

**Recomendação.** "Preço mais recente por loja" deve ser uma **view derivada** (o preço do último `EventoDeCompra` daquele produto naquela loja), não um campo separadamente editável no catálogo. Se o usuário quiser registrar uma expectativa de preço antes da primeira compra pelo app (para já alimentar a sugestão de loja mais barata), isso deve ser um campo explicitamente rotulado como estimativa/referência — nunca com o mesmo nome ou aparência de "preço atual", para não repetir a ambiguidade que já existia.

**Lacuna sobre `quantity`.** O item 6 propõe manter `quantity` no produto. Mas as funcionalidades do item 7 — gasto total por compra, gasto por produto, comparação entre mercados — exigem a quantidade *efetivamente comprada naquele evento*, não uma quantidade fixa por produto (o usuário pode comprar 1kg de frango numa semana e 2kg noutra). Se `quantity` ficar só no catálogo, o cálculo de gasto (preço × quantidade) fica sistematicamente errado assim que a quantidade comprada variar de uma compra para outra. Recomendo mover `quantidade_comprada` para o evento (obrigatório) e manter no catálogo, no máximo, uma `quantidade_padrão` opcional só como valor pré-preenchido ao montar a lista.

Relacionado: os nomes de produto já embutem tamanho de embalagem como texto ("Azeite Borges 500 ml" vs "Farinha de Rosca (Kg)"), sem um campo estruturado de unidade. Sem isso, a "visão de otimização" (sugerir o mercado mais barato) só é correta quando os produtos comparados têm o mesmo tamanho de embalagem — o que nem sempre é o caso (ex. os 3 azeites da base têm todos 500ml por acaso, mas isso não está garantido para os próximos itens). Recomendo um campo `unidade_de_medida` opcional (mas fortemente recomendado) para permitir preço por unidade normalizado, não preço bruto.

### 2.5 Redundâncias e inconsistências nas colunas brutas

| Coluna | Situação encontrada nos dados | O que fazer |
|---|---|---|
| `*-sum` (4 colunas) | Campos-fórmula derivados (preço × quantidade), majoritariamente zerados/obsoletos; onde não-zero, apenas replicam preço×quantidade que o app novo vai calcular ao vivo a partir do evento | Descartar, não migrar |
| `comprei` | Vazia em 100% das 160 linhas (ambos os CSVs) | Descartar; a intenção é substituída pelo próprio evento de compra, que é estritamente melhor (data+preço+loja em vez de um checkbox) |
| `vamo comprar` | Vazia em 100% das linhas | Descartar; intenção já coberta pelo status `na lista` |
| `shopping list / daily` | ✅ em 74/80 (92,5%) — variância quase nula | Descartar, como já decidido; se um dia for útil saber "recorrência de compra", isso é derivável da frequência de eventos no histórico, sem precisar de um campo mantido manualmente |
| `amazon` | Booleano Yes/No em ~9 linhas, sem nenhum preço associado — é uma 6ª "loja" modelada de forma inconsistente com as outras 5 | Não manter como campo booleano à parte; se for relevante, dobrar dentro da lista de lojas do evento de compra (Amazon como mais uma opção de `loja`), senão descartar |
| `category` | Vazia em 87,5% das linhas | Descartar como input manual (ver 2.3), diferível via `product_family → departamento` |

**Achado adicional não pedido explicitamente, mas relevante para "riscos de manutenção":** as últimas linhas da base (`Taxa de Entrega Ifood`, `Secar - evita mofo`, `Papel toalha`, `espiga de milho`, `shoyu`, `shimeji`) têm quase nenhum metadado preenchido — só nome e status. Isso é evidência ao vivo, dentro de uma base de apenas 80 linhas, de que o usuário já tende a fazer "captura rápida" com o mínimo de campos assim que a fricção de preencher tudo aumenta. Além disso, `Taxa de Entrega Ifood` é uma taxa de entrega, não um produto comparável entre lojas — misturado na mesma tabela que os alimentos, ela pode distorcer relatórios de gasto se entrar na mesma agregação. Recomendação prática: manter o conjunto de campos obrigatórios mínimo (nome + status, só isso), e excluir itens não comparáveis (taxas, itens sem preço em mais de uma loja) da lógica de "sugestão de loja mais barata" em vez de forçar todo "produto" a caber no modelo de comparação entre 5 lojas.

### 2.6 Riscos de manutenção de longo prazo (curadoria de uma pessoa só) e mitigação de baixo esforço

- **Drift de nomenclatura** (grafia, acentuação, maiúsculas) — já demonstrado no caso Paçoquita "Helena"/"Santa Helena". Mitigação: normalizar (trim/case/acento) na comparação ao salvar `product_family`, sem exigir uma taxonomia fechada.
- **Fragmentação de categoria por eixo múltiplo** (caso do iogurte) — mitigação: split `product_family` / `variant_attributes` (seção 2.2), é a correção estrutural, não paliativa.
- **Registros incompletos por captura rápida** (linhas finais da base) — mitigação: manter só nome+status como obrigatórios; oferecer, sem bloquear a captura, uma visão opcional de "produtos incompletos" (sem família ou sem localização) para revisão esporádica, não em tempo real.
- **Campo de preço indo obsoleto em paralelo ao histórico real** (lição das colunas "sum") — mitigação: nunca ter um campo de "preço atual" editável a mão; sempre derivar do último evento.
- **Nenhuma validação externa** — sem outra pessoa revisando a base, o único controle de qualidade viável é de baixo custo e periódico: revisão trimestral (ou quando o usuário sentir que a lista "está bagunçada") das famílias com um único produto e dos produtos sem família, em vez de qualquer automação pesada.

---

## 3. Proposta de Esquema Revisado

Nomes de campos/entidades, sem código. Marcado obrigatório vs. opcional.

### Entidade: `Produto` (catálogo — dados relativamente estáveis)

| Campo | Obrigatório? | Observação |
|---|---|---|
| `nome` | Obrigatório | Como hoje — texto livre, carrega marca/tamanho no próprio nome |
| `product_family` | Obrigatório | Substitui `small category` como chave de agrupamento; autocomplete sobre valores existentes |
| `variant_attributes` | Opcional | O que hoje está misturado em `small category` (teor, sabor, tamanho); não usado para agrupar, só para diferenciar variantes dentro da família |
| `status` | Obrigatório | Enum tripartite (`em_casa` / `na_lista` / `catalogado`); alterado só via ações da UI, nunca digitado livremente |
| `localização_em_casa` | Opcional | Só relevante quando `status = em_casa`; aceitar vazio mesmo nesse estado (já ocorre nos dados atuais) |
| `unidade_de_medida` | Opcional (recomendado) | kg/L/un/pacote — necessário para comparação de preço por unidade ser correta entre embalagens de tamanhos diferentes |
| `quantidade_padrão` | Opcional / nice-to-have | Só um valor de pré-preenchimento ao montar a lista, não usado em cálculo de gasto |
| `loja_preferida` | Opcional / nice-to-have | Dica de UI, não fonte de verdade de preço |
| `departamento` | Fora de escopo na Fase 1 | Derivável depois via mapeamento `product_family → departamento`, sem precisar re-tocar cada produto |
| `ativo` | Opcional / nice-to-have | Soft-delete/arquivamento, para não perder integridade do histórico de compras ao "remover" um produto descontinuado |

### Entidade: `EventoDeCompra` (transação — um registro por item comprado em cada compra)

| Campo | Obrigatório? | Observação |
|---|---|---|
| `produto_id` | Obrigatório | FK para `Produto` |
| `data` | Obrigatório | |
| `loja` | Obrigatório | Lista controlada das 5 lojas (+ Amazon, se mantido) |
| `preço_pago` | Obrigatório | Preço real pago naquele evento, não um campo de referência |
| `quantidade_comprada` | Obrigatório | Necessário para gasto total e para preço por unidade; não confundir com `quantidade_padrão` do catálogo |

### Campos/valores explicitamente descartados (não migrar)

`category` (grande, como input manual — deferida, não perdida), `shopping list / daily`, todas as colunas `*-sum`, `comprei`, `vamo comprar`, `amazon` como coluna booleana isolada (fold em `loja`, se mantido).

### Dados derivados (calculados, não armazenados como campo próprio)

- Preço mais recente por produto/loja = último `EventoDeCompra` daquele par.
- Gasto total por compra = soma de `preço_pago` agrupado por `data` (+ `loja`, se quiser por trajeto).
- Sugestão de loja mais barata = menor `preço_pago / quantidade_comprada` (normalizado por `unidade_de_medida`) entre o subconjunto de lojas escolhido pelo usuário naquele dia; a sobreposição manual mencionada no item 7 não precisa de um campo de "override" — o próprio `EventoDeCompra` registrado (loja diferente da sugerida) já é, por definição, a fonte de verdade.
- Categoria grande / departamento (se um dia for reintroduzida) = lookup de `product_family` numa tabela pequena de mapeamento, não um campo por produto.
