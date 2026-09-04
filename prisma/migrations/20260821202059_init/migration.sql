-- CreateEnum
CREATE TYPE "StatusProduto" AS ENUM ('catalogado', 'na_lista', 'em_casa');

-- CreateTable
CREATE TABLE "Produto" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "productFamily" TEXT NOT NULL,
    "variantAttributes" TEXT,
    "status" "StatusProduto" NOT NULL DEFAULT 'catalogado',
    "localizacaoEmCasa" TEXT,
    "unidadeDeMedida" TEXT,
    "quantidadePadrao" DOUBLE PRECISION,
    "lojaPreferida" TEXT,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Produto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Loja" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Loja_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EventoDeCompra" (
    "id" TEXT NOT NULL,
    "produtoId" TEXT NOT NULL,
    "data" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lojaId" TEXT NOT NULL,
    "precoPago" DOUBLE PRECISION NOT NULL,
    "quantidadeComprada" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EventoDeCompra_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Produto_status_idx" ON "Produto"("status");

-- CreateIndex
CREATE INDEX "Produto_productFamily_idx" ON "Produto"("productFamily");

-- CreateIndex
CREATE UNIQUE INDEX "Loja_nome_key" ON "Loja"("nome");

-- CreateIndex
CREATE INDEX "EventoDeCompra_produtoId_idx" ON "EventoDeCompra"("produtoId");

-- CreateIndex
CREATE INDEX "EventoDeCompra_data_idx" ON "EventoDeCompra"("data");

-- CreateIndex
CREATE INDEX "EventoDeCompra_lojaId_idx" ON "EventoDeCompra"("lojaId");

-- AddForeignKey
ALTER TABLE "EventoDeCompra" ADD CONSTRAINT "EventoDeCompra_produtoId_fkey" FOREIGN KEY ("produtoId") REFERENCES "Produto"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventoDeCompra" ADD CONSTRAINT "EventoDeCompra_lojaId_fkey" FOREIGN KEY ("lojaId") REFERENCES "Loja"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
