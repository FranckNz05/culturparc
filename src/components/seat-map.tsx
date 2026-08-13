"use client";

import { useMemo, useState } from "react";
import { cn, formatFcfa } from "@/lib/utils";
import { MAX_SEATS_PER_BOOKING } from "@/lib/constants";
import type { SeatMapView, SeatView } from "@/lib/seating";

function seatLabel(seat: SeatView) {
  return `${seat.rowLabel}${seat.number}`;
}

function SeatButton({
  seat,
  selected,
  disabled,
  onToggle,
}: {
  seat: SeatView;
  selected: boolean;
  disabled: boolean;
  onToggle: (seat: SeatView) => void;
}) {
  const label = seatLabel(seat);
  const unavailable = seat.status === "TAKEN" || seat.status === "HELD";

  const stateClass = selected
    ? "bg-brand-500 text-ink-950 ring-2 ring-brand-300"
    : unavailable
      ? "bg-seat-taken text-ink-400 cursor-not-allowed"
      : "bg-ink-600 text-ink-200 hover:bg-ink-500 hover:ring-1 hover:ring-brand-500";

  const describedStatus = selected
    ? "selectionnee"
    : seat.status === "TAKEN"
      ? "deja vendue"
      : seat.status === "HELD"
        ? "en cours de reservation"
        : "libre";

  return (
    <button
      type="button"
      onClick={() => onToggle(seat)}
      disabled={unavailable || (disabled && !selected)}
      aria-pressed={selected}
      aria-label={`Place ${label}, ${seat.categoryName ?? "standard"}, ${formatFcfa(seat.price)}, ${describedStatus}`}
      title={`${label} - ${seat.categoryName ?? "Standard"} - ${formatFcfa(seat.price)}`}
      className={cn(
        "relative flex aspect-square w-full items-center justify-center rounded-[4px] text-[9px] font-medium transition-all",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400",
        stateClass,
        disabled && !selected && !unavailable && "opacity-40",
      )}
      style={
        // Un liseré rappelle la categorie sans ecraser l'etat de la place.
        !selected && !unavailable && seat.categoryColor
          ? { boxShadow: `inset 0 -2px 0 0 ${seat.categoryColor}` }
          : undefined
      }
    >
      {seat.kind === "WHEELCHAIR" ? (
        <span aria-hidden>&#9855;</span>
      ) : (
        <span className="opacity-80">{seat.number}</span>
      )}
    </button>
  );
}

