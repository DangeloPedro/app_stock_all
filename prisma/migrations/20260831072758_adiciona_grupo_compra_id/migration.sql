-- AlterTable
ALTER TABLE "EventoDeCompra" ADD COLUMN     "grupoCompraId" TEXT;

-- CreateIndex
CREATE INDEX "EventoDeCompra_grupoCompraId_idx" ON "EventoDeCompra"("grupoCompraId");
