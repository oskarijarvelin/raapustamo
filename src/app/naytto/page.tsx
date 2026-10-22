import type { Metadata } from "next";
import Naytto, { type Layout } from "@/components/naytto/Naytto";

export const metadata: Metadata = {
  title: "Näyttö – Raapustamo",
  robots: { index: false, follow: false },
};

type Parametrit = Record<string, string | string[] | undefined>;
const teksti = (arvo: string | string[] | undefined) => (typeof arvo === "string" ? arvo : undefined);

/**
 * LED-screenin näkymä. Parametrit:
 * ?layout=trio|solo|seina · ?vaihto=12 (s) · ?qr=0 · ?osoite=raapustamo.fi · ?qr-url=… · ?skaala=1
 */
export default async function Nayttosivu({ searchParams }: { searchParams: Promise<Parametrit> }) {
  const p = await searchParams;
  const layout = teksti(p.layout);
  const vaihto = Number(teksti(p.vaihto));
  const skaala = Number(teksti(p.skaala));
  return (
    <Naytto
      layout={layout === "solo" || layout === "seina" ? (layout as Layout) : "trio"}
      vaihtoS={Number.isFinite(vaihto) && vaihto >= 4 ? vaihto : 12}
      naytaQr={teksti(p.qr) !== "0"}
      qrUrl={teksti(p["qr-url"]) ?? null}
      osoite={teksti(p.osoite) ?? "raapustamo.fi"}
      skaala={Number.isFinite(skaala) && skaala > 0 ? skaala : null}
    />
  );
}
