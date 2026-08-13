import Link from "next/link";
import { requireRole } from "@/auth";
import { prisma } from "@/lib/prisma";
import { Badge } from "@/components/ui/badge";

export const dynamic = "force-dynamic";

const SCREEN_LABELS: Record<string, string> = {
  STANDARD: "Standard",
  THREE_D: "3D",
  PREMIUM: "Premium",
  OUTDOOR: "Plein air",
};

export default async function AuditoriumsPage() {
  const session = await requireRole("MANAGER");

  const cinemas = await prisma.cinema.findMany({
    where:
      session?.user.role === "MANAGER" && session.user.cinemaId
        ? { id: session.user.cinemaId }
        : {},
    include: {
      auditoriums: {
        include: {
          _count: {
            select: {
              seats: { where: { kind: { in: ["SEAT", "WHEELCHAIR"] }, active: true } },
              showtimes: true,
            },
          },
        },
        orderBy: { name: "asc" },
      },
    },
    orderBy: { sortOrder: "asc" },
  });

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-3xl text-ink-50">Salles et plans</h1>
        <p className="mt-1 text-sm text-ink-300">
          Definissez les places de chaque salle, leur position et leur categorie.
        </p>
      </div>

      {cinemas.map((cinema) => (
        <section key={cinema.id}>
          <h2 className="mb-3 flex items-center gap-2 font-display text-xl text-ink-50">
            {cinema.name}
            <Badge tone="outline">{cinema.city}</Badge>
          </h2>

          {cinema.auditoriums.length === 0 ? (
            <p className="rounded-xl border border-dashed border-ink-700 p-6 text-sm text-ink-300">
              Aucune salle enregistree pour ce cinema.
            </p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {cinema.auditoriums.map((a) => (
                <Link
                  key={a.id}
                  href={`/admin/salles/${a.id}`}
                  className="group rounded-xl border border-ink-700 bg-ink-900 p-4 transition-colors hover:border-brand-500"
                >
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-semibold text-ink-50 group-hover:text-brand-400">
                      {a.name}
                    </h3>
                    <Badge tone="outline">
                      {SCREEN_LABELS[a.screenType] ?? a.screenType}
                    </Badge>
                  </div>

                  <p className="mt-3 font-display text-3xl text-brand-400">
                    {a._count.seats}
                  </p>
                  <p className="text-xs uppercase tracking-wider text-ink-400">
                    places vendables
                  </p>

                  <p className="mt-3 text-xs text-ink-400">
                    Grille {a.gridRows} x {a.gridCols} &middot; {a._count.showtimes}{" "}
                    seance{a._count.showtimes > 1 ? "s" : ""}
                  </p>
                </Link>
              ))}
            </div>
          )}
        </section>
      ))}
    </div>
  );
}
