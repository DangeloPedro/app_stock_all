-- CreateEnum
CREATE TYPE "Moeda" AS ENUM ('BRL', 'USD', 'EUR', 'GBP');

-- CreateTable
CREATE TABLE "Configuracao" (
    "id" TEXT NOT NULL DEFAULT 'singleton',
    "moeda" "Moeda" NOT NULL DEFAULT 'BRL',

    CONSTRAINT "Configuracao_pkey" PRIMARY KEY ("id")
);
