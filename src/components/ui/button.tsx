import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/utils";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md" | "lg";

const VARIANTS: Record<Variant, string> = {
  primary:
    "bg-brand-500 text-ink-950 hover:bg-brand-400 active:bg-brand-600 font-semibold shadow-[0_8px_24px_-10px_rgba(247,148,30,0.9)]",
  secondary:
    "bg-ink-700 text-ink-50 hover:bg-ink-600 border border-ink-600",
  ghost: "text-ink-200 hover:text-ink-50 hover:bg-ink-800",
  danger: "bg-danger text-white hover:brightness-110 font-semibold",
};

const SIZES: Record<Size, string> = {
  sm: "h-9 px-3 text-sm rounded-lg gap-1.5",
  md: "h-11 px-5 text-sm rounded-xl gap-2",
  lg: "h-13 px-7 text-base rounded-xl gap-2.5",
};

const BASE =
  "inline-flex items-center justify-center whitespace-nowrap transition-colors " +
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 " +
  "focus-visible:ring-offset-ink-950 disabled:pointer-events-none disabled:opacity-45";

export function Button({
  variant = "primary",
  size = "md",
  className,
  ...props
}: ComponentProps<"button"> & { variant?: Variant; size?: Size }) {
  return (
    <button
      className={cn(BASE, VARIANTS[variant], SIZES[size], className)}
      {...props}
    />
  );
}

export function ButtonLink({
  variant = "primary",
  size = "md",
  className,
  children,
  ...props
}: ComponentProps<typeof Link> & {
  variant?: Variant;
  size?: Size;
  children: ReactNode;
}) {
  return (
    <Link
      className={cn(BASE, VARIANTS[variant], SIZES[size], className)}
      {...props}
    >
      {children}
    </Link>
  );
}
