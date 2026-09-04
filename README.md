# App Stock

App pessoal (uso de uma pessoa/família só, sem multiusuário) para controlar
o estoque de comida/itens domésticos de casa, montar listas de compras e
acompanhar gastos por mercado ao longo do tempo. Feito pra rodar tanto no
computador quanto no celular (funciona bem como "Adicionar à tela de
início" no navegador).

Este repositório é uma cópia exportada de um projeto pessoal, pronta pra
qualquer pessoa clonar e subir a própria instância (seu próprio banco,
sua própria senha, seus próprios dados) — veja [Rodando localmente](#rodando-localmente)
e [Deploy na Vercel](#deploy-na-vercel) abaixo.

## Funcionalidades

A UI é organizada em abas principais:

### `to buy` — lista de compras
- **Editável** (`/to-buy`, padrão): cada item da lista tem um mercado
  atribuído (editável ali mesmo), os itens ficam agrupados por mercado,
  com preview de gasto por mercado e total geral. Marcar um item como
  "pego" abre um formulário de loja/preço/quantidade e registra a compra
  no histórico — nunca sobrescreve um preço fixo do produto.
- **Sugestão de lista** (`/to-buy/sugestao`): mesma lista, mas cada item
  é automaticamente atribuído ao mercado com o menor preço conhecido.
  Um botão aplica a sugestão inteira de uma vez na aba Editável.
- **Scan de nota fiscal** (`/to-buy/scan`): tira/sobe uma foto da nota
  fiscal e o app lê os itens automaticamente (OCR) e tenta casar cada
  linha com um produto da lista (matching semântico) — veja
  [Leitura de nota fiscal](#leitura-de-nota-fiscal-por-foto) abaixo.
  Preço, quantidade e associação ficam editáveis antes de confirmar.
- **Grabbed & eaten** (`/to-buy/ate-fora`): registra algo comprado e
  consumido na hora (ex. lanche no próprio mercado) — vai direto pro
  histórico de gastos, sem mexer no estoque de casa.

### `shelf` — o que tem em casa
Produtos em estoque, organizados por localização (geladeira, freezer,
armário etc. — cadastro editável). Mostra a quantidade em estoque
(editável) e um botão "acabou", que pergunta quantos você pretende
comprar e manda o item de volta pra lista de compras.

### `market/shelf` — catálogo completo
Todos os produtos conhecidos (os que estão no mercado/catálogo + os que
estão em casa), ordenados por família de produto, com o selo do estado
atual, último preço pago conhecido e preços de referência editáveis por
mercado — pra decidir onde comprar antes de sair de casa. É também onde
se cadastra um produto novo.

### `compare` — comparação lado a lado
Dado uma família de produto (ex. "Leite"), mostra todas as variantes
lado a lado com o preço em cada mercado — útil quando uma família tem
vários produtos e vários mercados, o que fica espalhado demais nas
outras telas pra comparar de olho.

### `histórico` — gastos
Gasto total, por mercado e por compra (data + mercado, com data editável
depois do registro). Exportável em CSV (seleção manual item a item, ou
por janela de tempo: último mês, 3 meses, 6 meses, último ano).

### `configurações`
- **Mercados**: cadastro editável (adicionar, renomear, desativar sem
  perder histórico).
- **Locais**: idem, para os locais de casa usados em `/shelf`.
- **Famílias**: famílias de produto não são uma tabela própria (é texto
  livre em cada produto) — "editar" aqui é um renomear em massa de todos
  os produtos que usam aquele nome (renomear pra um nome já existente
  funciona como merge). Também é onde a unidade de medida de uma família
  fica travada (todos os produtos da mesma família usam a mesma unidade,
  pra comparação de preço por unidade fazer sentido).
- **Moeda**: BRL/USD/EUR/GBP — muda só a exibição, não converte valores
  já registrados.

## Leitura de nota fiscal por foto

- **OCR** (foto → texto): [Tesseract.js](https://github.com/naptha/tesseract.js)
  rodando **inteiramente no navegador** (WASM) — a foto nunca sai do
  dispositivo, nunca é enviada a nenhum serviço externo. Só baixa o
  pacote de idioma (~4MB) de um CDN público na primeira vez, depois fica
  em cache no navegador.
- **Matching** (linha da nota → produto do catálogo): embeddings
  semânticos locais via [transformers.js](https://huggingface.co/docs/transformers.js)
  (modelo `Xenova/all-MiniLM-L6-v2`, ~90MB, baixado uma vez do Hugging
  Face Hub e cacheado pelo navegador) — também sem chamada a nenhuma API
  de IA paga. Preferido a comparação de string simples porque abreviações
  de recibo real (ex. "MILK 2PT SEMI SKMD") não batem caractere a
  caractere com o nome do produto no catálogo.
- Nada é salvo no banco até você confirmar a tela de preview.

## Modelo de dados (essência)

- **`Produto`** — o catálogo. Cada linha é uma variante concreta (ex.
  "Leite integral 1L", não um conceito genérico como "leite"). Tem um
  status tripartite (`catalogado` / `na_lista` / `em_casa`), família,
  unidade de medida, local (quando em casa), estoque, mercado preferido.
- **`EventoDeCompra`** — uma transação real (produto + mercado + preço
  pago + quantidade + data). É o único lugar onde o "preço realmente
  pago" existe — nunca editável fora daqui, pra manter o histórico
  confiável.
- **`PrecoReferencia`** — preço de *planejamento* por produto × mercado
  (sempre editável, em qualquer tela), separado do preço realmente pago —
  serve pra decidir onde comprar antes de sair de casa, não é fonte de
  verdade de gasto.
- **`Loja`** / **`Localizacao`** — cadastros editáveis (soft-delete, não
  perdem o histórico ligado a eles).

Mais detalhes em [docs/revisao-modelo-dados.md](docs/revisao-modelo-dados.md).

## Stack técnica

- **Next.js** 16 (App Router, TypeScript) — UI e API routes num projeto só.
- **Postgres** gerenciado via **Prisma** (v6) — recomendado
  [Neon](https://neon.tech) (free tier).
- **Tailwind CSS v4** para estilo.
- **Vercel** (free tier) para hospedagem.
- Proteção por senha única (`src/proxy.ts`, HTTP Basic Auth) — não há
  sistema de contas, é uso de uma pessoa/família só. Qualquer usuário
  digitado é aceito, só a senha é checada.
- OCR e matching de nota fiscal rodam 100% no navegador (sem custo de
  API, sem enviar fotos pra fora — ver seção acima).

## Rodando localmente

1. `npm install`
2. Crie um projeto grátis em [neon.tech](https://neon.tech) (ou qualquer
   Postgres gerenciado) e copie a *connection string*
   (`postgresql://usuario:senha@host/banco?sslmode=require`).
3. Copie `.env.example` para `.env` e preencha `DATABASE_URL` (a string
   acima) e `APP_PASSWORD` (uma senha à sua escolha, pra proteger o app).
4. `npx prisma migrate deploy` — aplica as migrations já commitadas e
   cria as tabelas no banco.
5. `npm run dev` — abre em `http://localhost:3000`.

O banco começa **vazio** (sem mercados, locais ou produtos pré-cadastrados)
— cadastre os seus em `/configuracoes` (Mercados, Locais) e adicione
produtos em `/market-shelf`. Existe um script `npm run db:seed`
(`prisma/seed.ts`), mas ele espera um CSV pessoal que não faz parte deste
repositório (`prisma/seed-data/`, propositalmente fora do git) — não rode
esse comando, ele vai falhar tentando ler um arquivo que não existe.

## Deploy na Vercel

1. Suba este repositório pra sua própria conta do GitHub (fork, ou clone
   + push pra um repo novo seu).
2. Crie uma conta grátis em [vercel.com](https://vercel.com) (dá pra
   logar direto com GitHub).
3. "Add New… → Project" e importe o repositório. A Vercel detecta
   Next.js automaticamente — não precisa mexer no build command.
4. Antes (ou durante) o import, crie um banco Postgres: na própria
   Vercel, aba **Storage → Create Database → Postgres** (integração
   nativa com Neon) — isso já injeta a variável `DATABASE_URL` no
   projeto sozinho.
5. Em **Settings → Environment Variables**, adicione `APP_PASSWORD` com
   a senha que você quiser.
6. Faça o deploy.
7. **Importante:** o build da Vercel (`prisma generate && next build`)
   *não* roda as migrations sozinho. Depois do primeiro deploy, rode uma
   vez, do seu computador, com o `DATABASE_URL` do banco novo no `.env`
   local:
   ```
   npx prisma migrate deploy
   ```
   Sem isso o banco fica sem tabelas e o app não funciona.
8. Pronto — o app fica acessível por HTTPS de qualquer lugar. No
   celular, abra pelo navegador e use "Adicionar à tela de início" pra
   abrir como um app.

## Estrutura

- `prisma/schema.prisma` — schema (`Produto`, `EventoDeCompra`,
  `PrecoReferencia`, `Loja`, `Localizacao`, `Configuracao`,
  `FamiliaUnidade`).
- `prisma/migrations/` — histórico de migrations, aplicado via
  `prisma migrate deploy`.
- `src/app/to-buy` — lista de compras (editável, sugestão, scan de nota,
  grabbed & eaten).
- `src/app/shelf` — o que tem em casa, por local.
- `src/app/market-shelf` — catálogo completo (criar/editar produto).
- `src/app/compare` — comparação lado a lado por família de produto.
- `src/app/historico` — gastos e export CSV.
- `src/app/configuracoes` — Mercados / Locais / Famílias / Moeda.
- `src/app/api/*` — rotas usadas pelos componentes client para mutações.
- `src/lib/receiptOcr.ts`, `receiptParsing.ts`, `receiptMatching.ts` —
  pipeline de leitura de nota fiscal (100% client-side).
- `src/proxy.ts` — autenticação por senha única (Next.js `proxy.ts`, não
  `middleware.ts` — convenção do Next 16).
