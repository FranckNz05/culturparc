import Image from "next/image";
import { cn } from "@/lib/utils";

/**
 * Affiche d'un film, avec repli lisible tant que l'exploitant n'en a pas
 * televerse une : le catalogue reste presentable des le premier jour.
 */
export function Poster({
  src,
  title,
  className,
  sizes = "(max-width: 640px) 45vw, 200px",
  priority = false,
}: {
  src: string | null;
  title: string;
  className?: string;
  sizes?: string;
  priority?: boolean;
}) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-xl bg-ink-800 ring-1 ring-ink-700",
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
    </div>
  );
}
