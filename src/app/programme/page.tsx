import type { Metadata } from "next";
import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { Poster } from "@/components/poster";
import { AgeBadge } from "@/components/ui/badge";
import { ShowtimeList } from "@/components/showtime-list";
import { getCinemas, getUpcomingShowtimes } from "@/lib/queries";
import { cn, formatDuration } from "@/lib/utils";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Programme et horaires",
  description:
    "Toutes les seances des cinemas Culture Parc a Brazzaville et Pointe-Noire, jour par jour.",
};

export default async function ProgramPage({
  searchParams,
}: PageProps<"/programme">) {
  const { cinema: cinemaSlug } = await searchParams;
  const selectedSlug = typeof cinemaSlug === "string" ? cinemaSlug : undefined;

  const cinemas = await getCinemas();
  const selected = selectedSlug
    ? cinemas.find((c) => c.slug === selectedSlug)
    : undefined;

  // Une semaine de programmation : au-dela, la grille devient illisible.
  const to = new Date();
  to.setDate(to.getDate() + 7);

  const showtimes = await getUpcomingShowtimes({
    cinemaId: selected?.id,
    to,
  });

  // Regroupement par film : le visiteur cherche d'abord un film, puis une heure.
  const byMovie = new Map<string, typeof showtimes>();
  for (const showtime of showtimes) {
    const bucket = byMovie.get(showtime.movie.id);
    if (bucket) bucket.push(showtime);
    else byMovie.set(showtime.movie.id, [showtime]);
  }

  return (
    <>
      <SiteHeader />

      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-10">
        <h1 className="font-display text-3xl text-ink-50 sm:text-4xl">
          Programme
        </h1>
        <p className="mt-2 text-sm text-ink-300">
          Les seances des sept prochains jours.
        </p>

        {/* Filtre par salle */}
        <div className="mt-6 flex flex-wrap gap-2">
          <Link
            href="/programme"
            className={cn(
              "rounded-lg border px-4 py-2 text-sm transition-colors",
              !selected
                ? "border-brand-500 bg-brand-500/10 text-brand-300"
                : "border-ink-600 text-ink-200 hover:border-ink-500",
            )}
          >
            Tous les cinemas
          </Link>

          {cinemas.map((cinema) => (
            <Link
              key={cinema.id}
              href={`/programme?cinema=${cinema.slug}`}
              className={cn(
                "rounded-lg border px-4 py-2 text-sm transition-colors",
                selected?.id === cinema.id
                  ? "border-brand-500 bg-brand-500/10 text-brand-300"
                  : "border-ink-600 text-ink-200 hover:border-ink-500",
              )}
            >
              {cinema.name}
            </Link>
          ))}
        </div>

        {byMovie.size === 0 ? (
          <p className="mt-10 rounded-xl border border-dashed border-ink-700 p-10 text-center text-sm text-ink-300">
            Aucune seance programmee{selected ? ` a ${selected.name}` : ""} pour
            le moment.
          </p>
        ) : (
          <div className="mt-10 space-y-12">
            {[...byMovie.values()].map((movieShowtimes) => {
              const movie = movieShowtimes[0].movie;

              return (
                <article key={movie.id} className="flex flex-col gap-5 sm:flex-row">
                  <Link
                    href={`/films/${movie.slug}`}
                    className="shrink-0 self-start"
                  >
                    <Poster
                      src={movie.posterUrl}
                      title={movie.title}
                      sizes="112px"
                      className="aspect-2/3 w-24 sm:w-28"
                    />
                  </Link>

                  <div className="min-w-0 flex-1">
                    <div className="mb-4 flex flex-wrap items-center gap-2">
                      <Link
                        href={`/films/${movie.slug}`}
                        className="font-display text-xl text-ink-50 hover:text-brand-400"
                      >
                        {movie.title}
                      </Link>
                      <AgeBadge minAge={movie.minAge} />
                      <span className="text-xs text-ink-400">
                        {formatDuration(movie.durationMin)}
                      </span>
                    </div>

                    <ShowtimeList
                      showtimes={movieShowtimes}
                      showCinema={!selected}
                    />
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </main>

      <SiteFooter />
    </>
  );
}
