import { notFound } from "next/navigation";
import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { Poster } from "@/components/poster";
import { AgeBadge, Badge } from "@/components/ui/badge";
import { prisma } from "@/lib/prisma";
import { getSeatMap, SEAT_HOLD_MINUTES } from "@/lib/seating";
import { getHoldKey } from "@/lib/hold-key";
import { formatDayLong, formatDuration, formatTime } from "@/lib/utils";
import { SeatSelectionForm } from "./seat-selection-form";

// L'etat des places change en permanence : aucune mise en cache possible.
export const dynamic = "force-dynamic";

export default async function ShowtimePage({
  params,
}: PageProps<"/seances/[id]">) {
  const { id } = await params;

  const showtime = await prisma.showtime.findUnique({
    where: { id },
    include: {
      movie: true,
      cinema: true,
      auditorium: true,
    },
  });

  if (!showtime) notFound();

  const holdKey = await getHoldKey();
  const seatMap = await getSeatMap(id, { holdKey });

  if (!seatMap) notFound();

  const isPast = showtime.startsAt.getTime() < Date.now();
  const freeSeats = seatMap.seats.filter((s) => s.status === "FREE").length;

  return (
    <>
      <SiteHeader />

      <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-8">
        {/* Rappel de la seance choisie */}
        <div className="mb-8 flex flex-col gap-5 rounded-2xl border border-ink-700 bg-ink-900 p-5 sm:flex-row">
          <Poster
            src={showtime.movie.posterUrl}
            title={showtime.movie.title}
            sizes="120px"
            className="aspect-2/3 w-24 shrink-0"
          />

          <div className="min-w-0 flex-1 space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <AgeBadge minAge={showtime.movie.minAge} />
              <Badge tone="outline">
                {showtime.format === "THREE_D" ? "3D" : "2D"}
              </Badge>
              <Badge tone="outline">{showtime.language}</Badge>
              {showtime.isPremiere && <Badge tone="brand">Avant-premiere</Badge>}
            </div>

            <div>
              <Link
                href={`/films/${showtime.movie.slug}`}
                className="font-display text-2xl text-ink-50 hover:text-brand-400 sm:text-3xl"
              >
                {showtime.movie.title}
              </Link>
              <p className="mt-1 text-sm text-ink-300">
                {formatDuration(showtime.movie.durationMin)}
              </p>
            </div>

            <dl className="grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
              <div className="flex gap-2">
                <dt className="text-ink-400">Seance</dt>
                <dd className="font-medium text-ink-50">
                  {formatDayLong(showtime.startsAt)} a {formatTime(showtime.startsAt)}
                </dd>
              </div>
              <div className="flex gap-2">
                <dt className="text-ink-400">Salle</dt>
                <dd className="font-medium text-ink-50">
                  {showtime.cinema.name}, {showtime.auditorium.name}
                </dd>
              </div>
            </dl>
          </div>
        </div>

        <div className="mb-6">
          <h1 className="font-display text-2xl text-ink-50">
            Choisissez vos places
          </h1>
          <p className="mt-1 text-sm text-ink-300">
            {freeSeats} place{freeSeats > 1 ? "s" : ""} encore disponible
            {freeSeats > 1 ? "s" : ""}. Vos places seront retenues{" "}
            {SEAT_HOLD_MINUTES} minutes, le temps de payer.
          </p>
        </div>

        {isPast ? (
          <p className="rounded-xl border border-ink-700 bg-ink-900 p-6 text-center text-sm text-ink-300">
            Cette seance a deja commence. Consultez le{" "}
            <Link href="/programme" className="text-brand-400 hover:underline">
              programme
            </Link>{" "}
            pour trouver une autre horaire.
          </p>
        ) : freeSeats === 0 ? (
          <p className="rounded-xl border border-danger/40 bg-danger/10 p-6 text-center text-sm text-danger">
            Cette seance est complete.
          </p>
        ) : (
          <SeatSelectionForm seatMap={seatMap} />
        )}
      </main>

      <SiteFooter />
    </>
  );
}
