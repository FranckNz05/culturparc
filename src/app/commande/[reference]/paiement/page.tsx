import { notFound, redirect } from "next/navigation";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { prisma } from "@/lib/prisma";
import { formatFcfa } from "@/lib/utils";
import { PaymentWatcher } from "./payment-watcher";

export const dynamic = "force-dynamic";

export default async function PaymentPage({
  params,
  searchParams,
}: PageProps<"/commande/[reference]/paiement">) {
  const { reference } = await params;
  const { p } = await searchParams;

  const booking = await prisma.booking.findUnique({
    where: { reference },
    include: {
      payments: { orderBy: { createdAt: "desc" }, take: 1 },
      showtime: { include: { movie: true, cinema: true } },
    },
  });

  if (!booking) notFound();

  if (booking.status === "PAID") {
    redirect(`/commande/${reference}/billets`);
  }

  // L'identifiant passe en parametre prime, sinon on prend le dernier paiement.
  const paymentId =
    typeof p === "string" && p ? p : booking.payments[0]?.id;

  if (!paymentId) {
    redirect(`/commande/${reference}`);
  }

  return (
    <>
      <SiteHeader />

      <main className="mx-auto w-full max-w-xl flex-1 px-4 py-12">
        <div className="mb-6 text-center">
          <p className="text-sm text-ink-300">
            {booking.showtime.movie.title} &middot; {booking.showtime.cinema.name}
          </p>
          <p className="mt-1 font-display text-3xl text-brand-400">
            {formatFcfa(booking.total)}
          </p>
        </div>

        <PaymentWatcher paymentId={paymentId} reference={reference} />
      </main>

      <SiteFooter />
    </>
  );
}
