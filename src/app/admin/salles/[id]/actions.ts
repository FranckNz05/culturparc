"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireRole } from "@/auth";
import { prisma } from "@/lib/prisma";

const seatSchema = z.object({
  // Present pour un siege existant, absent pour un siege qu'on vient de poser.
  id: z.string().optional(),
  rowLabel: z.string().min(1).max(3),
  number: z.number().int().min(1).max(999),
  x: z.number().int().min(0).max(99),
  y: z.number().int().min(0).max(99),
  kind: z.enum(["SEAT", "WHEELCHAIR", "AISLE", "BLOCKED"]),
  categoryId: z.string().nullable(),
});

const payloadSchema = z.object({
  auditoriumId: z.string().min(1),
  gridRows: z.number().int().min(1).max(60),
  gridCols: z.number().int().min(1).max(60),
  seats: z.array(seatSchema).max(2000),
});

export interface SeatPlanState {
  error?: string;
  success?: string;
}

/**
 * Enregistre le plan d'une salle.
 *
 * Point de vigilance : une place deja vendue ne peut pas disparaitre du plan,
 * sinon le billet correspondant designerait un siege inexistant. On refuse donc
 * la sauvegarde en nommant les places concernees plutot que de la faire
 * silencieusement echouer.
 */
export async function saveSeatPlan(
  _prev: SeatPlanState,
  formData: FormData,
): Promise<SeatPlanState> {
  const session = await requireRole("MANAGER");
  if (!session) return { error: "Acces refuse." };

  let raw: unknown;
  try {
    raw = JSON.parse(String(formData.get("payload") ?? ""));
  } catch {
    return { error: "Donnees du plan illisibles." };
  }

  const parsed = payloadSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Plan invalide." };
  }

  const { auditoriumId, gridRows, gridCols, seats } = parsed.data;

  const auditorium = await prisma.auditorium.findUnique({
    where: { id: auditoriumId },
    include: {
      seats: {
        select: {
          id: true,
          rowLabel: true,
          number: true,
          x: true,
          y: true,
          kind: true,
          categoryId: true,
        },
      },
    },
  });

  if (!auditorium) return { error: "Salle introuvable." };

  // Un responsable ne touche qu'aux salles de son cinema.
  if (
    session.user.role === "MANAGER" &&
    session.user.cinemaId &&
    auditorium.cinemaId !== session.user.cinemaId
  ) {
    return { error: "Cette salle appartient a un autre cinema." };
  }

  // Doublons de position ou de numerotation : la base les refuserait, autant
  // le dire clairement ici.
  const positions = new Set<string>();
  const labels = new Set<string>();
  for (const seat of seats) {
    const pos = `${seat.x}:${seat.y}`;
    if (positions.has(pos)) {
      return { error: `Deux places occupent la meme case (colonne ${seat.x + 1}, rangee ${seat.y + 1}).` };
    }
    positions.add(pos);

    if (seat.kind !== "AISLE") {
      const label = `${seat.rowLabel}${seat.number}`;
      if (labels.has(label)) {
        return { error: `Le numero ${label} est utilise deux fois.` };
      }
      labels.add(label);
    }
  }

  const existingById = new Map(auditorium.seats.map((s) => [s.id, s]));

  const keptIds = new Set(seats.map((s) => s.id).filter(Boolean) as string[]);
  const removedIds = auditorium.seats
    .map((s) => s.id)
    .filter((id) => !keptIds.has(id));

  if (removedIds.length > 0) {
    const sold = await prisma.ticket.findMany({
      where: { seatId: { in: removedIds }, status: { in: ["VALID", "SCANNED"] } },
      select: { seat: { select: { rowLabel: true, number: true } } },
      take: 10,
    });

    if (sold.length > 0) {
      const labelList = [
        ...new Set(sold.map((t) => `${t.seat.rowLabel}${t.seat.number}`)),
      ].join(", ");
      return {
        error: `Impossible de supprimer des places deja vendues : ${labelList}. Annulez d'abord les billets concernes.`,
      };
    }
  }

  try {
    await prisma.$transaction(async (tx) => {
      await tx.auditorium.update({
        where: { id: auditoriumId },
        data: { gridRows, gridCols },
      });

      if (removedIds.length > 0) {
        await tx.seat.deleteMany({ where: { id: { in: removedIds } } });
      }

      // Une salle compte plusieurs centaines de places : les reecrire toutes a
      // chaque enregistrement ferait expirer la transaction. On ne touche donc
      // que celles qui ont reellement change.
      const changed = seats.filter((seat) => {
        if (!seat.id) return false;
        const before = existingById.get(seat.id);
        if (!before) return false;
        return (
          before.rowLabel !== seat.rowLabel ||
          before.number !== seat.number ||
          before.x !== seat.x ||
          before.y !== seat.y ||
          before.kind !== seat.kind ||
          before.categoryId !== seat.categoryId
        );
      });

      // Ajouter une place au milieu d'une rangee decale toutes les suivantes.
      // Ecrire ces nouveaux numeros un par un violerait la contrainte unique
      // (rowLabel, number) le temps que la place suivante soit traitee. On gare
      // donc d'abord les places deplacees sur des coordonnees negatives, que le
      // plan final n'utilise jamais, avant d'ecrire les valeurs reelles.
      for (const [index, seat] of changed.entries()) {
        await tx.seat.update({
          where: { id: seat.id },
          data: { x: -(index + 1), y: -(index + 1), number: -(index + 1) },
        });
      }

      for (const seat of changed) {
        await tx.seat.update({
          where: { id: seat.id },
          data: {
            rowLabel: seat.rowLabel,
            number: seat.number,
            x: seat.x,
            y: seat.y,
            kind: seat.kind,
            categoryId: seat.categoryId,
          },
        });
      }

      const added = seats.filter((s) => !s.id);
      for (const seat of added) {
        await tx.seat.create({
          data: {
            auditoriumId,
            rowLabel: seat.rowLabel,
            number: seat.number,
            x: seat.x,
            y: seat.y,
            kind: seat.kind,
            categoryId: seat.categoryId,
          },
        });
      }
    }, { timeout: 20_000 });
  } catch (error) {
    console.error("Echec d'enregistrement du plan", error);
    return {
      error:
        "Le plan n'a pas pu etre enregistre. Verifiez qu'aucune place ne partage la meme case ou le meme numero.",
    };
  }

  revalidatePath(`/admin/salles/${auditoriumId}`);

  const sellable = seats.filter((s) => s.kind === "SEAT" || s.kind === "WHEELCHAIR");
  return {
    success: `Plan enregistre : ${sellable.length} place${sellable.length > 1 ? "s" : ""} vendable${sellable.length > 1 ? "s" : ""}.`,
  };
}
