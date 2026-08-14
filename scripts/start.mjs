/**
 * Demarrage du service en production.
 *
 * Trois etapes, dans cet ordre : attendre que la base reponde, appliquer les
 * migrations, lancer le serveur.
 *
 * L'attente n'est pas un ornement. Au premier deploiement, la base est encore
 * en cours de creation quand le service demarre, et une tentative de migration
 * immediate echoue sur un P1001. Sans cette boucle, le service part en boucle
 * de redemarrage sans jamais reussir, alors qu'il suffisait d'attendre.
 */

import { spawn } from "node:child_process";
import { Client } from "pg";

// En local, les variables vivent dans .env ; sur Render, elles sont deja dans
// l'environnement. On charge donc dotenv s'il est la, sans en dependre.
try {
  await import("dotenv/config");
} catch {
  // dotenv absent : les variables viennent forcement de l'environnement.
}

const MAX_ATTEMPTS = 20;
const DELAY_MS = 5000;

function run(command, args) {
  return new Promise((resolve, reject) => {
    // Windows a besoin du shell pour resoudre npx et npm ; Linux, non, et le
    // lui imposer declenche un avertissement de securite de Node.
    const child = spawn(command, args, {
      stdio: "inherit",
      shell: process.platform === "win32",
    });
    child.on("close", (code) =>
      code === 0 ? resolve() : reject(new Error(`${command} a echoue (code ${code})`)),
    );
    child.on("error", reject);
  });
}

async function databaseAnswers() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    connectionTimeoutMillis: 5000,
  });
  try {
    await client.connect();
    await client.query("select 1");
    return { ok: true };
  } catch (error) {
    return { ok: false, code: error.code, message: error.message };
  } finally {
    await client.end().catch(() => {});
  }
}

/**
 * Distingue les deux echecs, qui n'appellent pas la meme reponse.
 *
 * Un nom d'hote qui ne resout pas ne resoudra pas davantage dans dix secondes :
 * l'hote interne dpg-... n'est visible que depuis la region de la base, donc
 * attendre est inutile et il faut le dire tout de suite. Une connexion refusee,
 * elle, signale une base qui n'a pas fini de demarrer, et la patience suffit.
 */
function hostnameUnresolvable(result) {
  return result.code === "ENOTFOUND" || result.code === "EAI_AGAIN";
}

/**
 * Amorce le catalogue si la base est encore vide.
 *
 * Les migrations creent les tables, jamais les donnees : sans cette etape, un
 * deploiement neuf presente un site sans cinema, sans film, et surtout sans
 * compte administrateur, donc impossible a configurer. La connexion echouerait
 * sur un CredentialsSignin parfaitement exact mais incomprehensible.
 *
 * Le declencheur est l'absence totale de cinema. Des qu'un seul existe, plus
 * rien n'est ecrit : les donnees reelles de l'exploitant ne risquent jamais
 * d'etre ecrasees par le jeu de demonstration.
 */
async function seedIfEmpty() {
  const client = new Client({ connectionString: process.env.DATABASE_URL });

  try {
    await client.connect();
    const { rows } = await client.query("select count(*)::int as n from cinemas");

    if (rows[0].n > 0) {
      console.log(`Catalogue deja renseigne (${rows[0].n} cinemas), amorcage ignore.`);
      return;
    }

    console.log("Base vide : amorcage du catalogue de demonstration...");
    await run("npx", ["prisma", "db", "seed"]);
  } catch (error) {
    // Un amorcage rate ne doit pas empecher le service de demarrer : le site
    // s'affichera vide, ce qui reste diagnosticable, alors qu'un service mort
    // ne dit rien.
    console.error("Amorcage impossible :", error.message);
  } finally {
    await client.end().catch(() => {});
  }
}

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error(
      "DATABASE_URL absente. Sur Render, verifiez que le service est bien rattache a la base dans l'onglet Environment.",
    );
    process.exit(1);
  }

  // Le nom d'hote interne renseigne sur ce qu'on attend, sans divulguer le
  // mot de passe contenu dans l'URL.
  const host = (() => {
    try {
      return new URL(process.env.DATABASE_URL).hostname;
    } catch {
      return "inconnu";
    }
  })();

  console.log(`Attente de la base ${host}...`);

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const result = await databaseAnswers();

    if (result.ok) {
      console.log(`Base joignable (tentative ${attempt}).`);

      await run("npx", ["prisma", "migrate", "deploy"]);
      await seedIfEmpty();
      await run("npm", ["run", "start:next"]);
      return;
    }

    if (hostnameUnresolvable(result)) {
      console.error(
        [
          "",
          `Le nom d'hote ${host} n'existe pas pour ce service.`,
          "",
          "Un hote interne Render (dpg-...-a) n'est visible que depuis la region",
          "de la base. Attendre n'y changera rien.",
          "",
          "Deux corrections possibles, au choix :",
          "",
          "  1. Aligner les regions. Dans le tableau de bord, comparez la region",
          "     de la base et celle du service web. Si elles different, supprimez",
          "     la base et laissez le blueprint la recreer dans la region du",
          "     service (render.yaml la fixe a frankfurt).",
          "",
          "  2. Passer par l'adresse externe, qui fonctionne quelle que soit la",
          "     region. Sur la page de la base, section Connections, copiez",
          "     l'External Database URL, puis collez-la dans DATABASE_URL depuis",
          "     l'onglet Environment du service web. Elle ressemble a :",
          "     postgresql://...@dpg-....frankfurt-postgres.render.com/cultureparc",
          "",
        ].join("\n"),
      );
      process.exit(1);
    }

    console.log(
      `Base injoignable (tentative ${attempt}/${MAX_ATTEMPTS}) : ${result.code ?? result.message}. Nouvel essai dans ${DELAY_MS / 1000}s.`,
    );
    await new Promise((r) => setTimeout(r, DELAY_MS));
  }

  console.error(
    [
      "",
      `La base ${host} est restee injoignable apres ${MAX_ATTEMPTS} tentatives.`,
      "Elle repond au reseau mais refuse les connexions : verifiez dans le",
      "tableau de bord qu'elle est bien demarree et non suspendue.",
      "",
    ].join("\n"),
  );
  process.exit(1);
}

main().catch((error) => {
  console.error("Demarrage impossible :", error.message);
  process.exit(1);
});
