"use client";

import { useActionState, useMemo, useState } from "react";
import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";
import { cn, formatFcfa } from "@/lib/utils";
import { detectOperator } from "@/lib/phone";
import { confirmAndPay, type CheckoutState } from "./actions";

export interface SeatLineData {
  seatId: string;
  label: string;
  categoryName: string | null;
  /** Prix pour chaque type de billet, calcule par le serveur. */
  prices: Record<string, number>;
}

export interface TicketTypeData {
  id: string;
  code: string;
  name: string;
  requiresProof: boolean;
}

const PROVIDERS = [
  { value: "AIRTEL_MONEY", label: "Airtel Money", hint: "04 / 05" },
  { value: "MTN_MOMO", label: "MTN Mobile Money", hint: "06" },
] as const;

function Field({
  label,
  error,
  children,
  hint,
}: {
  label: string;
  error?: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block space-y-1.5">
      <span className="text-sm font-medium text-ink-100">{label}</span>
      {children}
      {hint && !error && <span className="block text-xs text-ink-400">{hint}</span>}
      {error && (
        <span className="block text-xs text-danger" role="alert">
          {error}
        </span>
      )}
    </label>
  );
}

const inputClass =
  "w-full rounded-lg border border-ink-600 bg-ink-850 px-3 py-2.5 text-sm text-ink-50 " +
  "placeholder:text-ink-400 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500";

function SubmitButton({ total }: { total: number }) {
  const { pending } = useFormStatus();

  return (
    <Button type="submit" size="lg" disabled={pending} className="w-full">
      {pending ? "Envoi de la demande..." : `Payer ${formatFcfa(total)}`}
    </Button>
  );
}

