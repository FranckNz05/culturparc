"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getGateway } from "@/lib/payments";
import { isValidCongoPhone, toE164 } from "@/lib/phone";
import { computeDiscount, resolveSeatPrice, type PricingRule } from "@/lib/pricing";
import { toAlphanumericReference } from "@/lib/utils";

const schema = z.object({
  reference: z.string().min(1),
  fullName: z.string().trim().min(2, "Indiquez votre nom."),
  phone: z.string().trim().refine(isValidCongoPhone, {
    message: "Numero invalide. Format attendu : 06 110 92 01.",
  }),
  email: z.union([z.literal(""), z.email("Adresse email invalide.")]),
  provider: z.enum(["AIRTEL_MONEY", "MTN_MOMO"]),
  payerPhone: z.string().trim().refine(isValidCongoPhone, {
    message: "Numero de paiement invalide.",
  }),
  promoCode: z.string().trim().optional(),
});

export interface CheckoutState {
  error?: string;
  fieldErrors?: Record<string, string>;
}

export async function confirmAndPay(
  _prev: CheckoutState,
  formData: FormData,
): Promise<CheckoutState> {
  const parsed = schema.safeParse({
    reference: formData.get("reference"),
    fullName: formData.get("fullName"),
    phone: formData.get("phone"),
    email: formData.get("email") ?? "",
    provider: formData.get("provider"),
    payerPhone: formData.get("payerPhone"),
    promoCode: formData.get("promoCode") ?? "",
  });

  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = String(issue.path[0] ?? "form");
      fieldErrors[key] ??= issue.message;
    }
    return { error: "Verifiez les informations saisies.", fieldErrors };
  }

  const input = parsed.data;

  const booking = await prisma.booking.findUnique({
    where: { reference: input.reference },
    include: {
      showtime: true,
      seatHolds: { include: { seat: { include: { category: true } } } },
    },
  });

  if (!booking) {
    return { error: "Commande introuvable." };
  }

  if (booking.status === "PAID") {
    redirect(`/commande/${booking.reference}/billets`);
  }

  if (booking.status !== "PENDING" || booking.expiresAt.getTime() < Date.now()) {
    return {
      error:
        "Le delai de paiement est depasse et vos places ont ete liberees. Recommencez votre reservation.",
    };
  }

  if (booking.seatHolds.length === 0) {
    return {
      error: "Vos places ont ete liberees. Recommencez votre reservation.",
    };
  }

  // ---------------------------------------------------------------------
  // Tarif choisi pour chaque place
  // ---------------------------------------------------------------------
  const ticketTypes = await prisma.ticketType.findMany({ where: { active: true } });
  const typeById = new Map(ticketTypes.map((t) => [t.id, t]));

  const rules = (await prisma.priceRule.findMany({
    where: { active: true },
  })) as PricingRule[];

  const pricingContext = {
    cinemaId: booking.showtime.cinemaId,
    movieId: booking.showtime.movieId,
    startsAt: booking.showtime.startsAt,
    basePrice: booking.showtime.basePrice,
    isPremiere: booking.showtime.isPremiere,
  };

  const lines: {
    seatId: string;
    ticketTypeId: string;
    price: number;
  }[] = [];

  for (const hold of booking.seatHolds) {
    const chosen = String(formData.get(`ticketType_${hold.seatId}`) ?? "");
    const ticketType = typeById.get(chosen);

    if (!ticketType) {
      return {
        error: `Choisissez un tarif pour la place ${hold.seat.rowLabel}${hold.seat.number}.`,
      };
    }

    const breakdown = resolveSeatPrice(rules, pricingContext, {
      seatCategoryId: hold.seat.categoryId,
      seatCategoryModifier: hold.seat.category?.priceModifier ?? 0,
      ticketTypeId: ticketType.id,
    });

    lines.push({
      seatId: hold.seatId,
      ticketTypeId: ticketType.id,
      price: breakdown.amount,
    });
  }

  const subtotal = lines.reduce((sum, l) => sum + l.price, 0);

  // ---------------------------------------------------------------------
  // Code promo
  // ---------------------------------------------------------------------
  let discount = 0;
  let promoCodeId: string | null = null;

  if (input.promoCode) {
    const promo = await prisma.promoCode.findUnique({
      where: { code: input.promoCode.toUpperCase() },
    });

    const now = new Date();
    const usable =
      promo &&
      promo.active &&
      (!promo.startsAt || promo.startsAt <= now) &&
      (!promo.endsAt || promo.endsAt >= now) &&
      (promo.maxUses === null || promo.usedCount < promo.maxUses) &&
      (!promo.cinemaId || promo.cinemaId === booking.showtime.cinemaId) &&
      (!promo.movieId || promo.movieId === booking.showtime.movieId);

    if (!usable) {
      return {
        error: "Ce code promo n'est pas valide pour cette seance.",
        fieldErrors: { promoCode: "Code invalide ou expire." },
      };
    }

    discount = computeDiscount(subtotal, {
      type: promo.type,
      value: promo.value,
      minAmount: promo.minAmount,
    });

    if (discount === 0 && subtotal < promo.minAmount) {
      return {
        error: `Ce code s'applique a partir de ${promo.minAmount} FCFA d'achat.`,
        fieldErrors: { promoCode: "Montant minimum non atteint." },
      };
    }

    promoCodeId = promo.id;
  }

  const total = Math.max(0, subtotal - discount);

  // ---------------------------------------------------------------------
  // Enregistrement du panier fige, puis appel a l'operateur
  // ---------------------------------------------------------------------
  await prisma.$transaction(async (tx) => {
    await tx.bookingTicketLine.deleteMany({ where: { bookingId: booking.id } });
    await tx.bookingTicketLine.createMany({
      data: lines.map((l) => ({ ...l, bookingId: booking.id })),
    });

    await tx.booking.update({
      where: { id: booking.id },
      data: {
        subtotal,
        discount,
        total,
        promoCodeId,
        guestName: input.fullName,
        guestPhone: toE164(input.phone),
        guestEmail: input.email || null,
      },
    });
  });

  const externalRef = toAlphanumericReference(
    `${booking.reference}${Date.now().toString(36)}`.toUpperCase(),
  );

  const payment = await prisma.payment.create({
    data: {
      bookingId: booking.id,
      provider: input.provider,
      amount: total,
      msisdn: toE164(input.payerPhone),
      externalRef,
      status: "INITIATED",
    },
  });

  try {
    const gateway = getGateway(input.provider);
    const result = await gateway.initiate({
      amount: total,
      phone: input.payerPhone,
      reference: externalRef,
      description: `Culture Parc ${booking.reference}`,
    });

    await prisma.payment.update({
      where: { id: payment.id },
      data: {
        // MTN renvoie son propre identifiant : il remplace notre reference.
        externalRef: result.externalRef,
        status:
          result.status === "success"
            ? "SUCCESS"
            : result.status === "pending"
              ? "PENDING"
              : result.status === "ambiguous"
                ? "AMBIGUOUS"
                : result.status === "expired"
                  ? "EXPIRED"
                  : result.success
                    ? "PENDING"
                    : "FAILED",
        providerTxId: result.providerTxId ?? null,
        providerCode: result.providerCode ?? null,
        message: result.message,
        attempts: { increment: 1 },
        lastCheckedAt: new Date(),
        rawResponse: result.raw ? JSON.parse(JSON.stringify(result.raw)) : undefined,
      },
    });

    if (!result.success && result.status !== "pending") {
      return { error: result.message };
    }
  } catch (error) {
    console.error("Echec d'initiation du paiement", error);

    await prisma.payment.update({
      where: { id: payment.id },
      data: {
        status: "FAILED",
        message:
          error instanceof Error ? error.message : "Erreur technique inconnue.",
      },
    });

    return {
      error:
        "Le paiement n'a pas pu etre lance. Verifiez votre numero et reessayez.",
    };
  }

  redirect(`/commande/${booking.reference}/paiement?p=${payment.id}`);
}
