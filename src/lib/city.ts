/**
 * Ville active.
 *
 * Culture Parc exploite plusieurs sites dans des villes differentes. Le
 * visiteur choisit la sienne une fois, et tout le site s'y adapte : programme,
 * films a l'affiche, adresses et numeros de telephone.
 *
 * La liste des villes n'est jamais codee en dur : elle se deduit des cinemas
 * actifs, donc un site cree depuis le back-office apparait aussitot.
 */

import { cache } from "react";
import { cookies } from "next/headers";
import { prisma } from "./prisma";

const COOKIE_NAME = "cp_ville";
const COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

export interface CityOption {
  /** Identifiant d'URL, ex. "brazzaville". */
  slug: string;
  /** Nom affiche, ex. "Brazzaville". */
  name: string;
  /** Salles de cette ville. */
  cinemas: {
    id: string;
    name: string;
    slug: string;
    address: string | null;
    phone: string | null;
    email: string | null;
  }[];
}

export function citySlug(city: string): string {
  return city
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * Villes ou Culture Parc est present, dans l'ordre d'affichage voulu.
 *
 * Memoise pour la duree du rendu : l'en-tete, le pied de page et la page
 * elle-meme demandent tous la ville active, et rien ne justifie trois allers
 * vers la base pour une donnee qui ne bouge pas pendant un rendu.
 */
export const getCities = cache(async function getCities(): Promise<CityOption[]> {
  const cinemas = await prisma.cinema.findMany({
    where: { active: true },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      slug: true,
      city: true,
      address: true,
      phone: true,
      email: true,
    },
  });

  const byCity = new Map<string, CityOption>();

  for (const cinema of cinemas) {
    const slug = citySlug(cinema.city);
    const entry = byCity.get(slug);

    const summary = {
      id: cinema.id,
      name: cinema.name,
      slug: cinema.slug,
      address: cinema.address,
      phone: cinema.phone,
      email: cinema.email,
    };

    if (entry) entry.cinemas.push(summary);
    else byCity.set(slug, { slug, name: cinema.city, cinemas: [summary] });
  }

  return [...byCity.values()];
});

/**
 * Ville retenue pour la visite en cours.
 *
 * Sans choix explicite, on renvoie la premiere ville plutot que "toutes" : un
 * habitant de Pointe-Noire n'a que faire des seances de Brazzaville, et un
 * programme melangeant les villes est illisible.
 */
export const getActiveCity = cache(async function getActiveCity(): Promise<{
  city: CityOption | null;
  cities: CityOption[];
  explicit: boolean;
}> {
  const cities = await getCities();
  if (cities.length === 0) return { city: null, cities, explicit: false };

  const store = await cookies();
  const chosen = store.get(COOKIE_NAME)?.value;

  const match = chosen ? cities.find((c) => c.slug === chosen) : undefined;

  return {
    city: match ?? cities[0],
    cities,
    explicit: Boolean(match),
  };
});

/** Identifiants des salles de la ville active, pour filtrer les requetes. */
export async function getActiveCinemaIds(): Promise<string[] | undefined> {
  const { city } = await getActiveCity();
  return city?.cinemas.map((c) => c.id);
}

export const CITY_COOKIE_NAME = COOKIE_NAME;
export const CITY_COOKIE_MAX_AGE = COOKIE_MAX_AGE;
