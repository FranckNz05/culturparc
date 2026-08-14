import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { auth, signOut, hasRole } from "@/auth";
import { prisma } from "@/lib/prisma";
import { Badge } from "@/components/ui/badge";
import { Button, ButtonLink } from "@/components/ui/button";
import { formatDayLong, formatFcfa, formatTime } from "@/lib/utils";
import { PasswordForm } from "./password-form";

export const dynamic = "force-dynamic";

export default async function AccountPage() {
  const session = await auth();

  if (!session?.user) {
    return (
      <>
        <SiteHeader />
        <main className="mx-auto w-full max-w-md flex-1 px-4 py-16 text-center">
          <h1 className="font-display text-3xl text-ink-50">Mon compte</h1>
          <p className="mt-3 text-sm text-ink-300">
            Connectez-vous pour retrouver vos billets, vos points de fidelite et
            vos abonnements.
          </p>
          <ButtonLink href="/connexion?callbackUrl=/mon-compte" className="mt-6">
            Se connecter
          </ButtonLink>
          <p className="mt-8 text-xs text-ink-400">
            Vous avez reserve sans compte ?{" "}
            <Link href="/billets/retrouver" className="text-brand-400 hover:underline">
              Retrouvez vos billets
            </Link>{" "}
            avec votre reference de commande et votre telephone.
          </p>
        </main>
        <SiteFooter />
      </>
    );
  }

  const [bookings, subscriptions] = await Promise.all([
    prisma.booking.findMany({
      where: { userId: session.user.id, status: "PAID" },
      include: {
        showtime: { include: { movie: true, cinema: true } },
        _count: { select: { tickets: true } },
      },
      orderBy: { paidAt: "desc" },
      take: 10,
    }),
    prisma.subscription.findMany({
      where: { userId: session.user.id, status: "ACTIVE" },
      include: { plan: true },
    }),
  ]);

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { loyaltyPoints: true },
  });

  return (
    <>
      <SiteHeader />

      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-10">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="font-display text-3xl text-ink-50">
              Bonjour {session.user.name}
            </h1>
            <p className="mt-1 text-sm text-ink-300">{session.user.email}</p>
          </div>

          <form
            action={async () => {
              "use server";
              await signOut({ redirectTo: "/" });
            }}
          >
            <Button type="submit" variant="ghost" size="sm">
              Se deconnecter
            </Button>
          </form>
        </div>

        {/* Acces reserves au personnel */}
        {hasRole(session.user.role, "STAFF") && (
          <div className="mt-6 flex flex-wrap gap-3 rounded-xl border border-brand-500/40 bg-brand-500/5 p-4">
            <ButtonLink href="/scan" size="sm">
              Controle d&apos;acces
            </ButtonLink>
            {hasRole(session.user.role, "MANAGER") && (
              <ButtonLink href="/admin" variant="secondary" size="sm">
                Administration
              </ButtonLink>
            )}
          </div>
        )}

        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          <div className="rounded-xl border border-ink-700 bg-ink-900 p-5">
            <p className="text-xs uppercase tracking-wider text-ink-400">
              Points de fidelite
            </p>
            <p className="mt-2 font-display text-3xl text-brand-400">
              {user?.loyaltyPoints ?? 0}
            </p>
            <p className="mt-1 text-xs text-ink-400">
              1 point pour 100 FCFA depenses
            </p>
          </div>

          <div className="rounded-xl border border-ink-700 bg-ink-900 p-5">
            <p className="text-xs uppercase tracking-wider text-ink-400">
              Abonnement
            </p>
            {subscriptions.length === 0 ? (
              <>
                <p className="mt-2 text-sm text-ink-300">Aucun abonnement actif</p>
                <Link
                  href="/abonnements"
                  className="mt-2 inline-block text-sm text-brand-400 hover:underline"
                >
                  Voir les formules
                </Link>
              </>
            ) : (
              subscriptions.map((sub) => (
                <div key={sub.id} className="mt-2">
                  <p className="font-medium text-ink-50">{sub.plan.name}</p>
                  <p className="text-xs text-ink-400">
                    {sub.plan.credits > 0
                      ? `${sub.creditsRemaining} seance${sub.creditsRemaining > 1 ? "s" : ""} restante${sub.creditsRemaining > 1 ? "s" : ""}`
                      : "Seances illimitees"}{" "}
                    jusqu&apos;au {sub.endsAt.toLocaleDateString("fr-FR")}
                  </p>
                </div>
              ))
            )}
          </div>
        </div>

        <section className="mt-10">
          <h2 className="mb-4 font-display text-xl text-ink-50">
            Mes reservations
          </h2>

          {bookings.length === 0 ? (
            <p className="rounded-xl border border-dashed border-ink-700 p-8 text-center text-sm text-ink-300">
              Aucune reservation pour le moment.
            </p>
          ) : (
            <div className="space-y-3">
              {bookings.map((booking) => (
                <Link
                  key={booking.id}
                  href={`/commande/${booking.reference}/billets`}
                  className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-ink-700 bg-ink-900 p-4 transition-colors hover:border-brand-500"
                >
                  <div className="min-w-0">
                    <p className="font-medium text-ink-50">
                      {booking.showtime.movie.title}
                    </p>
                    <p className="text-sm text-ink-300">
                      {formatDayLong(booking.showtime.startsAt)} a{" "}
                      {formatTime(booking.showtime.startsAt)} &middot;{" "}
                      {booking.showtime.cinema.name}
                    </p>
                  </div>

                  <div className="flex items-center gap-3">
                    <Badge tone="outline">
                      {booking._count.tickets} billet
                      {booking._count.tickets > 1 ? "s" : ""}
                    </Badge>
                    <span className="font-medium text-brand-400">
                      {formatFcfa(booking.total)}
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>

        <section className="mt-10 max-w-md">
          <h2 className="mb-4 font-display text-xl text-ink-50">
            Mot de passe
          </h2>
          <div className="rounded-xl border border-ink-700 bg-ink-900 p-5">
            <PasswordForm />
          </div>
        </section>
      </main>

      <SiteFooter />
    </>
  );
}
