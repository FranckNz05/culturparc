/**
 * Messages sortants : email et SMS.
 *
 * Deux principes tiennent cette partie :
 *
 * 1. L'absence de fournisseur configure n'est jamais une erreur silencieuse.
 *    Le message est journalise avec le statut SKIPPED et son contenu complet,
 *    ce qui permet a un responsable de reprendre la liste et d'appeler les
 *    clients a la main. Une annulation de seance ne doit pas se perdre parce
 *    qu'une cle d'API manque.
 *
 * 2. Rien n'est envoye deux fois. Le journal sert aussi de garde-fou : rejouer
 *    une annulation ne renvoie pas un second SMS aux memes personnes.
 */

import { prisma } from "./prisma";
import { toE164 } from "./phone";
import { formatDayLong, formatTime } from "./utils";
import type { NotificationChannel, NotificationKind } from "@/generated/prisma/enums";

interface DeliveryResult {
  ok: boolean;
  error?: string;
  /** Vrai quand aucun fournisseur n'est configure pour ce canal. */
  skipped?: boolean;
}

// ---------------------------------------------------------------------------
// Fournisseurs
// ---------------------------------------------------------------------------

async function sendEmail(
  to: string,
  subject: string,
  body: string,
): Promise<DeliveryResult> {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const from = process.env.NOTIFICATION_EMAIL_FROM?.trim();

  if (!apiKey || !from) {
    return { ok: false, skipped: true, error: "Aucun fournisseur email configure." };
  }

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [to],
        subject,
        text: body,
      }),
    });

    if (!response.ok) {
      const detail = await response.text();
      return { ok: false, error: `HTTP ${response.status} : ${detail.slice(0, 200)}` };
    }

    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Erreur reseau.",
    };
  }
}

async function sendSms(to: string, body: string): Promise<DeliveryResult> {
  const sid = process.env.TWILIO_ACCOUNT_SID?.trim();
  const token = process.env.TWILIO_AUTH_TOKEN?.trim();
  const from = process.env.TWILIO_FROM_NUMBER?.trim();

  if (!sid || !token || !from) {
    return { ok: false, skipped: true, error: "Aucun fournisseur SMS configure." };
  }

  try {
    const response = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(sid)}/Messages.json`,
      {
        method: "POST",
        headers: {
          Authorization: `Basic ${Buffer.from(`${sid}:${token}`).toString("base64")}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({ To: to, From: from, Body: body }),
      },
    );

    if (!response.ok) {
      const detail = await response.text();
      return { ok: false, error: `HTTP ${response.status} : ${detail.slice(0, 200)}` };
    }

    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Erreur reseau.",
    };
  }
}

// ---------------------------------------------------------------------------
// Envoi journalise
// ---------------------------------------------------------------------------

async function deliver(options: {
  kind: NotificationKind;
  channel: NotificationChannel;
  recipient: string;
  subject?: string;
  body: string;
  bookingId?: string;
  showtimeId?: string;
}): Promise<void> {
  const result =
    options.channel === "EMAIL"
      ? await sendEmail(options.recipient, options.subject ?? "Culture Parc", options.body)
      : await sendSms(options.recipient, options.body);

  await prisma.notificationLog.create({
    data: {
      kind: options.kind,
      channel: options.channel,
      recipient: options.recipient,
      subject: options.subject ?? null,
      body: options.body,
      bookingId: options.bookingId ?? null,
      showtimeId: options.showtimeId ?? null,
      status: result.ok ? "SENT" : result.skipped ? "SKIPPED" : "FAILED",
      error: result.ok ? null : (result.error ?? null),
      sentAt: result.ok ? new Date() : null,
    },
  });
}

export interface CancellationReport {
  bookings: number;
  emailsSent: number;
  smsSent: number;
  /** Messages non partis faute de fournisseur : a traiter manuellement. */
  pendingManual: number;
}

