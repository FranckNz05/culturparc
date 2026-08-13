import { prisma } from "@/lib/prisma";
import { buildTicketPdf } from "@/lib/ticket-pdf";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ reference: string }> },
) {
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

  if (!booking || booking.status !== "PAID" || booking.tickets.length === 0) {
    return new Response("Billets indisponibles.", { status: 404 });
  }

  const pdf = await buildTicketPdf({
    bookingReference: booking.reference,
    movieTitle: booking.showtime.movie.title,
    cinemaName: booking.showtime.cinema.name,
    auditoriumName: booking.showtime.auditorium.name,
    startsAt: booking.showtime.startsAt,
    format: booking.showtime.format,
    language: booking.showtime.language,
    tickets: booking.tickets.map((t) => ({
      seatLabel: `${t.seat.rowLabel}${t.seat.number}`,
      ticketTypeName: t.ticketType.name,
      price: t.price,
      qrPayload: t.qrPayload,
    })),
  });

  return new Response(pdf as BodyInit, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="billets-${booking.reference}.pdf"`,
      "Cache-Control": "no-store",
    },
  });
}
