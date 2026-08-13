import { redirect } from "next/navigation";
import Link from "next/link";
import { requireRole } from "@/auth";
import { prisma } from "@/lib/prisma";
import { Logo } from "@/components/logo";
import { formatTime } from "@/lib/utils";
import { Scanner } from "./scanner";

export const dynamic = "force-dynamic";

export default async function ScanPage({ searchParams }: PageProps<"/scan">) {
  const session = await requireRole("STAFF");

  if (!session) {
    redirect("/connexion?callbackUrl=/scan");
  }

  const { showtime: showtimeParam } = await searchParams;
  const showtimeId =
    typeof showtimeParam === "string" ? showtimeParam : undefined;

  // Seances du moment dans le cinema du controleur : le poste se cale sur
  // l'une d'elles pour refuser les billets d'une autre salle.
  const now = new Date();
  const windowStart = new Date(now.getTime() - 60 * 60_000);
  const windowEnd = new Date(now.getTime() + 3 * 60 * 60_000);

  const showtimes = await prisma.showtime.findMany({
    where: {
      startsAt: { gte: windowStart, lte: windowEnd },
      status: "SCHEDULED",
      ...(session.user.cinemaId ? { cinemaId: session.user.cinemaId } : {}),
    },
    include: { movie: true, auditorium: true },
    orderBy: { startsAt: "asc" },
    take: 12,
  });

  const selected = showtimes.find((s) => s.id === showtimeId);

  return (
    <div className="flex min-h-screen flex-col bg-ink-950">
      <header className="border-b border-ink-800 bg-ink-900">
        <div className="mx-auto flex max-w-lg items-center justify-between gap-4 px-4 py-3">
          <Logo compact />
          <div className="min-w-0 text-right">
            <p className="truncate text-sm font-medium text-ink-50">
              Controle d&apos;acces
            </p>
            <p className="truncate text-xs text-ink-400">
              {session.user.name}
            </p>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-lg flex-1 px-4 py-6">
        {/* Choix de la seance controlee */}
        <div className="mb-6">
          <p className="mb-2 text-xs uppercase tracking-widest text-ink-400">
            Seance controlee
          </p>

          {showtimes.length === 0 ? (
            <p className="rounded-lg border border-ink-700 bg-ink-900 p-3 text-sm text-ink-300">
              Aucune seance dans les prochaines heures. Le scan accepte tout
              billet valable.
            </p>
          ) : (
            <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-slim">
              <Link
                href="/scan"
                className={
                  !selected
                    ? "shrink-0 rounded-lg border border-brand-500 bg-brand-500/10 px-3 py-2 text-sm text-brand-300"
                    : "shrink-0 rounded-lg border border-ink-600 px-3 py-2 text-sm text-ink-200"
                }
              >
                Toutes
              </Link>

              {showtimes.map((s) => (
                <Link
                  key={s.id}
                  href={`/scan?showtime=${s.id}`}
                  className={
                    selected?.id === s.id
                      ? "shrink-0 rounded-lg border border-brand-500 bg-brand-500/10 px-3 py-2 text-sm text-brand-300"
                      : "shrink-0 rounded-lg border border-ink-600 px-3 py-2 text-sm text-ink-200"
                  }
                >
                  <span className="block font-medium">
                    {formatTime(s.startsAt)} {s.auditorium.name}
                  </span>
                  <span className="block max-w-40 truncate text-xs text-ink-400">
                    {s.movie.title}
                  </span>
                </Link>
              ))}
            </div>
          )}
        </div>

        <Scanner showtimeId={selected?.id} />
      </main>
    </div>
  );
}
