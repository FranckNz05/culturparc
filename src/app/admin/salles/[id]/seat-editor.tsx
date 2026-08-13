"use client";

import { useActionState, useMemo, useState } from "react";
import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
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

function rowLabelFor(y: number): string {
  // Au-dela de Z, on passe a AA, AB...
  if (y < 26) return String.fromCharCode(65 + y);
  const first = Math.floor(y / 26) - 1;
  return String.fromCharCode(65 + first) + String.fromCharCode(65 + (y % 26));
}

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
  categories,
}: {
  auditoriumId: string;
  auditoriumName: string;
  initialSeats: EditableSeat[];
  initialRows: number;
  initialCols: number;
  categories: CategoryOption[];
}) {
  const [state, formAction] = useActionState<SeatPlanState, FormData>(
    saveSeatPlan,
    {},
  );

  const [rows, setRows] = useState(initialRows);
  const [cols, setCols] = useState(initialCols);
  const [seats, setSeats] = useState<EditableSeat[]>(initialSeats);

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

  /**
   * Renumerote chaque rangee de gauche a droite. Les allees ne consomment pas
   * de numero : la place a droite d'une allee suit celle de gauche, comme sur
   * les plans affiches en salle.
   */
  function renumber(list: EditableSeat[]): EditableSeat[] {
    const byRow = new Map<number, EditableSeat[]>();
    for (const seat of list) {
      const bucket = byRow.get(seat.y);
      if (bucket) bucket.push(seat);
      else byRow.set(seat.y, [seat]);
    }

    const out: EditableSeat[] = [];
    for (const [y, rowSeats] of byRow) {
      let n = 0;
      for (const seat of rowSeats.sort((a, b) => a.x - b.x)) {
        if (seat.kind === "AISLE") {
          out.push({ ...seat, rowLabel: rowLabelFor(y), number: 0 });
        } else {
          n += 1;
          out.push({ ...seat, rowLabel: rowLabelFor(y), number: n });
        }
      }
    }
    return out;
  }

  function applyAt(x: number, y: number) {
    setSeats((current) => {
      const key = `${x}:${y}`;
      const existing = current.find((s) => `${s.x}:${s.y}` === key);

      if (eraseMode) {
        if (!existing) return current;
        return renumber(current.filter((s) => `${s.x}:${s.y}` !== key));
      }

      const next: EditableSeat = {
        id: existing?.id,
        rowLabel: rowLabelFor(y),
        number: existing?.number ?? 1,
        x,
        y,
        kind: brushKind,
        categoryId: brushKind === "AISLE" ? null : brushCategory,
      };

      const others = current.filter((s) => `${s.x}:${s.y}` !== key);
      return renumber([...others, next]);
    });
  }

  /** Remplit une rangee entiere d'un coup : le geste le plus frequent. */
  function fillRow(y: number) {
    setSeats((current) => {
      const others = current.filter((s) => s.y !== y);
      const rowSeats: EditableSeat[] = [];
      for (let x = 0; x < cols; x++) {
        const existing = current.find((s) => s.x === x && s.y === y);
        rowSeats.push({
          id: existing?.id,
          rowLabel: rowLabelFor(y),
          number: 1,
          x,
          y,
          kind: brushKind,
          categoryId: brushKind === "AISLE" ? null : brushCategory,
        });
      }
      return renumber([...others, ...rowSeats]);
    });
  }

  function clearRow(y: number) {
    setSeats((current) => renumber(current.filter((s) => s.y !== y)));
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

  return (
    <form action={formAction} className="space-y-6">
      <input type="hidden" name="payload" value={JSON.stringify({ auditoriumId, gridRows: rows, gridCols: cols, seats })} />

      {/* Barre d'outils */}
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
                className="rounded-lg border border-ink-600 bg-ink-850 px-3 py-2 text-sm text-ink-50"
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
                onChange={(e) => setRows(Math.max(1, Number(e.target.value)))}
                className="w-16 rounded-lg border border-ink-600 bg-ink-850 px-2 py-2 text-ink-50"
                aria-label="Nombre de rangees"
              />
              <span className="text-ink-400">rangees</span>
              <input
                type="number"
                min={1}
                max={60}
                value={cols}
                onChange={(e) => setCols(Math.max(1, Number(e.target.value)))}
                className="w-16 rounded-lg border border-ink-600 bg-ink-850 px-2 py-2 text-ink-50"
                aria-label="Nombre de colonnes"
              />
              <span className="text-ink-400">colonnes</span>
            </div>
          </div>
        </div>

        <p className="text-xs text-ink-400">
          Cliquez une case pour poser ou retirer une place. Maintenez le bouton
          enfonce pour dessiner plusieurs cases d&apos;affilee. La numerotation se
          recalcule automatiquement, de gauche a droite, sans compter les allees.
        </p>
      </div>

      {/* Grille */}
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
            {Array.from({ length: rows }, (_, y) => (
              <div key={y} className="flex items-center gap-2">
                <span className="w-6 shrink-0 text-right text-[11px] font-medium text-ink-400">
                  {rowLabelFor(y)}
                </span>

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
                            ? `Case colonne ${x + 1}, rangee ${rowLabelFor(y)} : ${seat.kind === "AISLE" ? "allee" : `place ${seat.rowLabel}${seat.number}`}`
                            : `Case vide colonne ${x + 1}, rangee ${rowLabelFor(y)}`
                        }
                        className={cn(
                          "flex aspect-square items-center justify-center rounded-[4px] text-[9px] transition-colors",
                          !seat && "border border-dashed border-ink-700 bg-transparent hover:border-brand-500/60",
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
                    title={`Remplir la rangee ${rowLabelFor(y)}`}
                  >
                    Remplir
                  </button>
                  <button
                    type="button"
                    onClick={() => clearRow(y)}
                    className="rounded border border-ink-600 px-1.5 py-0.5 text-[10px] text-ink-300 hover:border-danger hover:text-danger"
                    title={`Vider la rangee ${rowLabelFor(y)}`}
                  >
                    Vider
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Recapitulatif et enregistrement */}
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
