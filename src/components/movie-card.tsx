import Link from "next/link";
import { Poster } from "./poster";
import { AgeBadge } from "./ui/badge";
import { formatDuration } from "@/lib/utils";

export interface MovieCardData {
  slug: string;
  title: string;
  durationMin: number;
  minAge: number;
  posterUrl: string | null;
  genres: { name: string }[];
}

export function MovieCard({
  movie,
  priority = false,
}: {
  movie: MovieCardData;
  priority?: boolean;
}) {
  return (
    <Link
      href={`/films/${movie.slug}`}
      className="group flex w-full flex-col gap-3 rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
    >
      <div className="relative">
        <Poster
          src={movie.posterUrl}
          title={movie.title}
          priority={priority}
          className="aspect-2/3 w-full transition-transform duration-300 group-hover:scale-[1.02]"
        />
        <div className="absolute right-2 top-2">
          <AgeBadge minAge={movie.minAge} />
        </div>
      </div>

      <div className="space-y-1">
        <h3 className="line-clamp-2 text-sm font-semibold leading-snug text-ink-50 group-hover:text-brand-400">
          {movie.title}
        </h3>
        <p className="text-xs text-ink-300">
          {formatDuration(movie.durationMin)}
          {movie.genres.length > 0 && (
            <span> &middot; {movie.genres.map((g) => g.name).join(", ")}</span>
          )}
        </p>
      </div>
    </Link>
  );
}
