/**
 * Resolution du prix d'une place.
 *
 * Le prix se construit en trois couches :
 *   1. une regle tarifaire, si l'une correspond a la seance et a la place ;
 *   2. sinon le tarif plancher de la seance ;
 *   3. auquel s'ajoute, dans ce seul cas, le supplement de la categorie de
 *      siege (balcon, VIP).
 *
 * Le supplement ne s'applique pas par-dessus une regle : une regle qui cible
 * explicitement une categorie de siege fixe deja le prix definitif.
 */

import { minutesSinceMidnight } from "./utils";

export interface PricingRule {
  id: string;
  label: string;
  priority: number;
  active: boolean;
  cinemaId: string | null;
  movieId: string | null;
  seatCategoryId: string | null;
  ticketTypeId: string;
  daysOfWeek: number[];
  startMinute: number | null;
  endMinute: number | null;
  amount: number;
}

export interface PricingContext {
  cinemaId: string;
  movieId: string;
  startsAt: Date;
  basePrice: number;
  /** Avant-premiere : sert a filtrer les regles dediees si besoin. */
  isPremiere?: boolean;
}

export interface SeatPricingInput {
  seatCategoryId: string | null;
  seatCategoryModifier: number;
  ticketTypeId: string;
}

export interface PriceBreakdown {
  amount: number;
  /** Regle retenue, ou null si l'on est retombe sur le tarif de la seance. */
  ruleId: string | null;
  ruleLabel: string | null;
  basePrice: number;
  categoryModifier: number;
}

/** Une regle s'applique si tous ses criteres renseignes correspondent. */
function ruleMatches(
  rule: PricingRule,
  context: PricingContext,
  seat: SeatPricingInput,
): boolean {
  if (!rule.active) return false;
  if (rule.ticketTypeId !== seat.ticketTypeId) return false;
  if (rule.cinemaId !== null && rule.cinemaId !== context.cinemaId) return false;
  if (rule.movieId !== null && rule.movieId !== context.movieId) return false;
  if (
    rule.seatCategoryId !== null &&
    rule.seatCategoryId !== seat.seatCategoryId
  ) {
    return false;
  }

  if (rule.daysOfWeek.length > 0) {
    if (!rule.daysOfWeek.includes(context.startsAt.getDay())) return false;
  }

  if (rule.startMinute !== null || rule.endMinute !== null) {
    const minute = minutesSinceMidnight(context.startsAt);
    if (rule.startMinute !== null && minute < rule.startMinute) return false;
    // Borne haute exclue : une regle 14h00-18h00 ne couvre pas la seance de 18h00.
    if (rule.endMinute !== null && minute >= rule.endMinute) return false;
  }

  return true;
}

/**
 * Nombre de criteres explicitement renseignes : departage deux regles de meme
 * priorite en faveur de la plus ciblee.
 */
function specificity(rule: PricingRule): number {
  let score = 0;
  if (rule.cinemaId !== null) score += 1;
  if (rule.movieId !== null) score += 1;
  if (rule.seatCategoryId !== null) score += 1;
  if (rule.daysOfWeek.length > 0) score += 1;
  if (rule.startMinute !== null || rule.endMinute !== null) score += 1;
  return score;
}

export function resolveSeatPrice(
  rules: PricingRule[],
  context: PricingContext,
  seat: SeatPricingInput,
): PriceBreakdown {
  const candidates = rules
    .filter((rule) => ruleMatches(rule, context, seat))
    .sort((a, b) => {
      if (b.priority !== a.priority) return b.priority - a.priority;
      if (specificity(b) !== specificity(a)) return specificity(b) - specificity(a);
      // A egalite parfaite, le tarif le plus avantageux pour le client gagne.
      return a.amount - b.amount;
    });

  const winner = candidates[0];

  if (winner) {
    return {
      amount: Math.max(0, winner.amount),
      ruleId: winner.id,
      ruleLabel: winner.label,
      basePrice: context.basePrice,
      categoryModifier: 0,
    };
  }

  return {
    amount: Math.max(0, context.basePrice + seat.seatCategoryModifier),
    ruleId: null,
    ruleLabel: null,
    basePrice: context.basePrice,
    categoryModifier: seat.seatCategoryModifier,
  };
}

/** Total d'un panier, chaque place pouvant avoir son propre tarif. */
export function computeSubtotal(breakdowns: PriceBreakdown[]): number {
  return breakdowns.reduce((sum, b) => sum + b.amount, 0);
}

export interface PromoInput {
  type: "PERCENT" | "FIXED";
  value: number;
  minAmount: number;
}

/**
 * Remise appliquee au sous-total. Le resultat ne descend jamais sous zero et
 * une remise en pourcentage est bornee a 100 %.
 */
export function computeDiscount(subtotal: number, promo: PromoInput | null): number {
  if (!promo) return 0;
  if (subtotal < promo.minAmount) return 0;

  if (promo.type === "PERCENT") {
    const pct = Math.min(100, Math.max(0, promo.value));
    return Math.round((subtotal * pct) / 100);
  }

  return Math.min(subtotal, Math.max(0, promo.value));
}

/** Un point de fidelite pour 100 FCFA payes. */
export const LOYALTY_POINTS_PER_FCFA = 1 / 100;

export function computeLoyaltyPoints(total: number): number {
  return Math.floor(total * LOYALTY_POINTS_PER_FCFA);
}
