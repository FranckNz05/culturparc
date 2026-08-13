"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "./ui/button";
import type { VideoSource } from "@/lib/video";

/**
 * Lecteur de bande-annonce, ouvert en surimpression.
 *
 * La video n'est montee qu'a l'ouverture : une iframe YouTube posee dans la
 * page couterait un chargement tiers a chaque visite d'une fiche film, meme
 * quand personne ne clique.
 */
export function TrailerPlayer({
  source,
  movieTitle,
}: {
  source: VideoSource;
  movieTitle: string;
}) {
  const [open, setOpen] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;

    closeRef.current?.focus();

    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }

    document.addEventListener("keydown", onKey);
    // Empeche la page de defiler derriere la surimpression.
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
    };
  }, [open]);

  if (source.kind === "UNKNOWN") return null;

  return (
    <>
      <Button onClick={() => setOpen(true)} variant="secondary">
        <span aria-hidden>&#9654;</span> Bande-annonce
      </Button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-ink-950/90 p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) setOpen(false);
          }}
        >
          <div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-label={`Bande-annonce de ${movieTitle}`}
            className="w-full max-w-3xl"
          >
            <div className="mb-3 flex items-center justify-between gap-4">
              <p className="truncate font-display text-lg text-ink-50">
                {movieTitle}
              </p>
              <button
                ref={closeRef}
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-lg border border-ink-600 px-3 py-1.5 text-sm text-ink-200 hover:border-brand-500 hover:text-brand-400"
              >
                Fermer
              </button>
            </div>

            <div className="aspect-video overflow-hidden rounded-xl bg-black ring-1 ring-ink-700">
              {source.kind === "FILE" ? (
                <video
                  src={source.fileUrl}
                  controls
                  autoPlay
                  playsInline
                  className="h-full w-full"
                />
              ) : (
                <iframe
                  src={`${source.embedUrl}${source.embedUrl?.includes("?") ? "&" : "?"}autoplay=1`}
                  title={`Bande-annonce de ${movieTitle}`}
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                  className="h-full w-full border-0"
                />
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

/**
 * Extrait muet joue en boucle au survol de l'affiche.
 * Sur mobile, ou le survol n'existe pas, l'affiche reste simplement fixe.
 */
export function PosterPreview({
  videoUrl,
  className,
}: {
  videoUrl: string;
  className?: string;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [ready, setReady] = useState(false);

  return (
    <video
      ref={videoRef}
      src={videoUrl}
      muted
      loop
      playsInline
      preload="none"
      onCanPlay={() => setReady(true)}
      onMouseEnter={() => void videoRef.current?.play()}
      onMouseLeave={() => {
        videoRef.current?.pause();
        if (videoRef.current) videoRef.current.currentTime = 0;
      }}
      className={`${className ?? ""} ${ready ? "opacity-100" : "opacity-0"} transition-opacity duration-300`}
      aria-hidden
    />
  );
}
