import type { Metadata } from "next";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { ButtonLink } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { getSubscriptionPlans } from "@/lib/queries";
import { formatFcfa } from "@/lib/utils";

// Le choix de ville vit dans un cookie : le rendu ne peut pas etre mis en cache.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Abonnements",
  description:
    "Les formules d'abonnement Culture Parc : pass decouverte et pass illimite, valables dans tous nos cinemas.",
};

export default async function SubscriptionsPage() {
  const plans = await getSubscriptionPlans();

  return (
    <>
      <SiteHeader />

      <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-12">
        <div className="text-center">
          <h1 className="font-display text-3xl text-ink-50 sm:text-4xl">
            Abonnements
          </h1>
          <p className="mx-auto mt-3 max-w-xl text-sm text-ink-300">
            Venez plus souvent, payez moins. Nos formules sont valables dans les
            trois Culture Parc.
          </p>
        </div>

        {plans.length === 0 ? (
          <p className="mt-10 rounded-xl border border-dashed border-ink-700 p-10 text-center text-sm text-ink-300">
            Aucune formule disponible pour le moment.
          </p>
        ) : (
          <div className="mt-10 grid gap-5 sm:grid-cols-2">
            {plans.map((plan, index) => (
              <div
                key={plan.id}
                className={
                  index === 1
                    ? "rounded-2xl border-2 border-brand-500 bg-ink-900 p-6"
                    : "rounded-2xl border border-ink-700 bg-ink-900 p-6"
                }
              >
                {index === 1 && <Badge tone="brand">Le plus choisi</Badge>}

                <h2 className="mt-3 font-display text-2xl text-ink-50">
                  {plan.name}
                </h2>

                <p className="mt-2 font-display text-4xl text-brand-400">
                  {formatFcfa(plan.price)}
                </p>
                <p className="text-xs text-ink-400">
                  Valable {plan.durationDays} jours
                  {plan.credits > 0
                    ? ` - ${plan.credits} seances`
                    : " - seances illimitees"}
                </p>

                {plan.description && (
                  <p className="mt-4 text-sm text-ink-200">{plan.description}</p>
                )}

                {plan.perks.length > 0 && (
                  <ul className="mt-4 space-y-2 text-sm text-ink-200">
                    {plan.perks.map((perk) => (
                      <li key={perk} className="flex gap-2">
                        <span className="text-brand-500">&#10003;</span>
                        {perk}
                      </li>
                    ))}
                  </ul>
                )}

                <ButtonLink
                  href="/mon-compte"
                  variant={index === 1 ? "primary" : "secondary"}
                  className="mt-6 w-full"
                >
                  Souscrire
                </ButtonLink>
              </div>
            ))}
          </div>
        )}

        <p className="mx-auto mt-8 max-w-xl text-center text-xs text-ink-400">
          La souscription se fait en caisse ou depuis votre espace client. Le
          reglement s&apos;effectue par Airtel Money ou MTN Mobile Money.
        </p>
      </main>

      <SiteFooter />
    </>
  );
}
