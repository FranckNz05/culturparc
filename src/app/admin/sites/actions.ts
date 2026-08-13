"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireRole } from "@/auth";
import { prisma } from "@/lib/prisma";
import { slugify } from "@/lib/utils";

const siteSchema = z.object({
  name: z.string().trim().min(2, "Indiquez le nom du site."),
  city: z.string().trim().min(2, "Indiquez la ville."),
  address: z.string().trim().optional(),
  phone: z.string().trim().optional(),
  email: z.union([z.literal(""), z.email("Adresse email invalide.")]).optional(),
  description: z.string().trim().optional(),
});

export interface SiteState {
  error?: string;
  success?: string;
}

/** Categories livrees avec tout nouveau site, modifiables ensuite. */
const DEFAULT_CATEGORIES = [
  { code: "STANDARD", name: "Standard", color: "#3d3d4a", priceModifier: 0, sortOrder: 1 },
  { code: "BALCON", name: "Balcon", color: "#f7941e", priceModifier: 500, sortOrder: 2 },
  { code: "VIP", name: "VIP", color: "#a855f7", priceModifier: 2500, sortOrder: 3 },
];

export async function createSite(
  _prev: SiteState,
  formData: FormData,
): Promise<SiteState> {
  // Ouvrir une ville engage la marque : reserve aux administrateurs.
  const session = await requireRole("ADMIN");
  if (!session) return { error: "Seul un administrateur peut ouvrir un site." };

  const parsed = siteSchema.safeParse({
    name: formData.get("name"),
    city: formData.get("city"),
    address: formData.get("address") ?? "",
    phone: formData.get("phone") ?? "",
    email: formData.get("email") ?? "",
    description: formData.get("description") ?? "",
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Formulaire invalide." };
  }

  const input = parsed.data;

  // Le slug alimente les URL publiques : il doit rester unique.
  const base = slugify(`${input.city}-${input.name}`) || slugify(input.name);
  let slug = base;
  let suffix = 2;
  while (await prisma.cinema.findUnique({ where: { slug } })) {
    slug = `${base}-${suffix++}`;
  }

  const lastOrder = await prisma.cinema.aggregate({ _max: { sortOrder: true } });

  const cinema = await prisma.cinema.create({
    data: {
      name: input.name,
      slug,
      city: input.city,
      address: input.address || null,
      phone: input.phone || null,
      email: input.email || null,
      description: input.description || null,
      sortOrder: (lastOrder._max.sortOrder ?? 0) + 1,
      // Un site sans categorie de siege ne pourrait pas differencier ses tarifs.
      seatCategories: { create: DEFAULT_CATEGORIES },
    },
  });

  revalidatePath("/admin/sites");
  revalidatePath("/", "layout");

  return {
    success: `${cinema.name} ouvert a ${cinema.city}. Ajoutez maintenant ses salles.`,
  };
}

const auditoriumSchema = z.object({
  cinemaId: z.string().min(1),
  name: z.string().trim().min(1, "Indiquez le nom de la salle."),
  screenType: z.enum(["STANDARD", "THREE_D", "PREMIUM", "OUTDOOR"]),
  gridRows: z.coerce.number().int().min(1).max(60),
  gridCols: z.coerce.number().int().min(1).max(60),
});

export async function createAuditorium(
  _prev: SiteState,
  formData: FormData,
): Promise<SiteState> {
  const session = await requireRole("MANAGER");
  if (!session) return { error: "Acces refuse." };

  const parsed = auditoriumSchema.safeParse({
    cinemaId: formData.get("cinemaId"),
    name: formData.get("name"),
    screenType: formData.get("screenType"),
    gridRows: formData.get("gridRows"),
    gridCols: formData.get("gridCols"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Formulaire invalide." };
  }

  const input = parsed.data;

  if (
    session.user.role === "MANAGER" &&
    session.user.cinemaId &&
    input.cinemaId !== session.user.cinemaId
  ) {
    return { error: "Ce site ne releve pas de votre cinema." };
  }

  const exists = await prisma.auditorium.findFirst({
    where: { cinemaId: input.cinemaId, name: input.name },
  });

  if (exists) {
    return { error: `Une salle nommee ${input.name} existe deja sur ce site.` };
  }

  const auditorium = await prisma.auditorium.create({
    data: {
      cinemaId: input.cinemaId,
      name: input.name,
      screenType: input.screenType,
      gridRows: input.gridRows,
      gridCols: input.gridCols,
    },
  });

  revalidatePath("/admin/sites");
  revalidatePath("/admin/salles");

  return {
    success: `Salle ${auditorium.name} creee. Dessinez son plan depuis l'onglet Salles et plans.`,
  };
}

export async function toggleSite(formData: FormData): Promise<void> {
  const session = await requireRole("ADMIN");
  if (!session) return;

  const id = String(formData.get("cinemaId") ?? "");
  if (!id) return;

  const cinema = await prisma.cinema.findUnique({ where: { id } });
  if (!cinema) return;

  await prisma.cinema.update({
    where: { id },
    data: { active: !cinema.active },
  });

  revalidatePath("/admin/sites");
  revalidatePath("/", "layout");
}
