/**
 * Disponibilite des places et retenue temporaire.
 *
 * Une place peut etre dans trois etats pour une seance donnee :
 *   - vendue : un billet non annule existe ;
 *   - retenue : quelqu'un est en train de payer, la retenue n'a pas expire ;
 *   - libre.
 *
 * L'unicite est garantie par la base, pas par le code applicatif :
 *   - `SeatHold @@unique([showtimeId, seatId])` empeche deux retenues ;
 *   - `Ticket  @@unique([showtimeId, seatId])` empeche deux ventes.
 * Deux clients qui cliquent sur la meme place a la meme milliseconde ne peuvent
 * donc pas passer tous les deux, meme sous forte charge.
 */

import { prisma } from "./prisma";
import { resolveSeatPrice, type PricingRule } from "./pricing";

export const SEAT_HOLD_MINUTES = Number(process.env.SEAT_HOLD_MINUTES ?? 10);

export type SeatStatus = "FREE" | "TAKEN" | "HELD" | "UNAVAILABLE";

export interface SeatView {
  id: string;
  rowLabel: string;
  number: number;
  x: number;
  y: number;
  kind: "SEAT" | "WHEELCHAIR" | "AISLE" | "BLOCKED";
  categoryId: string | null;
  categoryName: string | null;
  categoryColor: string | null;
  status: SeatStatus;
  /** Tarif standard pour cette place, affiche avant le choix du type de billet. */
  price: number;
}

export interface SeatMapView {
  showtimeId: string;
  gridRows: number;
  gridCols: number;
  auditoriumName: string;
  seats: SeatView[];
  categories: {
    id: string;
    name: string;
    color: string;
    priceModifier: number;
  }[];
}

/**
 * Supprime les retenues arrivees a expiration.
 * Appele avant toute lecture ou ecriture du plan : c'est ce qui libere
 * reellement les places abandonnees en cours de paiement.
 */
export async function releaseExpiredHolds(showtimeId?: string): Promise<number> {
  const result = await prisma.seatHold.deleteMany({
    where: {
      expiresAt: { lte: new Date() },
      ...(showtimeId ? { showtimeId } : {}),
    },
  });
  return result.count;
}

export async function getSeatMap(
  showtimeId: string,
  options: { holdKey?: string } = {},
): Promise<SeatMapView | null> {
  await releaseExpiredHolds(showtimeId);

  const showtime = await prisma.showtime.findUnique({
    where: { id: showtimeId },
    include: {
      auditorium: {
        include: {
          seats: {
            include: { category: true },
            orderBy: [{ y: "asc" }, { x: "asc" }],
          },
        },
      },
      cinema: { include: { seatCategories: { orderBy: { sortOrder: "asc" } } } },
    },
  });

  if (!showtime) return null;

  const [tickets, holds, standardType, rules] = await Promise.all([
    prisma.ticket.findMany({
      where: { showtimeId, status: { in: ["VALID", "SCANNED"] } },
      select: { seatId: true },
    }),
    prisma.seatHold.findMany({
      where: { showtimeId, expiresAt: { gt: new Date() } },
      select: { seatId: true, holdKey: true },
    }),
    prisma.ticketType.findUnique({ where: { code: "STANDARD" } }),
    prisma.priceRule.findMany({ where: { active: true } }),
  ]);

  const takenSeatIds = new Set(tickets.map((t) => t.seatId));
  const holdsBySeat = new Map(holds.map((h) => [h.seatId, h.holdKey]));

  const pricingContext = {
    cinemaId: showtime.cinemaId,
    movieId: showtime.movieId,
    startsAt: showtime.startsAt,
    basePrice: showtime.basePrice,
    isPremiere: showtime.isPremiere,
  };

  const seats: SeatView[] = showtime.auditorium.seats.map((seat) => {
    let status: SeatStatus;

    if (!seat.active || seat.kind === "BLOCKED" || seat.kind === "AISLE") {
      status = "UNAVAILABLE";
    } else if (takenSeatIds.has(seat.id)) {
      status = "TAKEN";
    } else {
      const holder = holdsBySeat.get(seat.id);
      // Une place retenue par le visiteur lui-meme reste selectionnable.
      status =
        holder && holder !== options.holdKey ? "HELD" : "FREE";
    }

    const price = standardType
      ? resolveSeatPrice(rules as PricingRule[], pricingContext, {
          seatCategoryId: seat.categoryId,
          seatCategoryModifier: seat.category?.priceModifier ?? 0,
          ticketTypeId: standardType.id,
        }).amount
      : showtime.basePrice;

    return {
      id: seat.id,
      rowLabel: seat.rowLabel,
      number: seat.number,
      x: seat.x,
      y: seat.y,
      kind: seat.kind,
      categoryId: seat.categoryId,
      categoryName: seat.category?.name ?? null,
      categoryColor: seat.category?.color ?? null,
      status,
      price,
    };
  });

  return {
    showtimeId,
    gridRows: showtime.auditorium.gridRows,
    gridCols: showtime.auditorium.gridCols,
    auditoriumName: showtime.auditorium.name,
    seats,
    categories: showtime.cinema.seatCategories.map((c) => ({
      id: c.id,
      name: c.name,
      color: c.color,
      priceModifier: c.priceModifier,
    })),
  };
}

