"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";
import { lookupBooking, type LookupState } from "./actions";

const inputClass =
  "w-full rounded-lg border border-ink-600 bg-ink-850 px-3 py-2.5 text-sm text-ink-50 " +
  "placeholder:text-ink-400 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500";

function Submit() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="lg" disabled={pending} className="w-full">
      {pending ? "Recherche..." : "Retrouver mes billets"}
    </Button>
  );
}

export function LookupForm() {
  const [state, formAction] = useActionState<LookupState, FormData>(
    lookupBooking,
    {},
  );

  return (
    <form action={formAction} className="space-y-4">
      <label className="block space-y-1.5">
        <span className="text-sm font-medium text-ink-100">
          Reference de commande
        </span>
        <input
          name="reference"
          required
          placeholder="CP-7F3K9Q"
          autoCapitalize="characters"
          className={inputClass + " uppercase"}
        />
        <span className="block text-xs text-ink-400">
          Recue par SMS ou affichee a l&apos;ecran juste apres le paiement
        </span>
      </label>

      <label className="block space-y-1.5">
        <span className="text-sm font-medium text-ink-100">
          Telephone utilise pour la reservation
        </span>
        <input
          name="phone"
          required
          inputMode="tel"
          placeholder="06 110 92 01"
          className={inputClass}
        />
      </label>

      {state.error && (
        <p
          role="alert"
          className="rounded-lg border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger"
        >
          {state.error}
        </p>
      )}

      <Submit />
    </form>
  );
}
