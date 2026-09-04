-- CreateTable
CREATE TABLE "FamiliaUnidade" (
    "nome" TEXT NOT NULL,
    "unidadeDeMedida" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FamiliaUnidade_pkey" PRIMARY KEY ("nome")
);
