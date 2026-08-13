import type { PaymentProvider } from "@/generated/prisma/enums";
import { AirtelMoneyGateway } from "./airtel";
import { MtnMomoGateway } from "./mtn";
import { isSimulationEnabled, SimulationGateway } from "./simulation";
import type { PaymentGateway } from "./types";

export * from "./types";
export { AirtelMoneyGateway, parseAirtelWebhook } from "./airtel";
export { MtnMomoGateway, parseMtnWebhook } from "./mtn";
export { isSimulationEnabled, SimulationGateway } from "./simulation";

/**
 * Renvoie la passerelle correspondant au moyen de paiement choisi par le
 * client. Le choix reste explicite : les plages de numeros evoluent et la
 * portabilite existe, donc on ne devine jamais l'operateur a sa place.
 */
export function getGateway(provider: PaymentProvider): PaymentGateway {
  // En demonstration, toutes les demandes passent par la passerelle simulee.
  // Le client voit exactement le meme tunnel, y compris le choix de
  // l'operateur : seule l'autorisation est jouee localement.
  if (isSimulationEnabled() && provider !== "CASH" && provider !== "SUBSCRIPTION") {
    return new SimulationGateway();
  }

  switch (provider) {
    case "AIRTEL_MONEY":
      return new AirtelMoneyGateway();
    case "MTN_MOMO":
      return new MtnMomoGateway();
    default:
      throw new Error(
        `Le moyen de paiement ${provider} ne passe pas par une passerelle en ligne.`,
      );
  }
}

/** Moyens de paiement en ligne proposes dans le tunnel. */
export const ONLINE_PROVIDERS = [
  {
    provider: "AIRTEL_MONEY" as const,
    label: "Airtel Money",
    hint: "Numeros 04 et 05",
  },
  {
    provider: "MTN_MOMO" as const,
    label: "MTN Mobile Money",
    hint: "Numeros 06",
  },
];
