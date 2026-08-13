import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { MovieCard } from "@/components/movie-card";
import { Poster } from "@/components/poster";
import { AgeBadge, Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import {
  getComingSoonMovies,
  getNowShowingMovies,
  getUpcomingShowtimes,
} from "@/lib/queries";
import { formatDayShort, formatDuration, formatTime } from "@/lib/utils";
import { getActiveCity } from "@/lib/city";
import { parseVideoUrl } from "@/lib/video";
import { HeroBackdrop } from "@/components/hero-backdrop";

// La programmation bouge tous les jours : on ne fige pas la page trop longtemps.
// Le choix de ville vit dans un cookie : le rendu ne peut pas etre mis en cache.
export const dynamic = "force-dynamic";

export default async function HomePage() {
  // Tout l'accueil parle de la ville choisie : films, seances et salles.
  const { city } = await getActiveCity();
  const cinemaIds = city?.cinemas.map((c) => c.id);

  const [movies, comingSoon] = await Promise.all([
    getNowShowingMovies(cinemaIds),
    getComingSoonMovies(),
  ]);
  const cinemas = city?.cinemas ?? [];

  const featured = movies.find((m) => m.featured) ?? movies[0];

  const todayShowtimes = featured
    ? await getUpcomingShowtimes({ movieId: featured.id, cinemaIds, limit: 6 })
    : [];

  return (
    <>
      <SiteHeader />

      <main className="flex-1">
        {/* ---------------------------------------------------------------
            Mise en avant : le film du moment et ses prochaines seances
            --------------------------------------------------------------- */}
        {featured && (
          <section className="relative overflow-hidden border-b border-ink-800">
            <HeroBackdrop
              backdropUrl={featured.backdropUrl}
              source={parseVideoUrl(featured.trailerUrl)}
              movieTitle={featured.title}
            />

            <div className="relative mx-auto flex max-w-6xl flex-col gap-8 px-4 py-12 sm:py-16 md:flex-row md:items-center">
              <Poster
                src={featured.posterUrl}
                title={featured.title}
                priority
                sizes="(max-width: 768px) 60vw, 260px"
                className="aspect-2/3 w-44 shrink-0 self-start shadow-2xl sm:w-56 md:w-64"
              />

              <div className="min-w-0 flex-1 space-y-5">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone="brand">A l&apos;affiche</Badge>
                  <AgeBadge minAge={featured.minAge} />
                  <span className="text-sm text-ink-300">
                    {formatDuration(featured.durationMin)}
                  </span>
                </div>

                <h1 className="font-display text-4xl leading-none text-ink-50 sm:text-6xl">
                  {featured.title}
                </h1>

                {featured.synopsis && (
                  <p className="max-w-2xl text-sm leading-relaxed text-ink-200 sm:text-base">
                    {featured.synopsis}
                  </p>
                )}

                {todayShowtimes.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-xs uppercase tracking-widest text-ink-400">
                      Prochaines seances
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {todayShowtimes.map((s) => (
                        <Link
                          key={s.id}
                          href={`/seances/${s.id}`}
                          className="rounded-lg border border-ink-600 bg-ink-800/70 px-3 py-2 text-sm transition-colors hover:border-brand-500 hover:text-brand-400"
                        >
                          <span className="block text-[10px] uppercase tracking-wide text-ink-400">
                            {formatDayShort(s.startsAt)}
                          </span>
                          <span className="font-semibold">{formatTime(s.startsAt)}</span>
                          <span className="ml-2 text-xs text-ink-300">
                            {s.cinema.city}
                          </span>
                        </Link>
                      ))}
                    </div>
                  </div>
                )}

                <div className="flex flex-wrap gap-3 pt-1">
                  <ButtonLink href={`/films/${featured.slug}`} size="lg">
                    Reserver une place
                  </ButtonLink>
                  <ButtonLink href="/programme" variant="secondary" size="lg">
                    Voir tout le programme
                  </ButtonLink>
                </div>
              </div>
            </div>
          </section>
        )}

        {/* ---------------------------------------------------------------
            Films a l'affiche
            --------------------------------------------------------------- */}
        <section className="mx-auto max-w-6xl px-4 py-12">
          <div className="mb-6 flex items-end justify-between gap-4">
            <h2 className="font-display text-2xl text-ink-50 sm:text-3xl">
              A l&apos;affiche
            </h2>
            <Link
              href="/films"
              className="text-sm text-brand-400 hover:text-brand-300"
            >
              Tous les films
            </Link>
          </div>

          {movies.length === 0 ? (
            <p className="rounded-xl border border-dashed border-ink-700 p-8 text-center text-sm text-ink-300">
              Aucune seance programmee pour le moment.
            </p>
          ) : (
            <div className="grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 lg:grid-cols-5">
              {movies.slice(0, 10).map((movie, i) => (
                <MovieCard key={movie.id} movie={movie} priority={i < 5} />
              ))}
            </div>
          )}
        </section>

        {/* ---------------------------------------------------------------
            Nos salles
            --------------------------------------------------------------- */}
        <section className="border-y border-ink-800 bg-ink-900/50">
          <div className="mx-auto max-w-6xl px-4 py-12">
            <h2 className="mb-6 font-display text-2xl text-ink-50 sm:text-3xl">
              {city ? `Nos salles a ${city.name}` : "Nos salles"}
            </h2>

            <div className="grid gap-4 sm:grid-cols-3">
              {cinemas.map((cinema) => (
                <Link
                  key={cinema.id}
                  href={`/programme?cinema=${cinema.slug}`}
                  className="group rounded-xl border border-ink-700 bg-ink-850 p-5 transition-colors hover:border-brand-500"
                >
                  <h3 className="font-semibold text-ink-50 group-hover:text-brand-400">
                    {cinema.name}
                  </h3>
                  {cinema.address && (
                    <p className="mt-1 text-sm text-ink-300">{cinema.address}</p>
                  )}
                  {cinema.phone && (
                    <p className="mt-3 text-sm text-ink-400">{cinema.phone}</p>
                  )}
                </Link>
              ))}
            </div>
          </div>
        </section>

        {/* ---------------------------------------------------------------
            Prochainement
            --------------------------------------------------------------- */}
        {comingSoon.length > 0 && (
          <section className="mx-auto max-w-6xl px-4 py-12">
            <h2 className="mb-6 font-display text-2xl text-ink-50 sm:text-3xl">
              Prochainement
            </h2>
            <div className="grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 lg:grid-cols-5">
              {comingSoon.map((movie) => (
                <MovieCard key={movie.id} movie={movie} />
              ))}
            </div>
          </section>
        )}
      </main>

      <SiteFooter />
    </>
  );
}
