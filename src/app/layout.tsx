import type { Metadata } from "next";
import { Outfit, Bebas_Neue } from "next/font/google";
import "./globals.css";

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
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="fr"
      className={`${outfit.variable} ${bebas.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-ink-950 text-ink-50">
        {children}
      </body>
    </html>
  );
}
