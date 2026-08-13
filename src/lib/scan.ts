/**
 * Controle d'acces a l'entree de la salle.
 *
 * L'ordre des verifications compte : on rejette d'abord ce qui est faux
 * (signature invalide), puis ce qui est deja consomme, puis ce qui n'est pas
 * valable ici et maintenant. Chaque tentative est journalisee, y compris les
 * echecs : c'est la seule trace exploitable en cas de contestation ou de fraude.
 */

import { prisma } from "./prisma";
import { decodeTicketPayload, hashTicketCode, InvalidTicketCodeError } from "./qr";
import type { ScanResult } from "@/generated/prisma/enums";

/** Tolerance avant la seance : on laisse entrer une heure a l'avance. */
const EARLY_ENTRY_MINUTES = 60;
/** Apres ce delai depuis le debut, le billet n'ouvre plus la salle. */
const LATE_ENTRY_MINUTES = 30;

export interface ScanOutcome {
  result: ScanResult;
  /** Message court affiche en grand au controleur. */
  title: string;
  detail: string;
  ticket?: {
    seatLabel: string;
    movieTitle: string;
    ticketTypeName: string;
    requiresProof: boolean;
    startsAt: Date;
    auditoriumName: string;
    bookingReference: string;
  };
}

export async function scanTicket(options: {
  code: string;
  scannedById?: string;
  /** Limite le controle a une seance precise, quand un poste est dedie. */
  expectedShowtimeId?: string;
  device?: string;
}): Promise<ScanOutcome> {
  const { code, scannedById, expectedShowtimeId, device } = options;

  async function log(result: ScanResult, ticketId?: string) {
    await prisma.scanLog.create({
      data: {
        ticketId: ticketId ?? null,
        result,
        rawPayload: code.slice(0, 500),
        scannedById: scannedById ?? null,
        device: device ?? null,
      },
    });
  }

  // 1. Authenticite du code.
  let payload;
  try {
    payload = decodeTicketPayload(code.trim());
  } catch (error) {
    await log("INVALID_SIGNATURE");
    return {
      result: "INVALID_SIGNATURE",
      title: "Billet non valide",
      detail:
        error instanceof InvalidTicketCodeError
          ? error.message
          : "Ce code n'a pas ete emis par Culture Parc.",
    };
  }

  // 2. Existence du billet.
  const ticket = await prisma.ticket.findUnique({
    where: { id: payload.ticketId },
    include: {
      seat: true,
      ticketType: true,
      booking: { select: { reference: true, status: true } },
      showtime: {
        include: { movie: true, auditorium: true },
      },
    },
  });

  if (!ticket || ticket.qrHash !== hashTicketCode(code.trim())) {
    // Le code se dechiffre mais ne correspond a aucun billet en cours : billet
    // supprime, ou code regenere apres un changement de cle.
    await log("NOT_FOUND");
    return {
      result: "NOT_FOUND",
      title: "Billet introuvable",
      detail: "Aucun billet actif ne correspond a ce code.",
    };
  }

  const info = {
    seatLabel: `${ticket.seat.rowLabel}${ticket.seat.number}`,
    movieTitle: ticket.showtime.movie.title,
    ticketTypeName: ticket.ticketType.name,
    requiresProof: ticket.ticketType.requiresProof,
    startsAt: ticket.showtime.startsAt,
    auditoriumName: ticket.showtime.auditorium.name,
    bookingReference: ticket.booking.reference,
  };

  // 3. Billet annule ou rembourse.
  if (ticket.status === "CANCELLED" || ticket.status === "REFUNDED") {
    await log("CANCELLED", ticket.id);
    return {
      result: "CANCELLED",
      title: "Billet annule",
      detail: "Ce billet a ete annule ou rembourse.",
      ticket: info,
    };
  }

  // 4. Deja utilise : le cas le plus courant de fraude par capture d'ecran.
  if (ticket.status === "SCANNED") {
    await log("ALREADY_SCANNED", ticket.id);
    return {
      result: "ALREADY_SCANNED",
      title: "Deja utilise",
      detail: ticket.scannedAt
        ? `Ce billet a ete scanne a ${ticket.scannedAt.getHours().toString().padStart(2, "0")}h${ticket.scannedAt.getMinutes().toString().padStart(2, "0")}.`
        : "Ce billet a deja ete scanne.",
      ticket: info,
    };
  }

  // 5. Bonne seance.
  if (expectedShowtimeId && ticket.showtimeId !== expectedShowtimeId) {
    await log("WRONG_SHOWTIME", ticket.id);
    return {
      result: "WRONG_SHOWTIME",
      title: "Autre seance",
      detail: `Ce billet est valable pour ${info.movieTitle}, salle ${info.auditoriumName}.`,
      ticket: info,
    };
  }

  // 6. Fenetre horaire.
  const now = Date.now();
  const start = ticket.showtime.startsAt.getTime();

  if (now < start - EARLY_ENTRY_MINUTES * 60_000) {
    await log("TOO_EARLY", ticket.id);
    return {
      result: "TOO_EARLY",
      title: "Trop tot",
      detail: `L'acces ouvre ${EARLY_ENTRY_MINUTES} minutes avant la seance.`,
      ticket: info,
    };
  }

  if (now > start + LATE_ENTRY_MINUTES * 60_000) {
    await log("WRONG_SHOWTIME", ticket.id);
    return {
      result: "WRONG_SHOWTIME",
      title: "Seance commencee",
      detail: `La seance a commence il y a plus de ${LATE_ENTRY_MINUTES} minutes. Voyez avec la caisse.`,
      ticket: info,
    };
  }

  // 7. Validation. Le updateMany conditionnel garantit qu'un seul des deux
  // controleurs l'emporte si le meme billet est scanne simultanement.
  const claimed = await prisma.ticket.updateMany({
    where: { id: ticket.id, status: "VALID" },
    data: { status: "SCANNED", scannedAt: new Date() },
  });

  if (claimed.count === 0) {
    await log("ALREADY_SCANNED", ticket.id);
    return {
      result: "ALREADY_SCANNED",
      title: "Deja utilise",
      detail: "Ce billet vient d'etre scanne a une autre entree.",
      ticket: info,
    };
  }

  await log("OK", ticket.id);

  return {
    result: "OK",
    title: "Entree autorisee",
    detail: `Place ${info.seatLabel}, salle ${info.auditoriumName}.`,
    ticket: info,
  };
}