export class SeatUnavailableError extends Error {
  constructor(public readonly seatLabels: string[]) {
    super(
      seatLabels.length === 1
        ? `La place ${seatLabels[0]} vient d'etre prise.`
        : `Les places ${seatLabels.join(", ")} viennent d'etre prises.`,
    );
    this.name = "SeatUnavailableError";
  }
}

/**
 * Retient un ensemble de places pour la duree du paiement.
 *
 * Tout ou rien : si une seule place est deja prise, aucune retenue n'est posee
 * et l'appelant sait exactement laquelle a echoue.
 */
export async function holdSeats(options: {
  showtimeId: string;
  seatIds: string[];
  holdKey: string;
  bookingId?: string;
}): Promise<{ expiresAt: Date }> {
  const { showtimeId, seatIds, holdKey, bookingId } = options;

  if (seatIds.length === 0) {
    throw new Error("Aucune place selectionnee.");
  }

  await releaseExpiredHolds(showtimeId);

  const expiresAt = new Date(Date.now() + SEAT_HOLD_MINUTES * 60_000);

  return prisma.$transaction(async (tx) => {
    // Places deja vendues.
    const sold = await tx.ticket.findMany({
      where: {
        showtimeId,
        seatId: { in: seatIds },
        status: { in: ["VALID", "SCANNED"] },
      },
      select: { seat: { select: { rowLabel: true, number: true } } },
    });

    if (sold.length > 0) {
      throw new SeatUnavailableError(
        sold.map((t) => `${t.seat.rowLabel}${t.seat.number}`),
      );
    }

    // Places retenues par quelqu'un d'autre.
    const heldByOthers = await tx.seatHold.findMany({
      where: {
        showtimeId,
        seatId: { in: seatIds },
        holdKey: { not: holdKey },
        expiresAt: { gt: new Date() },
      },
      select: { seat: { select: { rowLabel: true, number: true } } },
    });

    if (heldByOthers.length > 0) {
      throw new SeatUnavailableError(
        heldByOthers.map((h) => `${h.seat.rowLabel}${h.seat.number}`),
      );
    }

    // Le visiteur repart d'une selection propre a chaque validation.
    await tx.seatHold.deleteMany({ where: { showtimeId, holdKey } });

    // Les verifications ci-dessus ne suffisent pas : deux requetes concurrentes
    // peuvent les franchir toutes les deux. C'est la contrainte unique
    // (showtimeId, seatId) qui arbitre pour de bon, et l'une des deux repart
    // avec une violation P2002 que l'on traduit en message metier.
    try {
      await tx.seatHold.createMany({
        data: seatIds.map((seatId) => ({
          showtimeId,
          seatId,
          holdKey,
          bookingId,
          expiresAt,
        })),
      });
    } catch (error) {
      if (
        typeof error === "object" &&
        error !== null &&
        "code" in error &&
        (error as { code: string }).code === "P2002"
      ) {
        const seats = await tx.seat.findMany({
          where: { id: { in: seatIds } },
          select: { rowLabel: true, number: true },
        });
        throw new SeatUnavailableError(
          seats.map((s) => `${s.rowLabel}${s.number}`),
        );
      }
      throw error;
    }

    return { expiresAt };
  });
}

export async function releaseHolds(showtimeId: string, holdKey: string) {
  await prisma.seatHold.deleteMany({ where: { showtimeId, holdKey } });
}
