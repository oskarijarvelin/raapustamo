import type { Metadata } from "next";
import KeynoteLahetin from "@/components/keynote/KeynoteLahetin";
import { LAVA } from "@/lib/keynote";

export const metadata: Metadata = {
  title: "Keynote-lähetin – Raapustamo",
  robots: { index: false, follow: false },
};

type Parametrit = Record<string, string | string[] | undefined>;

/**
 * Keynote-lähetin kaappauskoneelle: esitysmateriaali kaappauslaitteelta tai ruudunjaosta keynote-editorin
 * taustaksi WebRTC:llä. Vaatii kirjautumisen (esiintyjät ja moderaattorit). ?lava=lava-1
 */
export default async function KeynoteLahetinsivu({ searchParams }: { searchParams: Promise<Parametrit> }) {
  const { lava } = await searchParams;
  const tunnus = typeof lava === "string" ? lava.toLowerCase() : "";
  return <KeynoteLahetin lava={LAVA.test(tunnus) ? tunnus : "lava-1"} />;
}
