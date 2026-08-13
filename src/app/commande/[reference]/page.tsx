import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { Badge } from "@/components/ui/badge";
import { prisma } from "@/lib/prisma";
import { resolveSeatPrice, type PricingRule } from "@/lib/pricing";
import { formatDayLong, formatTime } from "@/lib/utils";
import { CheckoutForm, type SeatLineData } from "./checkout-form";
import { CountdownNotice } from "./countdown-notice";

export const dynamic = "force-dynamic";

export default async function CheckoutPage({
  params,
}: PageProps<"/commande/[reference]">) {
  const { reference } = await params;

  const booking = await prisma.booking.findUnique({
    where: { reference },
    include: {
      showtime: {
        include: { movie: true, cinema: true, auditorium: true },
      },
      seatHolds: {
        include: { seat: { include: { category: true } } },
        orderBy: { seat: { y: "asc" } },
      },
    },
  });

  if (!booking) notFound();

  if (booking.status === "PAID") {
    redirect(`/commande/${booking.reference}/billets`);
  }

  const expired =
    booking.status !== "PENDING" || booking.expiresAt.getTime() < Date.now();

  const ticketTypes = await prisma.ticketType.findMany({
    where: { active: true },
    orderBy: { sortOrder: "asc" },
  });

  const rules = (await prisma.priceRule.findMany({
    where: { active: true },
  })) as PricingRule[];

  const pricingContext = {
    cinemaId: booking.showtime.cinemaId,
    movieId: booking.showtime.movieId,
    startsAt: booking.showtime.startsAt,
    basePrice: booking.showtime.basePrice,
    isPremiere: booking.showtime.isPremiere,
  };

  // Prix de chaque place pour chaque tarif : le client voit le total evoluer
  // sans aller-retour serveur, et le serveur recalcule tout a la validation.
  const seatLines: SeatLineData[] = booking.seatHolds.map((hold) => {
    const prices: Record<string, number> = {};

    for (const type of ticketTypes) {
      prices[type.id] = resolveSeatPrice(rules, pricingContext, {
        seatCategoryId: hold.seat.categoryId,
        seatCategoryModifier: hold.seat.category?.priceModifier ?? 0,
        ticketTypeId: type.id,
      }).amount;
    }

    return {
      seatId: hold.seatId,
      label: `${hold.seat.rowLabel}${hold.seat.number}`,
      categoryName: hold.seat.category?.name ?? null,
      prices,
    };
  });

  const standardType =
    ticketTypes.find((t) => t.code === "STANDARD") ?? ticketTypes[0];

  return (
    <>
      <SiteHeader />

      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-8">
        <div className="mb-6 flex flex-wrap items-center gap-3">
          <Badge tone="outline">Commande {booking.reference}</Badge>
          {!expired && <CountdownNotice expiresAt={booking.expiresAt.toISOString()} />}
        </div>

        <header className="mb-8 rounded-2xl border border-ink-700 bg-ink-900 p-5">
          <h1 className="font-display text-2xl text-ink-50">
            {booking.showtime.movie.title}
          </h1>
          <p className="mt-2 text-sm text-ink-300">
            {formatDayLong(booking.showtime.startsAt)} a{" "}
            {formatTime(booking.showtime.startsAt)} &middot;{" "}
            {booking.showtime.cinema.name}, {booking.showtime.auditorium.name}
          </p>
        </header>

        {expired ? (
          <div className="rounded-xl border border-danger/40 bg-danger/10 p-6 text-center">
            <p className="text-sm text-danger">
              Le delai de paiement est ecoule et vos places ont ete remises en
              vente.
            </p>
            <Link
              href={`/seances/${booking.showtimeId}`}
              className="mt-4 inline-block text-sm font-medium text-brand-400 hover:underline"
            >
              Choisir de nouvelles places
            </Link>
          </div>
        ) : seatLines.length === 0 ? (
          <div className="rounded-xl border border-danger/40 bg-danger/10 p-6 text-center text-sm text-danger">
            Vos places ont ete liberees. Recommencez votre reservation.
          </div>
        ) : (
          <CheckoutForm
            reference={booking.reference}
            seatLines={seatLines}
            ticketTypes={ticketTypes.map((t) => ({
              id: t.id,
              code: t.code,
              name: t.name,
              requiresProof: t.requiresProof,
            }))}
            defaultTicketTypeId={standardType.id}
          />
        )}
      </main>

      <SiteFooter />
    </>
  );
}
