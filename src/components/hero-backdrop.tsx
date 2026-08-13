"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import type { VideoSource } from "@/lib/video";

/**
 * Fond du bloc de tete : la bande-annonce du film mis en avant, jouee en
 * sourdine derriere le texte.
 *
 * Trois precautions :
 *
 * 1. L'image de fond s'affiche immediatement et reste visible sous la video.
 *    Le titre et les horaires ne clignotent donc pas en attendant la lecture,
 *    et le bloc reste habille si la video ne demarre jamais.
 * 2. La video n'est montee qu'apres l'affichage, pour ne pas retarder le
 *    contenu utile ni consommer la connexion du visiteur avant l'essentiel.
 * 3. Elle est desactivee si le visiteur demande a reduire les animations, et
 *    sur les petits ecrans, ou elle couterait des donnees mobiles sans rien
 *    apporter a la lecture des horaires.
 */
export function HeroBackdrop({
  backdropUrl,
  source,
  movieTitle,
}: {
  backdropUrl: string | null;
  source: VideoSource;
  movieTitle: string;
}) {
  const [showVideo, setShowVideo] = useState(false);

  useEffect(() => {
    if (source.kind !== "YOUTUBE" || !source.youtubeId) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const small = window.matchMedia("(max-width: 767px)").matches;
    if (reduced || small) return;

    // Laisse la page s'afficher et se stabiliser avant de charger le lecteur.
    const timer = setTimeout(() => setShowVideo(true), 1200);
    return () => clearTimeout(timer);
  }, [source]);

  return (
    <div className="absolute inset-0 overflow-hidden" aria-hidden>
      {backdropUrl && (
        <Image
          src={backdropUrl}
          alt=""
          fill
          priority
          sizes="100vw"
          className="object-cover opacity-30"
        />
      )}

      {showVideo && source.youtubeId && (
        <iframe
          // loop exige playlist avec le meme identifiant, sans quoi YouTube
          // enchaine sur des videos suggerees.
          src={
            `https://www.youtube-nocookie.com/embed/${encodeURIComponent(source.youtubeId)}` +
            `?autoplay=1&mute=1&loop=1&playlist=${encodeURIComponent(source.youtubeId)}` +
            `&controls=0&modestbranding=1&rel=0&showinfo=0&disablekb=1&playsinline=1&iv_load_policy=3`
          }
          title={`Bande-annonce de ${movieTitle}`}
          allow="autoplay; encrypted-media"
          tabIndex={-1}
          className="pointer-events-none absolute left-1/2 top-1/2 h-[56.25vw] min-h-full w-[177.78vh] min-w-full -translate-x-1/2 -translate-y-1/2 border-0 opacity-70 transition-opacity duration-1000"
        />
      )}

      {/* Voiles superposes : ils garantissent le contraste du texte quelle que
          soit l'image de la bande-annonce a l'instant t. */}
      <div className="absolute inset-0 bg-gradient-to-r from-ink-950 via-ink-950/85 to-ink-950/60" />
      <div className="absolute inset-0 bg-gradient-to-t from-ink-950 via-transparent to-ink-950/70" />
    </div>
  );
}
