import type { Metadata, Viewport } from "next";
import KeynoteEditori from "@/components/keynote/KeynoteEditori";
import { LAVA, lueSuhde } from "@/lib/keynote";
import type { Kieli } from "@/lib/tyypit";

export const metadata: Metadata = {
  title: "Keynote – Raapustamo",
  robots: { index: false, follow: false },
  // Kotivalikkoon lisättynä editori aukeaa iPadilla koko ruudulle ilman Safarin palkkeja.
  appleWebApp: { capable: true, title: "Keynote", statusBarStyle: "black-translucent" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: "#000000",
};

type Parametrit = Record<string, string | string[] | undefined>;
const teksti = (arvo: string | string[] | undefined) => (typeof arvo === "string" ? arvo : undefined);

/**
 * Keynote-puhujan piirtoeditori (iPad + Apple Pencil). Vaatii kirjautumisen (esiintyjät ja moderaattorit).
 * ?lava=lava-1 · ?suhde=16:9 (pakotettu kuvasuhde, oletuksena koko ruutu) · ?kieli=fi|en
 */
export default async function Keynotesivu({ searchParams }: { searchParams: Promise<Parametrit> }) {
  const p = await searchParams;
  const lava = teksti(p.lava)?.toLowerCase();
  const kieli = teksti(p.kieli);
  return (
    <KeynoteEditori
      lava={lava && LAVA.test(lava) ? lava : "lava-1"}
      suhde={lueSuhde(teksti(p.suhde))}
      kieli={kieli === "fi" || kieli === "en" ? (kieli as Kieli) : null}
    />
  );
}
