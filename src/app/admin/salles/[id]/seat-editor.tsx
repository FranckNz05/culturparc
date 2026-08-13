"use client";

import { useActionState, useMemo, useState } from "react";
import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  previewRow,
  renumberSeats,
  rowLabelFor,
  type NumberingSettings,
  type RowLabelStyle,
  type RowOrder,
  type SeatDirection,
} from "@/lib/seat-numbering";
import { saveSeatPlan, type SeatPlanState } from "./actions";

export type SeatKind = "SEAT" | "WHEELCHAIR" | "AISLE" | "BLOCKED";

export interface EditableSeat {
  id?: string;
  rowLabel: string;
  number: number;
  x: number;
  y: number;
  kind: SeatKind;
  categoryId: string | null;
}

export interface CategoryOption {
  id: string;
  name: string;
  color: string;
  priceModifier: number;
}

const KINDS: { value: SeatKind; label: string; hint: string }[] = [
  { value: "SEAT", label: "Place", hint: "Vendable" },
  { value: "WHEELCHAIR", label: "PMR", hint: "Emplacement adapte" },
  { value: "AISLE", label: "Allee", hint: "Espace de circulation" },
  { value: "BLOCKED", label: "Condamnee", hint: "Non vendable" },
];

const selectClass =
  "rounded-lg border border-ink-600 bg-ink-850 px-3 py-2 text-sm text-ink-50 " +
  "focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500";

function SaveButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Enregistrement..." : "Enregistrer le plan"}
    </Button>
  );
}

