"use client";

import { useEffect, useState } from "react";

/**
 * Compte a rebours de la retenue des places.
 * Le calcul part de l'heure d'expiration envoyee par le serveur : l'horloge du
 * visiteur peut etre fausse, mais l'echeance, elle, ne l'est pas.
 */
export function CountdownNotice({ expiresAt }: { expiresAt: string }) {
  const deadline = new Date(expiresAt).getTime();
  const [remaining, setRemaining] = useState(() =>
    Math.max(0, deadline - Date.now()),
  );

  useEffect(() => {
    const timer = setInterval(() => {
      setRemaining(Math.max(0, deadline - Date.now()));
    }, 1000);
    return () => clearInterval(timer);
  }, [deadline]);

  const totalSeconds = Math.floor(remaining / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  const urgent = totalSeconds < 120;

  if (totalSeconds === 0) {
    return (
      <span className="text-sm text-danger" role="status">
        Delai ecoule
      </span>
    );
  }

  return (
    <span
      role="timer"
      aria-live="off"
      className={urgent ? "text-sm text-danger" : "text-sm text-ink-300"}
    >
      Places retenues encore {minutes}:{seconds.toString().padStart(2, "0")}
    </span>
  );
}
