"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";
import { createShowtime, type ShowtimeState } from "./actions";

const inputClass =
  "w-full rounded-lg border border-ink-600 bg-ink-850 px-3 py-2 text-sm text-ink-50 " +
  "focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Ajout..." : "Programmer la seance"}
    </Button>
  );
}

export function ShowtimeForm({
  movies,
  auditoriums,
  defaultDate,
}: {
  movies: { id: string; title: string; durationMin: number }[];
  auditoriums: { id: string; label: string }[];
  defaultDate: string;
}) {
  const [state, formAction] = useActionState<ShowtimeState, FormData>(
    createShowtime,
    {},
  );

  return (
    <form
      action={formAction}
      className="space-y-4 rounded-xl border border-ink-700 bg-ink-900 p-5"
    >
      <h2 className="font-display text-xl text-ink-50">Programmer une seance</h2>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <label className="space-y-1.5">
          <span className="text-sm text-ink-100">Film</span>
          <select name="movieId" required className={inputClass}>
            <option value="">Choisir...</option>
            {movies.map((m) => (
              <option key={m.id} value={m.id}>
                {m.title} ({m.durationMin} min)
              </option>
            ))}
          </select>
        </label>

        <label className="space-y-1.5">
          <span className="text-sm text-ink-100">Salle</span>
          <select name="auditoriumId" required className={inputClass}>
            <option value="">Choisir...</option>
            {auditoriums.map((a) => (
              <option key={a.id} value={a.id}>
                {a.label}
              </option>
            ))}
          </select>
        </label>

        <label className="space-y-1.5">
          <span className="text-sm text-ink-100">Date</span>
          <input
            type="date"
            name="date"
            required
            defaultValue={defaultDate}
            className={inputClass}
          />
        </label>

        <label className="space-y-1.5">
          <span className="text-sm text-ink-100">Heure</span>
          <input
            type="time"
            name="time"
            required
            defaultValue="19:00"
            className={inputClass}
          />
        </label>

        <label className="space-y-1.5">
          <span className="text-sm text-ink-100">Format</span>
          <select name="format" className={inputClass} defaultValue="TWO_D">
            <option value="TWO_D">2D</option>
            <option value="THREE_D">3D</option>
          </select>
        </label>

        <label className="space-y-1.5">
          <span className="text-sm text-ink-100">Version</span>
          <select name="language" className={inputClass} defaultValue="VF">
            <option value="VF">VF</option>
            <option value="VOSTFR">VOSTFR</option>
            <option value="VO">VO</option>
          </select>
        </label>

        <label className="space-y-1.5">
          <span className="text-sm text-ink-100">Tarif de base (FCFA)</span>
          <input
            type="number"
            name="basePrice"
            min={0}
            step={100}
            defaultValue={2500}
            required
            className={inputClass}
          />
        </label>

        <label className="flex items-center gap-2 self-end pb-2">
          <input
            type="checkbox"
            name="isPremiere"
            className="h-4 w-4 accent-brand-500"
          />
          <span className="text-sm text-ink-100">Avant-premiere</span>
        </label>
      </div>

      {state.error && (
        <p
          role="alert"
          className="rounded-lg border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger"
        >
          {state.error}
        </p>
      )}

      {state.success && (
        <p
          role="status"
          className="rounded-lg border border-success/40 bg-success/10 px-4 py-3 text-sm text-success"
        >
          {state.success}
        </p>
      )}

      <SubmitButton />
    </form>
  );
}
