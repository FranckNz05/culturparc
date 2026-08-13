import Link from "next/link";
import { Badge } from "./ui/badge";
import { cn, formatDayLong, formatTime } from "@/lib/utils";
import type { ShowtimeWithContext } from "@/lib/queries";

/**
 * Une seance, presentee comme un bouton d'horaire.
 * Le taux de remplissage est signale des qu'il devient un argument pour se
 * decider vite, sans jamais afficher un decompte anxiogene place par place.
 */
function ShowtimeChip({ showtime }: { showtime: ShowtimeWithContext }) {
  const free = showtime.seatsTotal - showtime.seatsTaken;
  const full = free <= 0;
  const almostFull = !full && free <= Math.max(5, showtime.seatsTotal * 0.1);

  if (full) {
    return (
      <span
        className="flex min-w-20 cursor-not-allowed flex-col items-center rounded-lg border border-ink-700 bg-ink-850 px-3 py-2 opacity-60"
        aria-label={`Seance de ${formatTime(showtime.startsAt)} complete`}
      >
        <span className="text-sm font-semibold text-ink-400 line-through">
          {formatTime(showtime.startsAt)}
        </span>
        <span className="text-[10px] uppercase tracking-wide text-danger">
          Complet
        </span>
      </span>
    );
  }

  return (
    <Link
      href={`/seances/${showtime.id}`}
      className={cn(
        "flex min-w-20 flex-col items-center rounded-lg border px-3 py-2 transition-colors",
        "border-ink-600 bg-ink-850 hover:border-brand-500 hover:bg-brand-500/10",
      )}
    >
      <span className="text-sm font-semibold text-ink-50">
        {formatTime(showtime.startsAt)}
      </span>
      <span className="text-[10px] uppercase tracking-wide text-ink-400">
        {showtime.format === "THREE_D" ? "3D" : "2D"} &middot; {showtime.language}
      </span>
      {almostFull && (
        <span className="mt-0.5 text-[10px] text-warning">
          {free} place{free > 1 ? "s" : ""}
        </span>
      )}
    </Link>
  );
}

/** Seances d'un film, regroupees par jour puis par cinema. */
export function ShowtimeList({
  showtimes,
  showCinema = true,
}: {
  showtimes: ShowtimeWithContext[];
  showCinema?: boolean;
}) {
  if (showtimes.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-ink-700 p-8 text-center text-sm text-ink-300">
        Aucune seance programmee pour l&apos;instant.
      </p>
    );
  }

  const byDay = new Map<string, ShowtimeWithContext[]>();
  for (const showtime of showtimes) {
    const key = showtime.startsAt.toISOString().slice(0, 10);
    const bucket = byDay.get(key);
    if (bucket) bucket.push(showtime);
    else byDay.set(key, [showtime]);
  }

  return (
    <div className="space-y-8">
      {[...byDay.entries()]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([day, daySessions]) => {
          const byCinema = new Map<string, ShowtimeWithContext[]>();
          for (const s of daySessions) {
            const bucket = byCinema.get(s.cinema.id);
            if (bucket) bucket.push(s);
            else byCinema.set(s.cinema.id, [s]);
          }

          return (
            <section key={day}>
              <h3 className="mb-3 font-display text-lg capitalize text-brand-400">
                {formatDayLong(new Date(`${day}T12:00:00`))}
              </h3>

              <div className="space-y-4">
                {[...byCinema.values()].map((group) => (
                  <div key={group[0].cinema.id}>
                    {showCinema && (
                      <div className="mb-2 flex items-center gap-2">
                        <span className="text-sm font-medium text-ink-100">
                          {group[0].cinema.name}
                        </span>
                        <Badge tone="outline">{group[0].cinema.city}</Badge>
                      </div>
                    )}

                    <div className="flex flex-wrap gap-2">
                      {group
                        .sort(
                          (a, b) => a.startsAt.getTime() - b.startsAt.getTime(),
                        )
                        .map((s) => (
                          <ShowtimeChip key={s.id} showtime={s} />
                        ))}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          );
        })}
    </div>
  );
}
