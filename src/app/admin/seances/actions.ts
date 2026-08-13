"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireRole } from "@/auth";
import { prisma } from "@/lib/prisma";
import { notifyShowtimeCancelled } from "@/lib/notifications";

const schema = z.object({
  movieId: z.string().min(1, "Choisissez un film."),
  auditoriumId: z.string().min(1, "Choisissez une salle."),
  date: z.string().min(1, "Indiquez une date."),
  time: z.string().min(1, "Indiquez une heure."),
  format: z.enum(["TWO_D", "THREE_D"]),
  language: z.enum(["VF", "VOSTFR", "VO"]),
  basePrice: z.coerce.number().int().min(0).max(1_000_000),
  isPremiere: z.coerce.boolean().optional(),
});

export interface ShowtimeState {
  error?: string;
  success?: string;
}

/** Marge de nettoyage entre deux seances : sortie de salle et menage. */
const TURNAROUND_MINUTES = 20;

export async function createShowtime(
  _prev: ShowtimeState,
  formData: FormData,
): Promise<ShowtimeState> {
  const session = await requireRole("MANAGER");
  if (!session) return { error: "Acces refuse." };

  const parsed = schema.safeParse({
    movieId: formData.get("movieId"),
    auditoriumId: formData.get("auditoriumId"),
    date: formData.get("date"),
    time: formData.get("time"),
    format: formData.get("format"),
    language: formData.get("language"),
    basePrice: formData.get("basePrice"),
    isPremiere: formData.get("isPremiere") === "on",
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Formulaire invalide." };
  }

  const input = parsed.data;

  const startsAt = new Date(`${input.date}T${input.time}:00`);
  if (Number.isNaN(startsAt.getTime())) {
    return { error: "Date ou heure invalide." };
  }

  const [movie, auditorium] = await Promise.all([
    prisma.movie.findUnique({ where: { id: input.movieId } }),
    prisma.auditorium.findUnique({ where: { id: input.auditoriumId } }),
  ]);

  if (!movie) return { error: "Film introuvable." };
  if (!auditorium) return { error: "Salle introuvable." };

  if (
    session.user.role === "MANAGER" &&
    session.user.cinemaId &&
    auditorium.cinemaId !== session.user.cinemaId
  ) {
    return { error: "Cette salle appartient a un autre cinema." };
  }

  const endsAt = new Date(
    startsAt.getTime() + (movie.durationMin + TURNAROUND_MINUTES) * 60_000,
  );

  // Chevauchement : la contrainte unique ne couvre qu'un debut identique, pas
  // une seance qui empiete sur la precedente.
  const overlapping = await prisma.showtime.findFirst({
    where: {
      auditoriumId: input.auditoriumId,
      status: { not: "CANCELLED" },
      startsAt: { lt: endsAt },
      endsAt: { gt: startsAt },
    },
    include: { movie: { select: { title: true } } },
  });

  if (overlapping) {
    const h = overlapping.startsAt.getHours().toString().padStart(2, "0");
    const m = overlapping.startsAt.getMinutes().toString().padStart(2, "0");
    return {
      error: `La salle est deja occupee par ${overlapping.movie.title} a ${h}h${m}.`,
    };
  }

  await prisma.showtime.create({
    data: {
      movieId: input.movieId,
      auditoriumId: input.auditoriumId,
      cinemaId: auditorium.cinemaId,
      startsAt,
      endsAt,
      format: input.format,
      language: input.language,
      basePrice: input.basePrice,
      isPremiere: input.isPremiere ?? false,
    },
  });

  revalidatePath("/admin/seances");
  revalidatePath("/programme");

  return { success: `Seance ajoutee : ${movie.title}, ${input.date} a ${input.time}.` };
}

export async function cancelShowtime(formData: FormData): Promise<void> {
  const session = await requireRole("MANAGER");
  if (!session) return;

  const id = String(formData.get("showtimeId") ?? "");
  if (!id) return;

  const sold = await prisma.ticket.count({
    where: { showtimeId: id, status: { in: ["VALID", "SCANNED"] } },
  });

  // Une seance deja vendue se marque annulee mais garde ses billets : le
  // remboursement se traite ensuite commande par commande.
  await prisma.showtime.update({
    where: { id },
    data: { status: "CANCELLED" },
  });

  if (sold === 0) {
    await prisma.seatHold.deleteMany({ where: { showtimeId: id } });
  }

  // Prevenir les clients passe avant tout le reste : ils doivent apprendre
  // l'annulation par nous, pas devant une porte fermee. L'echec d'envoi est
  // journalise mais ne remet pas l'annulation en cause.
  if (sold > 0) {
    try {
      const report = await notifyShowtimeCancelled(id);
      console.info("Annulation notifiee", report);
    } catch (error) {
      console.error("Notification d'annulation impossible", error);
    }
  }

  revalidatePath("/admin/seances");
  revalidatePath("/programme");
}
