"use client";

import { useEffect } from "react";

/**
 * Enregistre le service worker.
 *
 * Rendu inoffensif en developpement : un worker actif y masquerait les
 * rechargements a chaud et donnerait l'impression que les modifications ne
 * partent pas. Il est meme desinscrit pour rattraper une installation faite
 * lors d'un passage en production sur la meme machine.
 */
export function ServiceWorkerRegistrar() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    if (process.env.NODE_ENV !== "production") {
      void navigator.serviceWorker
        .getRegistrations()
        .then((registrations) =>
          Promise.all(registrations.map((r) => r.unregister())),
        );
      return;
    }

    const register = () => {
      void navigator.serviceWorker.register("/sw.js", { scope: "/" });
    };

    // On attend la fin du chargement pour ne pas concurrencer l'affichage.
    if (document.readyState === "complete") register();
    else window.addEventListener("load", register, { once: true });
  }, []);

  return null;
}
