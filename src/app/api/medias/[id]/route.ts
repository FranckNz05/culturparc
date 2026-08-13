import { prisma } from "@/lib/prisma";

/**
 * Sert un media televerse.
 *
 * Le contenu est immuable : un fichier remplace donne un nouvel identifiant.
 * On peut donc le mettre en cache tres longtemps, ce qui evite de relire la
 * base a chaque affiche affichee sur la page d'accueil.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const asset = await prisma.mediaAsset.findUnique({
    where: { id },
    select: { data: true, mimeType: true, size: true, filename: true },
  });

  if (!asset) {
    return new Response("Media introuvable.", { status: 404 });
  }

  const etag = `"${id}"`;

  // Le navigateur revient avec son etag : inutile de renvoyer les octets.
  if (request.headers.get("if-none-match") === etag) {
    return new Response(null, { status: 304, headers: { ETag: etag } });
  }

  return new Response(new Uint8Array(asset.data) as BodyInit, {
    headers: {
      "Content-Type": asset.mimeType,
      "Content-Length": String(asset.size),
      "Cache-Control": "public, max-age=31536000, immutable",
      ETag: etag,
      "Content-Disposition": `inline; filename="${encodeURIComponent(asset.filename)}"`,
    },
  });
}