export function CheckoutForm({
  reference,
  seatLines,
  ticketTypes,
  defaultTicketTypeId,
}: {
  reference: string;
  seatLines: SeatLineData[];
  ticketTypes: TicketTypeData[];
  defaultTicketTypeId: string;
}) {
  const [state, formAction] = useActionState<CheckoutState, FormData>(
    confirmAndPay,
    {},
  );

  const [selectedTypes, setSelectedTypes] = useState<Record<string, string>>(() =>
    Object.fromEntries(seatLines.map((l) => [l.seatId, defaultTicketTypeId])),
  );
  const [payerPhone, setPayerPhone] = useState("");
  const [provider, setProvider] = useState<string>("");

  const subtotal = useMemo(
    () =>
      seatLines.reduce(
        (sum, line) => sum + (line.prices[selectedTypes[line.seatId]] ?? 0),
        0,
      ),
    [seatLines, selectedTypes],
  );

  // Preselection d'apres le numero saisi, que le client reste libre de changer.
  const suggested = payerPhone ? detectOperator(payerPhone) : "UNKNOWN";
  const effectiveProvider =
    provider ||
    (suggested === "AIRTEL" ? "AIRTEL_MONEY" : suggested === "MTN" ? "MTN_MOMO" : "");

  return (
    <form action={formAction} className="space-y-8">
      <input type="hidden" name="reference" value={reference} />

      {/* ----------------------------------------------------------------
          Tarif de chaque place
          ---------------------------------------------------------------- */}
      <section className="space-y-3">
        <h2 className="font-display text-xl text-ink-50">Vos places</h2>

        <div className="divide-y divide-ink-700 overflow-hidden rounded-xl border border-ink-700 bg-ink-900">
          {seatLines.map((line) => (
            <div
              key={line.seatId}
              className="flex flex-wrap items-center gap-3 p-4"
            >
              <span className="flex h-10 w-12 shrink-0 items-center justify-center rounded-lg bg-brand-500/15 font-semibold text-brand-300">
                {line.label}
              </span>

              <div className="min-w-0 flex-1">
                <p className="text-sm text-ink-200">
                  {line.categoryName ?? "Standard"}
                </p>
              </div>

              <select
                name={`ticketType_${line.seatId}`}
                value={selectedTypes[line.seatId]}
                onChange={(e) =>
                  setSelectedTypes((prev) => ({
                    ...prev,
                    [line.seatId]: e.target.value,
                  }))
                }
                className={cn(inputClass, "w-auto min-w-44 py-2")}
                aria-label={`Tarif pour la place ${line.label}`}
              >
                {ticketTypes.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name} ({formatFcfa(line.prices[t.id] ?? 0)})
                  </option>
                ))}
              </select>

              <span className="w-24 shrink-0 text-right font-semibold text-ink-50">
                {formatFcfa(line.prices[selectedTypes[line.seatId]] ?? 0)}
              </span>
            </div>
          ))}
        </div>

        {ticketTypes.some((t) => t.requiresProof) && (
          <p className="text-xs text-ink-400">
            Les tarifs reduits sont verifies a l&apos;entree : munissez-vous d&apos;un
            justificatif.
          </p>
        )}
      </section>

      {/* ----------------------------------------------------------------
          Coordonnees
          ---------------------------------------------------------------- */}
      <section className="space-y-4">
        <h2 className="font-display text-xl text-ink-50">Vos coordonnees</h2>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Nom et prenom" error={state.fieldErrors?.fullName}>
            <input
              name="fullName"
              required
              autoComplete="name"
              className={inputClass}
              placeholder="Jean Makaya"
            />
          </Field>

          <Field
            label="Telephone"
            error={state.fieldErrors?.phone}
            hint="Pour retrouver votre billet en salle"
          >
            <input
              name="phone"
              required
              inputMode="tel"
              autoComplete="tel"
              className={inputClass}
              placeholder="06 110 92 01"
            />
          </Field>
        </div>

        <Field
          label="Email (facultatif)"
          error={state.fieldErrors?.email}
          hint="Pour recevoir votre billet par email"
        >
          <input
            name="email"
            type="email"
            autoComplete="email"
            className={inputClass}
            placeholder="vous@exemple.cg"
          />
        </Field>

        <Field label="Code promo (facultatif)" error={state.fieldErrors?.promoCode}>
          <input
            name="promoCode"
            className={cn(inputClass, "uppercase")}
            placeholder="CINEMA2026"
          />
        </Field>
      </section>

      {/* ----------------------------------------------------------------
          Paiement
          ---------------------------------------------------------------- */}
      <section className="space-y-4">
        <h2 className="font-display text-xl text-ink-50">Paiement</h2>

        <Field
          label="Numero mobile money"
          error={state.fieldErrors?.payerPhone}
          hint="Vous recevrez une demande de confirmation sur ce numero"
        >
          <input
            name="payerPhone"
            required
            inputMode="tel"
            value={payerPhone}
            onChange={(e) => setPayerPhone(e.target.value)}
            className={inputClass}
            placeholder="06 110 92 01"
          />
        </Field>

        <fieldset className="space-y-2">
          <legend className="mb-2 text-sm font-medium text-ink-100">
            Operateur
          </legend>

          <div className="grid gap-3 sm:grid-cols-2">
            {PROVIDERS.map((p) => {
              const checked = effectiveProvider === p.value;
              return (
                <label
                  key={p.value}
                  className={cn(
                    "flex cursor-pointer items-center gap-3 rounded-xl border p-4 transition-colors",
                    checked
                      ? "border-brand-500 bg-brand-500/10"
                      : "border-ink-600 bg-ink-850 hover:border-ink-500",
                  )}
                >
                  <input
                    type="radio"
                    name="provider"
                    value={p.value}
                    checked={checked}
                    onChange={(e) => setProvider(e.target.value)}
                    className="h-4 w-4 accent-brand-500"
                    required
                  />
                  <span className="min-w-0">
                    <span className="block text-sm font-medium text-ink-50">
                      {p.label}
                    </span>
                    <span className="block text-xs text-ink-400">
                      Numeros {p.hint}
                    </span>
                  </span>
                </label>
              );
            })}
          </div>
        </fieldset>
      </section>

      {/* ----------------------------------------------------------------
          Total et validation
          ---------------------------------------------------------------- */}
      <section className="space-y-4 rounded-xl border border-ink-700 bg-ink-900 p-5">
        <div className="flex items-center justify-between">
          <span className="text-sm text-ink-300">
            {seatLines.length} place{seatLines.length > 1 ? "s" : ""}
          </span>
          <span className="font-display text-3xl text-brand-400">
            {formatFcfa(subtotal)}
          </span>
        </div>

        <p className="text-xs text-ink-400">
          Une remise eventuelle sera appliquee apres verification du code promo.
        </p>

        {state.error && (
          <p
            role="alert"
            className="rounded-lg border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger"
          >
            {state.error}
          </p>
        )}

        <SubmitButton total={subtotal} />
      </section>
    </form>
  );
}
