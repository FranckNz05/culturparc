/**
 * Televersement des medias du catalogue.
 *
 * L'exploitant a le choix : coller une URL, ou envoyer un fichier depuis son
 * ordinateur. Le fichier est enregistre en base et sert ensuite sous une URL
 * interne, ce qui rend les deux cas indistinguables pour le reste du code.
 */

import { prisma } from "./prisma";

/** Une affiche depasse rarement 2 Mo ; on laisse de la marge. */
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
/**
 * Les extraits sont courts et muets. La limite protege la base : un fichier
 * lourd la ferait gonfler et ralentirait les sauvegardes.
 */
export const MAX_VIDEO_BYTES = 25 * 1024 * 1024;

const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/avif"];
const VIDEO_TYPES = ["video/mp4", "video/webm", "video/ogg", "video/quicktime"];

export class MediaUploadError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MediaUploadError";
  }
}

function formatSize(bytes: number): string {
  return bytes >= 1024 * 1024
    ? `${(bytes / (1024 * 1024)).toFixed(1)} Mo`
    : `${Math.round(bytes / 1024)} ko`;
}

/**
 * Enregistre un fichier et renvoie son URL publique.
 * Renvoie null si aucun fichier n'a ete choisi, ce qui est le cas courant.
 */
export async function storeUploadedFile(
  file: File | null | undefined,
  expected: "IMAGE" | "VIDEO",
): Promise<string | null> {
  if (!file || file.size === 0) return null;

  const allowed = expected === "IMAGE" ? IMAGE_TYPES : VIDEO_TYPES;
  const limit = expected === "IMAGE" ? MAX_IMAGE_BYTES : MAX_VIDEO_BYTES;

  if (!allowed.includes(file.type)) {
    throw new MediaUploadError(
      expected === "IMAGE"
        ? "Format d'image non accepte. Utilisez un JPEG, PNG, WebP ou AVIF."
        : "Format video non accepte. Utilisez un MP4, WebM ou MOV.",
    );
  }

  if (file.size > limit) {
    throw new MediaUploadError(
      `Fichier trop lourd : ${formatSize(file.size)} pour un maximum de ${formatSize(limit)}.`,
    );
  }

  const data = Buffer.from(await file.arrayBuffer());

  const asset = await prisma.mediaAsset.create({
    data: {
      filename: file.name.slice(0, 200),
      mimeType: file.type,
      size: file.size,
      kind: expected,
      data,
    },
    select: { id: true },
  });

  return `/api/medias/${asset.id}`;
}

/**
 * Choisit entre le fichier televerse et l'URL saisie.
 * Le fichier l'emporte : c'est le geste le plus explicite de l'exploitant.
 */
export async function resolveMediaInput(options: {
  file: File | null | undefined;
  url: string | null | undefined;
  kind: "IMAGE" | "VIDEO";
  /** Valeur actuelle, conservee si rien de nouveau n'est fourni. */
  current?: string | null;
}): Promise<string | null> {
  const uploaded = await storeUploadedFile(options.file, options.kind);
  if (uploaded) return uploaded;

  const url = options.url?.trim();
  if (url) return url;

  return options.current ?? null;
}
