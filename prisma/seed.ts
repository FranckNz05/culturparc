/**
 * Jeu de donnees de demarrage.
 *
 * Reprend l'organisation reelle de Culture Parc : trois sites, des salles avec
 * un plan de sieges complet, la grille tarifaire affichee en salle, et une
 * programmation sur les jours a venir.
 *
 * Relancable sans risque : tout passe par des upsert sur des cles stables.
 */

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
});

/** Genere les sieges d'une salle : rangees A..n, avec une allee centrale. */
function buildSeatPlan(options: {
  rows: number;
  seatsPerRow: number;
  aisleAfterColumn: number;
  /** Rangees du fond classees en balcon. */
  balconyRows?: string[];
  /** Rangees de tete classees VIP. */
  vipRows?: string[];
  /** Nombre d'emplacements PMR places en bout de premiere rangee. */
  wheelchairSeats?: number;
}) {
  const {
    rows,
    seatsPerRow,
    aisleAfterColumn,
    balconyRows = [],
    vipRows = [],
    wheelchairSeats = 0,
  } = options;

  const seats: {
    rowLabel: string;
    number: number;
    x: number;
    y: number;
    kind: "SEAT" | "WHEELCHAIR" | "AISLE";
    categoryCode: string;
  }[] = [];

  for (let r = 0; r < rows; r++) {
    const rowLabel = String.fromCharCode(65 + r); // A, B, C...
    let seatNumber = 0;

    for (let c = 0; c < seatsPerRow; c++) {
      // La colonne d'allee ne porte aucune place vendable.
      const x = c < aisleAfterColumn ? c : c + 1;

      seatNumber += 1;

      let kind: "SEAT" | "WHEELCHAIR" = "SEAT";
      if (r === 0 && seatNumber <= wheelchairSeats) {
        kind = "WHEELCHAIR";
      }

      let categoryCode = "STANDARD";
      if (balconyRows.includes(rowLabel)) categoryCode = "BALCON";
      if (vipRows.includes(rowLabel)) categoryCode = "VIP";

      seats.push({ rowLabel, number: seatNumber, x, y: r, kind, categoryCode });
    }
  }

  return seats;
}

/** Prochaine occurrence d'une heure donnee, a J+offset. */
function dayAt(dayOffset: number, hour: number, minute = 0): Date {
  const d = new Date();
  d.setDate(d.getDate() + dayOffset);
  d.setHours(hour, minute, 0, 0);
  return d;
}

