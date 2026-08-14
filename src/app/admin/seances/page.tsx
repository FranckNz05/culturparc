import { requireRole } from "@/auth";
import { prisma } from "@/lib/prisma";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatDayLong, formatFcfa, formatTime } from "@/lib/utils";
import { cancelShowtime } from "./actions";
import { ShowtimeForm } from "./showtime-form";
import { DeleteShowtimeButton } from "./delete-showtime-button";

export const dynamic = "force-dynamic";

export default async function ShowtimesAdminPage() {
  const session = await requireRole("MANAGER");
  const cinemaFilter =
    session?.user.role === "MANAGER" && session.user.cinemaId
      ? { cinemaId: session.user.cinemaId }
      : {};

  const [movies, auditoriums, showtimes] = await Promise.all([
    prisma.movie.findMany({
      where: { status: { in: ["NOW_SHOWING", "COMING_SOON"] } },
      select: { id: true, title: true, durationMin: true },
      orderBy: { title: "asc" },
    }),
    prisma.auditorium.findMany({
      where: { active: true, ...cinemaFilter },
      include: { cinema: { select: { name: true } } },
      orderBy: [{ cinemaId: "asc" }, { name: "asc" }],
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
      take: 100,
    }),
  ]);

  const today = new Date();
  const defaultDate = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

  // Regroupement par jour, comme sur le planning affiche en salle.
  const byDay = new Map<string, typeof showtimes>();
  for (const s of showtimes) {
    const key = s.startsAt.toISOString().slice(0, 10);
    const bucket = byDay.get(key);
    if (bucket) bucket.push(s);
    else byDay.set(key, [s]);
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-3xl text-ink-50">Seances</h1>
        <p className="mt-1 text-sm text-ink-300">
          {showtimes.length} seance{showtimes.length > 1 ? "s" : ""} a venir.
        </p>
      </div>

      <ShowtimeForm
        movies={movies}
        auditoriums={auditoriums.map((a) => ({
          id: a.id,
          label: `${a.cinema.name} - ${a.name}`,
        }))}
        defaultDate={defaultDate}
      />

      {byDay.size === 0 ? (
        <p className="rounded-xl border border-dashed border-ink-700 p-8 text-center text-sm text-ink-300">
          Aucune seance a venir.
        </p>
      ) : (
        <div className="space-y-3">
          {[...byDay.entries()].map(([day, daySessions], index) => {
            const sold = daySessions.reduce((sum, s) => sum + s._count.tickets, 0);
            const capacity = daySessions.reduce(
              (sum, s) => sum + s.auditorium._count.seats,
              0,
            );
            const fillRate = capacity > 0 ? Math.round((sold / capacity) * 100) : 0;
            const cancelled = daySessions.filter(
              (s) => s.status === "CANCELLED",
            ).length;

            return (
            // Seule la journee en cours s'ouvre d'emblee : au-dela, la page
            // deroulerait des centaines de lignes.
            <details
              key={day}
              open={index === 0}
              className="group overflow-hidden rounded-xl border border-ink-700 bg-ink-900"
            >
              <summary className="flex cursor-pointer flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3 hover:bg-ink-850">
                <span className="font-display text-lg capitalize text-brand-400">
                  {formatDayLong(new Date(`${day}T12:00:00`))}
                </span>

                <span className="text-sm text-ink-300">
                  {daySessions.length} seance{daySessions.length > 1 ? "s" : ""}
                </span>

                {cancelled > 0 && (
                  <Badge tone="danger">
                    {cancelled} annulee{cancelled > 1 ? "s" : ""}
                  </Badge>
                )}

                <span className="ml-auto flex items-center gap-2">
                  <span className="h-1.5 w-24 overflow-hidden rounded-full bg-ink-700">
                    <span
                      className="block h-full rounded-full bg-brand-500"
                      style={{ width: `${Math.min(100, fillRate)}%` }}
                    />
                  </span>
                  <span className="whitespace-nowrap text-xs text-ink-300">
                    {sold} / {capacity} places
                  </span>
                  <span className="text-ink-400 transition-transform group-open:rotate-90">
                    &rsaquo;
                  </span>
                </span>
              </summary>

              <div className="overflow-x-auto border-t border-ink-700">
                <table className="w-full min-w-3xl text-sm">
                  <thead className="bg-ink-850 text-left text-xs uppercase tracking-wider text-ink-400">
                    <tr>
                      <th className="px-4 py-3">Heure</th>
                      <th className="px-4 py-3">Film</th>
                      <th className="px-4 py-3">Salle</th>
                      <th className="px-4 py-3">Format</th>
                      <th className="px-4 py-3">Tarif</th>
                      <th className="px-4 py-3">Vendu</th>
                      <th className="px-4 py-3"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-ink-800 bg-ink-900">
                    {daySessions.map((s) => (
                      <tr key={s.id} className={s.status === "CANCELLED" ? "opacity-50" : ""}>
                        <td className="whitespace-nowrap px-4 py-3 font-medium text-ink-50">
                          {formatTime(s.startsAt)}
                        </td>
                        <td className="px-4 py-3 text-ink-100">
                          {s.movie.title}
                          {s.isPremiere && (
                            <Badge tone="brand" className="ml-2">
                              Avant-premiere
                            </Badge>
                          )}
                          {s.status === "CANCELLED" && (
                            <Badge tone="danger" className="ml-2">
                              Annulee
                            </Badge>
                          )}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-ink-300">
                          {s.cinema.name} &middot; {s.auditorium.name}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-ink-300">
                          {s.format === "THREE_D" ? "3D" : "2D"} &middot; {s.language}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-ink-300">
                          {formatFcfa(s.basePrice)}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-ink-300">
                          {s._count.tickets} / {s.auditorium._count.seats}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex justify-end gap-1">
                            {s.status !== "CANCELLED" && (
                              <form action={cancelShowtime}>
                                <input type="hidden" name="showtimeId" value={s.id} />
                                <Button type="submit" variant="ghost" size="sm">
                                  Annuler
                                </Button>
                              </form>
                            )}
                            {s._count.tickets === 0 && (
                              <DeleteShowtimeButton showtimeId={s.id} />
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </details>
            );
          })}
        </div>
      )}
    </div>
  );
}
