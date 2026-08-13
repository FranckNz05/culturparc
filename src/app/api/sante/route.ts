import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/**
 * Sonde de sante utilisee par Render.
 *
 * Elle interroge reellement la base : un service qui repond alors que sa base
 * est injoignable ne rendrait aucun service, et le redemarrage automatique ne
 * se declencherait jamais.
 */
export async function GET() {
  try {
    await prisma.$queryRaw`select 1`;
    return Response.json({ status: "ok" });
  } catch (error) {
    console.error("Sonde de sante en echec", error);
    return Response.json(
      { status: "degraded", detail: "Base de donnees injoignable." },
      { status: 503 },
    );
  }
}
