/**
 * Airtel Money Congo - collecte par USSD push.
 *
 * Portage direct de l'integration deja eprouvee en production sur MokiliEvent.
 * Deux regles apprises la-bas et conservees ici :
 *
 * 1. La reference doit etre strictement alphanumerique. Un tiret suffit a
 *    declencher un DP00800001005 ("Transaction ID is invalid") plus tard, au
 *    moment de la verification de statut.
 * 2. La MEME reference nettoyee doit servir a la fois pour `reference` et pour
 *    `transaction.id`, sinon on ne retrouve plus la transaction.
 *
 * Le resultat se lit sur `status.response_code`, jamais sur `transaction.status`
 * de la reponse d'initiation : ce dernier vaut souvent TS alors que le client
 * n'a pas encore saisi son code PIN.
 */

import { toAirtelMsisdn } from "@/lib/phone";
import { toAlphanumericReference } from "@/lib/utils";
import type {
  GatewayResult,
  GatewayStatus,
  InitiatePaymentInput,
  PaymentGateway,
} from "./types";

interface AirtelCodeInfo {
  status: GatewayStatus;
  message: string;
  retryable: boolean;
  requiresUserAction?: boolean;
  requiresPolling?: boolean;
}

/** Codes de collecte (serie DP0080). */
const CODE_MAP: Record<string, AirtelCodeInfo> = {
  DP00800001000: {
    status: "ambiguous",
    message:
      "Transaction en cours de verification aupres d'Airtel. Merci de patienter.",
    retryable: true,
    requiresPolling: true,
  },
  DP00800001001: {
    status: "success",
    message: "Paiement confirme.",
    retryable: false,
  },
  DP00800001002: {
    status: "failed",
    message: "Le code PIN saisi est incorrect. Reessayez avec le bon PIN.",
    retryable: true,
  },
  DP00800001003: {
    status: "failed",
    message: "Vous avez depasse la limite autorisee sur votre portefeuille.",
    retryable: false,
  },
  DP00800001004: {
    status: "failed",
    message: "Montant invalide : il est inferieur au minimum autorise.",
    retryable: false,
  },
  DP00800001005: {
    status: "expired",
    message: "La transaction a expire ou son identifiant est invalide.",
    retryable: false,
  },
  DP00800001006: {
    status: "pending",
    message:
      "Confirmez le paiement sur votre telephone en saisissant votre code PIN.",
    retryable: true,
    requiresUserAction: true,
  },
  DP00800001007: {
    status: "failed",
    message: "Solde insuffisant pour completer cette transaction.",
    retryable: false,
  },
  DP00800001008: {
    status: "failed",
    message: "La transaction a ete refusee.",
    retryable: false,
  },
  DP00800001010: {
    status: "failed",
    message:
      "Le portefeuille est bloque ou le numero n'est pas inscrit a Airtel Money.",
    retryable: false,
  },
  DP00800001024: {
    status: "failed",
    message: "La transaction a expire faute de reponse.",
    retryable: true,
  },
  DP00800001025: {
    status: "failed",
    message: "Transaction introuvable.",
    retryable: false,
  },
  DP00800001026: {
    status: "failed",
    message: "Signature invalide.",
    retryable: false,
  },
  DP00800001029: {
    status: "expired",
    message: "La transaction a expire.",
    retryable: false,
  },
};

/** Statuts renvoyes par l'endpoint de verification. */
const TRANSACTION_STATUS_MAP: Record<string, GatewayStatus> = {
  TS: "success", // Transaction Success
  TF: "failed", // Transaction Failed
  TA: "ambiguous", // Transaction Ambiguous
  TIP: "pending", // Transaction In Progress
  TE: "expired", // Transaction Expired
};

const SUCCESS_CODE = "DP00800001001";

/** Montant minimum accepte par Airtel Money Congo. */
const MIN_AMOUNT = 100;

interface AirtelConfig {
  baseUrl: string;
  clientId: string;
  clientSecret: string;
  country: string;
  currency: string;
}