export function SeatEditor({
  auditoriumId,
  auditoriumName,
  initialSeats,
  initialRows,
  initialCols,
  initialNumbering,
  categories,
}: {
  auditoriumId: string;
  auditoriumName: string;
  initialSeats: EditableSeat[];
  initialRows: number;
  initialCols: number;
  initialNumbering: NumberingSettings;
  categories: CategoryOption[];
}) {
  const [state, formAction] = useActionState<SeatPlanState, FormData>(
    saveSeatPlan,
    {},
  );

  const [rows, setRows] = useState(initialRows);
  const [cols, setCols] = useState(initialCols);
  const [seats, setSeats] = useState<EditableSeat[]>(initialSeats);
  const [numbering, setNumbering] = useState<NumberingSettings>(initialNumbering);

  // Libelles forces par l'exploitant, qui l'emportent sur la convention.
  const [manualLabels, setManualLabels] = useState<Record<number, string>>(() => {
    const out: Record<number, string> = {};
    for (const seat of initialSeats) {
      const expected = rowLabelFor(seat.y, initialRows, initialNumbering);
      if (seat.rowLabel && seat.rowLabel !== expected) {
        out[seat.y] = seat.rowLabel;
      }
    }
    return out;
  });

  const [brushKind, setBrushKind] = useState<SeatKind>("SEAT");
  const [brushCategory, setBrushCategory] = useState<string | null>(
    categories[0]?.id ?? null,
  );
  const [painting, setPainting] = useState(false);
  const [eraseMode, setEraseMode] = useState(false);

  const seatByPos = useMemo(() => {
    const map = new Map<string, EditableSeat>();
    for (const seat of seats) map.set(`${seat.x}:${seat.y}`, seat);
    return map;
  }, [seats]);

  function applyNumbering(
    list: EditableSeat[],
    settings = numbering,
    labels = manualLabels,
    totalRows = rows,
  ): EditableSeat[] {
    return renumberSeats(list, totalRows, settings, labels);
  }

  function applyAt(x: number, y: number) {
    setSeats((current) => {
      const key = `${x}:${y}`;
      const existing = current.find((s) => `${s.x}:${s.y}` === key);

      if (eraseMode) {
        if (!existing) return current;
        return applyNumbering(current.filter((s) => `${s.x}:${s.y}` !== key));
      }

      const next: EditableSeat = {
        id: existing?.id,
        rowLabel: existing?.rowLabel ?? "",
        number: existing?.number ?? 1,
        x,
        y,
        kind: brushKind,
        categoryId: brushKind === "AISLE" ? null : brushCategory,
      };

      const others = current.filter((s) => `${s.x}:${s.y}` !== key);
      return applyNumbering([...others, next]);
    });
  }

  function fillRow(y: number) {
    setSeats((current) => {
      const others = current.filter((s) => s.y !== y);
      const rowSeats: EditableSeat[] = [];
      for (let x = 0; x < cols; x++) {
        const existing = current.find((s) => s.x === x && s.y === y);
        rowSeats.push({
          id: existing?.id,
          rowLabel: existing?.rowLabel ?? "",
          number: 1,
          x,
          y,
          kind: brushKind,
          categoryId: brushKind === "AISLE" ? null : brushCategory,
        });
      }
      return applyNumbering([...others, ...rowSeats]);
    });
  }

  function clearRow(y: number) {
    setSeats((current) => applyNumbering(current.filter((s) => s.y !== y)));
  }

  /** Rejoue la numerotation sur tout le plan avec les reglages courants. */
  function updateNumbering(patch: Partial<NumberingSettings>) {
    const next = { ...numbering, ...patch };
    setNumbering(next);
    setSeats((current) => applyNumbering(current, next));
  }

  function setRowLabel(y: number, value: string) {
    const nextLabels = { ...manualLabels };
    if (value.trim()) nextLabels[y] = value.trim().toUpperCase();
    else delete nextLabels[y];

    setManualLabels(nextLabels);
    setSeats((current) => applyNumbering(current, numbering, nextLabels));
  }

  function updateRows(value: number) {
    const next = Math.max(1, Math.min(60, value));
    setRows(next);
    // Le libelle depend du nombre de rangees quand on numerote depuis le fond.
    setSeats((current) =>
      applyNumbering(
        current.filter((s) => s.y < next),
        numbering,
        manualLabels,
        next,
      ),
    );
  }

  const sellableCount = seats.filter(
    (s) => s.kind === "SEAT" || s.kind === "WHEELCHAIR",
  ).length;

  const countByCategory = categories.map((c) => ({
    ...c,
    count: seats.filter(
      (s) => s.categoryId === c.id && (s.kind === "SEAT" || s.kind === "WHEELCHAIR"),
    ).length,
  }));

  function colorFor(seat: EditableSeat): string | undefined {
    if (seat.kind === "AISLE") return undefined;
    return categories.find((c) => c.id === seat.categoryId)?.color;
  }

  const payload = JSON.stringify({
    auditoriumId,
    gridRows: rows,
    gridCols: cols,
    numbering,
    seats,
  });

  return (
    <form action={formAction} className="space-y-6">
      <input type="hidden" name="payload" value={payload} />

      {/* ------------------------------------------------------------------
          Conventions de numerotation
          ------------------------------------------------------------------ */}
      <section className="space-y-4 rounded-xl border border-ink-700 bg-ink-900 p-4">
        <div>
          <h2 className="font-display text-lg text-ink-50">Numerotation</h2>
          <p className="mt-1 text-xs text-ink-400">
            Reproduisez l&apos;ordre deja en place dans la salle. Toute
            modification renumerote le plan immediatement.
          </p>
        </div>

        <div className="flex flex-wrap items-end gap-4">
          <label className="space-y-1.5">
            <span className="block text-xs uppercase tracking-wider text-ink-400">
              Rangees
            </span>
            <select
              value={numbering.rowLabelStyle}
              onChange={(e) =>
                updateNumbering({ rowLabelStyle: e.target.value as RowLabelStyle })
              }
              className={selectClass}
            >
              <option value="LETTERS">Lettres (A, B, C)</option>
              <option value="NUMBERS">Chiffres (1, 2, 3)</option>
            </select>
          </label>

          <label className="space-y-1.5">
            <span className="block text-xs uppercase tracking-wider text-ink-400">
              Premiere rangee
            </span>
            <select
              value={numbering.rowOrder}
              onChange={(e) =>
                updateNumbering({ rowOrder: e.target.value as RowOrder })
              }
              className={selectClass}
            >
              <option value="FROM_SCREEN">Cote ecran</option>
              <option value="FROM_BACK">Cote fond de salle</option>
            </select>
          </label>

          <label className="space-y-1.5">
            <span className="block text-xs uppercase tracking-wider text-ink-400">
              Sens des places
            </span>
            <select
              value={numbering.seatDirection}
              onChange={(e) =>
                updateNumbering({
                  seatDirection: e.target.value as SeatDirection,
                })
              }
              className={selectClass}
            >
              <option value="LEFT_TO_RIGHT">De gauche a droite</option>
              <option value="RIGHT_TO_LEFT">De droite a gauche</option>
            </select>
          </label>

          <label className="space-y-1.5">
            <span className="block text-xs uppercase tracking-wider text-ink-400">
              Premier numero
            </span>
            <input
              type="number"
              min={0}
              max={100}
              value={numbering.seatNumberStart}
              onChange={(e) =>
                updateNumbering({
                  seatNumberStart: Math.max(0, Number(e.target.value)),
                })
              }
              className={cn(selectClass, "w-24")}
            />
          </label>

          <div className="space-y-1.5">
            <span className="block text-xs uppercase tracking-wider text-ink-400">
              Apercu
            </span>
            <p className="rounded-lg border border-dashed border-ink-600 px-3 py-2 font-mono text-sm text-brand-300">
              {previewRow(cols, numbering, rows)}
            </p>
          </div>
        </div>

        {Object.keys(manualLabels).length > 0 && (
          <p className="text-xs text-ink-400">
            {Object.keys(manualLabels).length} rangee
            {Object.keys(manualLabels).length > 1 ? "s" : ""} porte
            {Object.keys(manualLabels).length > 1 ? "nt" : ""} un libelle
            personnalise, conserve malgre la convention choisie.
          </p>
        )}
      </section>

      {/* ------------------------------------------------------------------
          Outils de dessin
          ------------------------------------------------------------------ */}
      <div className="space-y-4 rounded-xl border border-ink-700 bg-ink-900 p-4">
        <div className="flex flex-wrap items-end gap-4">
          <div>
            <span className="mb-1.5 block text-xs uppercase tracking-wider text-ink-400">
              Outil
            </span>
            <div className="flex flex-wrap gap-1.5">
              {KINDS.map((k) => (
                <button
                  key={k.value}
                  type="button"
                  onClick={() => {
                    setBrushKind(k.value);
                    setEraseMode(false);
                  }}
                  title={k.hint}
                  className={cn(
                    "rounded-lg border px-3 py-1.5 text-sm transition-colors",
                    !eraseMode && brushKind === k.value
                      ? "border-brand-500 bg-brand-500/10 text-brand-300"
                      : "border-ink-600 text-ink-200 hover:border-ink-500",
                  )}
                >
                  {k.label}
                </button>
              ))}

              <button
                type="button"
                onClick={() => setEraseMode(true)}
                className={cn(
                  "rounded-lg border px-3 py-1.5 text-sm transition-colors",
                  eraseMode
                    ? "border-danger bg-danger/10 text-danger"
                    : "border-ink-600 text-ink-200 hover:border-ink-500",
                )}
              >
                Gomme
              </button>
            </div>
          </div>

          {categories.length > 0 && (
            <div>
              <span className="mb-1.5 block text-xs uppercase tracking-wider text-ink-400">
                Categorie
              </span>
              <select
                value={brushCategory ?? ""}
                onChange={(e) => setBrushCategory(e.target.value || null)}
                className={selectClass}
              >
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                    {c.priceModifier !== 0
                      ? ` (${c.priceModifier > 0 ? "+" : ""}${c.priceModifier} FCFA)`
                      : ""}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div>
            <span className="mb-1.5 block text-xs uppercase tracking-wider text-ink-400">
              Grille
            </span>
            <div className="flex items-center gap-2 text-sm">
              <input
                type="number"
                min={1}
                max={60}
                value={rows}
                onChange={(e) => updateRows(Number(e.target.value))}
                className={cn(selectClass, "w-16")}
                aria-label="Nombre de rangees"
              />
              <span className="text-ink-400">rangees</span>
              <input
                type="number"
                min={1}
                max={60}
                value={cols}
                onChange={(e) =>
                  setCols(Math.max(1, Math.min(60, Number(e.target.value))))
                }
                className={cn(selectClass, "w-16")}
                aria-label="Nombre de colonnes"
              />
              <span className="text-ink-400">colonnes</span>
            </div>
          </div>
        </div>

        <p className="text-xs text-ink-400">
          Cliquez une case pour poser ou retirer une place. Maintenez le bouton
          enfonce pour dessiner plusieurs cases d&apos;affilee.
        </p>
      </div>

      {/* ------------------------------------------------------------------
          Grille
          ------------------------------------------------------------------ */}
      <div className="rounded-xl border border-ink-700 bg-ink-900 p-4">
        <div className="mb-4 space-y-1">
          <div className="screen-curve mx-auto h-6 w-full max-w-xl rounded-t-sm" />
          <p className="text-center text-[10px] uppercase tracking-[0.3em] text-ink-400">
            Ecran
          </p>
        </div>

        <div
          className="overflow-x-auto pb-2 scrollbar-slim"
          onMouseUp={() => setPainting(false)}
          onMouseLeave={() => setPainting(false)}
        >
          <div className="w-fit min-w-full space-y-1">
            {Array.from({ length: rows }, (_, y) => {
              const label =
                manualLabels[y] ?? rowLabelFor(y, rows, numbering);

              return (
                <div key={y} className="flex items-center gap-2">
                  {/* Libelle editable : une salle peut avoir une rangee "BALCON". */}
                  <input
                    value={label}
                    onChange={(e) => setRowLabel(y, e.target.value)}
                    className="w-12 shrink-0 rounded border border-transparent bg-transparent px-1 py-0.5 text-right text-[11px] font-medium text-ink-300 hover:border-ink-600 focus:border-brand-500 focus:outline-none"
                    aria-label={`Libelle de la rangee ${y + 1}`}
                    maxLength={3}
                  />

                  <div
                    className="grid gap-1"
                    style={{
                      gridTemplateColumns: `repeat(${cols}, minmax(22px, 1fr))`,
                    }}
                  >
                    {Array.from({ length: cols }, (_, x) => {
                      const seat = seatByPos.get(`${x}:${y}`);
                      const color = seat ? colorFor(seat) : undefined;

                      return (
                        <button
                          key={x}
                          type="button"
                          onMouseDown={() => {
                            setPainting(true);
                            applyAt(x, y);
                          }}
                          onMouseEnter={() => {
                            if (painting) applyAt(x, y);
                          }}
                          aria-label={
                            seat
                              ? `Case colonne ${x + 1}, rangee ${label} : ${seat.kind === "AISLE" ? "allee" : `place ${seat.rowLabel}${seat.number}`}`
                              : `Case vide colonne ${x + 1}, rangee ${label}`
                          }
                          className={cn(
                            "flex aspect-square items-center justify-center rounded-[4px] text-[9px] transition-colors",
                            !seat &&
                              "border border-dashed border-ink-700 bg-transparent hover:border-brand-500/60",
                            seat?.kind === "SEAT" && "bg-ink-600 text-ink-100",
                            seat?.kind === "WHEELCHAIR" && "bg-ink-600 text-brand-300",
                            seat?.kind === "AISLE" && "bg-ink-800 text-ink-500",
                            seat?.kind === "BLOCKED" && "bg-danger/25 text-danger",
                          )}
                          style={
                            color && seat && seat.kind !== "BLOCKED"
                              ? { boxShadow: `inset 0 -2px 0 0 ${color}` }
                              : undefined
                          }
                        >
                          {seat?.kind === "WHEELCHAIR"
                            ? "♿"
                            : seat?.kind === "AISLE"
                              ? ""
                              : seat?.kind === "BLOCKED"
                                ? "✕"
                                : seat
                                  ? seat.number
                                  : ""}
                        </button>
                      );
                    })}
                  </div>

                  <div className="flex shrink-0 gap-1">
                    <button
                      type="button"
                      onClick={() => fillRow(y)}
                      className="rounded border border-ink-600 px-1.5 py-0.5 text-[10px] text-ink-300 hover:border-brand-500 hover:text-brand-400"
                      title={`Remplir la rangee ${label}`}
                    >
                      Remplir
                    </button>
                    <button
                      type="button"
                      onClick={() => clearRow(y)}
                      className="rounded border border-ink-600 px-1.5 py-0.5 text-[10px] text-ink-300 hover:border-danger hover:text-danger"
                      title={`Vider la rangee ${label}`}
                    >
                      Vider
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ------------------------------------------------------------------
          Recapitulatif
          ------------------------------------------------------------------ */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-ink-700 bg-ink-900 p-4">
        <div className="space-y-1">
          <p className="text-sm text-ink-100">
            <span className="font-display text-2xl text-brand-400">
              {sellableCount}
            </span>{" "}
            place{sellableCount > 1 ? "s" : ""} vendable
            {sellableCount > 1 ? "s" : ""} dans {auditoriumName}
          </p>
          <p className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-400">
            {countByCategory.map((c) => (
              <span key={c.id} className="flex items-center gap-1.5">
                <span
                  className="h-2.5 w-2.5 rounded-full"
                  style={{ background: c.color }}
                />
                {c.name} : {c.count}
              </span>
            ))}
          </p>
        </div>

        <SaveButton />
      </div>

      {state.error && (
        <p
          role="alert"
          className="rounded-lg border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger"
        >
          {state.error}
        </p>
      )}

      {state.success && (
        <p
          role="status"
          className="rounded-lg border border-success/40 bg-success/10 px-4 py-3 text-sm text-success"
        >
          {state.success}
        </p>
      )}
    </form>
  );
}
