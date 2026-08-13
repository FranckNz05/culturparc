"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ButtonLink } from "@/components/ui/button";

type Phase = "waiting" | "success" | "failed";

interface StatusResponse {
  status: string;
  message: string;
  reference: string;
  done: boolean;
  needsAttention?: boolean;
}

/** Rythme d'interrogation : assez reactif sans marteler l'API de l'operateur. */
const POLL_INTERVAL_MS = 4000;
/** Au-dela, l'operateur ne repondra plus : la demande a expire sur le telephone. */
const MAX_DURATION_MS = 3 * 60 * 1000;

export function PaymentWatcher({
  paymentId,
  reference,
}: {
  paymentId: string;
  reference: string;
}) {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>("waiting");
  const [message, setMessage] = useState(
    "Confirmez le paiement sur votre telephone en saisissant votre code PIN.",
  );
  const [needsAttention, setNeedsAttention] = useState(false);
  const startedAt = useRef(Date.now());

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    async function poll() {
      if (cancelled) return;

      if (Date.now() - startedAt.current > MAX_DURATION_MS) {
        setPhase("failed");
        setMessage(
          "Aucune confirmation recue dans le delai imparti. La demande a expire.",
        );
        return;
      }

      try {
        const response = await fetch(`/api/paiements/${paymentId}/statut`, {
          cache: "no-store",
        });
        const data: StatusResponse = await response.json();

        if (cancelled) return;

        setMessage(data.message);
        setNeedsAttention(Boolean(data.needsAttention));

        if (data.done) {
          if (data.status === "SUCCESS") {
            setPhase("success");
            // Laisse le temps de lire la confirmation avant la redirection.
            setTimeout(() => {
              if (!cancelled) router.push(`/commande/${reference}/billets`);
            }, 1200);
          } else {
            setPhase("failed");
          }
          return;
        }
      } catch {
        // Coupure reseau passagere : on retentera au prochain tour.
      }

      timer = setTimeout(poll, POLL_INTERVAL_MS);
    }

    poll();

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [paymentId, reference, router]);

  return (
    <div className="rounded-2xl border border-ink-700 bg-ink-900 p-8 text-center">
      {phase === "waiting" && (
        <>
          <div
            className="mx-auto mb-6 h-14 w-14 animate-spin rounded-full border-4 border-ink-700 border-t-brand-500"
            role="status"
            aria-label="Paiement en cours"
          />
          <h1 className="font-display text-2xl text-ink-50">
            Paiement en cours
          </h1>
          <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-ink-200">
            {message}
          </p>
          <p className="mt-6 text-xs text-ink-400">
            Ne fermez pas cette page. Elle se mettra a jour automatiquement.
          </p>
        </>
      )}

      {phase === "success" && (
        <>
          <div className="mx-auto mb-6 flex h-14 w-14 items-center justify-center rounded-full bg-success/20 text-3xl text-success">
            &#10003;
          </div>
          <h1 className="font-display text-2xl text-ink-50">Paiement confirme</h1>
          <p className="mx-auto mt-3 max-w-md text-sm text-ink-200">{message}</p>

          {needsAttention ? (
            <ButtonLink
              href={`/commande/${reference}`}
              variant="secondary"
              className="mt-6"
            >
              Voir ma commande
            </ButtonLink>
          ) : (
            <p className="mt-6 text-xs text-ink-400">
              Redirection vers vos billets...
            </p>
          )}
        </>
      )}

      {phase === "failed" && (
        <>
          <div className="mx-auto mb-6 flex h-14 w-14 items-center justify-center rounded-full bg-danger/20 text-3xl text-danger">
            &#10005;
          </div>
          <h1 className="font-display text-2xl text-ink-50">
            Paiement non abouti
          </h1>
          <p className="mx-auto mt-3 max-w-md text-sm text-ink-200">{message}</p>

          <div className="mt-6 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
            <ButtonLink href={`/commande/${reference}`}>Reessayer</ButtonLink>
            <Link
              href="/programme"
              className="text-sm text-ink-300 hover:text-brand-400"
            >
              Retour au programme
            </Link>
          </div>

          <p className="mt-6 text-xs text-ink-400">
            Vos places restent retenues tant que le delai n&apos;est pas ecoule.
          </p>
        </>
      )}
    </div>
  );
}
