/**
 * Conventions de numerotation des places.
 *
 * Une salle deja exploitee a presque toujours son ordre etabli : les rangees
 * peuvent partir du fond, les places se compter de droite a gauche, ou demarrer
 * a un autre numero que 1. Imposer une convention obligerait a recoller des
 * etiquettes sur les fauteuils, donc on reproduit l'existant.
 */

export type RowLabelStyle = "LETTERS" | "NUMBERS";
export type RowOrder = "FROM_SCREEN" | "FROM_BACK";
export type SeatDirection = "LEFT_TO_RIGHT" | "RIGHT_TO_LEFT";

export interface NumberingSettings {
  rowLabelStyle: RowLabelStyle;
  rowOrder: RowOrder;
  seatDirection: SeatDirection;
  seatNumberStart: number;
}

export const DEFAULT_NUMBERING: NumberingSettings = {
  rowLabelStyle: "LETTERS",
  rowOrder: "FROM_SCREEN",
  seatDirection: "LEFT_TO_RIGHT",
  seatNumberStart: 1,
};

/** 0 -> A, 25 -> Z, 26 -> AA. */
export function letterLabel(index: number): string {
  if (index < 0) return "?";
  if (index < 26) return String.fromCharCode(65 + index);
  const first = Math.floor(index / 26) - 1;
  return String.fromCharCode(65 + first) + String.fromCharCode(65 + (index % 26));
}

/**
 * Libelle d'une rangee a partir de sa position verticale sur la grille.
 * `y` vaut 0 pour la rangee la plus proche de l'ecran.
 */
export function rowLabelFor(
  y: number,
  totalRows: number,
  settings: NumberingSettings,
): string {
  const index = settings.rowOrder === "FROM_BACK" ? totalRows - 1 - y : y;
  return settings.rowLabelStyle === "NUMBERS"
    ? String(index + 1)
    : letterLabel(index);
}

export interface NumberableSeat {
  x: number;
  y: number;
  kind: "SEAT" | "WHEELCHAIR" | "AISLE" | "BLOCKED";
  rowLabel: string;
  number: number;
}

/**
 * Recalcule libelles et numeros de tout un plan.
 *
 * Les allees ne consomment pas de numero : la place a droite d'une allee suit
 * celle de gauche, comme sur les plans affiches en salle.
 *
 * `manualRowLabels` permet de forcer le libelle de certaines rangees, par
 * exemple une rangee "BALCON" au milieu d'un plan en lettres.
 */
export function renumberSeats<T extends NumberableSeat>(
  seats: T[],
  totalRows: number,
  settings: NumberingSettings,
  manualRowLabels: Record<number, string> = {},
): T[] {
  const byRow = new Map<number, T[]>();
  for (const seat of seats) {
    const bucket = byRow.get(seat.y);
    if (bucket) bucket.push(seat);
    else byRow.set(seat.y, [seat]);
  }

  const out: T[] = [];

  for (const [y, rowSeats] of byRow) {
    const label =
      manualRowLabels[y]?.trim() || rowLabelFor(y, totalRows, settings);

    // Le sens de comptage ne change pas la position des places, seulement
    // l'ordre dans lequel on leur attribue un numero.
    const ordered = [...rowSeats].sort((a, b) =>
      settings.seatDirection === "RIGHT_TO_LEFT" ? b.x - a.x : a.x - b.x,
    );

    let next = settings.seatNumberStart;
    for (const seat of ordered) {
      if (seat.kind === "AISLE") {
        out.push({ ...seat, rowLabel: label, number: 0 });
      } else {
        out.push({ ...seat, rowLabel: label, number: next });
        next += 1;
      }
    }
  }

  return out;
}

/** Apercu textuel d'une rangee, pour confirmer le reglage avant d'appliquer. */
export function previewRow(
  seatCount: number,
  settings: NumberingSettings,
  totalRows = 8,
): string {
  const numbers = Array.from(
    { length: Math.min(seatCount, 4) },
    (_, i) => settings.seatNumberStart + i,
  );
  const label = rowLabelFor(0, totalRows, settings);
  const rendered = numbers.map((n) => `${label}${n}`);

  const suffix = seatCount > 4 ? " ..." : "";
  return settings.seatDirection === "RIGHT_TO_LEFT"
    ? `${suffix ? "... " : ""}${[...rendered].reverse().join(" ")} (depuis la droite)`
    : `${rendered.join(" ")}${suffix}`;
}
