/**
 * Prepare le logo fourni par Culture Parc :
 * - retire les marges transparentes autour du dessin ;
 * - produit une version large pour l'en-tete et une version carree (la tache
 *   seule) pour les icones de l'application.
 */
import sharp from "sharp";

const SOURCE = "WhatsApp_Image_2026-08-13_at_1.42.28_PM-removebg-preview.png";

const trimmed = await sharp(SOURCE).trim({ threshold: 1 }).toBuffer();
const meta = await sharp(trimmed).metadata();
console.log(`logo detoure : ${meta.width}x${meta.height}`);

await sharp(trimmed).png().toFile("public/logo-culture-parc.png");
console.log("public/logo-culture-parc.png");

// La tache orange occupe la partie droite : on la recadre pour l'icone.
const size = Math.min(meta.width, meta.height);
await sharp(trimmed)
  // On decale legerement vers la droite : le E de CULTURE mord sinon sur le cadre.
  .extract({
    left: Math.max(0, meta.width - size + 16),
    top: 0,
    width: size - 16,
    height: size,
  })
  .resize(512, 512, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
  .png()
  .toFile("public/logo-mark.png");
console.log("public/logo-mark.png");
