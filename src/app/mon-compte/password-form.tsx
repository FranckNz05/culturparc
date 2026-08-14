"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";
import { MIN_PASSWORD_LENGTH } from "@/lib/constants";
import { changeOwnPassword, type UserState } from "@/app/admin/utilisateurs/actions";

const inputClass =
  "w-full rounded-lg border border-ink-600 bg-ink-850 px-3 py-2 text-sm text-ink-50 " +
  "focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500";

function Submit() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} size="sm">
      {pending ? "Enregistrement..." : "Changer le mot de passe"}
    </Button>
  );
}

export function PasswordForm() {
  const [state, formAction] = useActionState<UserState, FormData>(
    changeOwnPassword,
    {},
  );

  return (
    <form action={formAction} className="space-y-3">
      <label className="block space-y-1.5">
        <span className="text-sm text-ink-100">Mot de passe actuel</span>
        <input
          name="current"
          type="password"
          required
          autoComplete="current-password"
          className={inputClass}
        />
      </label>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block space-y-1.5">
          <span className="text-sm text-ink-100">Nouveau mot de passe</span>
          <input
            name="next"
            type="password"
            required
            minLength={MIN_PASSWORD_LENGTH}
            autoComplete="new-password"
            className={inputClass}
          />
        </label>

        <label className="block space-y-1.5">
          <span className="text-sm text-ink-100">Confirmer</span>
          <input
            name="confirm"
            type="password"
            required
            minLength={MIN_PASSWORD_LENGTH}
            autoComplete="new-password"
            className={inputClass}
          />
        </label>
      </div>

      <p className="text-xs text-ink-400">
        {MIN_PASSWORD_LENGTH} caracteres minimum.
      </p>

      {state.error && (
        <p role="alert" className="text-sm text-danger">
          {state.error}
        </p>
      )}
      {state.success && (
        <p role="status" className="text-sm text-success">
          {state.success}
        </p>
      )}

      <Submit />
    </form>
  );
}
