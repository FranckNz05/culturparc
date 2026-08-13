import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Les affiches et extraits video sont heberges ailleurs (TMDB, Cloudinary,
  // stockage objet). Sur Render le disque est ephemere : rien ne sert de
  // televerser dans le systeme de fichiers, tout passe par une URL.
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "**" },
    ],
  },

  async headers() {
    return [
      {
        // Le service worker ne doit jamais etre servi depuis un cache : sinon
        // une version obsolete continuerait de piloter l'application.
        source: "/sw.js",
        headers: [
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Service-Worker-Allowed", value: "/" },
        ],
      },
    ];
  },
};

export default nextConfig;
