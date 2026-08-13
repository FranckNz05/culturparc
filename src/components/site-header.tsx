import Link from "next/link";
import { Logo } from "./logo";
import { ButtonLink } from "./ui/button";
import { CitySwitch } from "./city-switch";
import { getActiveCity } from "@/lib/city";

const NAV = [
  { href: "/films", label: "Films" },
  { href: "/programme", label: "Programme" },
  { href: "/abonnements", label: "Abonnements" },
];

export async function SiteHeader() {
  const { city, cities } = await getActiveCity();

  return (
    <header className="sticky top-0 z-40 border-b border-ink-800 bg-ink-950/85 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-4 px-4">
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
          <CitySwitch
            cities={cities}
            activeSlug={city?.slug ?? null}
            className="hidden sm:inline-flex"
          />
          <ButtonLink href="/mon-compte" variant="ghost" size="sm">
            Mon compte
          </ButtonLink>
        </div>
      </div>

      {/* Sur mobile, la ville et la navigation passent sur une seconde ligne. */}
      <div className="flex items-center gap-2 border-t border-ink-800 px-4 py-2 md:hidden">
        <CitySwitch
          cities={cities}
          activeSlug={city?.slug ?? null}
          className="shrink-0 sm:hidden"
        />
        <nav className="flex gap-1 overflow-x-auto scrollbar-slim">
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
      </div>
    </header>
  );
}
