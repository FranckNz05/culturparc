import Link from "next/link";
import { requireRole } from "@/auth";
import { prisma } from "@/lib/prisma";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { toggleSite } from "./actions";
import { NewAuditoriumForm, NewSiteForm } from "./site-forms";

export const dynamic = "force-dynamic";

export default async function SitesAdminPage() {
  const session = await requireRole("MANAGER");
  const isAdmin = session?.user.role === "ADMIN";

  const cinemas = await prisma.cinema.findMany({
    where:
      !isAdmin && session?.user.cinemaId ? { id: session.user.cinemaId } : {},
    include: {
      auditoriums: {
        include: {
          _count: {
            select: {
              seats: { where: { kind: { in: ["SEAT", "WHEELCHAIR"] }, active: true } },
            },
          },
        },
        orderBy: { name: "asc" },
      },
      _count: { select: { showtimes: true, seatCategories: true } },
    },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
  });

  // Les villes se deduisent des sites : aucune liste figee a maintenir.
  const cities = [...new Set(cinemas.map((c) => c.city))];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-3xl text-ink-50">Sites et villes</h1>
        <p className="mt-1 text-sm text-ink-300">
          {cinemas.length} site{cinemas.length > 1 ? "s" : ""} dans{" "}
          {cities.length} ville{cities.length > 1 ? "s" : ""} :{" "}
          {cities.join(", ")}.
        </p>
      </div>

      {isAdmin && <NewSiteForm />}

      {cinemas.length > 0 && (
        <NewAuditoriumForm
          cinemas={cinemas.map((c) => ({ id: c.id, name: c.name, city: c.city }))}
        />
      )}

      <div className="space-y-4">
        {cinemas.map((cinema) => (
          <section
            key={cinema.id}
            className={
              cinema.active
                ? "rounded-xl border border-ink-700 bg-ink-900 p-5"
                : "rounded-xl border border-ink-800 bg-ink-900/50 p-5 opacity-60"
            }
          >
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="min-w-0">
                <h2 className="flex flex-wrap items-center gap-2 font-display text-xl text-ink-50">
                  {cinema.name}
                  <Badge tone="outline">{cinema.city}</Badge>
                  {!cinema.active && <Badge tone="danger">Ferme</Badge>}
                </h2>

                <dl className="mt-2 space-y-0.5 text-sm text-ink-300">
                  {cinema.address && <dd>{cinema.address}</dd>}
                  {cinema.phone && <dd>{cinema.phone}</dd>}
                  {cinema.email && <dd>{cinema.email}</dd>}
                </dl>

                <p className="mt-2 text-xs text-ink-400">
                  {cinema.auditoriums.length} salle
                  {cinema.auditoriums.length > 1 ? "s" : ""} &middot;{" "}
                  {cinema._count.seatCategories} categorie
                  {cinema._count.seatCategories > 1 ? "s" : ""} de sieges &middot;{" "}
                  {cinema._count.showtimes} seance
                  {cinema._count.showtimes > 1 ? "s" : ""}
                </p>
              </div>

              {isAdmin && (
                <form action={toggleSite}>
                  <input type="hidden" name="cinemaId" value={cinema.id} />
                  <Button type="submit" variant="ghost" size="sm">
                    {cinema.active ? "Fermer le site" : "Rouvrir"}
                  </Button>
                </form>
              )}
            </div>

            {cinema.auditoriums.length > 0 && (
              <div className="mt-4 flex flex-wrap gap-2">
                {cinema.auditoriums.map((a) => (
                  <Link
                    key={a.id}
                    href={`/admin/salles/${a.id}`}
                    className="rounded-lg border border-ink-600 px-3 py-2 text-sm transition-colors hover:border-brand-500 hover:text-brand-400"
                  >
                    <span className="font-medium text-ink-100">{a.name}</span>
                    <span className="ml-2 text-xs text-ink-400">
                      {a._count.seats} place{a._count.seats > 1 ? "s" : ""}
                    </span>
                  </Link>
                ))}
              </div>
            )}

            {cinema.auditoriums.length === 0 && (
              <p className="mt-4 rounded-lg border border-dashed border-ink-700 p-4 text-sm text-ink-400">
                Aucune salle. Ajoutez-en une avec le formulaire ci-dessus, puis
                dessinez son plan.
              </p>
            )}
          </section>
        ))}
      </div>
    </div>
  );
}
