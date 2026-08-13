import { revalidatePath } from "next/cache";
import { requireRole } from "@/auth";
import { prisma } from "@/lib/prisma";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatFcfa } from "@/lib/utils";

export const dynamic = "force-dynamic";

const DAY_NAMES = ["Dim", "Lun", "Mar", "Mer", "Jeu", "Ven", "Sam"];

/** "840" -> "14h00" */
function minuteToLabel(minute: number | null): string | null {
  if (minute === null) return null;
  const h = Math.floor(minute / 60);
  const m = minute % 60;
  return `${h.toString().padStart(2, "0")}h${m.toString().padStart(2, "0")}`;
}

/** "14:00" -> 840 */
function timeToMinute(value: string): number | null {
  const match = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (!match) return null;
  return Number(match[1]) * 60 + Number(match[2]);
}

async function createRule(formData: FormData) {
  "use server";

  const session = await requireRole("MANAGER");
  if (!session) return;

  const label = String(formData.get("label") ?? "").trim();
  const ticketTypeId = String(formData.get("ticketTypeId") ?? "");
  const amount = Number(formData.get("amount") ?? 0);

  if (!label || !ticketTypeId || !Number.isFinite(amount) || amount < 0) return;

  const days = formData
    .getAll("daysOfWeek")
    .map((d) => Number(d))
    .filter((d) => Number.isInteger(d) && d >= 0 && d <= 6);

  await prisma.priceRule.create({
    data: {
      label,
      ticketTypeId,
      amount: Math.round(amount),
      priority: Number(formData.get("priority") ?? 0),
      cinemaId: String(formData.get("cinemaId") ?? "") || null,
      movieId: String(formData.get("movieId") ?? "") || null,
      seatCategoryId: String(formData.get("seatCategoryId") ?? "") || null,
      daysOfWeek: days,
      startMinute: timeToMinute(String(formData.get("startTime") ?? "")),
      endMinute: timeToMinute(String(formData.get("endTime") ?? "")),
    },
  });

  revalidatePath("/admin/tarifs");
}

async function toggleRule(formData: FormData) {
  "use server";

  const session = await requireRole("MANAGER");
  if (!session) return;

  const id = String(formData.get("ruleId") ?? "");
  if (!id) return;

  const rule = await prisma.priceRule.findUnique({ where: { id } });
  if (!rule) return;

  await prisma.priceRule.update({
    where: { id },
    data: { active: !rule.active },
  });

  revalidatePath("/admin/tarifs");
}

const inputClass =
  "w-full rounded-lg border border-ink-600 bg-ink-850 px-3 py-2 text-sm text-ink-50 " +
  "focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500";

