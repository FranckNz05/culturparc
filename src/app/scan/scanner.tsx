"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { cn, formatTime } from "@/lib/utils";

interface ScanOutcome {
  result: string;
  title: string;
  detail: string;
  ticket?: {
    seatLabel: string;
    movieTitle: string;
    ticketTypeName: string;
    requiresProof: boolean;
    startsAt: string;
    auditoriumName: string;
    bookingReference: string;
  };
}

/**
 * L'API BarcodeDetector est disponible sur Chrome Android, la cible naturelle
 * pour un poste de controle. Ailleurs, la saisie manuelle prend le relais :
 * le controle ne doit jamais dependre d'une fonctionnalite optionnelle.
 */
interface BarcodeDetectorLike {
  detect(source: CanvasImageSource): Promise<{ rawValue: string }[]>;
}

declare global {
  interface Window {
    BarcodeDetector?: new (options?: { formats: string[] }) => BarcodeDetectorLike;
  }
}

const TONE: Record<string, string> = {
  OK: "border-success bg-success/10 text-success",
  ALREADY_SCANNED: "border-warning bg-warning/10 text-warning",
  TOO_EARLY: "border-warning bg-warning/10 text-warning",
  WRONG_SHOWTIME: "border-warning bg-warning/10 text-warning",
};

export function Scanner({ showtimeId }: { showtimeId?: string }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const busyRef = useRef(false);
  const lastCodeRef = useRef<{ code: string; at: number }>({ code: "", at: 0 });

  const [cameraOn, setCameraOn] = useState(false);
  const [supported, setSupported] = useState(true);
  const [outcome, setOutcome] = useState<ScanOutcome | null>(null);
  const [manualCode, setManualCode] = useState("");
  const [error, setError] = useState<string | null>(null);

  const submitCode = useCallback(
    async (code: string) => {
      if (busyRef.current) return;

      // Un QR reste dans le champ de la camera plusieurs images d'affilee :
      // sans ce garde, le meme billet part en boucle vers le serveur.
      const now = Date.now();
      if (lastCodeRef.current.code === code && now - lastCodeRef.current.at < 4000) {
        return;
      }
      lastCodeRef.current = { code, at: now };

      busyRef.current = true;
      setError(null);

      try {
        const response = await fetch("/api/scan", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ code, showtimeId }),
        });

        const data = await response.json();

        if (!response.ok) {
          setError(data.error ?? "Le controle a echoue.");
          setOutcome(null);
        } else {
          setOutcome(data as ScanOutcome);
          // Retour haptique : le controleur n'a pas toujours les yeux sur l'ecran.
          if (typeof navigator.vibrate === "function") {
            navigator.vibrate(data.result === "OK" ? 60 : [50, 60, 50]);
          }
        }
      } catch {
        setError("Reseau indisponible. Reessayez.");
      } finally {
        busyRef.current = false;
      }
    },
    [showtimeId],
  );

  // Boucle de detection sur le flux video.
  useEffect(() => {
    if (!cameraOn) return;

    const DetectorClass = window.BarcodeDetector;
    if (!DetectorClass) {
      setSupported(false);
      setCameraOn(false);
      return;
    }

    const detector = new DetectorClass({ formats: ["qr_code"] });
    let raf = 0;
    let stopped = false;

    async function tick() {
      if (stopped) return;
      const video = videoRef.current;

      if (video && video.readyState === video.HAVE_ENOUGH_DATA) {
        try {
          const codes = await detector.detect(video);
          if (codes.length > 0 && codes[0].rawValue) {
            await submitCode(codes[0].rawValue);
          }
        } catch {
          // Image illisible sur cette frame : on retentera a la suivante.
        }
      }

      raf = requestAnimationFrame(tick);
    }

    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: "environment" } })
      .then((stream) => {
        if (stopped) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          void videoRef.current.play();
        }
        raf = requestAnimationFrame(tick);
      })
      .catch(() => {
        setError("Camera inaccessible. Autorisez l'acces ou saisissez le code.");
        setCameraOn(false);
      });

    return () => {
      stopped = true;
      cancelAnimationFrame(raf);
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    };
  }, [cameraOn, submitCode]);

  return (
    <div className="space-y-6">
      {/* Resultat, en grand : c'est ce que le controleur regarde. */}
      {outcome && (
        <div
          role="status"
          aria-live="assertive"
          className={cn(
            "rounded-2xl border-2 p-6 text-center",
            TONE[outcome.result] ?? "border-danger bg-danger/10 text-danger",
          )}
        >
          <p className="font-display text-3xl">{outcome.title}</p>
          <p className="mt-2 text-sm opacity-90">{outcome.detail}</p>

          {outcome.ticket && (
            <div className="mt-4 space-y-1 border-t border-current/20 pt-4 text-sm text-ink-100">
              <p className="font-display text-2xl text-ink-50">
                {outcome.ticket.seatLabel}
              </p>
              <p>{outcome.ticket.movieTitle}</p>
              <p className="text-ink-300">
                {outcome.ticket.auditoriumName} &middot;{" "}
                {formatTime(new Date(outcome.ticket.startsAt))} &middot;{" "}
                {outcome.ticket.ticketTypeName}
              </p>
              {outcome.ticket.requiresProof && outcome.result === "OK" && (
                <p className="mt-2 rounded-lg bg-warning/15 px-3 py-2 text-warning">
                  Tarif reduit : demandez le justificatif.
                </p>
              )}
            </div>
          )}
        </div>
      )}

      {error && (
        <p
          role="alert"
          className="rounded-lg border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger"
        >
          {error}
        </p>
      )}

      {/* Camera */}
      <div className="overflow-hidden rounded-2xl border border-ink-700 bg-ink-900">
        {cameraOn ? (
          <div className="relative">
            <video
              ref={videoRef}
              muted
              playsInline
              className="aspect-4/3 w-full bg-black object-cover"
            />
            {/* Viseur */}
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <div className="h-40 w-40 rounded-xl border-2 border-brand-500/80" />
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-4 p-8 text-center">
            <p className="text-sm text-ink-300">
              {supported
                ? "Activez la camera pour scanner les billets."
                : "La lecture par camera n'est pas disponible sur ce navigateur. Utilisez la saisie manuelle."}
            </p>
            {supported && (
              <Button onClick={() => setCameraOn(true)}>Activer la camera</Button>
            )}
          </div>
        )}

        {cameraOn && (
          <div className="border-t border-ink-700 p-3">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setCameraOn(false)}
              className="w-full"
            >
              Arreter la camera
            </Button>
          </div>
        )}
      </div>

      {/* Saisie manuelle, toujours disponible */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (manualCode.trim()) {
            lastCodeRef.current = { code: "", at: 0 };
            void submitCode(manualCode.trim());
            setManualCode("");
          }
        }}
        className="space-y-2"
      >
        <label className="block text-sm font-medium text-ink-100">
          Saisie manuelle du code
        </label>
        <div className="flex gap-2">
          <input
            value={manualCode}
            onChange={(e) => setManualCode(e.target.value)}
            placeholder="CP1...."
            className="w-full rounded-lg border border-ink-600 bg-ink-850 px-3 py-2.5 font-mono text-sm text-ink-50 focus:border-brand-500 focus:outline-none"
          />
          <Button type="submit">Verifier</Button>
        </div>
      </form>
    </div>
  );
}
