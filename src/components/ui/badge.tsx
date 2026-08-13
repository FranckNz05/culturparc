import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type Tone = "neutral" | "brand" | "success" | "danger" | "outline";

const TONES: Record<Tone, string> = {
  neutral: "bg-ink-700 text-ink-100",
  brand: "bg-brand-500 text-ink-950 font-semibold",
  success: "bg-success/15 text-success border border-success/30",
  danger: "bg-danger/15 text-danger border border-danger/30",
  outline: "border border-ink-600 text-ink-200",
};

export function Badge({
  tone = "neutral",
  className,
  children,
}: {
  tone?: Tone;
  className?: string;
  children: ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs leading-none",
        TONES[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

/**
 * Pastille d'age reglementaire, telle qu'affichee sur les programmes.
 * Le vert du tout public evite de faire passer "-12" pour une alerte.
 */
export function AgeBadge({ minAge }: { minAge: number }) {
  if (minAge <= 0) {
    return (
      <span className="inline-flex h-6 min-w-6 items-center justify-center rounded-md bg-success/20 px-1.5 text-xs font-semibold text-success">
        TP
      </span>
    );
  }

  return (
    <span className="inline-flex h-6 min-w-6 items-center justify-center rounded-md bg-danger/20 px-1.5 text-xs font-semibold text-danger">
      -{minAge}
    </span>
  );
}
