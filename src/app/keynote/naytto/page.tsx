import type { Metadata } from "next";
import KeynoteNaytto from "@/components/keynote/KeynoteNaytto";
import { LAVA } from "@/lib/keynote";

export const metadata: Metadata = {
  title: "Keynote-näyttö – Raapustamo",
  robots: { index: false, follow: false },
};

type Parametrit = Record<string, string | string[] | undefined>;
const teksti = (arvo: string | string[] | undefined) => (typeof arvo === "string" ? arvo : undefined);

/**
 * Keynote-näyttö: esiintyjän piirros reaaliajassa koko ikkunan kokoisena (kuvasuhde editorista).
 * ?lava=lava-1 · ?tila=1 (yhteyden tila kulmassa) · ?lapinakyva=1 (läpinäkyvä tausta Resolumen layeriksi)
 */
export default async function KeynoteNayttosivu({ searchParams }: { searchParams: Promise<Parametrit> }) {
  const p = await searchParams;
  const lava = teksti(p.lava)?.toLowerCase();
  return (
    <KeynoteNaytto
      lava={lava && LAVA.test(lava) ? lava : "lava-1"}
      naytaTila={teksti(p.tila) === "1"}
      lapinakyva={teksti(p.lapinakyva) === "1"}
    />
  );
}
