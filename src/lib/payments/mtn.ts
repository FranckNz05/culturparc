/**
 * MTN Mobile Money - API Collection (requestToPay).
 *
 * Deux differences structurantes avec Airtel :
 *
 * 1. La reference envoyee a MTN (`X-Reference-Id`) doit etre un UUID v4, et
 *    c'est cet UUID, pas notre reference de commande, qui sert ensuite a
 *    interroger le statut. On le conserve donc dans Payment.externalRef, et la
 *    reference lisible de la commande part dans `externalId`.
 * 2. `requestToPay` repond 202 avec un corps vide : l'acceptation ne vaut pas
 *    paiement. Le statut reel s'obtient uniquement par un appel de suivi ou par
 *    le callback.
 */

import { toMtnMsisdn } from "@/lib/phone";
import type {
  GatewayResult,
  GatewayStatus,
  InitiatePaymentInput,
  PaymentGateway,
} from "./types";

interface MtnConfig {
  baseUrl: string;
  targetEnvironment: string;
  subscriptionKey: string;
  apiUser: string;
  apiKey: string;
  callbackUrl: string;
  currency: string;
}

function loadConfig(): MtnConfig {
  const targetEnvironment =
    process.env.MTN_MOMO_TARGET_ENVIRONMENT?.trim() || "sandbox";

  return {
    baseUrl: (
      process.env.MTN_MOMO_BASE_URL?.trim() ||
      "https://sandbox.momodeveloper.mtn.com"
    ).replace(/\/+$/, ""),
    targetEnvironment,
    subscriptionKey: process.env.MTN_MOMO_COLLECTION_SUBSCRIPTION_KEY?.trim() ?? "",
    apiUser: process.env.MTN_MOMO_API_USER?.trim() ?? "",
    apiKey: process.env.MTN_MOMO_API_KEY?.trim() ?? "",
    callbackUrl: process.env.MTN_MOMO_CALLBACK_URL?.trim() ?? "",
    // En sandbox MTN n'accepte que EUR ; en production c'est XAF au Congo.
    currency:
      process.env.MTN_MOMO_CURRENCY?.trim() ||
      (targetEnvironment === "sandbox" ? "EUR" : "XAF"),
  };
}

const HTTP_TIMEOUT_MS = 30_000;

async function fetchWithTimeout(
  url: string,
  init: RequestInit,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), HTTP_TIMEOUT_MS);
  try {
    return await fetch(url, { ...init, signal: controller.signal, cache: "no-store" });
  } finally {
    clearTimeout(timer);
  }
}

/**
 * MTN valide payerMessage et payeeNote contre /^[ 0-9a-zA-Z\-_]+$/ et coupe
 * a 160 caracteres. Les accents et la ponctuation font echouer l'appel.
 */
function sanitizeMessage(message: string, fallback: string): string {
  const cleaned = message
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^ 0-9a-zA-Z\-_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  return (cleaned || fallback).slice(0, 160);
}

let tokenCache: { token: string; expiresAt: number } | null = null;

