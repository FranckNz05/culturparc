import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { SeatEditor, type EditableSeat } from "./seat-editor";
import { AuditoriumActions } from "./auditorium-actions";

export const dynamic = "force-dynamic";

export default async function AuditoriumPlanPage({
  params,
}: PageProps<"/admin/salles/[id]">) {
  const { id } = await params;

  const auditorium = await prisma.auditorium.findUnique({
    where: { id },
    include: {
      cinema: { include: { seatCategories: { orderBy: { sortOrder: "asc" } } } },
      seats: { orderBy: [{ y: "asc" }, { x: "asc" }] },
      _count: { select: { showtimes: true } },
    },
  });

  if (!auditorium) notFound();

  const seats: EditableSeat[] = auditorium.seats.map((s) => ({
    id: s.id,
    rowLabel: s.rowLabel,
    number: s.number,
    x: s.x,
    y: s.y,
    kind: s.kind,
    categoryId: s.categoryId,
  }));

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/admin/salles"
          className="text-sm text-ink-300 hover:text-brand-400"
        >
          Retour aux salles
        </Link>
        <h1 className="mt-2 font-display text-3xl text-ink-50">
          {auditorium.cinema.name} &middot; {auditorium.name}
        </h1>
        <p className="mt-1 text-sm text-ink-300">
          {auditorium._count.showtimes} seance
          {auditorium._count.showtimes > 1 ? "s" : ""} programmee
          {auditorium._count.showtimes > 1 ? "s" : ""} dans cette salle.
        </p>
      </div>

      <AuditoriumActions
        auditorium={{
          id: auditorium.id,
          name: auditorium.name,
          screenType: auditorium.screenType,
          showtimeCount: auditorium._count.showtimes,
        }}
      />

      {auditorium.cinema.seatCategories.length === 0 && (
        <p className="rounded-lg border border-warning/40 bg-warning/10 px-4 py-3 text-sm text-warning">
          Aucune categorie de siege n&apos;est definie pour ce cinema. Les places
          seront toutes vendues au tarif de base.
        </p>
      )}

      <SeatEditor
        auditoriumId={auditorium.id}
        auditoriumName={auditorium.name}
        initialSeats={seats}
        initialRows={auditorium.gridRows}
        initialCols={auditorium.gridCols}
        initialNumbering={{
          rowLabelStyle: auditorium.rowLabelStyle,
          rowOrder: auditorium.rowOrder,
          seatDirection: auditorium.seatDirection,
          seatNumberStart: auditorium.seatNumberStart,
        }}
        categories={auditorium.cinema.seatCategories.map((c) => ({
          id: c.id,
          name: c.name,
          color: c.color,
          priceModifier: c.priceModifier,
        }))}
      />
    </div>
  );
}
