import type { Metadata, Viewport } from "next";
import { Outfit, Bebas_Neue, Fredoka } from "next/font/google";
import "./globals.css";
import { ServiceWorkerRegistrar } from "@/components/service-worker";

const outfit = Outfit({
  variable: "--font-outfit",
  subsets: ["latin"],
  display: "swap",
});

const bebas = Bebas_Neue({
  variable: "--font-bebas",
  subsets: ["latin"],
  weight: "400",
  display: "swap",
});

// Police ronde du logo Culture Parc.
const fredoka = Fredoka({
  variable: "--font-fredoka",
  subsets: ["latin"],
  weight: ["600", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"),
  title: {
    default: "Culture Parc - Cinema a Brazzaville et Pointe-Noire",
    template: "%s | Culture Parc",
  },
  description:
    "Reservez vos places de cinema en ligne chez Culture Parc. Films a l'affiche, horaires, choix de votre siege et paiement par Airtel Money ou MTN Mobile Money.",
  openGraph: {
    type: "website",
    locale: "fr_CG",
    siteName: "Culture Parc",
  },
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "Culture Parc",
    statusBarStyle: "black-translucent",
  },
  icons: {
    icon: [{ url: "/icons/favicon-32.png", sizes: "32x32", type: "image/png" }],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180" }],
  },
};

export const viewport: Viewport = {
  themeColor: "#f7941e",
  // La billetterie s'utilise surtout au telephone, souvent en marchant.
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="fr"
      className={`${outfit.variable} ${bebas.variable} ${fredoka.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-ink-950 text-ink-50">
        {children}
        <ServiceWorkerRegistrar />
      </body>
    </html>
  );
}
