import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getGateway } from "@/lib/payments";
import { finalizeBooking } from "@/lib/booking";
import type { PaymentStatus } from "@/generated/prisma/enums";
import type { GatewayStatus } from "@/lib/payments/types";

export const dynamic = "force-dynamic";

const STATUS_MAP: Record<GatewayStatus, PaymentStatus> = {
  initiated: "INITIATED",
  pending: "PENDING",
  ambiguous: "AMBIGUOUS",
  success: "SUCCESS",
  failed: "FAILED",
  expired: "EXPIRED",
  unknown: "PENDING",
};

/**
 * Interrogation du statut d'un paiement, appelee en boucle par la page
 * d'attente. Des que l'operateur confirme, les billets sont emis ici meme :
 * on ne depend donc pas de l'arrivee du webhook, qui peut etre retarde.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const payment = await prisma.payment.findUnique({
    where: { id },
    include: { booking: { select: { id: true, reference: true, status: true } } },
  });

  if (!payment) {
    return NextResponse.json({ error: "Paiement introuvable." }, { status: 404 });
  }

  // Deja confirme : on s'assure seulement que les billets existent.
  if (payment.status === "SUCCESS") {
    if (payment.booking.status !== "PAID") {
      await finalizeBooking(payment.bookingId).catch((error) => {
        console.error("Finalisation impossible apres succes", error);
      });
    }
    return NextResponse.json({
      status: "SUCCESS",
      message: "Paiement confirme.",
      reference: payment.booking.reference,
      done: true,
    });
  }

  if (["FAILED", "EXPIRED", "REFUNDED"].includes(payment.status)) {
    return NextResponse.json({
      status: payment.status,
      message: payment.message ?? "Le paiement n'a pas abouti.",
      reference: payment.booking.reference,
      done: true,
    });
  }

  // Toujours en attente : on redemande a l'operateur.
  let result;
  try {
    const gateway = getGateway(payment.provider);
    result = await gateway.checkStatus(payment.externalRef);
  } catch (error) {
    console.error("Verification du statut impossible", error);
    return NextResponse.json({
      status: payment.status,
      message: "Verification en cours...",
      reference: payment.booking.reference,
      done: false,
    });
  }

  const mapped = STATUS_MAP[result.status];

  const updated = await prisma.payment.update({
    where: { id: payment.id },
    data: {
      status: mapped,
      providerTxId: result.providerTxId ?? payment.providerTxId,
      providerCode: result.providerCode ?? payment.providerCode,
      message: result.message,
      attempts: { increment: 1 },
      lastCheckedAt: new Date(),
      paidAt: result.status === "success" ? new Date() : payment.paidAt,
    },
  });

  if (result.status === "success") {
    try {
      await finalizeBooking(payment.bookingId);
    } catch (error) {
      console.error("Paiement recu mais billets non emis", error);
      // Le paiement est encaisse : on ne le marque pas en echec, un operateur
      // doit reprendre la main sur cette commande.
      return NextResponse.json({
        status: "SUCCESS",
        message:
          "Paiement recu. L'emission de vos billets necessite une verification, presentez-vous a la caisse avec votre reference.",
        reference: payment.booking.reference,
        done: true,
        needsAttention: true,
      });
    }
  }

  const done = ["SUCCESS", "FAILED", "EXPIRED"].includes(updated.status);

  return NextResponse.json({
    status: updated.status,
    message: result.message,
    reference: payment.booking.reference,
    done,
  });
}
