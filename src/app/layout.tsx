import type { Metadata, Viewport } from "next";
import { Poppins } from "next/font/google";
import "./globals.css";

const poppins = Poppins({
  subsets: ["latin", "latin-ext"],
  weight: ["400", "600", "700"],
  variable: "--font-poppins",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Raapustamo – Lumo Art & Tech Festival",
  description: "Piirrä terveisesi Lumo Art & Tech Festivalin LED-screenille.",
  // Ei hakukoneisiin (myös next.config.ts:n X-Robots-Tag-otsake).
  robots: { index: false, follow: false, nocache: true },
};

export const viewport: Viewport = {
  themeColor: "#000000",
  colorScheme: "dark",
};

export default function Juuri({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fi" className={poppins.variable}>
      <body>{children}</body>
    </html>
  );
}
