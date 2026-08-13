/**
 * Contrat commun aux passerelles mobile money.
 * Les statuts reprennent ceux du schema Prisma (PaymentStatus).
 */

export type GatewayStatus =
  | "initiated"
  | "pending"
  | "ambiguous"
  | "success"
  | "failed"
  | "expired"
  | "unknown";

export interface InitiatePaymentInput {
  /** Montant entier en FCFA. */
  amount: number;
  /** Numero payeur, dans n'importe quel format congolais. */
  phone: string;
  /** Reference interne de la commande (sera nettoyee si l'operateur l'exige). */
  reference: string;
  /** Libelle presente au payeur quand l'operateur le permet. */
  description?: string;
}

export interface GatewayResult {
  success: boolean;
  status: GatewayStatus;
  message: string;
  /** Reference telle qu'envoyee a l'operateur ; sert a interroger le statut. */
  externalRef: string;
  /** Identifiant cote operateur (airtel_money_id, financialTransactionId). */
  providerTxId?: string | null;
  /** Code brut de l'operateur, ex. DP00800001001. */
  providerCode?: string | null;
  /** Vrai quand le client doit encore valider sur son telephone. */
  requiresUserAction?: boolean;
  /** Vrai quand seul un nouvel appel de statut permettra de trancher. */
  requiresPolling?: boolean;
  /** Vrai quand une nouvelle tentative de paiement a du sens. */
  retryable?: boolean;
  raw?: unknown;
}

export interface PaymentGateway {
  readonly name: string;
  initiate(input: InitiatePaymentInput): Promise<GatewayResult>;
  checkStatus(externalRef: string): Promise<GatewayResult>;
}

/** Statuts au-dela desquels plus rien ne bougera. */
export const TERMINAL_STATUSES: GatewayStatus[] = [
  "success",
  "failed",
  "expired",
];

export function isTerminal(status: GatewayStatus): boolean {
  return TERMINAL_STATUSES.includes(status);
}
