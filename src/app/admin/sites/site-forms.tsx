"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";
import { createAuditorium, createSite, type SiteState } from "./actions";

const inputClass =
  "w-full rounded-lg border border-ink-600 bg-ink-850 px-3 py-2 text-sm text-ink-50 " +
  "placeholder:text-ink-400 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500";

function Submit({ label, pendingLabel }: { label: string; pendingLabel: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? pendingLabel : label}
    </Button>
  );
}

function Feedback({ state }: { state: SiteState }) {
  if (state.error) {
    return (
      <p
        role="alert"
        className="rounded-lg border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger"
      >
        {state.error}
      </p>
    );
  }
  if (state.success) {
    return (
      <p
        role="status"
        className="rounded-lg border border-success/40 bg-success/10 px-4 py-3 text-sm text-success"
      >
        {state.success}
      </p>
    );
  }
  return null;
}

export function NewSiteForm() {
  const [state, formAction] = useActionState<SiteState, FormData>(createSite, {});

  return (
    <form
      action={formAction}
      className="space-y-4 rounded-xl border border-ink-700 bg-ink-900 p-5"
    >
      <div>
        <h2 className="font-display text-xl text-ink-50">Ouvrir un site</h2>
        <p className="mt-1 text-xs text-ink-400">
          La ville saisie ici apparait aussitot dans le selecteur du site public.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <label className="space-y-1.5">
          <span className="text-sm text-ink-100">Nom du site</span>
          <input
            name="name"
            required
            placeholder="Culture Parc Dolisie"
            className={inputClass}
          />
        </label>

        <label className="space-y-1.5">
          <span className="text-sm text-ink-100">Ville</span>
          <input name="city" required placeholder="Dolisie" className={inputClass} />
        </label>

        <label className="space-y-1.5">
          <span className="text-sm text-ink-100">Telephone</span>
          <input name="phone" placeholder="06 110 92 04" className={inputClass} />
        </label>

        <label className="space-y-1.5 sm:col-span-2">
          <span className="text-sm text-ink-100">Adresse</span>
          <input
            name="address"
            placeholder="Avenue de la Liberte, quartier..."
            className={inputClass}
          />
        </label>

        <label className="space-y-1.5">
          <span className="text-sm text-ink-100">Email</span>
          <input
            name="email"
            type="email"
            placeholder="dolisie@cultureparc.cg"
            className={inputClass}
          />
        </label>

        <label className="space-y-1.5 sm:col-span-2 lg:col-span-3">
          <span className="text-sm text-ink-100">Presentation</span>
          <textarea
            name="description"
            rows={2}
            placeholder="Salle de cinema et espace de loisirs au coeur de..."
            className={inputClass}
          />
        </label>
      </div>

      <Feedback state={state} />

      <Submit label="Ouvrir le site" pendingLabel="Creation..." />
    </form>
  );
}

export function NewAuditoriumForm({
  cinemas,
}: {
  cinemas: { id: string; name: string; city: string }[];
}) {
  const [state, formAction] = useActionState<SiteState, FormData>(
    createAuditorium,
    {},
  );

  return (
    <form
      action={formAction}
      className="space-y-4 rounded-xl border border-ink-700 bg-ink-900 p-5"
    >
      <div>
        <h2 className="font-display text-xl text-ink-50">Ajouter une salle</h2>
        <p className="mt-1 text-xs text-ink-400">
          La grille se redimensionne ensuite librement dans l&apos;editeur de plan.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <label className="space-y-1.5 lg:col-span-2">
          <span className="text-sm text-ink-100">Site</span>
          <select name="cinemaId" required className={inputClass}>
            {cinemas.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} ({c.city})
              </option>
            ))}
          </select>
        </label>

        <label className="space-y-1.5">
          <span className="text-sm text-ink-100">Nom</span>
          <input name="name" required placeholder="Salle 1" className={inputClass} />
        </label>

        <label className="space-y-1.5">
          <span className="text-sm text-ink-100">Type d&apos;ecran</span>
          <select name="screenType" className={inputClass} defaultValue="STANDARD">
            <option value="STANDARD">Standard</option>
            <option value="THREE_D">3D</option>
            <option value="PREMIUM">Premium</option>
            <option value="OUTDOOR">Plein air</option>
          </select>
        </label>

        <label className="space-y-1.5">
          <span className="text-sm text-ink-100">Rangees</span>
          <input
            type="number"
            name="gridRows"
            min={1}
            max={60}
            defaultValue={8}
            className={inputClass}
          />
        </label>

        <label className="space-y-1.5">
          <span className="text-sm text-ink-100">Colonnes</span>
          <input
            type="number"
            name="gridCols"
            min={1}
            max={60}
            defaultValue={15}
            className={inputClass}
          />
        </label>
      </div>

      <Feedback state={state} />

      <Submit label="Creer la salle" pendingLabel="Creation..." />
    </form>
  );
}
