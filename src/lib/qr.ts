/**
 * Billets : generation et verification du code QR.
 *
 * Le QR ne contient pas un simple identifiant : il porte une charge utile
 * chiffree et authentifiee en AES-256-GCM. Deux consequences pratiques :
 *
 *   - un billet ne peut pas etre fabrique ni modifie sans la cle du serveur,
 *     donc le controle a l'entree detecte une contrefacon avant meme d'ouvrir
 *     la base de donnees ;
 *   - le contenu du QR ne revele rien d'exploitable s'il est photographie.
 *
 * Le format est versionne ("CP1.") pour pouvoir changer d'algorithme plus tard
 * sans invalider les billets deja emis.
 */

import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

const VERSION = "CP1";
const IV_LENGTH = 12; // GCM standard
const TAG_LENGTH = 16;

export class InvalidTicketCodeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidTicketCodeError";
  }
}

/**
 * Cle de 32 octets, fournie en hexadecimal (64 caracteres) ou en base64.
 * A generer avec : openssl rand -hex 32
 */
function getKey(): Buffer {
  const raw = process.env.TICKET_QR_SECRET?.trim();

  if (!raw) {
    throw new Error(
      "TICKET_QR_SECRET manquant. Generez une cle avec : openssl rand -hex 32",
    );
  }

  let key: Buffer;
  if (/^[0-9a-fA-F]{64}$/.test(raw)) {
    key = Buffer.from(raw, "hex");
  } else {
    key = Buffer.from(raw, "base64");
  }

  if (key.length !== 32) {
    throw new Error(
      `TICKET_QR_SECRET doit faire 32 octets (256 bits), ${key.length} trouves.`,
    );
  }

  return key;
}

export interface TicketPayload {
  /** Identifiant du billet. */
  ticketId: string;
  /** Seance : permet de refuser un billet valable presente a la mauvaise salle. */
  showtimeId: string;
  /** Date d'emission, en secondes. */
  issuedAt: number;
}

function toBase64Url(buffer: Buffer): string {
  return buffer
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function fromBase64Url(value: string): Buffer {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/");
  return Buffer.from(padded, "base64");
}

/**
 * Produit le contenu textuel a encoder dans l'image QR.
 * Forme : CP1.<base64url(iv | tag | ciphertext)>
 */
export function encodeTicketPayload(payload: TicketPayload): string {
  const key = getKey();
  const iv = randomBytes(IV_LENGTH);

  const plaintext = JSON.stringify([
    payload.ticketId,
    payload.showtimeId,
    payload.issuedAt,
  ]);

  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();

  return `${VERSION}.${toBase64Url(Buffer.concat([iv, tag, ciphertext]))}`;
}

/**
 * Dechiffre et authentifie un code scanne.
 * Leve InvalidTicketCodeError si le code est illisible ou a ete altere.
 */
export function decodeTicketPayload(code: string): TicketPayload {
  if (typeof code !== "string" || !code.startsWith(`${VERSION}.`)) {
    throw new InvalidTicketCodeError("Code billet non reconnu.");
  }

  const body = fromBase64Url(code.slice(VERSION.length + 1));

  if (body.length <= IV_LENGTH + TAG_LENGTH) {
    throw new InvalidTicketCodeError("Code billet tronque.");
  }

  const iv = body.subarray(0, IV_LENGTH);
  const tag = body.subarray(IV_LENGTH, IV_LENGTH + TAG_LENGTH);
  const ciphertext = body.subarray(IV_LENGTH + TAG_LENGTH);

  const decipher = createDecipheriv("aes-256-gcm", getKey(), iv);
  decipher.setAuthTag(tag);

  let plaintext: string;
  try {
    plaintext = Buffer.concat([
      decipher.update(ciphertext),
      decipher.final(),
    ]).toString("utf8");
  } catch {
    // final() echoue des que le tag ne correspond pas : billet contrefait.
    throw new InvalidTicketCodeError("Billet invalide ou falsifie.");
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(plaintext);
  } catch {
    throw new InvalidTicketCodeError("Contenu du billet illisible.");
  }

  if (
    !Array.isArray(parsed) ||
    parsed.length !== 3 ||
    typeof parsed[0] !== "string" ||
    typeof parsed[1] !== "string" ||
    typeof parsed[2] !== "number"
  ) {
    throw new InvalidTicketCodeError("Structure du billet inattendue.");
  }

  return {
    ticketId: parsed[0],
    showtimeId: parsed[1],
    issuedAt: parsed[2],
  };
}

/**
 * Empreinte du code, stockee en base pour retrouver un billet sans avoir a
 * dechiffrer, et pour indexer les tentatives de scan.
 */
export function hashTicketCode(code: string): string {
  return createHash("sha256").update(code).digest("hex");
}