export default async function PricingAdminPage() {
  const [rules, ticketTypes, cinemas, movies, categories] = await Promise.all([
    prisma.priceRule.findMany({
      include: {
        ticketType: true,
        cinema: { select: { name: true } },
        movie: { select: { title: true } },
        seatCategory: { select: { name: true } },
      },
      orderBy: [{ priority: "desc" }, { createdAt: "asc" }],
    }),
    prisma.ticketType.findMany({ orderBy: { sortOrder: "asc" } }),
    prisma.cinema.findMany({ orderBy: { sortOrder: "asc" } }),
    prisma.movie.findMany({
      where: { status: { in: ["NOW_SHOWING", "COMING_SOON"] } },
      select: { id: true, title: true },
      orderBy: { title: "asc" },
    }),
    prisma.seatCategory.findMany({
      include: { cinema: { select: { name: true } } },
      orderBy: { sortOrder: "asc" },
    }),
  ]);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-3xl text-ink-50">Tarifs</h1>
        <p className="mt-1 text-sm text-ink-300">
          La regle appliquee est la plus prioritaire parmi celles dont tous les
          criteres correspondent. Sans regle, le tarif de la seance s&apos;applique,
          augmente du supplement de categorie.
        </p>
      </div>

      <form
        action={createRule}
        className="space-y-4 rounded-xl border border-ink-700 bg-ink-900 p-5"
      >
        <h2 className="font-display text-xl text-ink-50">Nouvelle regle</h2>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <label className="space-y-1.5">
            <span className="text-sm text-ink-100">Libelle</span>
            <input
              name="label"
              required
              placeholder="Matinee en semaine"
              className={inputClass}
            />
          </label>

          <label className="space-y-1.5">
            <span className="text-sm text-ink-100">Type de billet</span>
            <select name="ticketTypeId" required className={inputClass}>
              {ticketTypes.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </label>

          <label className="space-y-1.5">
            <span className="text-sm text-ink-100">Prix (FCFA)</span>
            <input
              type="number"
              name="amount"
              min={0}
              step={100}
              required
              className={inputClass}
            />
          </label>

          <label className="space-y-1.5">
            <span className="text-sm text-ink-100">Priorite</span>
            <input
              type="number"
              name="priority"
              defaultValue={0}
              className={inputClass}
            />
          </label>

          <label className="space-y-1.5">
            <span className="text-sm text-ink-100">Cinema (facultatif)</span>
            <select name="cinemaId" className={inputClass}>
              <option value="">Tous</option>
              {cinemas.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>

          <label className="space-y-1.5">
            <span className="text-sm text-ink-100">Film (facultatif)</span>
            <select name="movieId" className={inputClass}>
              <option value="">Tous</option>
              {movies.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.title}
                </option>
              ))}
            </select>
          </label>

          <label className="space-y-1.5">
            <span className="text-sm text-ink-100">Categorie (facultatif)</span>
            <select name="seatCategoryId" className={inputClass}>
              <option value="">Toutes</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.cinema.name} - {c.name}
                </option>
              ))}
            </select>
          </label>

          <div className="grid grid-cols-2 gap-2">
            <label className="space-y-1.5">
              <span className="text-sm text-ink-100">De</span>
              <input type="time" name="startTime" className={inputClass} />
            </label>
            <label className="space-y-1.5">
              <span className="text-sm text-ink-100">A</span>
              <input type="time" name="endTime" className={inputClass} />
            </label>
          </div>
        </div>

        <fieldset>
          <legend className="mb-2 text-sm text-ink-100">
            Jours concernes (aucun coche = tous les jours)
          </legend>
          <div className="flex flex-wrap gap-3">
            {DAY_NAMES.map((name, index) => (
              <label key={index} className="flex items-center gap-1.5 text-sm text-ink-200">
                <input
                  type="checkbox"
                  name="daysOfWeek"
                  value={index}
                  className="h-4 w-4 accent-brand-500"
                />
                {name}
              </label>
            ))}
          </div>
        </fieldset>

        <Button type="submit">Ajouter la regle</Button>
      </form>

      <div className="overflow-x-auto rounded-xl border border-ink-700">
        <table className="w-full min-w-4xl text-sm">
          <thead className="bg-ink-850 text-left text-xs uppercase tracking-wider text-ink-400">
            <tr>
              <th className="px-4 py-3">Libelle</th>
              <th className="px-4 py-3">Billet</th>
              <th className="px-4 py-3">Prix</th>
              <th className="px-4 py-3">Portee</th>
              <th className="px-4 py-3">Jours</th>
              <th className="px-4 py-3">Horaire</th>
              <th className="px-4 py-3">Prio</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-ink-800 bg-ink-900">
            {rules.map((rule) => {
              const scope = [
                rule.cinema?.name,
                rule.movie?.title,
                rule.seatCategory?.name,
              ].filter(Boolean);

              const from = minuteToLabel(rule.startMinute);
              const to = minuteToLabel(rule.endMinute);

              return (
                <tr key={rule.id} className={rule.active ? "" : "opacity-50"}>
                  <td className="px-4 py-3 font-medium text-ink-50">
                    {rule.label}
                    {!rule.active && (
                      <Badge tone="outline" className="ml-2">
                        Inactive
                      </Badge>
                    )}
                  </td>
                  <td className="px-4 py-3 text-ink-300">{rule.ticketType.name}</td>
                  <td className="whitespace-nowrap px-4 py-3 font-medium text-brand-400">
                    {formatFcfa(rule.amount)}
                  </td>
                  <td className="px-4 py-3 text-ink-300">
                    {scope.length > 0 ? scope.join(", ") : "Partout"}
                  </td>
                  <td className="px-4 py-3 text-ink-300">
                    {rule.daysOfWeek.length === 0
                      ? "Tous"
                      : rule.daysOfWeek.map((d) => DAY_NAMES[d]).join(", ")}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-ink-300">
                    {from || to ? `${from ?? "00h00"} - ${to ?? "24h00"}` : "Toute la journee"}
                  </td>
                  <td className="px-4 py-3 text-ink-300">{rule.priority}</td>
                  <td className="px-4 py-3 text-right">
                    <form action={toggleRule}>
                      <input type="hidden" name="ruleId" value={rule.id} />
                      <Button type="submit" variant="ghost" size="sm">
                        {rule.active ? "Desactiver" : "Activer"}
                      </Button>
                    </form>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
