/**
 * Lectures partagees entre les pages publiques.
 * Tout est en Server Components : ces fonctions ne s'executent jamais chez le client.
 */

import { prisma } from "./prisma";

/** Debut de journee locale, pour ne jamais afficher une seance deja passee. */
export function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

export function endOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
}

export async function getCinemas() {
  return prisma.cinema.findMany({
    where: { active: true },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
  });
}

/**
 * Films avec au moins une seance a venir. Un film sans seance programmee n'a
 * rien a faire sur la page d'accueil, meme marque "a l'affiche".
 */
export async function getNowShowingMovies(cinemaIds?: string[]) {
  return prisma.movie.findMany({
    where: {
      status: "NOW_SHOWING",
      showtimes: {
        some: {
          startsAt: { gte: new Date() },
          status: "SCHEDULED",
          ...(cinemaIds?.length ? { cinemaId: { in: cinemaIds } } : {}),
        },
      },
    },
    include: { genres: true },
    orderBy: [{ featured: "desc" }, { title: "asc" }],
  });
}

export async function getComingSoonMovies() {
  return prisma.movie.findMany({
    where: { status: "COMING_SOON" },
    include: { genres: true },
    orderBy: { releaseDate: "asc" },
    take: 8,
  });
}

export async function getMovieBySlug(slug: string) {
  return prisma.movie.findUnique({
    where: { slug },
    include: { genres: true },
  });
}

export interface ShowtimeWithContext {
  id: string;
  startsAt: Date;
  format: string;
  language: string;
  basePrice: number;
  isPremiere: boolean;
  auditorium: { id: string; name: string };
  cinema: { id: string; name: string; slug: string; city: string };
  movie: { id: string; slug: string; title: string; durationMin: number; minAge: number; posterUrl: string | null };
  seatsTaken: number;
  seatsTotal: number;
}

/**
 * Seances a venir, avec le taux de remplissage.
 *
 * Le comptage des places occupees additionne les billets emis et les retenues
 * encore valides : une place en cours de paiement ne doit pas etre annoncee
 * comme libre.
 */
export async function getUpcomingShowtimes(options: {
  movieId?: string;
  cinemaId?: string;
  cinemaIds?: string[];
  from?: Date;
  to?: Date;
  limit?: number;
}): Promise<ShowtimeWithContext[]> {
  const showtimes = await prisma.showtime.findMany({
    where: {
      status: "SCHEDULED",
      startsAt: {
        gte: options.from ?? new Date(),
        ...(options.to ? { lte: options.to } : {}),
      },
      ...(options.movieId ? { movieId: options.movieId } : {}),
      ...(options.cinemaId ? { cinemaId: options.cinemaId } : {}),
      ...(options.cinemaIds?.length && !options.cinemaId
        ? { cinemaId: { in: options.cinemaIds } }
        : {}),
    },
    include: {
      auditorium: {
        select: {
          id: true,
          name: true,
          _count: { select: { seats: { where: { kind: "SEAT", active: true } } } },
        },
      },
      cinema: { select: { id: true, name: true, slug: true, city: true } },
      movie: {
        select: {
          id: true,
          slug: true,
          title: true,
          durationMin: true,
          minAge: true,
          posterUrl: true,
        },
      },
      // Un billet annule libere sa place : il ne compte pas comme occupe.
      _count: {
        select: { tickets: { where: { status: { in: ["VALID", "SCANNED"] } } } },
      },
    },
    orderBy: { startsAt: "asc" },
    take: options.limit ?? 200,
  });

  if (showtimes.length === 0) return [];

  // Retenues encore vivantes, comptees en une seule requete.
  const holds = await prisma.seatHold.groupBy({
    by: ["showtimeId"],
    where: {
      showtimeId: { in: showtimes.map((s) => s.id) },
      expiresAt: { gt: new Date() },
    },
    _count: { _all: true },
  });

  const holdsByShowtime = new Map(holds.map((h) => [h.showtimeId, h._count._all]));

  return showtimes.map((s) => ({
    id: s.id,
    startsAt: s.startsAt,
    format: s.format,
    language: s.language,
    basePrice: s.basePrice,
    isPremiere: s.isPremiere,
    auditorium: { id: s.auditorium.id, name: s.auditorium.name },
    cinema: s.cinema,
    movie: s.movie,
    seatsTaken: s._count.tickets + (holdsByShowtime.get(s.id) ?? 0),
    seatsTotal: s.auditorium._count.seats,
  }));
}

/** Regroupe des seances par jour, puis par cinema : la forme du programme. */
export function groupShowtimesByDay(showtimes: ShowtimeWithContext[]) {
  const byDay = new Map<string, ShowtimeWithContext[]>();

  for (const showtime of showtimes) {
    const key = showtime.startsAt.toISOString().slice(0, 10);
    const bucket = byDay.get(key);
    if (bucket) {
      bucket.push(showtime);
    } else {
      byDay.set(key, [showtime]);
    }
  }

  return [...byDay.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, items]) => ({ date, showtimes: items }));
}

export async function getSubscriptionPlans() {
  return prisma.subscriptionPlan.findMany({
    where: { active: true },
    orderBy: { sortOrder: "asc" },
  });
}
