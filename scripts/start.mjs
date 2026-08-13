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
    return true;
  } catch {
    return false;
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
    if (await databaseAnswers()) {
      console.log(`Base joignable (tentative ${attempt}).`);

      await run("npx", ["prisma", "migrate", "deploy"]);
      await run("npm", ["run", "start:next"]);
      return;
    }

    console.log(
      `Base injoignable (tentative ${attempt}/${MAX_ATTEMPTS}), nouvel essai dans ${DELAY_MS / 1000}s.`,
    );
    await new Promise((r) => setTimeout(r, DELAY_MS));
  }

  console.error(
    [
      "",
      `La base ${host} est restee injoignable apres ${MAX_ATTEMPTS} tentatives.`,
      "",
      "Deux causes possibles sur Render :",
      "  1. La base et le service web ne sont pas dans la meme region. Le reseau",
      "     prive ne relie que des ressources d'une meme region, et le nom d'hote",
      "     interne dpg-... n'est pas resolvable au-dela. Comparez les regions",
      "     dans le tableau de bord.",
      "  2. La base n'a pas fini d'etre creee, ou a ete suspendue.",
      "",
    ].join("\n"),
  );
  process.exit(1);
}

main().catch((error) => {
  console.error("Demarrage impossible :", error.message);
  process.exit(1);
});
