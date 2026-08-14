import Link from "next/link";
import { Logo } from "./logo";
import { getActiveCity } from "@/lib/city";

export async function SiteFooter() {
  const { city, cities } = await getActiveCity();

  return (
    <footer className="mt-20 border-t border-ink-800 bg-ink-900">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-12 sm:grid-cols-2 lg:grid-cols-4">
        <div className="space-y-4">
          <Logo />
          <p className="text-sm leading-relaxed text-ink-300">
            Salle de cinema, espace de loisirs et de divertissement
            {city ? ` a ${city.name}` : ""}.
          </p>
        </div>

        <div>
          <h2 className="mb-3 text-sm font-semibold text-ink-50">Cinema</h2>
          <ul className="space-y-2 text-sm text-ink-300">
            <li>
              <Link href="/films" className="hover:text-brand-400">
                Films a l&apos;affiche
              </Link>
            </li>
            <li>
              <Link href="/programme" className="hover:text-brand-400">
                Programme et horaires
              </Link>
            </li>
            <li>
              <Link href="/abonnements" className="hover:text-brand-400">
                Abonnements
              </Link>
            </li>
            <li>
              <Link href="/billets/retrouver" className="hover:text-brand-400">
                Retrouver mes billets
              </Link>
            </li>
          </ul>
        </div>

        {/* Adresses et contacts de la ville choisie, pas de toutes les villes. */}
        <div>
          <h2 className="mb-3 text-sm font-semibold text-ink-50">
            {city ? `Nos salles a ${city.name}` : "Nos salles"}
          </h2>
          <ul className="space-y-3 text-sm text-ink-300">
            {city?.cinemas.map((cinema) => (
              <li key={cinema.id}>
                <span className="block text-ink-100">{cinema.name}</span>
                {cinema.address && (
                  <span className="block text-xs text-ink-400">
                    {cinema.address}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </div>

        <div>
          <h2 className="mb-3 text-sm font-semibold text-ink-50">Contact</h2>
          <ul className="space-y-2 text-sm text-ink-300">
            {city?.cinemas.map((cinema) =>
              cinema.phone ? (
                <li key={cinema.id}>
                  <a
                    href={`tel:${cinema.phone.replace(/\s+/g, "")}`}
                    className="hover:text-brand-400"
                  >
                    {cinema.phone}
                  </a>
                  <span className="block text-xs text-ink-400">
                    {cinema.name}
                  </span>
                </li>
              ) : null,
            )}
            {city?.cinemas.find((c) => c.email) && (
              <li className="pt-1">
                <a
                  href={`mailto:${city.cinemas.find((c) => c.email)!.email}`}
                  className="hover:text-brand-400"
                >
                  {city.cinemas.find((c) => c.email)!.email}
                </a>
              </li>
            )}
          </ul>

          <p className="mt-4 text-xs text-ink-400">
            Paiement par Airtel Money et MTN Mobile Money.
          </p>
        </div>
      </div>

      {cities.length > 1 && (
        <div className="border-t border-ink-800 px-4 py-4">
          <p className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink-400">
            <span>Culture Parc, c&apos;est aussi :</span>
            {cities
              .filter((c) => c.slug !== city?.slug)
              .map((c) => (
                <span key={c.slug} className="text-ink-300">
                  {c.name}
                </span>
              ))}
          </p>
        </div>
      )}

      <div className="border-t border-ink-800 px-4 py-5">
        <p className="mx-auto max-w-6xl text-xs text-ink-400">
          Culture Parc, Republique du Congo. Tous droits reserves.
        </p>
      </div>
    </footer>
  );
}
