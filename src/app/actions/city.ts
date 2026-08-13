"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { CITY_COOKIE_MAX_AGE, CITY_COOKIE_NAME, getCities } from "@/lib/city";

/**
 * Change la ville active. La valeur est verifiee contre les villes reellement
 * exploitees : un slug forge dans le cookie ne doit pas vider le programme.
 */
export async function selectCity(formData: FormData): Promise<void> {
  const slug = String(formData.get("city") ?? "");
  const cities = await getCities();

  if (!cities.some((c) => c.slug === slug)) return;

  const store = await cookies();
  store.set(CITY_COOKIE_NAME, slug, {
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: CITY_COOKIE_MAX_AGE,
    path: "/",
  });

  // Toutes les pages publiques dependent de la ville.
  revalidatePath("/", "layout");
}
