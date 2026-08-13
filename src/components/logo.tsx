import Image from "next/image";
import { cn } from "@/lib/utils";

/**
 * Marque Culture Parc.
 *
 * Le fichier officiel est utilise tel quel, sans recadrage ni retouche. Il est
 * carre et comporte ses propres marges : on l'affiche donc en `contain`, et on
 * lui donne une hauteur genereuse pour que le lettrage reste lisible malgre
 * l'espace vide inclus dans l'image.
 *
 * A savoir sur ce fichier : "CULTURE" est peint en blanc opaque, tandis que
 * "PARC" est decoupe dans la tache orange et laisse voir le fond. Le logo
 * suppose donc un fond sombre, ce qui correspond a la charte du site.
 */
export function Logo({
  className,
  compact = false,
}: {
  className?: string;
  /** N'affiche que la tache, pour les barres etroites. */
  compact?: boolean;
}) {
  if (compact) {
    return (
      <span className={cn("relative inline-block h-10 w-10 shrink-0", className)}>
        <Image
          src="/logo-mark.png"
          alt="Culture Parc"
          fill
          sizes="40px"
          priority
          className="object-contain"
        />
      </span>
    );
  }

  return (
    <span className={cn("relative inline-block h-14 w-40 shrink-0", className)}>
      <Image
        src="/logo-culture-parc.png"
        alt="Culture Parc"
        fill
        sizes="160px"
        priority
        className="object-contain"
      />
    </span>
  );
}
