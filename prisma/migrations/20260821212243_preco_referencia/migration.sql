-- CreateTable
CREATE TABLE "PrecoReferencia" (
    "id" TEXT NOT NULL,
    "produtoId" TEXT NOT NULL,
    "lojaId" TEXT NOT NULL,
    "preco" DOUBLE PRECISION NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PrecoReferencia_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PrecoReferencia_produtoId_lojaId_key" ON "PrecoReferencia"("produtoId", "lojaId");

-- AddForeignKey
ALTER TABLE "PrecoReferencia" ADD CONSTRAINT "PrecoReferencia_produtoId_fkey" FOREIGN KEY ("produtoId") REFERENCES "Produto"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PrecoReferencia" ADD CONSTRAINT "PrecoReferencia_lojaId_fkey" FOREIGN KEY ("lojaId") REFERENCES "Loja"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
