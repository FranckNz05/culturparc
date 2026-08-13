import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Le franc CFA ne se divise pas : on n'affiche jamais de decimales.
 */
export function formatFcfa(amount: number): string {
  return `${new Intl.NumberFormat("fr-FR").format(Math.round(amount))} FCFA`;
}

/**
 * Reference de commande lisible au telephone : pas de 0/O ni de 1/I.
 */
const REFERENCE_ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";

export function generateBookingReference(): string {
  let out = "";
  const bytes = crypto.getRandomValues(new Uint8Array(6));
  for (const b of bytes) {
    out += REFERENCE_ALPHABET[b % REFERENCE_ALPHABET.length];
  }
  return `CP-${out}`;
}

/**
 * Airtel rejette toute reference non alphanumerique (erreur DP00800001005),
 * d'ou ce nettoyage avant chaque appel a l'API.
 */
export function toAlphanumericReference(value: string, maxLength = 64): string {
  const cleaned = value.replace(/[^A-Za-z0-9]/g, "");
  if (cleaned.length === 0) {
    return `TXN${Date.now().toString(36).toUpperCase()}`.slice(0, maxLength);
  }
  return cleaned.slice(0, maxLength);
}

const DAY_LABELS = [
  "dimanche",
  "lundi",
  "mardi",
  "mercredi",
  "jeudi",
  "vendredi",
  "samedi",
];

const MONTH_LABELS = [
  "janvier",
  "fevrier",
  "mars",
  "avril",
  "mai",
  "juin",
  "juillet",
  "aout",
  "septembre",
  "octobre",
  "novembre",
  "decembre",
];

/** "mercredi 12 aout" */
export function formatDayLong(date: Date): string {
  return `${DAY_LABELS[date.getDay()]} ${date.getDate()} ${MONTH_LABELS[date.getMonth()]}`;
}

/** "14h00" */
export function formatTime(date: Date): string {
  const h = date.getHours().toString().padStart(2, "0");
  const m = date.getMinutes().toString().padStart(2, "0");
  return `${h}h${m}`;
}

/** "1h58" a partir d'une duree en minutes */
export function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m} min`;
  return m === 0 ? `${h}h` : `${h}h${m.toString().padStart(2, "0")}`;
}

/** Minutes ecoulees depuis minuit, utilise par les regles tarifaires horaires. */
export function minutesSinceMidnight(date: Date): number {
  return date.getHours() * 60 + date.getMinutes();
}

export function slugify(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** "mer. 12" : format court pour les listes d'horaires. */
export function formatDayShort(date: Date): string {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(date);
  target.setHours(0, 0, 0, 0);

  const diffDays = Math.round((target.getTime() - today.getTime()) / 86_400_000);
  if (diffDays === 0) return "Aujourd'hui";
  if (diffDays === 1) return "Demain";

  return `${DAY_LABELS[date.getDay()].slice(0, 3)}. ${date.getDate()}`;
}
