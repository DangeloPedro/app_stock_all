/*
  Warnings:

  - You are about to drop the column `lojaPreferida` on the `Produto` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Produto" DROP COLUMN "lojaPreferida",
ADD COLUMN     "lojaPreferidaId" TEXT;

-- CreateIndex
CREATE INDEX "Produto_lojaPreferidaId_idx" ON "Produto"("lojaPreferidaId");

-- AddForeignKey
ALTER TABLE "Produto" ADD CONSTRAINT "Produto_lojaPreferidaId_fkey" FOREIGN KEY ("lojaPreferidaId") REFERENCES "Loja"("id") ON DELETE SET NULL ON UPDATE CASCADE;
