import { notFound } from "next/navigation";
import QRCode from "qrcode";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { prisma } from "@/lib/prisma";
import { formatDayLong, formatFcfa, formatTime } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function TicketsPage({
  params,
}: PageProps<"/commande/[reference]/billets">) {
  const { reference } = await params;

  const booking = await prisma.booking.findUnique({
    where: { reference },
    include: {
      showtime: { include: { movie: true, cinema: true, auditorium: true } },
      tickets: {
        include: { seat: true, ticketType: true },
        orderBy: [{ seat: { y: "asc" } }, { seat: { x: "asc" } }],
      },
    },
  });

  if (!booking) notFound();

  // Un compte permet de retrouver ses billets sous "Mes reservations" ; sans
  // compte, cette page est le seul acces facile et l'avertissement doit etre
  // vu, pas suppose lu.
  const isGuest = !booking.userId;

  if (booking.status !== "PAID" || booking.tickets.length === 0) {
    return (
      <>
        <SiteHeader />
        <main className="mx-auto w-full max-w-xl flex-1 px-4 py-16 text-center">
          <h1 className="font-display text-2xl text-ink-50">
            Billets indisponibles
          </h1>
          <p className="mt-3 text-sm text-ink-300">
            Cette commande n&apos;a pas encore ete payee.
          </p>
          <ButtonLink href={`/commande/${reference}`} className="mt-6">
            Reprendre le paiement
          </ButtonLink>
        </main>
        <SiteFooter />
      </>
    );
  }

  // Les QR sont produits a l'affichage : rien n'est stocke en image.
  const qrCodes = await Promise.all(
    booking.tickets.map((ticket) =>
      QRCode.toDataURL(ticket.qrPayload, {
        errorCorrectionLevel: "M",
        margin: 1,
        width: 320,
        color: { dark: "#08080b", light: "#ffffff" },
      }),
    ),
  );

  const { showtime } = booking;

  return (
    <>
      <SiteHeader />

      <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-8">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-success/20 text-3xl text-success">
            &#10003;
          </div>
          <h1 className="font-display text-3xl text-ink-50">
            Vos billets sont prets
          </h1>
          <p className="mt-2 text-sm text-ink-300">
            Commande {booking.reference} &middot; {formatFcfa(booking.total)} payes
          </p>
        </div>

        <div className="mb-6 flex flex-wrap justify-center gap-3">
          <ButtonLink href={`/commande/${reference}/billets/pdf`} prefetch={false}>
            Telecharger en PDF
          </ButtonLink>
          <ButtonLink href="/programme" variant="secondary">
            Voir le programme
          </ButtonLink>
        </div>

        {isGuest && (
          <div className="mb-8 rounded-xl border border-warning/40 bg-warning/10 px-4 py-3 text-sm text-warning">
            <p className="font-medium">
              Telechargez votre billet des maintenant.
            </p>
            <p className="mt-1 text-warning/90">
              Vous avez reserve sans compte : une fois cette page fermee, le
              seul moyen de la retrouver est votre reference{" "}
              <span className="font-mono font-semibold">{booking.reference}</span>{" "}
              avec le telephone utilise au paiement, depuis{" "}
              <a href="/billets/retrouver" className="underline hover:text-warning">
                Retrouver mes billets
              </a>
              . Enregistrer le PDF maintenant vous evite cette etape.
            </p>
          </div>
        )}

        <div className="space-y-5">
          {booking.tickets.map((ticket, index) => (
            <article
              key={ticket.id}
              className="overflow-hidden rounded-2xl border border-ink-700 bg-ink-900"
            >
              <div className="flex flex-col gap-5 p-5 sm:flex-row sm:items-center">
                <div className="mx-auto shrink-0 rounded-xl bg-white p-2.5 sm:mx-0">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={qrCodes[index]}
                    alt={`Code QR du billet pour la place ${ticket.seat.rowLabel}${ticket.seat.number}`}
                    width={128}
                    height={128}
                    className="h-32 w-32"
                  />
                </div>

                <div className="min-w-0 flex-1 space-y-3 text-center sm:text-left">
                  <div>
                    <h2 className="font-display text-xl text-ink-50">
                      {showtime.movie.title}
                    </h2>
                    <p className="mt-1 text-sm text-ink-300">
                      {formatDayLong(showtime.startsAt)} a{" "}
                      {formatTime(showtime.startsAt)}
                    </p>
                  </div>

                  <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                    <div>
                      <dt className="text-xs uppercase tracking-wider text-ink-400">
                        Place
                      </dt>
                      <dd className="font-display text-2xl text-brand-400">
                        {ticket.seat.rowLabel}
                        {ticket.seat.number}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs uppercase tracking-wider text-ink-400">
                        Salle
                      </dt>
                      <dd className="text-ink-50">{showtime.auditorium.name}</dd>
                    </div>
                    <div>
                      <dt className="text-xs uppercase tracking-wider text-ink-400">
                        Tarif
                      </dt>
                      <dd className="text-ink-50">
                        {ticket.ticketType.name} &middot; {formatFcfa(ticket.price)}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs uppercase tracking-wider text-ink-400">
                        Cinema
                      </dt>
                      <dd className="text-ink-50">{showtime.cinema.name}</dd>
                    </div>
                  </dl>

                  {ticket.ticketType.requiresProof && (
                    <Badge tone="outline">Justificatif demande a l&apos;entree</Badge>
                  )}
                </div>
              </div>

              <div className="border-t border-dashed border-ink-700 bg-ink-850 px-5 py-3">
                <p className="text-xs text-ink-400">
                  Presentez ce code a l&apos;entree. Il n&apos;est valable qu&apos;une
                  seule fois.
                </p>
              </div>
            </article>
          ))}
        </div>
      </main>

      <SiteFooter />
    </>
  );
}
