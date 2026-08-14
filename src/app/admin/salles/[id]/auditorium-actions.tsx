"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";
import {
  deleteAuditorium,
  updateAuditoriumInfo,
  type AuditoriumInfoState,
} from "./actions";

const inputClass =
  "w-full rounded-lg border border-ink-600 bg-ink-850 px-3 py-2 text-sm text-ink-50 " +
  "focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500";

function Submit({ label, pendingLabel }: { label: string; pendingLabel: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="sm" disabled={pending}>
      {pending ? pendingLabel : label}
    </Button>
  );
}

function Feedback({ state }: { state: AuditoriumInfoState }) {
  if (state.error) {
    return (
      <p role="alert" className="text-sm text-danger">
        {state.error}
      </p>
    );
  }
  if (state.success) {
    return (
      <p role="status" className="text-sm text-success">
        {state.success}
      </p>
    );
  }
  return null;
}

export interface EditableAuditorium {
  id: string;
  name: string;
  screenType: "STANDARD" | "THREE_D" | "PREMIUM" | "OUTDOOR";
  showtimeCount: number;
}

/** Nom et type d'ecran, plus suppression : un seul volet ouvert a la fois. */
export function AuditoriumActions({ auditorium }: { auditorium: EditableAuditorium }) {
  const [mode, setMode] = useState<"none" | "edit" | "delete">("none");

  return (
    <div className="rounded-xl border border-ink-700 bg-ink-900 p-4">
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => setMode(mode === "edit" ? "none" : "edit")}
          className="text-sm text-ink-300 hover:text-brand-400"
        >
          {mode === "edit" ? "Annuler la modification" : "Modifier le nom ou l'ecran"}
        </button>
        <button
          type="button"
          onClick={() => setMode(mode === "delete" ? "none" : "delete")}
          className="text-sm text-danger/80 hover:text-danger"
        >
          {mode === "delete" ? "Annuler la suppression" : "Supprimer la salle"}
        </button>
      </div>

      {mode === "edit" && (
        <EditFields auditorium={auditorium} onDone={() => setMode("none")} />
      )}
      {mode === "delete" && <DeleteFields auditorium={auditorium} />}
    </div>
  );
}

function EditFields({
  auditorium,
  onDone,
}: {
  auditorium: EditableAuditorium;
  onDone: () => void;
}) {
  const [state, formAction] = useActionState<AuditoriumInfoState, FormData>(
    updateAuditoriumInfo,
    {},
  );

  return (
    <form action={formAction} className="mt-4 space-y-3">
      <input type="hidden" name="auditoriumId" value={auditorium.id} />

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="space-y-1.5">
          <span className="text-xs text-ink-100">Nom de la salle</span>
          <input name="name" required defaultValue={auditorium.name} className={inputClass} />
        </label>

        <label className="space-y-1.5">
          <span className="text-xs text-ink-100">Type d&apos;ecran</span>
          <select name="screenType" defaultValue={auditorium.screenType} className={inputClass}>
            <option value="STANDARD">Standard</option>
            <option value="THREE_D">3D</option>
            <option value="PREMIUM">Premium</option>
            <option value="OUTDOOR">Plein air</option>
          </select>
        </label>
      </div>

      <Feedback state={state} />

      <div className="flex gap-2">
        <Submit label="Enregistrer" pendingLabel="Enregistrement..." />
        <Button type="button" variant="ghost" size="sm" onClick={onDone}>
          Fermer
        </Button>
      </div>
    </form>
  );
}

/**
 * Suppression de la salle, avec confirmation par saisie exacte du nom.
 *
 * Bloquee des qu'une seule seance y est rattachee, vendue ou non : la base
 * (`showtimes.auditoriumId` en Restrict) refuse la suppression tant qu'une
 * seance existe, contrairement a un site entier ou seules les reservations
 * bloquent. Le message le dit avant meme la tentative.
 */
function DeleteFields({ auditorium }: { auditorium: EditableAuditorium }) {
  const [state, formAction] = useActionState<AuditoriumInfoState, FormData>(
    deleteAuditorium,
    {},
  );
  const [confirmName, setConfirmName] = useState("");

  return (
    <form action={formAction} className="mt-4 space-y-3">
      <input type="hidden" name="auditoriumId" value={auditorium.id} />

      <p className="text-sm text-danger">
        {auditorium.showtimeCount > 0
          ? `Impossible pour l'instant : ${auditorium.showtimeCount} seance${auditorium.showtimeCount > 1 ? "s" : ""} ${auditorium.showtimeCount > 1 ? "sont rattachees" : "est rattachee"} a cette salle, vendue${auditorium.showtimeCount > 1 ? "s" : ""} ou non. Supprimez-les depuis l'onglet Seances.`
          : "Cette action est irreversible et efface le plan de sieges de cette salle."}
      </p>

      {auditorium.showtimeCount === 0 && (
        <>
          <label className="block space-y-1.5">
            <span className="text-xs text-ink-100">
              Saisissez{" "}
              <span className="font-mono font-semibold">{auditorium.name}</span> pour
              confirmer
            </span>
            <input
              name="confirmName"
              value={confirmName}
              onChange={(e) => setConfirmName(e.target.value)}
              className={inputClass}
              autoComplete="off"
            />
          </label>

          <Button
            type="submit"
            variant="secondary"
            size="sm"
            disabled={confirmName !== auditorium.name}
            className="border-danger/60 text-danger hover:bg-danger/10"
          >
            Supprimer definitivement
          </Button>
        </>
      )}

      <Feedback state={state} />
    </form>
  );
}
