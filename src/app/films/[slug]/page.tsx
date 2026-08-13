import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { Poster } from "@/components/poster";
import { AgeBadge, Badge } from "@/components/ui/badge";
import { ShowtimeList } from "@/components/showtime-list";
import { getMovieBySlug, getUpcomingShowtimes } from "@/lib/queries";
import { getActiveCity } from "@/lib/city";
import { formatDuration } from "@/lib/utils";
import { parseVideoUrl } from "@/lib/video";
import { TrailerPlayer } from "@/components/trailer-player";

// Le choix de ville vit dans un cookie : le rendu ne peut pas etre mis en cache.
export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: PageProps<"/films/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const movie = await getMovieBySlug(slug);

  if (!movie) return { title: "Film introuvable" };

  return {
    title: movie.title,
    description:
      movie.synopsis?.slice(0, 160) ??
      `Seances et reservation pour ${movie.title} chez Culture Parc.`,
    openGraph: {
      title: movie.title,
      images: movie.posterUrl ? [movie.posterUrl] : undefined,
    },
  };
}

export default async function MoviePage({ params }: PageProps<"/films/[slug]">) {
  const { slug } = await params;
  const movie = await getMovieBySlug(slug);

  if (!movie) notFound();

  // Le programme d'une ville n'est pas celui d'une autre : on ne montre que
  // les seances de la ville choisie.
  const { city } = await getActiveCity();
  const showtimes = await getUpcomingShowtimes({
    movieId: movie.id,
    cinemaIds: city?.cinemas.map((c) => c.id),
  });

  return (
    <>
      <SiteHeader />

      <main className="flex-1">
        <div className="border-b border-ink-800 bg-gradient-to-b from-ink-900 to-ink-950">
          <div className="mx-auto flex max-w-5xl flex-col gap-8 px-4 py-10 sm:flex-row">
            <Poster
              src={movie.posterUrl}
              title={movie.title}
              previewVideoUrl={movie.previewVideoUrl}
              priority
              sizes="(max-width: 640px) 50vw, 220px"
              className="aspect-2/3 w-40 shrink-0 self-start sm:w-52"
            />

            <div className="min-w-0 flex-1 space-y-4">
              <div className="flex flex-wrap items-center gap-2">
                <AgeBadge minAge={movie.minAge} />
                <span className="text-sm text-ink-300">
                  {formatDuration(movie.durationMin)}
                </span>
                {movie.genres.map((g) => (
                  <Badge key={g.id} tone="outline">
                    {g.name}
                  </Badge>
                ))}
              </div>

              <h1 className="font-display text-4xl leading-none text-ink-50 sm:text-5xl">
                {movie.title}
              </h1>

              {movie.director && (
                <p className="text-sm text-ink-300">
                  Realise par{" "}
                  <span className="text-ink-100">{movie.director}</span>
                </p>
              )}

              {movie.synopsis && (
                <p className="max-w-2xl text-sm leading-relaxed text-ink-200">
                  {movie.synopsis}
                </p>
              )}

              {movie.cast.length > 0 && (
                <p className="text-sm text-ink-300">
                  Avec{" "}
                  <span className="text-ink-100">{movie.cast.join(", ")}</span>
                </p>
              )}

              <TrailerPlayer
                source={parseVideoUrl(movie.trailerUrl)}
                movieTitle={movie.title}
              />
            </div>
          </div>
        </div>

        <section className="mx-auto max-w-5xl px-4 py-10">
          <h2 className="mb-6 font-display text-2xl text-ink-50">
            Seances et reservation{city ? ` a ${city.name}` : ""}
          </h2>
          <ShowtimeList showtimes={showtimes} />
        </section>
      </main>

      <SiteFooter />
    </>
  );
}
