"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { isValidCongoPhone, toE164 } from "@/lib/phone";

const schema = z.object({
  reference: z
    .string()
    .trim()
    .transform((v) => v.toUpperCase())
    .refine((v) => v.length > 0, "Indiquez la reference de votre commande."),
  phone: z.string().trim().refine(isValidCongoPhone, {
    message: "Numero invalide. Format attendu : 06 110 92 01.",
  }),
});

export interface LookupState {
  error?: string;
}

/**
 * Retrouve une commande sans compte, avec la reference et le telephone.
 *
 * La reference seule (six caracteres, alphabet sans ambiguite) suffirait
 * techniquement a retrouver le billet, mais elle circule par SMS et par
 * l'historique du navigateur : quiconque la voit ne doit pas pouvoir en
 * deduire les places de quelqu'un d'autre. Le telephone verifie que la
 * personne qui demande est bien celle qui a reserve.
 */
export async function lookupBooking(
  _prev: LookupState,
  formData: FormData,
): Promise<LookupState> {
  const parsed = schema.safeParse({
    reference: formData.get("reference"),
    phone: formData.get("phone"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Formulaire invalide." };
  }

  const reference = parsed.data.reference.startsWith("CP-")
    ? parsed.data.reference
    : `CP-${parsed.data.reference}`;

  const phone = toE164(parsed.data.phone);

  const booking = await prisma.booking.findUnique({
    where: { reference },
    include: { user: { select: { phone: true } } },
  });

  // Le meme message sert a "commande introuvable" et a "telephone incorrect" :
  // distinguer les deux renseignerait un tiers sur l'existence d'une reference
  // qu'il aurait devinee.
  const genericError =
    "Aucune commande ne correspond a cette reference et ce numero. Verifiez les deux et reessayez.";

  if (!booking) {
    return { error: genericError };
  }

  const knownPhone = booking.user?.phone ?? booking.guestPhone;
  if (!knownPhone || knownPhone !== phone) {
    return { error: genericError };
  }

  if (booking.status !== "PAID") {
    return {
      error:
        "Cette commande n'a pas ete payee. Si le paiement est en cours, reprenez-le depuis le lien recu au moment de la reservation.",
    };
  }

  redirect(`/commande/${booking.reference}/billets`);
}
