import Link from "next/link";
import { requireRole } from "@/auth";
import { prisma } from "@/lib/prisma";
import { formatFcfa, formatTime } from "@/lib/utils";

export const dynamic = "force-dynamic";

function Kpi({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="rounded-xl border border-ink-700 bg-ink-900 p-5">
      <p className="text-xs uppercase tracking-wider text-ink-400">{label}</p>
      <p className="mt-2 font-display text-3xl text-brand-400">{value}</p>
      {hint && <p className="mt-1 text-xs text-ink-400">{hint}</p>}
    </div>
  );
}

export default async function AdminDashboard() {
  const session = await requireRole("MANAGER");
  const cinemaFilter =
    session?.user.role === "MANAGER" && session.user.cinemaId
      ? { cinemaId: session.user.cinemaId }
      : {};

  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(startOfDay);
  endOfDay.setDate(endOfDay.getDate() + 1);

  const [todayShowtimes, paidToday, ticketsToday, upcoming] = await Promise.all([
    prisma.showtime.count({
      where: { ...cinemaFilter, startsAt: { gte: startOfDay, lt: endOfDay } },
    }),
    prisma.booking.aggregate({
      where: {
        status: "PAID",
        paidAt: { gte: startOfDay, lt: endOfDay },
        ...(cinemaFilter.cinemaId
          ? { showtime: { cinemaId: cinemaFilter.cinemaId } }
          : {}),
      },
      _sum: { total: true },
      _count: { _all: true },
    }),
    prisma.ticket.count({
      where: {
        status: { in: ["VALID", "SCANNED"] },
        createdAt: { gte: startOfDay, lt: endOfDay },
        ...(cinemaFilter.cinemaId
          ? { showtime: { cinemaId: cinemaFilter.cinemaId } }
          : {}),
      },
    }),
    prisma.showtime.findMany({
      where: { ...cinemaFilter, startsAt: { gte: new Date() } },
      include: {
        movie: { select: { title: true } },
        auditorium: {
          select: {
            name: true,
            _count: {
              select: { seats: { where: { kind: { in: ["SEAT", "WHEELCHAIR"] } } } },
            },
          },
        },
        cinema: { select: { name: true } },
        _count: {
          select: { tickets: { where: { status: { in: ["VALID", "SCANNED"] } } } },
        },
      },
      orderBy: { startsAt: "asc" },
      take: 8,
    }),
  ]);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-3xl text-ink-50">Tableau de bord</h1>
        <p className="mt-1 text-sm text-ink-300">
          Activite du jour et prochaines seances.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi label="Recette du jour" value={formatFcfa(paidToday._sum.total ?? 0)} />
        <Kpi
          label="Commandes payees"
          value={String(paidToday._count._all)}
          hint="Depuis minuit"
        />
        <Kpi label="Billets emis" value={String(ticketsToday)} hint="Depuis minuit" />
        <Kpi label="Seances aujourd'hui" value={String(todayShowtimes)} />
      </div>

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-display text-xl text-ink-50">Prochaines seances</h2>
          <Link
            href="/admin/seances"
            className="text-sm text-brand-400 hover:text-brand-300"
          >
            Tout le planning
          </Link>
        </div>

        {upcoming.length === 0 ? (
          <p className="rounded-xl border border-dashed border-ink-700 p-6 text-sm text-ink-300">
            Aucune seance a venir. Programmez-en depuis l&apos;onglet Seances.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-ink-700">
            <table className="w-full min-w-2xl text-sm">
              <thead className="bg-ink-850 text-left text-xs uppercase tracking-wider text-ink-400">
                <tr>
                  <th className="px-4 py-3">Heure</th>
                  <th className="px-4 py-3">Film</th>
                  <th className="px-4 py-3">Salle</th>
                  <th className="px-4 py-3">Remplissage</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-800 bg-ink-900">
                {upcoming.map((s) => {
                  const total = s.auditorium._count.seats;
                  const sold = s._count.tickets;
                  const pct = total > 0 ? Math.round((sold / total) * 100) : 0;

                  return (
                    <tr key={s.id}>
                      <td className="whitespace-nowrap px-4 py-3 font-medium text-ink-50">
                        {formatTime(s.startsAt)}
                      </td>
                      <td className="px-4 py-3 text-ink-100">{s.movie.title}</td>
                      <td className="whitespace-nowrap px-4 py-3 text-ink-300">
                        {s.cinema.name} &middot; {s.auditorium.name}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="h-1.5 w-24 overflow-hidden rounded-full bg-ink-700">
                            <div
                              className="h-full rounded-full bg-brand-500"
                              style={{ width: `${Math.min(100, pct)}%` }}
                            />
                          </div>
                          <span className="whitespace-nowrap text-xs text-ink-300">
                            {sold} / {total}
                          </span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
