/**
 * Genere les icones de l'application a partir du logo officiel.
 * A relancer si le logo change : node scripts/prepare-logo.mjs && npm run icons
 */
import { mkdir } from "node:fs/promises";
import sharp from "sharp";

const INK = { r: 8, g: 8, b: 11, alpha: 1 };
const MARK = "public/logo-mark.png";

await mkdir("public/icons", { recursive: true });

/** Icone classique : la tache posee sur le noir de la marque. */
async function icon(size, padding) {
  const inner = Math.round(size * (1 - padding * 2));
  const mark = await sharp(MARK).resize(inner, inner, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } }).toBuffer();

  return sharp({
    create: { width: size, height: size, channels: 4, background: INK },
  })
    .composite([{ input: mark, gravity: "center" }])
    .png();
}

for (const size of [192, 512]) {
  await (await icon(size, 0.12)).toFile(`public/icons/icon-${size}.png`);
  console.log(`public/icons/icon-${size}.png`);
}

// Maskable : le systeme rogne les bords, le motif reste dans la zone sure.
await (await icon(512, 0.2)).toFile("public/icons/icon-maskable-512.png");
console.log("public/icons/icon-maskable-512.png");

await (await icon(180, 0.12)).toFile("public/icons/apple-touch-icon.png");
console.log("public/icons/apple-touch-icon.png");

await (await icon(32, 0.06)).toFile("public/icons/favicon-32.png");
console.log("public/icons/favicon-32.png");
