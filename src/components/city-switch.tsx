import { selectCity } from "@/app/actions/city";
import { cn } from "@/lib/utils";
import type { CityOption } from "@/lib/city";

/**
 * Bascule entre les villes ou Culture Parc est present.
 *
 * Rendu en formulaires plutot qu'en composant interactif : le choix doit
 * survivre sans JavaScript, et chaque bascule recharge des donnees serveur de
 * toute facon.
 */
export function CitySwitch({
  cities,
  activeSlug,
  className,
}: {
  cities: CityOption[];
  activeSlug: string | null;
  className?: string;
}) {
  // Une seule ville : le selecteur n'apporte rien.
  if (cities.length < 2) return null;

  return (
    <div
      className={cn(
        "inline-flex rounded-full border border-ink-700 bg-ink-900 p-0.5",
        className,
      )}
      role="group"
      aria-label="Choisir la ville"
    >
      {cities.map((city) => {
        const active = city.slug === activeSlug;

        return (
          <form key={city.slug} action={selectCity}>
            <input type="hidden" name="city" value={city.slug} />
            <button
              type="submit"
              aria-current={active ? "true" : undefined}
              className={cn(
                "whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-medium transition-colors sm:text-sm",
                active
                  ? "bg-brand-500 text-ink-950"
                  : "text-ink-300 hover:text-ink-50",
              )}
            >
              {city.name}
            </button>
          </form>
        );
      })}
    </div>
  );
}
