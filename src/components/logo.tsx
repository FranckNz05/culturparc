import { cn } from "@/lib/utils";

/**
 * Marque Culture Parc : la tache orange du logo, posee derriere le nom.
 * Le vrai logo pourra remplacer ce composant sans toucher aux mises en page.
 */
export function Logo({
  className,
  compact = false,
}: {
  className?: string;
  compact?: boolean;
}) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <span className="relative inline-flex h-9 w-9 shrink-0 items-center justify-center">
        <svg viewBox="0 0 40 40" className="absolute inset-0 h-full w-full" aria-hidden>
          <path
            d="M20 1.5c8 0 17 3.5 18 11.5 1 8-3.5 14-9 18-5.5 4-14 5-19 1S1 19 3 12 12 1.5 20 1.5Z"
            fill="var(--color-brand-500)"
          />
        </svg>
        <span className="relative font-display text-lg leading-none text-ink-950">
          CP
        </span>
      </span>

      {!compact && (
        <span className="flex flex-col leading-none">
          <span className="font-display text-lg tracking-wide text-ink-50">
            CULTURE PARC
          </span>
          <span className="text-[10px] uppercase tracking-[0.18em] text-ink-300">
            Loisirs et divertissements
          </span>
        </span>
      )}
    </span>
  );
}
