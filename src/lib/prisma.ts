import { PrismaClient } from "@prisma/client";

// Singleton do Prisma Client — evita esgotar conexões em dev por causa do
// hot-reload do Next.js recriando o módulo a cada mudança.
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