export function SeatMap({
  seatMap,
  onSelectionChange,
}: {
  seatMap: SeatMapView;
  onSelectionChange?: (seats: SeatView[]) => void;
}) {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const selectableSeats = useMemo(
    () => seatMap.seats.filter((s) => s.status !== "UNAVAILABLE"),
    [seatMap.seats],
  );

  // Les rangees, de l'ecran vers le fond.
  const rows = useMemo(() => {
    const map = new Map<number, SeatView[]>();
    for (const seat of selectableSeats) {
      const bucket = map.get(seat.y);
      if (bucket) bucket.push(seat);
      else map.set(seat.y, [seat]);
    }
    return [...map.entries()]
      .sort(([a], [b]) => a - b)
      .map(([y, seats]) => ({
        y,
        label: seats[0]?.rowLabel ?? "",
        seats: seats.sort((a, b) => a.x - b.x),
      }));
  }, [selectableSeats]);

  const selected = useMemo(
    () => seatMap.seats.filter((s) => selectedIds.includes(s.id)),
    [seatMap.seats, selectedIds],
  );

  const total = selected.reduce((sum, s) => sum + s.price, 0);
  const limitReached = selectedIds.length >= MAX_SEATS_PER_BOOKING;

  function toggle(seat: SeatView) {
    setSelectedIds((current) => {
      const next = current.includes(seat.id)
        ? current.filter((id) => id !== seat.id)
        : current.length >= MAX_SEATS_PER_BOOKING
          ? current
          : [...current, seat.id];

      onSelectionChange?.(
        seatMap.seats.filter((s) => next.includes(s.id)),
      );
      return next;
    });
  }

  return (
    <div className="space-y-6">
      {/* L'ecran, pour que le visiteur s'oriente dans la salle. */}
      <div className="space-y-2">
        <div className="screen-curve mx-auto h-8 w-full max-w-2xl rounded-t-sm" />
        <p className="text-center text-xs uppercase tracking-[0.3em] text-ink-400">
          Ecran
        </p>
      </div>

      {/* Plan. Le defilement horizontal evite d'ecraser les grandes salles
          sur les petits telephones. */}
      <div className="overflow-x-auto pb-2 scrollbar-slim">
        <div className="mx-auto w-fit min-w-full space-y-1.5 px-1">
          {rows.map((row) => (
            <div key={row.y} className="flex items-center gap-2">
              <span className="w-4 shrink-0 text-right text-[10px] font-medium text-ink-400">
                {row.label}
              </span>

              <div
                className="grid flex-1 gap-1"
                style={{
                  gridTemplateColumns: `repeat(${seatMap.gridCols}, minmax(18px, 1fr))`,
                }}
              >
                {row.seats.map((seat) => (
                  <div
                    key={seat.id}
                    style={{ gridColumnStart: seat.x + 1 }}
                    className="min-w-[18px]"
                  >
                    <SeatButton
                      seat={seat}
                      selected={selectedIds.includes(seat.id)}
                      disabled={limitReached}
                      onToggle={toggle}
                    />
                  </div>
                ))}
              </div>

              <span className="w-4 shrink-0 text-[10px] font-medium text-ink-400">
                {row.label}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Legende */}
      <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-xs text-ink-300">
        <span className="flex items-center gap-1.5">
          <span className="h-3.5 w-3.5 rounded-[3px] bg-ink-600" /> Libre
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-3.5 w-3.5 rounded-[3px] bg-brand-500" /> Votre choix
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-3.5 w-3.5 rounded-[3px] bg-seat-taken" /> Occupee
        </span>
        {seatMap.categories.map((c) => (
          <span key={c.id} className="flex items-center gap-1.5">
            <span
              className="h-3.5 w-3.5 rounded-[3px] bg-ink-600"
              style={{ boxShadow: `inset 0 -2px 0 0 ${c.color}` }}
            />
            {c.name}
            {c.priceModifier !== 0 && (
              <span className="text-ink-400">
                ({c.priceModifier > 0 ? "+" : ""}
                {formatFcfa(c.priceModifier)})
              </span>
            )}
          </span>
        ))}
      </div>

      {limitReached && (
        <p className="text-center text-xs text-warning">
          Maximum {MAX_SEATS_PER_BOOKING} places par reservation. Pour un groupe
          plus important, contactez la salle.
        </p>
      )}

      {/* Recapitulatif de la selection */}
      <div className="rounded-xl border border-ink-700 bg-ink-850 p-4">
        {selected.length === 0 ? (
          <p className="text-sm text-ink-300">
            Choisissez vos places sur le plan ci-dessus.
          </p>
        ) : (
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="min-w-0">
              <p className="text-xs uppercase tracking-widest text-ink-400">
                {selected.length} place{selected.length > 1 ? "s" : ""}
              </p>
              <p className="mt-1 flex flex-wrap gap-1.5">
                {selected.map((s) => (
                  <span
                    key={s.id}
                    className="rounded-md bg-brand-500/15 px-2 py-0.5 text-sm font-medium text-brand-300"
                  >
                    {seatLabel(s)}
                  </span>
                ))}
              </p>
            </div>

            <div className="text-right">
              <p className="text-xs uppercase tracking-widest text-ink-400">
                Total indicatif
              </p>
              <p className="font-display text-2xl text-brand-400">
                {formatFcfa(total)}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Le formulaire parent recupere la selection par ces champs. */}
      {selectedIds.map((id) => (
        <input key={id} type="hidden" name="seatIds" value={id} />
      ))}
    </div>
  );
}
