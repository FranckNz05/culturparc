"use server";

import { revalidatePath } from "next/cache";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { auth, requireRole } from "@/auth";
import { prisma } from "@/lib/prisma";
import { isValidCongoPhone, toE164 } from "@/lib/phone";
import { MIN_PASSWORD_LENGTH } from "@/lib/constants";

const createSchema = z.object({
  name: z.string().trim().min(2, "Indiquez le nom de la personne."),
  email: z.email("Adresse email invalide."),
  phone: z.union([
    z.literal(""),
    z.string().refine(isValidCongoPhone, {
      message: "Numero invalide. Format attendu : 06 110 92 01.",
    }),
  ]),
  role: z.enum(["CUSTOMER", "STAFF", "MANAGER", "ADMIN"]),
  cinemaId: z.string(),
  password: z
    .string()
    .min(MIN_PASSWORD_LENGTH, `Le mot de passe doit faire au moins ${MIN_PASSWORD_LENGTH} caracteres.`),
});

export interface UserState {
  error?: string;
  success?: string;
}

export async function createUser(
  _prev: UserState,
  formData: FormData,
): Promise<UserState> {
  const session = await requireRole("ADMIN");
  if (!session) return { error: "Seul un administrateur peut creer un compte." };

  const parsed = createSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    phone: formData.get("phone") ?? "",
    role: formData.get("role"),
    cinemaId: formData.get("cinemaId") ?? "",
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Formulaire invalide." };
  }

  const input = parsed.data;
  const email = input.email.toLowerCase();

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return { error: `Un compte utilise deja l'adresse ${email}.` };
  }

  // Le personnel est rattache a un cinema ; un administrateur voit tout.
  const cinemaId = input.role === "ADMIN" ? null : input.cinemaId || null;

  if (input.role !== "ADMIN" && input.role !== "CUSTOMER" && !cinemaId) {
    return { error: "Choisissez le cinema de rattachement." };
  }

  await prisma.user.create({
    data: {
      name: input.name,
      email,
      phone: input.phone ? toE164(input.phone) : null,
      role: input.role,
      cinemaId,
      passwordHash: await bcrypt.hash(input.password, 10),
    },
  });

  revalidatePath("/admin/utilisateurs");

  return {
    success: `Compte cree pour ${input.name}. Communiquez-lui son mot de passe et demandez-lui de le changer a la premiere connexion.`,
  };
}

const roleSchema = z.object({
  userId: z.string().min(1),
  role: z.enum(["CUSTOMER", "STAFF", "MANAGER", "ADMIN"]),
  cinemaId: z.string(),
});

export async function updateUserRole(formData: FormData): Promise<void> {
  const session = await requireRole("ADMIN");
  if (!session) return;

  const parsed = roleSchema.safeParse({
    userId: formData.get("userId"),
    role: formData.get("role"),
    cinemaId: formData.get("cinemaId") ?? "",
  });

  if (!parsed.success) return;

  // Un administrateur ne peut pas se retirer ses propres droits : ce serait le
  // moyen le plus simple de se verrouiller dehors, sans recours.
  if (parsed.data.userId === session.user.id) return;

  await prisma.user.update({
    where: { id: parsed.data.userId },
    data: {
      role: parsed.data.role,
      cinemaId: parsed.data.role === "ADMIN" ? null : parsed.data.cinemaId || null,
    },
  });

  revalidatePath("/admin/utilisateurs");
}

const resetSchema = z.object({
  userId: z.string().min(1),
  password: z.string().min(MIN_PASSWORD_LENGTH),
});

/** Reinitialisation par l'administrateur, quand un mot de passe est oublie. */
export async function resetUserPassword(
  _prev: UserState,
  formData: FormData,
): Promise<UserState> {
  const session = await requireRole("ADMIN");
  if (!session) return { error: "Acces refuse." };

  const parsed = resetSchema.safeParse({
    userId: formData.get("userId"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return {
      error: `Le mot de passe doit faire au moins ${MIN_PASSWORD_LENGTH} caracteres.`,
    };
  }

  const user = await prisma.user.update({
    where: { id: parsed.data.userId },
    data: { passwordHash: await bcrypt.hash(parsed.data.password, 10) },
    select: { name: true },
  });

  revalidatePath("/admin/utilisateurs");

  return { success: `Mot de passe reinitialise pour ${user.name}.` };
}

const passwordSchema = z
  .object({
    current: z.string().min(1, "Saisissez votre mot de passe actuel."),
    next: z
      .string()
      .min(MIN_PASSWORD_LENGTH, `Le nouveau mot de passe doit faire au moins ${MIN_PASSWORD_LENGTH} caracteres.`),
    confirm: z.string(),
  })
  .refine((data) => data.next === data.confirm, {
    message: "Les deux nouveaux mots de passe ne correspondent pas.",
  })
  .refine((data) => data.next !== data.current, {
    message: "Le nouveau mot de passe doit differer de l'ancien.",
  });

/**
 * Changement de son propre mot de passe.
 *
 * L'ancien mot de passe est exige meme si la session est valide : sans lui,
 * un poste laisse ouvert quelques minutes suffirait a en prendre le controle
 * definitif.
 */
export async function changeOwnPassword(
  _prev: UserState,
  formData: FormData,
): Promise<UserState> {
  const session = await auth();
  if (!session?.user) return { error: "Vous n'etes pas connecte." };

  const parsed = passwordSchema.safeParse({
    current: formData.get("current"),
    next: formData.get("next"),
    confirm: formData.get("confirm"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Formulaire invalide." };
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { passwordHash: true },
  });

  if (!user?.passwordHash) {
    return { error: "Ce compte n'utilise pas de mot de passe." };
  }

  const valid = await bcrypt.compare(parsed.data.current, user.passwordHash);
  if (!valid) {
    return { error: "Mot de passe actuel incorrect." };
  }

  await prisma.user.update({
    where: { id: session.user.id },
    data: { passwordHash: await bcrypt.hash(parsed.data.next, 10) },
  });

  return { success: "Mot de passe modifie." };
}
