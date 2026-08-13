import Image from "next/image";
import { cn } from "@/lib/utils";
import { parseVideoUrl } from "@/lib/video";
import { PosterPreview } from "./trailer-player";

/**
 * Affiche d'un film.
 *
 * Trois niveaux, du plus riche au plus sobre : un extrait video muet qui se
 * lance au survol, sinon l'affiche, sinon un repli lisible. Le catalogue reste
 * ainsi presentable des le premier jour, avant tout televersement.
 */
export function Poster({
  src,
  title,
  className,
  sizes = "(max-width: 640px) 45vw, 200px",
  priority = false,
  previewVideoUrl = null,
}: {
  src: string | null;
  title: string;
  className?: string;
  sizes?: string;
  priority?: boolean;
  previewVideoUrl?: string | null;
}) {
  // On n'accepte qu'un fichier video lisible directement : une page YouTube ne
  // peut pas etre jouee en boucle silencieuse dans une vignette.
  const preview = parseVideoUrl(previewVideoUrl);
  const canPreview = preview.kind === "FILE" && Boolean(preview.fileUrl);

  return (
    <div
      className={cn(
        "group/poster relative overflow-hidden rounded-xl bg-ink-800 ring-1 ring-ink-700",
        className,
      )}
    >
      {src ? (
        <Image
          src={src}
          alt={`Affiche du film ${title}`}
          fill
          sizes={sizes}
          priority={priority}
          className="object-cover"
        />
      ) : (
        <div className="flex h-full w-full flex-col items-center justify-center gap-2 bg-gradient-to-br from-ink-700 via-ink-800 to-ink-900 p-3 text-center">
          <span className="font-display text-3xl text-brand-500/70">
            {title.slice(0, 2).toUpperCase()}
          </span>
          <span className="line-clamp-3 text-[11px] leading-tight text-ink-300">
            {title}
          </span>
        </div>
      )}

      {canPreview && (
        <PosterPreview
          videoUrl={preview.fileUrl!}
          className="absolute inset-0 h-full w-full object-cover opacity-0 group-hover/poster:opacity-100"
        />
      )}
    </div>
  );
}
