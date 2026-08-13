import type { Metadata } from "next";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { MovieCard } from "@/components/movie-card";
import { getComingSoonMovies, getNowShowingMovies } from "@/lib/queries";
import { getActiveCity } from "@/lib/city";

// Le choix de ville vit dans un cookie : le rendu ne peut pas etre mis en cache.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Films a l'affiche",
  description:
    "Tous les films actuellement projetes dans les salles Culture Parc de Brazzaville et Pointe-Noire.",
};

export default async function MoviesPage() {
  const { city } = await getActiveCity();

  const [nowShowing, comingSoon] = await Promise.all([
    getNowShowingMovies(city?.cinemas.map((c) => c.id)),
    getComingSoonMovies(),
  ]);

  return (
    <>
      <SiteHeader />

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-10">
        <h1 className="font-display text-3xl text-ink-50 sm:text-4xl">
          Films a l&apos;affiche{city ? ` a ${city.name}` : ""}
        </h1>
        <p className="mt-2 text-sm text-ink-300">
          {nowShowing.length} film{nowShowing.length > 1 ? "s" : ""} avec des
          seances programmees.
        </p>

        {nowShowing.length === 0 ? (
          <p className="mt-10 rounded-xl border border-dashed border-ink-700 p-10 text-center text-sm text-ink-300">
            Aucune seance programmee pour le moment.
          </p>
        ) : (
          <div className="mt-8 grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 lg:grid-cols-5">
            {nowShowing.map((movie, i) => (
              <MovieCard key={movie.id} movie={movie} priority={i < 5} />
            ))}
          </div>
        )}

        {comingSoon.length > 0 && (
          <section className="mt-16">
            <h2 className="font-display text-2xl text-ink-50">Prochainement</h2>
            <div className="mt-6 grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 lg:grid-cols-5">
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
