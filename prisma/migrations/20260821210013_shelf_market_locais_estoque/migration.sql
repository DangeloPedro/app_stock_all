-- AlterTable
ALTER TABLE "Produto" DROP COLUMN "localizacaoEmCasa",
ADD COLUMN     "localizacaoId" TEXT,
ADD COLUMN     "quantidadeEmEstoque" DOUBLE PRECISION NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "Localizacao" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Localizacao_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Localizacao_nome_key" ON "Localizacao"("nome");

-- CreateIndex
CREATE INDEX "Produto_localizacaoId_idx" ON "Produto"("localizacaoId");

-- AddForeignKey
ALTER TABLE "Produto" ADD CONSTRAINT "Produto_localizacaoId_fkey" FOREIGN KEY ("localizacaoId") REFERENCES "Localizacao"("id") ON DELETE SET NULL ON UPDATE CASCADE;

