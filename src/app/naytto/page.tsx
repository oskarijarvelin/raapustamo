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
 * ?layout=avaruus|trio|solo|seina · ?vaihto=12 (s) · ?maara=6 (avaruus) · ?qr=0 · ?osoite=raapustamo.fi · ?qr-url=… · ?skaala=1
 * ?tunnus=led-1 (syke moderointiin) · ?uudelleenlataus=240 (min, 0 = pois)
 * ?silta=http://localhost:7400 (Resolume-silta, ks. silta/README.md)
 */
export default async function Nayttosivu({ searchParams }: { searchParams: Promise<Parametrit> }) {
  const p = await searchParams;
  const layout = teksti(p.layout);
  const vaihto = Number(teksti(p.vaihto));
  const maara = Number(teksti(p.maara));
  const skaala = Number(teksti(p.skaala));
  const tunnus = teksti(p.tunnus)?.toLowerCase();
  const uudelleenlataus = Number(teksti(p.uudelleenlataus));
  const silta = teksti(p.silta);
  return (
    <Naytto
      layout={layout === "trio" || layout === "solo" || layout === "seina" ? (layout as Layout) : "avaruus"}
      vaihtoS={Number.isFinite(vaihto) && vaihto >= 4 ? vaihto : 12}
      maara={Number.isInteger(maara) && maara >= 2 && maara <= 12 ? maara : 6}
      naytaQr={teksti(p.qr) !== "0"}
      qrUrl={teksti(p["qr-url"]) ?? null}
      osoite={teksti(p.osoite) ?? "raapustamo.fi"}
      skaala={Number.isFinite(skaala) && skaala > 0 ? skaala : null}
      tunnus={tunnus && /^[a-z0-9-]{1,40}$/.test(tunnus) ? tunnus : "led-1"}
      uudelleenlatausMin={Number.isFinite(uudelleenlataus) && uudelleenlataus >= 30 ? uudelleenlataus : 0}
      siltaUrl={silta && /^https?:\/\/[^\s]+$/.test(silta) ? silta : null}
    />
  );
}
