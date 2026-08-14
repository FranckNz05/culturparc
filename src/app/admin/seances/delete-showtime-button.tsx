"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";
import { deleteShowtime, type DeleteShowtimeState } from "./actions";

function Submit() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="ghost" size="sm" disabled={pending}>
      {pending ? "..." : "Supprimer"}
    </Button>
  );
}

/**
 * Suppression definitive, reservee aux seances sans reservation.
 * L'erreur (seance avec des reservations) s'affiche sous la ligne plutot que
 * dans une alerte globale : elle ne concerne que cette seance-la.
 */
export function DeleteShowtimeButton({ showtimeId }: { showtimeId: string }) {
  const [state, formAction] = useActionState<DeleteShowtimeState, FormData>(
    deleteShowtime,
    {},
  );

  return (
    <div className="inline-block text-left">
      <form action={formAction}>
        <input type="hidden" name="showtimeId" value={showtimeId} />
        <Submit />
      </form>
      {state.error && (
        <p role="alert" className="mt-1 max-w-48 text-xs text-danger">
          {state.error}
        </p>
      )}
    </div>
  );
}
