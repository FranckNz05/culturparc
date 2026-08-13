import type { Metadata } from "next";
import { ButtonLink } from "@/components/ui/button";
import { Logo } from "@/components/logo";

export const metadata: Metadata = {
  title: "Hors ligne",
  robots: { index: false },
};

/**
 * Page servie par le service worker quand le reseau est indisponible.
 * Elle ne depend d'aucune donnee : c'est ce qui lui permet d'etre mise en cache
 * a l'installation et de s'afficher meme sans connexion.
 */
export default function OfflinePage() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-1 flex-col items-center justify-center gap-6 px-4 text-center">
      <Logo />

      <div className="space-y-2">
        <h1 className="font-display text-3xl text-ink-50">Pas de connexion</h1>
        <p className="text-sm text-ink-300">
          Votre appareil n&apos;est plus connecte a Internet. Les horaires et la
          disponibilite des places changent en permanence : ils ne peuvent pas
          etre consultes hors ligne.
        </p>
      </div>

      <div className="rounded-xl border border-ink-700 bg-ink-900 p-4 text-sm text-ink-200">
        <p className="font-medium text-ink-50">Vous avez deja un billet ?</p>
        <p className="mt-1 text-ink-300">
          Son code QR reste valable meme sans reseau. Presentez-le simplement a
          l&apos;entree.
        </p>
      </div>

      <ButtonLink href="/">Reessayer</ButtonLink>
    </main>
  );
}
