"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";
import { MIN_PASSWORD_LENGTH } from "@/lib/constants";
import { createUser, resetUserPassword, type UserState } from "./actions";

const inputClass =
  "w-full rounded-lg border border-ink-600 bg-ink-850 px-3 py-2 text-sm text-ink-50 " +
  "placeholder:text-ink-400 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500";

const ROLES = [
  { value: "STAFF", label: "Controle d'acces", hint: "Scanne les billets a l'entree" },
  { value: "MANAGER", label: "Responsable", hint: "Programme les seances et les tarifs de son site" },
  { value: "ADMIN", label: "Administrateur", hint: "Acces complet, tous les sites" },
  { value: "CUSTOMER", label: "Client", hint: "Compte de reservation, sans acces au back-office" },
];

function Submit({ label, pendingLabel }: { label: string; pendingLabel: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? pendingLabel : label}
    </Button>
  );
}

function Feedback({ state }: { state: UserState }) {
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

/** Propose un mot de passe solide, que l'administrateur peut remplacer. */
function suggestPassword(): string {
  const alphabet = "abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return [...bytes].map((b) => alphabet[b % alphabet.length]).join("");
}

export function NewUserForm({
  cinemas,
}: {
  cinemas: { id: string; name: string; city: string }[];
}) {
  const [state, formAction] = useActionState<UserState, FormData>(createUser, {});
  const [role, setRole] = useState("STAFF");
  const [password, setPassword] = useState("");

  // Un administrateur voit tous les sites ; un client n'en depend d'aucun.
  const needsCinema = role === "STAFF" || role === "MANAGER";

  return (
    <form
      action={formAction}
      className="space-y-4 rounded-xl border border-ink-700 bg-ink-900 p-5"
    >
      <div>
        <h2 className="font-display text-xl text-ink-50">Creer un compte</h2>
        <p className="mt-1 text-xs text-ink-400">
          Le mot de passe est communique a la personne, qui doit le changer
          depuis son espace des la premiere connexion.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <label className="space-y-1.5">
          <span className="text-sm text-ink-100">Nom et prenom</span>
          <input name="name" required placeholder="Jean Makaya" className={inputClass} />
        </label>

        <label className="space-y-1.5">
          <span className="text-sm text-ink-100">Email</span>
          <input
            name="email"
            type="email"
            required
            placeholder="jean@cultureparc.cg"
            className={inputClass}
          />
        </label>

        <label className="space-y-1.5">
          <span className="text-sm text-ink-100">Telephone (facultatif)</span>
          <input name="phone" placeholder="06 110 92 01" className={inputClass} />
        </label>

        <label className="space-y-1.5">
          <span className="text-sm text-ink-100">Role</span>
          <select
            name="role"
            value={role}
            onChange={(e) => setRole(e.target.value)}
            className={inputClass}
          >
            {ROLES.map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
          </select>
          <span className="block text-xs text-ink-400">
            {ROLES.find((r) => r.value === role)?.hint}
          </span>
        </label>

        <label className="space-y-1.5">
          <span className="text-sm text-ink-100">
            Site de rattachement{needsCinema ? "" : " (sans objet)"}
          </span>
          <select
            name="cinemaId"
            className={inputClass}
            disabled={!needsCinema}
            required={needsCinema}
          >
            <option value="">Choisir...</option>
            {cinemas.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} ({c.city})
              </option>
            ))}
          </select>
        </label>

        <div className="space-y-1.5">
          <label className="block space-y-1.5">
            <span className="text-sm text-ink-100">Mot de passe initial</span>
            <input
              name="password"
              required
              minLength={MIN_PASSWORD_LENGTH}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={inputClass}
            />
          </label>
          <button
            type="button"
            onClick={() => setPassword(suggestPassword())}
            className="text-xs text-brand-400 hover:underline"
          >
            Proposer un mot de passe
          </button>
          <span className="block text-xs text-ink-400">
            {MIN_PASSWORD_LENGTH} caracteres minimum
          </span>
        </div>
      </div>

      <Feedback state={state} />

      <Submit label="Creer le compte" pendingLabel="Creation..." />
    </form>
  );
}

export function ResetPasswordForm({
  userId,
  userName,
}: {
  userId: string;
  userName: string;
}) {
  const [state, formAction] = useActionState<UserState, FormData>(
    resetUserPassword,
    {},
  );
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState("");

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-xs text-ink-300 hover:text-brand-400"
      >
        Reinitialiser le mot de passe
      </button>
    );
  }

  return (
    <form action={formAction} className="space-y-2">
      <input type="hidden" name="userId" value={userId} />

      <div className="flex flex-wrap gap-2">
        <input
          name="password"
          required
          minLength={MIN_PASSWORD_LENGTH}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder={`Nouveau mot de passe de ${userName}`}
          className={inputClass + " flex-1 min-w-52"}
        />
        <Button type="submit" variant="secondary" size="sm">
          Valider
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => {
            setOpen(false);
            setPassword("");
          }}
        >
          Annuler
        </Button>
      </div>

      <button
        type="button"
        onClick={() => setPassword(suggestPassword())}
        className="text-xs text-brand-400 hover:underline"
      >
        Proposer un mot de passe
      </button>

      <Feedback state={state} />
    </form>
  );
}
