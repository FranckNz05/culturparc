/**
 * Bandes-annonces.
 *
 * L'exploitant colle l'URL qu'il a sous la main : un lien YouTube, une page
 * Vimeo, ou un fichier video heberge ailleurs. On reconnait la source pour
 * produire soit une iframe de lecture, soit une balise video native, sans lui
 * demander de comprendre la difference.
 */

export type VideoKind = "YOUTUBE" | "VIMEO" | "FILE" | "UNKNOWN";

export interface VideoSource {
  kind: VideoKind;
  /** URL prete a poser dans une iframe, pour YouTube et Vimeo. */
  embedUrl?: string;
  /** URL du fichier, pour une balise video. */
  fileUrl?: string;
  /** Vignette deduite de la source quand elle existe. */
  thumbnailUrl?: string;
  /** Identifiant YouTube brut, necessaire pour une lecture en boucle. */
  youtubeId?: string;
}

const YOUTUBE_HOSTS = ["youtube.com", "www.youtube.com", "m.youtube.com", "youtu.be"];
const VIMEO_HOSTS = ["vimeo.com", "www.vimeo.com", "player.vimeo.com"];
const FILE_EXTENSIONS = [".mp4", ".webm", ".ogg", ".ogv", ".mov", ".m4v"];

function youtubeId(url: URL): string | null {
  if (url.hostname === "youtu.be") {
    return url.pathname.slice(1) || null;
  }
  if (url.pathname.startsWith("/embed/")) {
    return url.pathname.slice("/embed/".length) || null;
  }
  if (url.pathname.startsWith("/shorts/")) {
    return url.pathname.slice("/shorts/".length) || null;
  }
  return url.searchParams.get("v");
}

function vimeoId(url: URL): string | null {
  const match = /\/(\d+)/.exec(url.pathname);
  return match ? match[1] : null;
}

export function parseVideoUrl(raw: string | null | undefined): VideoSource {
  if (!raw?.trim()) return { kind: "UNKNOWN" };

  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    return { kind: "UNKNOWN" };
  }

  // On n'accepte que http(s) : un lien javascript: ou data: n'a rien a faire
  // dans une iframe ou une balise video.
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    return { kind: "UNKNOWN" };
  }

  if (YOUTUBE_HOSTS.includes(url.hostname)) {
    const id = youtubeId(url);
    if (!id) return { kind: "UNKNOWN" };
    return {
      kind: "YOUTUBE",
      // rel=0 evite de proposer les films des concurrents en fin de lecture.
      embedUrl: `https://www.youtube-nocookie.com/embed/${encodeURIComponent(id)}?rel=0&modestbranding=1`,
      youtubeId: id,
      thumbnailUrl: `https://img.youtube.com/vi/${encodeURIComponent(id)}/hqdefault.jpg`,
    };
  }

  if (VIMEO_HOSTS.includes(url.hostname)) {
    const id = vimeoId(url);
    if (!id) return { kind: "UNKNOWN" };
    return {
      kind: "VIMEO",
      embedUrl: `https://player.vimeo.com/video/${encodeURIComponent(id)}`,
    };
  }

  const path = url.pathname.toLowerCase();
  if (FILE_EXTENSIONS.some((ext) => path.endsWith(ext))) {
    return { kind: "FILE", fileUrl: url.toString() };
  }

  return { kind: "UNKNOWN" };
}

/** Vrai si l'URL peut reellement etre lue par le lecteur. */
export function isPlayableVideo(raw: string | null | undefined): boolean {
  return parseVideoUrl(raw).kind !== "UNKNOWN";
}
