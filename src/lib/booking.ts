/**
 * Cycle de vie d'une commande.
 *
 * Regle de fond : les billets ne sont crees qu'au moment ou le paiement est
 * confirme. Tant que le client n'a pas paye, seules des retenues existent. On
 * evite ainsi les billets fantomes en cas d'abandon ou d'echec de paiement.
 */

import { prisma } from "./prisma";
import { encodeTicketPayload, hashTicketCode } from "./qr";
import { computeLoyaltyPoints } from "./pricing";

export class BookingFinalizationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BookingFinalizationError";
  }
}

/**
 * Transforme une commande payee en billets.
 *
 * Idempotent : rappeler cette fonction sur une commande deja payee renvoie les
 * billets existants sans rien recreer. C'est indispensable, car le webhook de
 * l'operateur et le polling du navigateur peuvent arriver en meme temps.
 */
export async function finalizeBooking(bookingId: string) {
  return prisma.$transaction(async (tx) => {
    const booking = await tx.booking.findUnique({
      where: { id: bookingId },
      include: {
        tickets: true,
        seatHolds: { include: { seat: true } },
        showtime: true,
      },
    });

    if (!booking) {
      throw new BookingFinalizationError("Commande introuvable.");
    }

    // Deja finalisee : on ressort tel quel.
    if (booking.status === "PAID" && booking.tickets.length > 0) {
      return booking.tickets;
    }

    if (booking.status === "CANCELLED" || booking.status === "EXPIRED") {
      throw new BookingFinalizationError(
        "Cette commande a expire, le paiement doit etre rembourse.",
      );
    }

    // Les places a emettre proviennent des retenues posees a la selection.
    const seatSelections = booking.seatHolds;

    if (seatSelections.length === 0) {
      throw new BookingFinalizationError(
        "Les places retenues ont expire avant la confirmation du paiement.",
      );
    }

    // Repartition des tarifs choisis, figee a l'etape precedente.
    const lines = await tx.bookingTicketLine.findMany({
      where: { bookingId },
    });

    const lineBySeat = new Map(lines.map((l) => [l.seatId, l]));

    const created = [];

    for (const hold of seatSelections) {
      const line = lineBySeat.get(hold.seatId);

      if (!line) {
        throw new BookingFinalizationError(
          `Aucun tarif enregistre pour la place ${hold.seat.rowLabel}${hold.seat.number}.`,
        );
      }

      // Le billet est cree d'abord, puis son QR : le code contient son identifiant.
      const ticket = await tx.ticket.create({
        data: {
          bookingId,
          showtimeId: booking.showtimeId,
          seatId: hold.seatId,
          ticketTypeId: line.ticketTypeId,
          price: line.price,
          // Valeurs provisoires, remplacees juste apres.
          qrPayload: `pending-${hold.seatId}-${bookingId}`,
          qrHash: `pending-${hold.seatId}-${bookingId}`,
        },
      });

      const code = encodeTicketPayload({
        ticketId: ticket.id,
        showtimeId: booking.showtimeId,
        issuedAt: Math.floor(Date.now() / 1000),
      });

      const updated = await tx.ticket.update({
        where: { id: ticket.id },
        data: { qrPayload: code, qrHash: hashTicketCode(code) },
      });

      created.push(updated);
    }

    await tx.booking.update({
      where: { id: bookingId },
      data: { status: "PAID", paidAt: new Date() },
    });

    // Les retenues ont joue leur role : les billets prennent le relais.
    await tx.seatHold.deleteMany({ where: { bookingId } });

    // Fidelite, uniquement pour les clients identifies.
    if (booking.userId) {
      const points = computeLoyaltyPoints(booking.total);
      if (points > 0) {
        await tx.loyaltyTransaction.create({
          data: {
            userId: booking.userId,
            points,
            reason: "BOOKING_EARNED",
            bookingId,
          },
        });
        await tx.user.update({
          where: { id: booking.userId },
          data: { loyaltyPoints: { increment: points } },
        });
      }
    }

    // Consommation d'un credit d'abonnement.
    if (booking.subscriptionId) {
      await tx.subscription.update({
        where: { id: booking.subscriptionId },
        data: { creditsRemaining: { decrement: created.length } },
      });
    }

    return created;
  });
}

/**
 * Annule les commandes en attente dont le delai de paiement est passe.
 * A appeler periodiquement, et systematiquement avant d'afficher un plan de salle.
 */
export async function expireStaleBookings(): Promise<number> {
  const result = await prisma.booking.updateMany({
    where: { status: "PENDING", expiresAt: { lte: new Date() } },
    data: { status: "EXPIRED" },
  });
  return result.count;
}
