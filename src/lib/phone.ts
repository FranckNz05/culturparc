/**
 * Numeros de telephone de la Republique du Congo (+242).
 *
 * Particularite locale a ne pas perdre de vue : le 0 initial fait partie
 * integrante du numero, y compris au format international. Un numero congolais
 * s'ecrit +242 06 110 92 01, soit l'indicatif 242 suivi de NEUF chiffres
 * commencant par 0. Supprimer ce 0 apres l'indicatif, comme on le ferait en
 * France, produit un numero invalide que les operateurs rejettent.
 */

export const CONGO_COUNTRY_CODE = "242";
export const NATIONAL_NUMBER_LENGTH = 9;

export type MobileOperator = "AIRTEL" | "MTN" | "UNKNOWN";

/**
 * Prefixes indicatifs, surchargeables sans redeploiement car les plages sont
 * reattribuees de temps en temps par l'ARPCE.
 */
const AIRTEL_PREFIXES = (process.env.AIRTEL_PREFIXES ?? "04,05").split(",").map((p) => p.trim());
const MTN_PREFIXES = (process.env.MTN_PREFIXES ?? "06").split(",").map((p) => p.trim());

export class InvalidPhoneError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidPhoneError";
  }
}

/** Ne garde que les chiffres. */
function digitsOnly(input: string): string {
  return input.replace(/\D+/g, "");
}

/**
 * Ramene une saisie quelconque au numero national a 9 chiffres, 0 compris.
 *
 * Accepte "06 110 92 01", "+242 06 110 92 01", "00242061109201", "242061109201".
 */
export function toNationalNumber(input: string): string {
  let digits = digitsOnly(input ?? "");

  if (digits.length === 0) {
    throw new InvalidPhoneError("Le numero de telephone est requis.");
  }

  // Prefixe international compose : 00242...
  if (digits.startsWith("00" + CONGO_COUNTRY_CODE)) {
    digits = digits.slice(2 + CONGO_COUNTRY_CODE.length);
  } else if (digits.startsWith(CONGO_COUNTRY_CODE)) {
    // Attention : on ne retire l'indicatif que s'il reste bien 9 chiffres
    // derriere. Sinon "242..." pourrait etre le debut d'un numero national.
    const rest = digits.slice(CONGO_COUNTRY_CODE.length);
    if (rest.length === NATIONAL_NUMBER_LENGTH) {
      digits = rest;
    }
  }

  if (digits.length !== NATIONAL_NUMBER_LENGTH) {
    throw new InvalidPhoneError(
      `Numero invalide : ${NATIONAL_NUMBER_LENGTH} chiffres attendus (ex. 06 110 92 01), ${digits.length} recus.`,
    );
  }

  if (!digits.startsWith("0")) {
    throw new InvalidPhoneError(
      "Un numero congolais commence par 0 (04, 05 ou 06), meme au format international.",
    );
  }

  return digits;
}

/** "+242061109201" */
export function toE164(input: string): string {
  return `+${CONGO_COUNTRY_CODE}${toNationalNumber(input)}`;
}

/**
 * MSISDN attendu par l'API Airtel : le numero national, sans indicatif pays,
 * donc avec son 0 initial.
 */
export function toAirtelMsisdn(input: string): string {
  return toNationalNumber(input);
}

/**
 * MSISDN attendu par MTN MoMo : numero complet avec indicatif, sans le +.
 */
export function toMtnMsisdn(input: string): string {
  return `${CONGO_COUNTRY_CODE}${toNationalNumber(input)}`;
}

/** "06 110 92 01" */
export function formatNationalDisplay(input: string): string {
  const n = toNationalNumber(input);
  return `${n.slice(0, 2)} ${n.slice(2, 5)} ${n.slice(5, 7)} ${n.slice(7, 9)}`;
}

/**
 * Detection indicative de l'operateur, utilisee seulement pour preselectionner
 * un moyen de paiement. Le client garde toujours la main sur le choix final :
 * les plages de numeros changent et une portabilite est toujours possible.
 */
export function detectOperator(input: string): MobileOperator {
  let national: string;
  try {
    national = toNationalNumber(input);
  } catch {
    return "UNKNOWN";
  }

  const prefix = national.slice(0, 2);
  if (AIRTEL_PREFIXES.includes(prefix)) return "AIRTEL";
  if (MTN_PREFIXES.includes(prefix)) return "MTN";
  return "UNKNOWN";
}

/** Validation souple pour les formulaires : ne leve pas d'exception. */
export function isValidCongoPhone(input: string): boolean {
  try {
    toNationalNumber(input);
    return true;
  } catch {
    return false;
  }
}
