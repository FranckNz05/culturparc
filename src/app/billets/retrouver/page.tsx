import type { Metadata } from "next";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { LookupForm } from "./lookup-form";

export const metadata: Metadata = {
  title: "Retrouver mes billets",
  description:
    "Retrouvez vos billets Culture Parc avec votre reference de commande et votre numero de telephone.",
};

export default function RetrieveTicketsPage() {
  return (
    <>
      <SiteHeader />

      <main className="mx-auto w-full max-w-md flex-1 px-4 py-16">
        <div className="mb-8 text-center">
          <h1 className="font-display text-3xl text-ink-50">
            Retrouver mes billets
          </h1>
          <p className="mt-3 text-sm text-ink-300">
            Vous avez reserve sans creer de compte ? Indiquez la reference de
            votre commande et le numero de telephone utilise au paiement.
          </p>
        </div>

        <div className="rounded-2xl border border-ink-700 bg-ink-900 p-6">
          <LookupForm />
        </div>

        <p className="mt-6 text-center text-xs text-ink-400">
          Pas de reference sous la main ? Elle a ete envoyee au moment du
          paiement. Un compte evite d&apos;avoir a la retrouver : consultez{" "}
          <a href="/connexion" className="text-brand-400 hover:underline">
            connexion
          </a>{" "}
          pour en creer un.
        </p>
      </main>

      <SiteFooter />
    </>
  );
}
