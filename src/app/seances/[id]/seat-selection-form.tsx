"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { SeatMap } from "@/components/seat-map";
import { Button } from "@/components/ui/button";
import { formatFcfa } from "@/lib/utils";
import type { SeatMapView, SeatView } from "@/lib/seating";
import { startBooking, type BookingFormState } from "./actions";

function SubmitButton({ count, total }: { count: number; total: number }) {
  const { pending } = useFormStatus();

  return (
    <Button
      type="submit"
      size="lg"
      disabled={count === 0 || pending}
      className="w-full sm:w-auto"
    >
      {pending
        ? "Reservation en cours..."
        : count === 0
          ? "Choisissez vos places"
          : `Continuer - ${formatFcfa(total)}`}
    </Button>
  );
}

export function SeatSelectionForm({ seatMap }: { seatMap: SeatMapView }) {
  const [state, formAction] = useActionState<BookingFormState, FormData>(
    startBooking,
    {},
  );
  const [selection, setSelection] = useState<SeatView[]>([]);

  const total = selection.reduce((sum, s) => sum + s.price, 0);

  return (
    <form action={formAction} className="space-y-6">
      <input type="hidden" name="showtimeId" value={seatMap.showtimeId} />

      <SeatMap seatMap={seatMap} onSelectionChange={setSelection} />

      {state.error && (
        <p
          role="alert"
          className="rounded-lg border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger"
        >
          {state.error}
        </p>
      )}

      <div className="flex flex-col items-stretch gap-3 sm:flex-row sm:items-center sm:justify-end">
        <SubmitButton count={selection.length} total={total} />
      </div>
    </form>
  );
}
