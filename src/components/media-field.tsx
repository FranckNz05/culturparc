import { cn } from "@/lib/utils";

const inputClass =
  "w-full rounded-lg border border-ink-600 bg-ink-850 px-3 py-2 text-sm text-ink-50 " +
  "placeholder:text-ink-400 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500";

/**
 * Champ media : televerser un fichier ou coller une URL.
 *
 * Les deux voies coexistent parce que les usages different : une affiche
 * officielle se recupere souvent par lien, alors qu'une photo prise sur place
 * arrive depuis l'ordinateur. Si les deux sont renseignes, le fichier gagne.
 */
export function MediaField({
  label,
  name,
  accept,
  hint,
  urlPlaceholder,
  currentUrl,
  className,
}: {
  label: string;
  /** Base des noms : `${name}File` et `${name}Url`. */
  name: string;
  accept: string;
  hint?: string;
  urlPlaceholder?: string;
  currentUrl?: string | null;
  className?: string;
}) {
  return (
    <fieldset className={cn("space-y-1.5", className)}>
      <legend className="text-sm text-ink-100">{label}</legend>

      <input
        type="file"
        name={`${name}File`}
        accept={accept}
        className={cn(
          inputClass,
          "file:mr-3 file:rounded-md file:border-0 file:bg-ink-700 file:px-3 file:py-1 file:text-sm file:text-ink-100 hover:file:bg-ink-600",
        )}
        aria-label={`${label} : televerser un fichier`}
      />

      <div className="flex items-center gap-2">
        <span className="text-[11px] uppercase tracking-wider text-ink-400">
          ou
        </span>
        <input
          type="url"
          name={`${name}Url`}
          defaultValue={currentUrl ?? ""}
          placeholder={urlPlaceholder}
          className={inputClass}
          aria-label={`${label} : adresse web`}
        />
      </div>

      {hint && <p className="text-xs text-ink-400">{hint}</p>}
    </fieldset>
  );
}
