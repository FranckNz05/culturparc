import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { PrismaClient } from "@/generated/prisma/client";

// Prisma 7 passe obligatoirement par un driver adapter.
function createClient() {
  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error(
      "DATABASE_URL manquant. Copiez .env.example en .env et renseignez la connexion PostgreSQL.",
    );
  }

  // Le serveur local lance par "npx prisma dev" ne tient pas plusieurs
  // connexions simultanees et ferme la connexion sous charge. On le contourne
  // avec DATABASE_POOL_MAX=1 en local ; un PostgreSQL classique garde 10.
  const poolMax = Number(process.env.DATABASE_POOL_MAX ?? 10);

  const pool = new Pool({
    connectionString,
    max: Number.isFinite(poolMax) && poolMax > 0 ? poolMax : 10,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 10_000,
  });

  // Une connexion inactive peut etre fermee par le serveur ou par le reseau.
  // Sans cet ecouteur, l'erreur remonte comme exception non geree et fait
  // tomber le processus ; ici, pg se contente d'ouvrir une nouvelle connexion
  // a la prochaine requete.
  pool.on("error", (error) => {
    console.error("Connexion PostgreSQL inactive perdue :", error.message);
  });

  return new PrismaClient({
    adapter: new PrismaPg(pool),
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });
}

// En developpement, Next recharge les modules a chaque edition. Sans ce cache
// global on ouvrirait une nouvelle pool de connexions a chaque rechargement.
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma = globalForPrisma.prisma ?? createClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
