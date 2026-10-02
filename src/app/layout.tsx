import type { Metadata, Viewport } from "next";
import { Cinzel, Roboto_Condensed } from "next/font/google";
import "./globals.css";

const roboto = Roboto_Condensed({ subsets: ["latin"], variable: "--font-roboto-condensed", display: "swap" });
const cinzel = Cinzel({ subsets: ["latin"], weight: ["400", "600", "700", "900"], variable: "--font-cinzel", display: "swap" });

export const metadata: Metadata = {
  title: { default: "Torneios · Reino Cobblemon", template: "%s · Reino Cobblemon" },
  description: "Torneios oficiais do Reino Cobblemon: inscrições, regras, premiação e chaves.",
};

export const viewport: Viewport = {
  themeColor: "#160b06",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className={`${roboto.variable} ${cinzel.variable}`}>
      <body className="font-sans antialiased">{children}</body>
    </html>
  );
}
