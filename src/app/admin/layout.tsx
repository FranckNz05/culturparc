import { redirect } from "next/navigation";
import Link from "next/link";
import { requireRole } from "@/auth";
import { Logo } from "@/components/logo";

export const dynamic = "force-dynamic";

const NAV = [
  { href: "/admin", label: "Tableau de bord" },
  { href: "/admin/seances", label: "Seances" },
  { href: "/admin/films", label: "Films" },
  { href: "/admin/salles", label: "Salles et plans" },
  { href: "/admin/sites", label: "Sites et villes" },
  { href: "/admin/tarifs", label: "Tarifs" },
];

export default async function AdminLayout({
  children,
}: LayoutProps<"/admin">) {
  const session = await requireRole("MANAGER");

  if (!session) {
    redirect("/connexion?callbackUrl=/admin");
  }

  return (
    <div className="flex min-h-screen flex-col bg-ink-950">
      <header className="border-b border-ink-800 bg-ink-900">
        <div className="mx-auto flex max-w-7xl items-center gap-6 px-4 py-3">
          <Link href="/admin" className="shrink-0">
            <Logo />
          </Link>

          <span className="hidden rounded-full bg-brand-500/15 px-3 py-1 text-xs font-medium text-brand-300 sm:inline">
            Administration
          </span>

          <div className="ml-auto flex items-center gap-3 text-sm">
            <span className="hidden text-ink-300 sm:inline">
              {session.user.name}
            </span>
            <Link href="/" className="text-ink-300 hover:text-brand-400">
              Voir le site
            </Link>
          </div>
        </div>

        <nav className="border-t border-ink-800">
          <div className="mx-auto flex max-w-7xl gap-1 overflow-x-auto px-4 py-2 scrollbar-slim">
            {NAV.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="whitespace-nowrap rounded-lg px-3 py-1.5 text-sm text-ink-200 transition-colors hover:bg-ink-800 hover:text-ink-50"
              >
                {item.label}
              </Link>
            ))}
          </div>
        </nav>
      </header>

      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-8">{children}</main>
    </div>
  );
}
