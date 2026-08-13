import { cookies } from "next/headers";

const COOKIE_NAME = "cp_panier";
const COOKIE_MAX_AGE = 60 * 60 * 6; // 6 heures

/**
 * Identifiant du panier du visiteur.
 *
 * Il relie une selection de places a la personne qui l'a faite, sans exiger de
 * compte : c'est ce qui permet de reserver en tant qu'invite tout en gardant
 * ses propres places selectionnables lorsqu'on revient sur le plan.
 */
export async function getHoldKey(): Promise<string> {
  const store = await cookies();
  const existing = store.get(COOKIE_NAME)?.value;
  if (existing) return existing;

  return crypto.randomUUID();
}

/**
 * A appeler depuis une Server Action ou une Route Handler : seuls ces contextes
 * peuvent ecrire un cookie.
 */
export async function ensureHoldKey(): Promise<string> {
  const store = await cookies();
  const existing = store.get(COOKIE_NAME)?.value;
  if (existing) return existing;

  const key = crypto.randomUUID();
  store.set(COOKIE_NAME, key, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: COOKIE_MAX_AGE,
    path: "/",
  });
  return key;
}
