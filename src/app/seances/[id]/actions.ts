"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { ensureHoldKey } from "@/lib/hold-key";
import { holdSeats, SeatUnavailableError, SEAT_HOLD_MINUTES } from "@/lib/seating";
import { generateBookingReference } from "@/lib/utils";
import { MAX_SEATS_PER_BOOKING } from "@/lib/constants";

const schema = z.object({
  showtimeId: z.string().min(1),
  seatIds: z
    .array(z.string().min(1))
    .min(1, "Choisissez au moins une place.")
    .max(MAX_SEATS_PER_BOOKING, `Maximum ${MAX_SEATS_PER_BOOKING} places par reservation.`),
});

export interface BookingFormState {
  error?: string;
}

/**
 * Retient les places choisies et ouvre une commande en attente de paiement.
 * Le client dispose alors de SEAT_HOLD_MINUTES pour aller au bout.
 */
export async function startBooking(
  _prev: BookingFormState,
  formData: FormData,
): Promise<BookingFormState> {
  const parsed = schema.safeParse({
    showtimeId: formData.get("showtimeId"),
    seatIds: formData.getAll("seatIds").map(String),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Selection invalide." };
  }

  const { showtimeId, seatIds } = parsed.data;

  const showtime = await prisma.showtime.findUnique({
    where: { id: showtimeId },
    select: { id: true, startsAt: true, status: true, auditoriumId: true },
  });

  if (!showtime || showtime.status !== "SCHEDULED") {
    return { error: "Cette seance n'est plus disponible." };
  }

  if (showtime.startsAt.getTime() < Date.now()) {
    return { error: "Cette seance a deja commence." };
  }

  // Les places doivent appartenir a la salle de la seance : sans ce controle,
  // un identifiant force permettrait de reserver un siege d'une autre salle.
  const validSeats = await prisma.seat.count({
    where: {
      id: { in: seatIds },
      auditoriumId: showtime.auditoriumId,
      active: true,
      kind: { in: ["SEAT", "WHEELCHAIR"] },
    },
  });

  if (validSeats !== seatIds.length) {
    return { error: "Une des places choisies n'existe pas dans cette salle." };
  }

  const holdKey = await ensureHoldKey();

  let reference: string;
  try {
    await holdSeats({ showtimeId, seatIds, holdKey });

    const booking = await prisma.booking.create({
      data: {
        reference: generateBookingReference(),
        showtimeId,
        subtotal: 0,
        total: 0,
        expiresAt: new Date(Date.now() + SEAT_HOLD_MINUTES * 60_000),
      },
      select: { id: true, reference: true },
    });

    // On rattache les retenues a la commande : leur suppression suivra la sienne.
    await prisma.seatHold.updateMany({
      where: { showtimeId, holdKey },
      data: { bookingId: booking.id },
    });

    reference = booking.reference;
  } catch (error) {
    if (error instanceof SeatUnavailableError) {
      return { error: error.message };
    }
    console.error("Echec de la creation de reservation", error);
    return {
      error: "La reservation n'a pas pu etre ouverte. Reessayez dans un instant.",
    };
  }

  redirect(`/commande/${reference}`);
}