/**
 * Previent tous les clients ayant un billet valable pour une seance annulee.
 *
 * Chaque commande recoit au plus un email et un SMS. Les erreurs d'envoi sont
 * journalisees mais n'interrompent pas la boucle : un destinataire injoignable
 * ne doit pas empecher de prevenir les autres.
 */
export async function notifyShowtimeCancelled(
  showtimeId: string,
): Promise<CancellationReport> {
  const showtime = await prisma.showtime.findUnique({
    where: { id: showtimeId },
    include: { movie: true, cinema: true },
  });

  if (!showtime) {
    return { bookings: 0, emailsSent: 0, smsSent: 0, pendingManual: 0 };
  }

  const bookings = await prisma.booking.findMany({
    where: {
      showtimeId,
      status: "PAID",
      tickets: { some: { status: { in: ["VALID", "SCANNED"] } } },
    },
    include: {
      user: { select: { email: true, phone: true, name: true } },
      _count: { select: { tickets: true } },
    },
  });

  // Deja prevenus lors d'une precedente annulation.
  const already = await prisma.notificationLog.findMany({
    where: { showtimeId, kind: "SHOWTIME_CANCELLED", status: { in: ["SENT", "SKIPPED"] } },
    select: { bookingId: true, channel: true },
  });

  const notified = new Set(
    already.map((n) => `${n.bookingId ?? ""}:${n.channel}`),
  );

  const report: CancellationReport = {
    bookings: bookings.length,
    emailsSent: 0,
    smsSent: 0,
    pendingManual: 0,
  };

  const when = `${formatDayLong(showtime.startsAt)} a ${formatTime(showtime.startsAt)}`;
  const subject = `Seance annulee : ${showtime.movie.title}`;

  for (const booking of bookings) {
    const name = booking.user?.name ?? booking.guestName ?? "Cher client";
    const email = booking.user?.email ?? booking.guestEmail;
    const phone = booking.user?.phone ?? booking.guestPhone;

    const message =
      `Bonjour ${name}, la seance de ${showtime.movie.title} du ${when} ` +
      `au ${showtime.cinema.name} est annulee. Votre commande ${booking.reference} ` +
      `(${booking._count.tickets} place${booking._count.tickets > 1 ? "s" : ""}) ` +
      `sera remboursee ou reportee. Contactez-nous au ${showtime.cinema.phone ?? "cinema"} ` +
      `pour choisir. Toutes nos excuses. Culture Parc.`;

    if (email && !notified.has(`${booking.id}:EMAIL`)) {
      await deliver({
        kind: "SHOWTIME_CANCELLED",
        channel: "EMAIL",
        recipient: email,
        subject,
        body: message,
        bookingId: booking.id,
        showtimeId,
      });

      const last = await prisma.notificationLog.findFirst({
        where: { bookingId: booking.id, channel: "EMAIL", kind: "SHOWTIME_CANCELLED" },
        orderBy: { createdAt: "desc" },
        select: { status: true },
      });

      if (last?.status === "SENT") report.emailsSent += 1;
      else report.pendingManual += 1;
    }

    if (phone && !notified.has(`${booking.id}:SMS`)) {
      let recipient: string;
      try {
        recipient = toE164(phone);
      } catch {
        // Numero inexploitable : on le signale sans bloquer les suivants.
        report.pendingManual += 1;
        continue;
      }

      await deliver({
        kind: "SHOWTIME_CANCELLED",
        channel: "SMS",
        recipient,
        // Un SMS coute au caractere : version courte.
        body:
          `Culture Parc : la seance de ${showtime.movie.title} du ${when} est annulee. ` +
          `Commande ${booking.reference}. Remboursement ou report : ${showtime.cinema.phone ?? "contactez la salle"}.`,
        bookingId: booking.id,
        showtimeId,
      });

      const last = await prisma.notificationLog.findFirst({
        where: { bookingId: booking.id, channel: "SMS", kind: "SHOWTIME_CANCELLED" },
        orderBy: { createdAt: "desc" },
        select: { status: true },
      });

      if (last?.status === "SENT") report.smsSent += 1;
      else report.pendingManual += 1;
    }
  }

  return report;
}