async function getAccessToken(config: MtnConfig): Promise<string> {
  if (tokenCache && tokenCache.expiresAt > Date.now() + 30_000) {
    return tokenCache.token;
  }

  if (!config.subscriptionKey || !config.apiUser || !config.apiKey) {
    throw new Error(
      "Configuration MTN MoMo incomplete : MTN_MOMO_COLLECTION_SUBSCRIPTION_KEY, MTN_MOMO_API_USER et MTN_MOMO_API_KEY sont requis.",
    );
  }

  const basic = Buffer.from(`${config.apiUser}:${config.apiKey}`).toString(
    "base64",
  );

  const response = await fetchWithTimeout(`${config.baseUrl}/collection/token/`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${basic}`,
      "Ocp-Apim-Subscription-Key": config.subscriptionKey,
    },
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(
      `Authentification MTN MoMo refusee (HTTP ${response.status}). Reponse : ${body.slice(0, 200)}`,
    );
  }

  const data = (await response.json()) as {
    access_token?: string;
    expires_in?: number;
  };

  if (!data.access_token) {
    throw new Error("MTN MoMo n'a pas retourne de token d'acces.");
  }

  const expiresIn = Number(data.expires_in ?? 3600);
  tokenCache = {
    token: data.access_token,
    expiresAt: Date.now() + expiresIn * 1000,
  };

  return data.access_token;
}

const STATUS_MAP: Record<string, GatewayStatus> = {
  SUCCESSFUL: "success",
  SUCCESS: "success",
  COMPLETED: "success",
  PENDING: "pending",
  FAILED: "failed",
  REJECTED: "failed",
  TIMEOUT: "expired",
};

/**
 * Messages des motifs d'echec les plus frequents cote MTN.
 */
const REASON_MESSAGES: Record<string, string> = {
  PAYER_NOT_FOUND: "Ce numero n'est pas inscrit a MTN Mobile Money.",
  PAYEE_NOT_ALLOWED_TO_RECEIVE: "Le compte marchand ne peut pas recevoir ce paiement.",
  NOT_ENOUGH_FUNDS: "Solde insuffisant pour completer cette transaction.",
  PAYER_LIMIT_REACHED: "Vous avez atteint la limite autorisee sur votre compte.",
  TRANSACTION_CANCELED: "Le paiement a ete annule.",
  EXPIRED: "La demande de paiement a expire.",
  APPROVAL_REJECTED: "Vous avez refuse la demande de paiement.",
  INTERNAL_PROCESSING_ERROR: "Erreur interne chez MTN. Reessayez dans un instant.",
};

export class MtnMomoGateway implements PaymentGateway {
  readonly name = "MTN_MOMO";

  private config: MtnConfig;

  constructor(config?: Partial<MtnConfig>) {
    this.config = { ...loadConfig(), ...config };
  }

  async initiate(input: InitiatePaymentInput): Promise<GatewayResult> {
    // C'est cet UUID qui identifiera la transaction chez MTN.
    const referenceId = crypto.randomUUID();

    if (!Number.isInteger(input.amount) || input.amount <= 0) {
      return {
        success: false,
        status: "failed",
        message: "Le montant doit etre un entier positif de francs CFA.",
        externalRef: referenceId,
      };
    }

    let msisdn: string;
    try {
      msisdn = toMtnMsisdn(input.phone);
    } catch (error) {
      return {
        success: false,
        status: "failed",
        message:
          error instanceof Error ? error.message : "Numero de telephone invalide.",
        externalRef: referenceId,
      };
    }

    const token = await getAccessToken(this.config);

    const label = sanitizeMessage(
      input.description ?? `Culture Parc ${input.reference}`,
      "Culture Parc",
    );

    const payload = {
      amount: String(input.amount),
      currency: this.config.currency,
      // Notre reference lisible voyage ici, puisque X-Reference-Id doit etre un UUID.
      externalId: input.reference,
      payer: {
        partyIdType: "MSISDN",
        partyId: msisdn,
      },
      payerMessage: label,
      payeeNote: label,
    };

    const headers: Record<string, string> = {
      Authorization: `Bearer ${token}`,
      "X-Reference-Id": referenceId,
      "X-Target-Environment": this.config.targetEnvironment,
      "Content-Type": "application/json",
      "Ocp-Apim-Subscription-Key": this.config.subscriptionKey,
    };

    if (this.config.callbackUrl) {
      headers["X-Callback-Url"] = this.config.callbackUrl;
    }

    const response = await fetchWithTimeout(
      `${this.config.baseUrl}/collection/v1_0/requesttopay`,
      {
        method: "POST",
        headers,
        body: JSON.stringify(payload),
      },
    );

    // 202 Accepted, corps vide : la demande est partie, rien n'est encore paye.
    if ([200, 201, 202, 204].includes(response.status)) {
      return {
        success: true,
        status: "pending",
        message:
          "Confirmez le paiement sur votre telephone en saisissant votre code PIN.",
        externalRef: referenceId,
        requiresUserAction: true,
        requiresPolling: true,
      };
    }

    const body = await response.text();
    return {
      success: false,
      status: "failed",
      message: `MTN MoMo a refuse la demande (HTTP ${response.status}).`,
      externalRef: referenceId,
      retryable: response.status >= 500,
      raw: body.slice(0, 500),
    };
  }

  async checkStatus(externalRef: string): Promise<GatewayResult> {
    const token = await getAccessToken(this.config);

    const response = await fetchWithTimeout(
      `${this.config.baseUrl}/collection/v1_0/requesttopay/${encodeURIComponent(externalRef)}`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
          "X-Target-Environment": this.config.targetEnvironment,
          "Ocp-Apim-Subscription-Key": this.config.subscriptionKey,
          Accept: "application/json",
        },
      },
    );

    if (!response.ok) {
      const body = await response.text();
      return {
        success: false,
        status: response.status === 404 ? "failed" : "unknown",
        message:
          response.status === 404
            ? "Transaction introuvable chez MTN."
            : `Statut MTN indisponible (HTTP ${response.status}).`,
        externalRef,
        retryable: response.status >= 500,
        raw: body.slice(0, 500),
      };
    }

    const data = (await response.json().catch(() => ({}))) as {
      status?: string;
      reason?: string | { code?: string; message?: string };
      financialTransactionId?: string;
    };

    const rawStatus = (data.status ?? "").toUpperCase();
    const status = STATUS_MAP[rawStatus] ?? "unknown";

    const reasonCode =
      typeof data.reason === "string" ? data.reason : data.reason?.code;

    let message: string;
    if (status === "success") {
      message = "Paiement confirme.";
    } else if (status === "pending") {
      message = "Paiement en attente de votre confirmation.";
    } else if (reasonCode && REASON_MESSAGES[reasonCode]) {
      message = REASON_MESSAGES[reasonCode];
    } else {
      message = "Le paiement n'a pas abouti.";
    }

    return {
      success: status === "success",
      status,
      message,
      externalRef,
      providerTxId: data.financialTransactionId ?? null,
      providerCode: reasonCode ?? rawStatus ?? null,
      requiresPolling: status === "pending",
      raw: data,
    };
  }
}

/**
 * Traduit un callback MTN. Le corps reprend la forme de la reponse de statut,
 * avec en plus l'externalId que nous avons envoye.
 */
export function parseMtnWebhook(payload: Record<string, unknown>): {
  status: GatewayStatus;
  externalRef: string | null;
  providerTxId: string | null;
  providerCode: string | null;
  message: string;
} {
  const rawStatus = String(payload.status ?? "").toUpperCase();
  const status = STATUS_MAP[rawStatus] ?? "unknown";

  const reason = payload.reason;
  const reasonCode =
    typeof reason === "string"
      ? reason
      : ((reason as { code?: string } | undefined)?.code ?? null);

  return {
    status,
    // MTN renvoie l'UUID dans referenceId selon les tenants ; externalId porte
    // notre reference de commande en secours.
    externalRef:
      (payload.referenceId as string | undefined) ??
      (payload.externalId as string | undefined) ??
      null,
    providerTxId: (payload.financialTransactionId as string | undefined) ?? null,
    providerCode: reasonCode,
    message:
      status === "success"
        ? "Paiement confirme."
        : (reasonCode && REASON_MESSAGES[reasonCode]) ||
          "Notification MTN MoMo recue.",
  };
}

export function resetMtnTokenCache(): void {
  tokenCache = null;
}
