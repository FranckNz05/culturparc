import { revalidatePath } from "next/cache";
import Link from "next/link";
import { requireRole } from "@/auth";
import { prisma } from "@/lib/prisma";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Poster } from "@/components/poster";
import { formatDuration, slugify } from "@/lib/utils";

export const dynamic = "force-dynamic";

const STATUS_LABELS: Record<string, string> = {
  DRAFT: "Brouillon",
  COMING_SOON: "Prochainement",
  NOW_SHOWING: "A l'affiche",
  ARCHIVED: "Archive",
};

async function createMovie(formData: FormData) {
  "use server";

  const session = await requireRole("MANAGER");
  if (!session) return;

  const title = String(formData.get("title") ?? "").trim();
  const durationMin = Number(formData.get("durationMin") ?? 0);

  if (!title || !Number.isFinite(durationMin) || durationMin <= 0) return;

  // Le slug alimente l'URL publique : il doit rester unique meme si deux films
  // portent le meme titre a quelques annees d'intervalle.
  const base = slugify(title);
  let slug = base;
  let suffix = 2;
  while (await prisma.movie.findUnique({ where: { slug } })) {
    slug = `${base}-${suffix++}`;
  }

  await prisma.movie.create({
    data: {
      title,
      slug,
      durationMin: Math.round(durationMin),
      synopsis: String(formData.get("synopsis") ?? "").trim() || null,
      director: String(formData.get("director") ?? "").trim() || null,
      posterUrl: String(formData.get("posterUrl") ?? "").trim() || null,
      trailerUrl: String(formData.get("trailerUrl") ?? "").trim() || null,
      minAge: Number(formData.get("minAge") ?? 0),
      status: String(formData.get("status") ?? "DRAFT") as "DRAFT",
    },
  });

  revalidatePath("/admin/films");
  revalidatePath("/films");
}

async function toggleStatus(formData: FormData) {
  "use server";

  const session = await requireRole("MANAGER");
  if (!session) return;

  const id = String(formData.get("movieId") ?? "");
  const status = String(formData.get("status") ?? "");
  if (!id || !status) return;

  await prisma.movie.update({
    where: { id },
    data: { status: status as "NOW_SHOWING" },
  });

  revalidatePath("/admin/films");
  revalidatePath("/films");
}

const inputClass =
  "w-full rounded-lg border border-ink-600 bg-ink-850 px-3 py-2 text-sm text-ink-50 " +
  "focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500";

export default async function MoviesAdminPage() {
  const movies = await prisma.movie.findMany({
    include: {
      _count: { select: { showtimes: { where: { startsAt: { gte: new Date() } } } } },
    },
    orderBy: [{ status: "asc" }, { title: "asc" }],
  });

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-3xl text-ink-50">Films</h1>
        <p className="mt-1 text-sm text-ink-300">
          {movies.length} film{movies.length > 1 ? "s" : ""} au catalogue.
        </p>
      </div>

      <form
        action={createMovie}
        className="space-y-4 rounded-xl border border-ink-700 bg-ink-900 p-5"
      >
        <h2 className="font-display text-xl text-ink-50">Ajouter un film</h2>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <label className="space-y-1.5">
            <span className="text-sm text-ink-100">Titre</span>
            <input name="title" required className={inputClass} />
          </label>

          <label className="space-y-1.5">
            <span className="text-sm text-ink-100">Duree (minutes)</span>
            <input
              type="number"
              name="durationMin"
              min={1}
              max={600}
              required
              className={inputClass}
            />
          </label>

          <label className="space-y-1.5">
            <span className="text-sm text-ink-100">Realisateur</span>
            <input name="director" className={inputClass} />
          </label>

          <label className="space-y-1.5">
            <span className="text-sm text-ink-100">Age minimum</span>
            <select name="minAge" className={inputClass} defaultValue="0">
              <option value="0">Tout public</option>
              <option value="12">-12 ans</option>
              <option value="16">-16 ans</option>
              <option value="18">-18 ans</option>
            </select>
          </label>

          <label className="space-y-1.5">
            <span className="text-sm text-ink-100">Statut</span>
            <select name="status" className={inputClass} defaultValue="NOW_SHOWING">
              <option value="NOW_SHOWING">A l&apos;affiche</option>
              <option value="COMING_SOON">Prochainement</option>
              <option value="DRAFT">Brouillon</option>
            </select>
          </label>

          <label className="space-y-1.5">
            <span className="text-sm text-ink-100">Affiche (URL)</span>
            <input name="posterUrl" type="url" className={inputClass} />
          </label>

          <label className="space-y-1.5 lg:col-span-2">
            <span className="text-sm text-ink-100">Bande-annonce (URL)</span>
            <input name="trailerUrl" type="url" className={inputClass} />
          </label>

          <label className="space-y-1.5 sm:col-span-2 lg:col-span-3">
            <span className="text-sm text-ink-100">Synopsis</span>
            <textarea name="synopsis" rows={3} className={inputClass} />
          </label>
        </div>

        <Button type="submit">Ajouter le film</Button>
      </form>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {movies.map((movie) => (
          <div
            key={movie.id}
            className="flex gap-4 rounded-xl border border-ink-700 bg-ink-900 p-4"
          >
            <Poster
              src={movie.posterUrl}
              title={movie.title}
              sizes="72px"
              className="aspect-2/3 w-16 shrink-0"
            />

            <div className="min-w-0 flex-1 space-y-2">
              <div>
                <Link
                  href={`/films/${movie.slug}`}
                  className="line-clamp-2 font-medium text-ink-50 hover:text-brand-400"
                >
                  {movie.title}
                </Link>
                <p className="text-xs text-ink-400">
                  {formatDuration(movie.durationMin)} &middot;{" "}
                  {movie._count.showtimes} seance
                  {movie._count.showtimes > 1 ? "s" : ""} a venir
                </p>
              </div>

              <Badge tone={movie.status === "NOW_SHOWING" ? "brand" : "outline"}>
                {STATUS_LABELS[movie.status] ?? movie.status}
              </Badge>

              <form action={toggleStatus} className="flex gap-1">
                <input type="hidden" name="movieId" value={movie.id} />
                <select
                  name="status"
                  defaultValue={movie.status}
                  className="flex-1 rounded border border-ink-600 bg-ink-850 px-2 py-1 text-xs text-ink-100"
                  aria-label={`Statut de ${movie.title}`}
                >
                  <option value="NOW_SHOWING">A l&apos;affiche</option>
                  <option value="COMING_SOON">Prochainement</option>
                  <option value="DRAFT">Brouillon</option>
                  <option value="ARCHIVED">Archive</option>
                </select>
                <Button type="submit" variant="secondary" size="sm">
                  OK
                </Button>
              </form>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