function loadConfig(): AirtelConfig {
  const production = process.env.AIRTEL_PRODUCTION === "true";
  const baseUrl =
    process.env.AIRTEL_BASE_URL?.trim() ||
    (production ? "https://openapi.airtel.cg" : "https://openapiuat.airtel.cg");

  return {
    baseUrl: baseUrl.replace(/\/+$/, ""),
    clientId: process.env.AIRTEL_CLIENT_ID?.trim() ?? "",
    clientSecret: process.env.AIRTEL_CLIENT_SECRET?.trim() ?? "",
    country: process.env.AIRTEL_COUNTRY?.trim() || "CG",
    currency: process.env.AIRTEL_CURRENCY?.trim() || "XAF",
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

/** Cache memoire du token : il vit assez longtemps pour couvrir un tunnel. */
let tokenCache: { token: string; expiresAt: number } | null = null;

async function getAccessToken(config: AirtelConfig): Promise<string> {
  if (tokenCache && tokenCache.expiresAt > Date.now() + 30_000) {
    return tokenCache.token;
  }

  if (!config.clientId || !config.clientSecret) {
    throw new Error(
      "Configuration Airtel incomplete : AIRTEL_CLIENT_ID et AIRTEL_CLIENT_SECRET sont requis.",
    );
  }

  const response = await fetchWithTimeout(`${config.baseUrl}/auth/oauth2/token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
    },
    body: new URLSearchParams({
      grant_type: "client_credentials",
      client_id: config.clientId,
      client_secret: config.clientSecret,
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    // Erreur classique : identifiants de production sur l'URL UAT (ou l'inverse).
    throw new Error(
      `Authentification Airtel refusee (HTTP ${response.status}) sur ${config.baseUrl}. ` +
        `Verifiez AIRTEL_PRODUCTION et les identifiants. Reponse : ${body.slice(0, 200)}`,
    );
  }

  const data = (await response.json()) as {
    access_token?: string;
    expires_in?: number;
  };

  if (!data.access_token) {
    throw new Error("Airtel n'a pas retourne de token d'acces.");
  }

  const expiresIn = Number(data.expires_in ?? 3600);
  tokenCache = {
    token: data.access_token,
    expiresAt: Date.now() + expiresIn * 1000,
  };

  return data.access_token;
}

function describeCode(code: string | null | undefined): AirtelCodeInfo {
  if (code && CODE_MAP[code]) return CODE_MAP[code];
  return {
    status: "unknown",
    message: "Statut de la transaction inconnu.",
    retryable: false,
  };
}

interface AirtelEnvelope {
  data?: {
    transaction?: {
      id?: string;
      status?: string;
      airtel_money_id?: string;
      message?: string;
    };
  };
  status?: {
    response_code?: string;
    result_code?: string;
    code?: string;
    success?: boolean;
    message?: string;
  };
}

function extractCode(payload: AirtelEnvelope): string | null {
  return payload.status?.response_code ?? payload.status?.result_code ?? null;
}

export class AirtelMoneyGateway implements PaymentGateway {
  readonly name = "AIRTEL_MONEY";

  private config: AirtelConfig;

  constructor(config?: Partial<AirtelConfig>) {
    this.config = { ...loadConfig(), ...config };
  }

  async initiate(input: InitiatePaymentInput): Promise<GatewayResult> {
    const reference = toAlphanumericReference(input.reference);

    // Validations locales : elles evitent un aller-retour reseau et rendent le
    // message d'erreur exploitable par le client.
    if (!Number.isInteger(input.amount)) {
      return {
        success: false,
        status: "failed",
        message: "Le montant doit etre un nombre entier de francs CFA.",
        externalRef: reference,
      };
    }
    if (input.amount <= 0) {
      return {
        success: false,
        status: "failed",
        message: "Le montant doit etre superieur a zero.",
        externalRef: reference,
      };
    }
    if (input.amount < MIN_AMOUNT) {
      return {
        success: false,
        status: "failed",
        message: `Le montant minimum accepte par Airtel Money est de ${MIN_AMOUNT} FCFA.`,
        externalRef: reference,
        providerCode: "DP00800001004",
      };
    }

    let msisdn: string;
    try {
      msisdn = toAirtelMsisdn(input.phone);
    } catch (error) {
      return {
        success: false,
        status: "failed",
        message:
          error instanceof Error ? error.message : "Numero de telephone invalide.",
        externalRef: reference,
      };
    }

    const token = await getAccessToken(this.config);

    // `reference` et `transaction.id` doivent porter exactement la meme valeur.
    const payload = {
      reference,
      subscriber: {
        country: this.config.country,
        currency: this.config.currency,
        msisdn,
      },
      transaction: {
        amount: input.amount,
        country: this.config.country,
        currency: this.config.currency,
        id: reference,
      },
    };

    const response = await fetchWithTimeout(
      `${this.config.baseUrl}/merchant/v1/payments/`,
      {
        method: "POST",
        headers: {
          Accept: "*/*",
          "Content-Type": "application/json",
          "X-Country": this.config.country,
          "X-Currency": this.config.currency,
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      },
    );

    const body = (await response.json().catch(() => ({}))) as AirtelEnvelope;
    const code = extractCode(body);
    const info = describeCode(code);
    const transaction = body.data?.transaction;

    if (!response.ok) {
      return {
        success: false,
        status: info.status === "unknown" ? "failed" : info.status,
        message: info.message,
        externalRef: reference,
        providerTxId: transaction?.airtel_money_id ?? null,
        providerCode: code,
        retryable: info.retryable,
        raw: body,
      };
    }

    // On ne se fie qu'au response_code : transaction.status vaut souvent TS
    // avant meme que le client ait saisi son PIN.
    const isSuccess = code === SUCCESS_CODE;

    return {
      success: isSuccess || info.status === "pending" || info.status === "ambiguous",
      status: info.status,
      message: info.message,
      externalRef: reference,
      providerTxId: transaction?.airtel_money_id ?? null,
      providerCode: code,
      requiresUserAction: info.requiresUserAction,
      requiresPolling: info.requiresPolling,
      retryable: info.retryable,
      raw: body,
    };
  }

  async checkStatus(externalRef: string): Promise<GatewayResult> {
    const reference = toAlphanumericReference(externalRef);
    const token = await getAccessToken(this.config);

    const response = await fetchWithTimeout(
      `${this.config.baseUrl}/standard/v1/payments/${encodeURIComponent(reference)}`,
      {
        method: "GET",
        headers: {
          Accept: "*/*",
          "X-Country": this.config.country,
          "X-Currency": this.config.currency,
          Authorization: `Bearer ${token}`,
        },
      },
    );

    const body = (await response.json().catch(() => ({}))) as AirtelEnvelope;
    const code = extractCode(body);
    const transaction = body.data?.transaction;

    if (!response.ok) {
      const info = describeCode(code);
      return {
        success: false,
        status: info.status,
        message: info.message,
        externalRef: reference,
        providerTxId: transaction?.airtel_money_id ?? null,
        providerCode: code,
        retryable: info.retryable,
        raw: body,
      };
    }

    // Ici, a l'inverse de l'initiation, transaction.status fait autorite.
    const airtelStatus = transaction?.status ?? null;
    if (airtelStatus && TRANSACTION_STATUS_MAP[airtelStatus]) {
      const status = TRANSACTION_STATUS_MAP[airtelStatus];
      const info = describeCode(code);
      return {
        success: status === "success",
        status,
        message:
          status === "success"
            ? "Paiement confirme."
            : transaction?.message || info.message,
        externalRef: reference,
        providerTxId: transaction?.airtel_money_id ?? null,
        providerCode: code,
        requiresPolling: status === "ambiguous" || status === "pending",
        raw: body,
      };
    }

    // Pas de statut exploitable : on retombe sur le code de reponse.
    const info = describeCode(code);
    return {
      success: code === SUCCESS_CODE,
      status: info.status,
      message: info.message,
      externalRef: reference,
      providerTxId: transaction?.airtel_money_id ?? null,
      providerCode: code,
      requiresPolling: info.requiresPolling,
      retryable: info.retryable,
      raw: body,
    };
  }
}

/**
 * Traduit un webhook Airtel en statut interne.
 * Airtel poste sur l'URL de callback declaree dans la console partenaire.
 */
export function parseAirtelWebhook(payload: Record<string, unknown>): {
  status: GatewayStatus;
  externalRef: string | null;
  providerTxId: string | null;
  providerCode: string | null;
  message: string;
} {
  const transaction = (payload.transaction ?? {}) as Record<string, unknown>;

  const code =
    (payload.result_code as string | undefined) ??
    (transaction.status_code as string | undefined) ??
    null;

  const externalRef =
    (transaction.id as string | undefined) ??
    (payload.transaction_id as string | undefined) ??
    (payload.reference as string | undefined) ??
    null;

  const rawStatus = transaction.status as string | undefined;

  let status: GatewayStatus = "unknown";
  if (code && CODE_MAP[code]) {
    status = CODE_MAP[code].status;
  } else if (rawStatus && TRANSACTION_STATUS_MAP[rawStatus]) {
    status = TRANSACTION_STATUS_MAP[rawStatus];
  }

  return {
    status,
    externalRef,
    providerTxId: (transaction.airtel_money_id as string | undefined) ?? null,
    providerCode: code,
    message: code ? describeCode(code).message : "Notification Airtel recue.",
  };
}

/** Reinitialise le cache de token (utile en test). */
export function resetAirtelTokenCache(): void {
  tokenCache = null;
}