async function main() {
  console.log("Initialisation des donnees Culture Parc...");

  // -------------------------------------------------------------------------
  // Types de billets : la grille affichee a l'entree des salles.
  // -------------------------------------------------------------------------
  const ticketTypes: Array<{
    code: string;
    name: string;
    sortOrder: number;
    minAge?: number;
    maxAge?: number;
    requiresProof?: boolean;
    description?: string;
  }> = [
    { code: "STANDARD", name: "Tarif standard", sortOrder: 1 },
    {
      code: "CHILD",
      name: "Tarif enfant (3 a 11 ans)",
      minAge: 3,
      maxAge: 11,
      sortOrder: 2,
      requiresProof: false,
    },
    {
      code: "STUDENT",
      name: "Tarif etudiant",
      requiresProof: true,
      description: "Sur presentation d'une carte etudiant valide",
      sortOrder: 3,
    },
    {
      code: "PREMIERE",
      name: "Tarif premiere",
      description: "Avant-premiere",
      sortOrder: 4,
    },
  ];

  for (const t of ticketTypes) {
    await prisma.ticketType.upsert({
      where: { code: t.code },
      update: { name: t.name, sortOrder: t.sortOrder },
      create: t,
    });
  }
  console.log(`  ${ticketTypes.length} types de billets`);

  // -------------------------------------------------------------------------
  // Cinemas
  // -------------------------------------------------------------------------
  const cinemasData = [
    {
      slug: "brazzaville-mfoa",
      name: "Culture Parc Mfoa",
      city: "Brazzaville",
      phone: "06 110 92 01",
      sortOrder: 1,
    },
    {
      slug: "pointe-noire",
      name: "Culture Parc Pointe-Noire",
      city: "Pointe-Noire",
      phone: "06 110 92 92",
      sortOrder: 2,
    },
    {
      slug: "ndjindji",
      name: "Culture Parc Ndjindji",
      city: "Brazzaville",
      phone: "06 110 92 03",
      sortOrder: 3,
    },
  ];

  const cinemas = [];
  for (const c of cinemasData) {
    const cinema = await prisma.cinema.upsert({
      where: { slug: c.slug },
      update: { name: c.name, city: c.city, phone: c.phone },
      create: c,
    });
    cinemas.push(cinema);

    // Categories de sieges, propres a chaque site.
    const categories = [
      { code: "STANDARD", name: "Standard", color: "#3d3d4a", priceModifier: 0, sortOrder: 1 },
      { code: "BALCON", name: "Balcon", color: "#f7941e", priceModifier: 500, sortOrder: 2 },
      { code: "VIP", name: "VIP", color: "#a855f7", priceModifier: 2500, sortOrder: 3 },
    ];

    for (const cat of categories) {
      await prisma.seatCategory.upsert({
        where: { cinemaId_code: { cinemaId: cinema.id, code: cat.code } },
        update: { name: cat.name, color: cat.color, priceModifier: cat.priceModifier },
        create: { ...cat, cinemaId: cinema.id },
      });
    }
  }
  console.log(`  ${cinemas.length} cinemas et leurs categories de sieges`);

  // -------------------------------------------------------------------------
  // Salles et plans de sieges
  // -------------------------------------------------------------------------
  const auditoriumSpecs = [
    { cinemaSlug: "brazzaville-mfoa", name: "Salle 1", rows: 9, seatsPerRow: 14, screenType: "THREE_D" as const },
    { cinemaSlug: "brazzaville-mfoa", name: "Salle 2", rows: 7, seatsPerRow: 12, screenType: "STANDARD" as const },
    { cinemaSlug: "pointe-noire", name: "Salle 1", rows: 8, seatsPerRow: 14, screenType: "THREE_D" as const },
    { cinemaSlug: "ndjindji", name: "Salle 1", rows: 7, seatsPerRow: 12, screenType: "STANDARD" as const },
  ];

  const auditoriums = [];
  for (const spec of auditoriumSpecs) {
    const cinema = cinemas.find((c) => c.slug === spec.cinemaSlug)!;

    const auditorium = await prisma.auditorium.upsert({
      where: { cinemaId_name: { cinemaId: cinema.id, name: spec.name } },
      update: { screenType: spec.screenType },
      create: {
        cinemaId: cinema.id,
        name: spec.name,
        screenType: spec.screenType,
        gridRows: spec.rows,
        gridCols: spec.seatsPerRow + 1, // la colonne d'allee en plus
      },
    });
    auditoriums.push({ ...auditorium, cinemaSlug: spec.cinemaSlug });

    const existingSeats = await prisma.seat.count({
      where: { auditoriumId: auditorium.id },
    });

    if (existingSeats === 0) {
      const cats = await prisma.seatCategory.findMany({
        where: { cinemaId: cinema.id },
      });
      const catByCode = new Map(cats.map((c) => [c.code, c.id]));

      const lastRows = [
        String.fromCharCode(65 + spec.rows - 1),
        String.fromCharCode(65 + spec.rows - 2),
      ];

      const plan = buildSeatPlan({
        rows: spec.rows,
        seatsPerRow: spec.seatsPerRow,
        aisleAfterColumn: Math.floor(spec.seatsPerRow / 2),
        balconyRows: lastRows,
        wheelchairSeats: 2,
      });

      await prisma.seat.createMany({
        data: plan.map((s) => ({
          auditoriumId: auditorium.id,
          rowLabel: s.rowLabel,
          number: s.number,
          x: s.x,
          y: s.y,
          kind: s.kind,
          categoryId: catByCode.get(s.categoryCode) ?? null,
        })),
      });

      console.log(`  ${spec.cinemaSlug} / ${spec.name} : ${plan.length} sieges`);
    }
  }

  // -------------------------------------------------------------------------
  // Genres et films
  // -------------------------------------------------------------------------
  const genreNames = [
    "Action",
    "Aventure",
    "Animation",
    "Comedie",
    "Drame",
    "Science-fiction",
    "Thriller",
    "Famille",
  ];

  for (const name of genreNames) {
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-");
    await prisma.genre.upsert({
      where: { slug },
      update: {},
      create: { name, slug },
    });
  }

  const moviesData: Array<{
    slug: string;
    title: string;
    originalTitle?: string;
    synopsis: string;
    durationMin: number;
    director?: string;
    cast?: string[];
    minAge: number;
    status: "NOW_SHOWING" | "COMING_SOON";
    featured?: boolean;
    posterUrl?: string;
    backdropUrl?: string;
    trailerUrl?: string;
    genres: string[];
  }> = [
    {
      slug: "l-odyssee",
      title: "L'Odyssee",
      originalTitle: "The Odyssey",
      synopsis:
        "Ulysse, roi d'Ithaque, entreprend un long et perilleux retour apres la guerre de Troie. Tout au long de son voyage, il affronte les caprices des dieux, des monstres mythologiques et de rudes epreuves.",
      durationMin: 173,
      director: "Christopher Nolan",
      cast: ["Matt Damon", "Anne Hathaway", "Tom Holland", "Zendaya"],
      minAge: 12,
      status: "NOW_SHOWING",
      featured: true,
      posterUrl: "https://image.tmdb.org/t/p/w500/5rhTDKUhPYvpdQIijFIs5VoWsON.jpg",
      backdropUrl: "https://image.tmdb.org/t/p/w1280/RMXG8myu1aGlNUsRjtxzmpdMK0.jpg",
      trailerUrl: "https://www.youtube.com/watch?v=Mzw2ttJD2qQ",
      genres: ["Aventure", "Action"],
    },
    {
      slug: "spider-man-brand-new-day",
      title: "Spider-Man: Brand New Day",
      synopsis:
        "Peter Parker combat le crime a plein temps dans un monde qui ne se souvient plus de lui. Voir ses anciens amis avancer sans lui declenche un changement qu'il ne maitrise pas, et qui pourrait pourtant seul arreter une menace invisible.",
      durationMin: 145,
      director: "Destin Daniel Cretton",
      cast: ["Tom Holland", "Zendaya", "Jacob Batalon"],
      minAge: 0,
      status: "NOW_SHOWING",
      featured: true,
      posterUrl: "https://image.tmdb.org/t/p/w500/iPOn6DinuVyLY17YM9mKuPofV08.jpg",
      backdropUrl: "https://image.tmdb.org/t/p/w1280/qeQJx07rK2xm8SD2sJxFKhE7gs0.jpg",
      trailerUrl: "https://www.youtube.com/watch?v=8TZMtslA3UY",
      genres: ["Action", "Aventure", "Science-fiction"],
    },
    {
      slug: "zootopie-2",
      title: "Zootopie 2",
      originalTitle: "Zootopia 2",
      synopsis:
        "Apres avoir resolu la plus grande enquete de l'histoire de Zootopie, Judy Hopps et Nick Wilde suivent la piste d'un nouveau mystere. Pour y voir clair, ils doivent infiltrer des quartiers inconnus, et leur duo n'a jamais ete autant mis a l'epreuve.",
      durationMin: 108,
      director: "Jared Bush",
      cast: ["Ginnifer Goodwin", "Jason Bateman"],
      minAge: 0,
      status: "NOW_SHOWING",
      posterUrl: "https://image.tmdb.org/t/p/w500/oJ7g2CifqpStmoYQyaLQgEU32qO.jpg",
      backdropUrl: "https://image.tmdb.org/t/p/w1280/lgotja3xMoJZbynwHfcQcJAEMWH.jpg",
      trailerUrl: "https://www.youtube.com/watch?v=BjkIOU5PhyQ",
      genres: ["Animation", "Famille", "Comedie"],
    },
    {
      slug: "wicked-partie-2",
      title: "Wicked : Partie 2",
      originalTitle: "Wicked: For Good",
      synopsis:
        "Alors qu'une foule en colere se souleve contre la Mechante Sorciere, Glinda et Elphaba doivent se retrouver une derniere fois. Leur amitie devient le point d'appui de leur avenir, et celui de tout Oz.",
      durationMin: 137,
      director: "Jon M. Chu",
      cast: ["Cynthia Erivo", "Ariana Grande", "Jeff Goldblum", "Michelle Yeoh"],
      minAge: 0,
      status: "NOW_SHOWING",
      posterUrl: "https://image.tmdb.org/t/p/w500/si9tolnefLSUKaqQEGz1bWArOaL.jpg",
      backdropUrl: "https://image.tmdb.org/t/p/w1280/cGbPBHKSFO7hSIjxkb3KOaGdOep.jpg",
      trailerUrl: "https://www.youtube.com/watch?v=vt98AlBDI9Y",
      genres: ["Aventure", "Drame"],
    },
    {
      slug: "avatar-de-feu-et-de-cendres",
      title: "Avatar : De feu et de cendres",
      originalTitle: "Avatar: Fire and Ash",
      synopsis:
        "Apres la guerre contre la RDA et la perte de leur fils aine, Jake Sully et Neytiri affrontent une nouvelle menace sur Pandora : le Peuple des Cendres, une tribu Na'vi violente menee par l'implacable Varang.",
      durationMin: 198,
      director: "James Cameron",
      cast: ["Sam Worthington", "Zoe Saldana", "Sigourney Weaver"],
      minAge: 12,
      status: "COMING_SOON",
      posterUrl: "https://image.tmdb.org/t/p/w500/bRBeSHfGHwkEpImlhxPmOcUsaeg.jpg",
      backdropUrl: "https://image.tmdb.org/t/p/w1280/sdZSjtGUTSN8B3al5o0f2WoQfQQ.jpg",
      trailerUrl: "https://www.youtube.com/watch?v=nb_fFj_0rq8",
      genres: ["Science-fiction", "Aventure"],
    },
  ];

  const movies = [];
  for (const m of moviesData) {
    const { genres, ...data } = m;
    const movie = await prisma.movie.upsert({
      where: { slug: m.slug },
      update: {
        status: data.status,
        featured: data.featured ?? false,
        posterUrl: data.posterUrl ?? null,
        backdropUrl: data.backdropUrl ?? null,
        trailerUrl: data.trailerUrl ?? null,
      },
      create: {
        ...data,
        genres: {
          connect: genres.map((g) => ({
            slug: g.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
          })),
        },
      },
    });
    movies.push(movie);
  }
  console.log(`  ${movies.length} films`);

  // -------------------------------------------------------------------------
  // Grille tarifaire
  // -------------------------------------------------------------------------
  const types = await prisma.ticketType.findMany();
  const typeByCode = new Map(types.map((t) => [t.code, t.id]));

  const priceRules: Array<{
    label: string;
    ticketTypeCode: string;
    amount: number;
    priority: number;
    daysOfWeek?: number[];
    startMinute?: number;
    endMinute?: number;
  }> = [
    { label: "Standard", ticketTypeCode: "STANDARD", amount: 2500, priority: 0 },
    { label: "Enfant 3 a 11 ans", ticketTypeCode: "CHILD", amount: 1000, priority: 0 },
    { label: "Etudiant", ticketTypeCode: "STUDENT", amount: 1500, priority: 0 },
    { label: "Avant-premiere", ticketTypeCode: "PREMIERE", amount: 5000, priority: 0 },
    // Seances de journee en semaine : tarif reduit jusqu'a 18h00.
    {
      label: "Matinee en semaine",
      ticketTypeCode: "STANDARD",
      amount: 1500,
      priority: 10,
      daysOfWeek: [1, 2, 3, 4, 5],
      startMinute: 0,
      endMinute: 18 * 60,
    },
  ];

  for (const rule of priceRules) {
    const ticketTypeId = typeByCode.get(rule.ticketTypeCode)!;
    const existing = await prisma.priceRule.findFirst({
      where: { label: rule.label, ticketTypeId },
    });

    const data = {
      label: rule.label,
      ticketTypeId,
      amount: rule.amount,
      priority: rule.priority,
      daysOfWeek: rule.daysOfWeek ?? [],
      startMinute: rule.startMinute ?? null,
      endMinute: rule.endMinute ?? null,
    };

    if (existing) {
      await prisma.priceRule.update({ where: { id: existing.id }, data });
    } else {
      await prisma.priceRule.create({ data });
    }
  }
  console.log(`  ${priceRules.length} regles tarifaires`);

  // -------------------------------------------------------------------------
  // Programmation : les seances des prochains jours
  // -------------------------------------------------------------------------
  const nowShowing = movies.filter((m) => m.status === "NOW_SHOWING");
  const slots = [14, 16, 19, 21];

  let showtimeCount = 0;
  for (const auditorium of auditoriums) {
    const cinema = cinemas.find((c) => c.slug === auditorium.cinemaSlug)!;

    for (let day = 0; day < 7; day++) {
      for (let s = 0; s < slots.length; s++) {
        const movie = nowShowing[(day + s + auditorium.name.length) % nowShowing.length];
        const startsAt = dayAt(day, slots[s]);

        // On ne programme pas dans le passe.
        if (startsAt.getTime() < Date.now()) continue;

        const endsAt = new Date(startsAt.getTime() + (movie.durationMin + 20) * 60_000);

        await prisma.showtime.upsert({
          where: {
            auditoriumId_startsAt: {
              auditoriumId: auditorium.id,
              startsAt,
            },
          },
          update: {},
          create: {
            movieId: movie.id,
            auditoriumId: auditorium.id,
            cinemaId: cinema.id,
            startsAt,
            endsAt,
            basePrice: 2500,
            format: auditorium.screenType === "THREE_D" ? "THREE_D" : "TWO_D",
            language: "VF",
          },
        });
        showtimeCount += 1;
      }
    }
  }
  console.log(`  ${showtimeCount} seances programmees`);

  // -------------------------------------------------------------------------
  // Formules d'abonnement
  // -------------------------------------------------------------------------
  const plans = [
    {
      slug: "pass-decouverte",
      name: "Pass Decouverte",
      description: "5 seances a utiliser en 3 mois, dans tous les Culture Parc.",
      price: 10000,
      durationDays: 90,
      credits: 5,
      perks: ["5 seances", "Valable dans les 3 sites", "Transferable une fois"],
      sortOrder: 1,
    },
    {
      slug: "pass-illimite",
      name: "Pass Illimite",
      description: "Toutes les seances pendant 30 jours.",
      price: 25000,
      durationDays: 30,
      credits: 0, // 0 = illimite
      perks: ["Seances illimitees", "Avant-premieres incluses", "Boisson offerte le mardi"],
      sortOrder: 2,
    },
  ];

  for (const p of plans) {
    await prisma.subscriptionPlan.upsert({
      where: { slug: p.slug },
      update: { price: p.price, description: p.description },
      create: p,
    });
  }
  console.log(`  ${plans.length} formules d'abonnement`);

  // -------------------------------------------------------------------------
  // Comptes de demonstration
  // -------------------------------------------------------------------------
  const adminPassword = await bcrypt.hash("CultureParc2026!", 10);

  await prisma.user.upsert({
    where: { email: "admin@cultureparc.cg" },
    update: {},
    create: {
      email: "admin@cultureparc.cg",
      name: "Administrateur",
      passwordHash: adminPassword,
      role: "ADMIN",
    },
  });

  await prisma.user.upsert({
    where: { email: "controle@cultureparc.cg" },
    update: {},
    create: {
      email: "controle@cultureparc.cg",
      name: "Controle d'acces Mfoa",
      passwordHash: adminPassword,
      role: "STAFF",
      cinemaId: cinemas[0].id,
    },
  });

  console.log("  2 comptes de demonstration (mot de passe : CultureParc2026!)");
  console.log("Termine.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
