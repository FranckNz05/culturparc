import Link from "next/link";
import { Logo } from "./logo";
import { ButtonLink } from "./ui/button";

const NAV = [
  { href: "/films", label: "Films" },
  { href: "/programme", label: "Programme" },
  { href: "/abonnements", label: "Abonnements" },
];

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-ink-800 bg-ink-950/85 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-6 px-4">
        <Link href="/" className="shrink-0" aria-label="Culture Parc, accueil">
          <Logo />
        </Link>

        <nav className="hidden flex-1 items-center gap-1 md:flex">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="rounded-lg px-3 py-2 text-sm text-ink-200 transition-colors hover:bg-ink-800 hover:text-ink-50"
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-2">
          <ButtonLink href="/mon-compte" variant="ghost" size="sm">
            Mon compte
          </ButtonLink>
          <ButtonLink href="/programme" size="sm" className="hidden sm:inline-flex">
            Reserver
          </ButtonLink>
        </div>
      </div>

      {/* Navigation repliee sur mobile : la barre principale reste lisible. */}
      <nav className="flex gap-1 overflow-x-auto border-t border-ink-800 px-4 py-2 md:hidden scrollbar-slim">
        {NAV.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="whitespace-nowrap rounded-lg px-3 py-1.5 text-sm text-ink-200"
          >
            {item.label}
          </Link>
        ))}
      </nav>
    </header>
  );
}
