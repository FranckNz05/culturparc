/**
 * Passerelle de demonstration.
 *
 * Reproduit le rythme d'un vrai paiement mobile money : la demande part, le
 * client "confirme sur son telephone" pendant quelques secondes, puis la
 * transaction aboutit. Elle sert a derouler le tunnel complet, a former le
 * personnel et a faire une demonstration, sans identifiants operateur.
 *
 * Le dernier chiffre du numero payeur pilote le scenario, ce qui permet de
 * montrer aussi les cas d'echec :
 *
 *   ...0  solde insuffisant
 *   ...1  code PIN incorrect
 *   ...2  le client ne confirme pas, la demande expire
 *   autre paiement accepte apres quelques secondes
 *
 * Cette passerelle ne s'active que si PAYMENT_SIMULATION vaut "true".
 */

import { prisma } from "@/lib/prisma";
import { toNationalNumber } from "@/lib/phone";
import { toAlphanumericReference } from "@/lib/utils";
import type {
  GatewayResult,
  InitiatePaymentInput,
  PaymentGateway,
} from "./types";

/** Delai avant confirmation, assez long pour voir l'ecran d'attente. */
const CONFIRMATION_DELAY_MS = 6000;
/** Au-dela, le scenario "client qui ne repond pas" bascule en expiration. */
const EXPIRY_DELAY_MS = 20_000;

type Scenario = "SUCCESS" | "INSUFFICIENT_FUNDS" | "WRONG_PIN" | "NO_ANSWER";

/**
 * La simulation ne conserve aucun etat en memoire.
 *
 * Une premiere version gardait les paiements en cours dans une Map. Elle
 * echouait des le premier essai : l'initiation a lieu dans une Server Action et
 * le suivi dans une Route Handler, deux contextes de module distincts, et le
 * probleme se reproduirait de toute facon en production des qu'il y a plus
 * d'une instance. Tout est donc deduit du paiement enregistre en base : le
 * numero payeur donne le scenario, et sa date de creation donne l'avancement.
 */
function scenarioFor(msisdn: string): Scenario {
  switch (msisdn.slice(-1)) {
    case "0":
      return "INSUFFICIENT_FUNDS";
    case "1":
      return "WRONG_PIN";
    case "2":
      return "NO_ANSWER";
    default:
      return "SUCCESS";
  }
}

export function isSimulationEnabled(): boolean {
  return process.env.PAYMENT_SIMULATION === "true";
}

export class SimulationGateway implements PaymentGateway {
  readonly name = "SIMULATION";

  async initiate(input: InitiatePaymentInput): Promise<GatewayResult> {
    const externalRef = toAlphanumericReference(`SIM${input.reference}`);

    if (!Number.isInteger(input.amount) || input.amount <= 0) {
      return {
        success: false,
        status: "failed",
        message: "Le montant doit etre un entier positif de francs CFA.",
        externalRef,
      };
    }

    try {
      // Valide le numero des l'initiation, comme le ferait un vrai operateur.
      toNationalNumber(input.phone);
    } catch (error) {
      return {
        success: false,
        status: "failed",
        message:
          error instanceof Error ? error.message : "Numero de telephone invalide.",
        externalRef,
      };
    }

    return {
      success: true,
      status: "pending",
      message:
        "Mode demonstration : le paiement se confirme tout seul dans quelques secondes.",
      externalRef,
      providerCode: "SIMULATION",
      requiresUserAction: true,
      requiresPolling: true,
    };
  }

  async checkStatus(externalRef: string): Promise<GatewayResult> {
    const record = await prisma.payment.findUnique({
      where: { externalRef },
      select: { msisdn: true, createdAt: true },
    });

    if (!record) {
      return {
        success: false,
        status: "failed",
        message: "Paiement introuvable.",
        externalRef,
        providerCode: "SIMULATION",
      };
    }

    const payment = {
      scenario: scenarioFor(record.msisdn ?? ""),
      startedAt: record.createdAt.getTime(),
    };

    const elapsed = Date.now() - payment.startedAt;

    if (payment.scenario === "NO_ANSWER") {
      if (elapsed < EXPIRY_DELAY_MS) {
        return {
          success: true,
          status: "pending",
          message: "En attente de confirmation sur le telephone du client.",
          externalRef,
          providerCode: "SIMULATION",
          requiresUserAction: true,
          requiresPolling: true,
        };
      }
      return {
        success: false,
        status: "expired",
        message: "Le client n'a pas confirme le paiement a temps.",
        externalRef,
        providerCode: "SIMULATION",
      };
    }

    if (elapsed < CONFIRMATION_DELAY_MS) {
      return {
        success: true,
        status: "pending",
        message: "En attente de confirmation sur le telephone du client.",
        externalRef,
        providerCode: "SIMULATION",
        requiresUserAction: true,
        requiresPolling: true,
      };
    }


    switch (payment.scenario) {
      case "INSUFFICIENT_FUNDS":
        return {
          success: false,
          status: "failed",
          message: "Solde insuffisant pour completer cette transaction.",
          externalRef,
          providerCode: "SIMULATION",
        };
      case "WRONG_PIN":
        return {
          success: false,
          status: "failed",
          message: "Le code PIN saisi est incorrect. Reessayez.",
          externalRef,
          providerCode: "SIMULATION",
          retryable: true,
        };
      default:
        return {
          success: true,
          status: "success",
          message: "Paiement confirme (mode demonstration).",
          externalRef,
          providerTxId: `SIM-${externalRef.slice(-8)}`,
          providerCode: "SIMULATION",
        };
    }
  }
}
