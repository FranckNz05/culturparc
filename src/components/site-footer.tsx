import Link from "next/link";
import { Logo } from "./logo";

export function SiteFooter() {
  return (
    <footer className="mt-20 border-t border-ink-800 bg-ink-900">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-12 sm:grid-cols-2 lg:grid-cols-4">
        <div className="space-y-4">
          <Logo />
          <p className="text-sm leading-relaxed text-ink-300">
            Salle de cinema, espace de loisirs et de divertissement a Brazzaville
            et Pointe-Noire.
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
          </ul>
        </div>

        <div>
          <h2 className="mb-3 text-sm font-semibold text-ink-50">Nos sites</h2>
          <ul className="space-y-2 text-sm text-ink-300">
            <li>Culture Parc Mfoa, Brazzaville</li>
            <li>Culture Parc Pointe-Noire</li>
            <li>Culture Parc Ndjindji</li>
          </ul>
        </div>

        <div>
          <h2 className="mb-3 text-sm font-semibold text-ink-50">Contact</h2>
          <ul className="space-y-2 text-sm text-ink-300">
            <li>Brazzaville : 06 110 92 01</li>
            <li>Pointe-Noire : 06 110 92 92</li>
          </ul>
          <p className="mt-4 text-xs text-ink-400">
            Paiement par Airtel Money et MTN Mobile Money.
          </p>
        </div>
      </div>

      <div className="border-t border-ink-800 px-4 py-5">
        <p className="mx-auto max-w-6xl text-xs text-ink-400">
          Culture Parc, Republique du Congo. Tous droits reserves.
        </p>
      </div>
    </footer>
  );
}
