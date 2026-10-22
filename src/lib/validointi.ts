// Lähetetyn piirroksen tarkistus palvelimella. Kaikki selaimelta tuleva data on
// epäluotettavaa: rakenne, värit, koot ja määrät tarkistetaan ja numerot pyöristetään.
import { KOOT, SALLITUT_VARIT, SIVELTIMET } from "./piirto";
import type { Kieli, Piste, SivellinId, Viiva } from "./tyypit";

export const RAJAT = {
  viivoja: 400,
  pisteitaViivassa: 2000,
  pisteitaYhteensa: 20000,
  /** Vähintään näin monta pistettä muuta kuin kumia, ettei tyhjää piirrosta voi lähettää. */
  pisteitaVahintaan: 8,
} as const;

const SALLITUT_KOOT = new Set(Object.values(KOOT));
const LAHDE = /^(mobiili|ipad-[1-9][0-9]?)$/;

export interface Lahetys {
  viivat: Viiva[];
  lahde: string;
  kieli: Kieli;
}

export type Tulos = { ok: true; lahetys: Lahetys } | { ok: false; virhe: string };

const pyorista = (n: number, desimaalit: number) => Math.round(n * 10 ** desimaalit) / 10 ** desimaalit;
const onLuku = (n: unknown): n is number => typeof n === "number" && Number.isFinite(n);

function tarkistaPiste(p: unknown): Piste | null {
  if (!Array.isArray(p) || p.length !== 4 || !p.every(onLuku)) return null;
  const [x, y, paine, t] = p as number[];
  if (x < 0 || x > 1 || y < 0 || y > 1 || paine < 0 || paine > 1 || t < 0 || t > 600_000) return null;
  return [pyorista(x, 4), pyorista(y, 4), pyorista(paine, 3), Math.round(t)];
}

function tarkistaViiva(v: unknown): Viiva | string {
  if (typeof v !== "object" || v === null) return "viiva ei ole objekti";
  const { vari, koko, sivellin, paine, pisteet } = v as Record<string, unknown>;
  if (typeof sivellin !== "string" || !(sivellin in SIVELTIMET)) return "tuntematon sivellin";
  if (typeof vari !== "string" || !SALLITUT_VARIT.has(vari.toUpperCase())) return "väri ei ole paletissa";
  if (!onLuku(koko) || !SALLITUT_KOOT.has(koko)) return "tuntematon koko";
  if (typeof paine !== "boolean") return "paine puuttuu";
  if (!Array.isArray(pisteet) || pisteet.length === 0 || pisteet.length > RAJAT.pisteitaViivassa) return "virheellinen pistemäärä";
  const puhtaat: Piste[] = [];
  for (const p of pisteet) {
    const puhdas = tarkistaPiste(p);
    if (!puhdas) return "virheellinen piste";
    puhtaat.push(puhdas);
  }
  return { vari: vari.toUpperCase(), koko, sivellin: sivellin as SivellinId, paine, pisteet: puhtaat };
}

/** Tarkistaa ja siistii lähetyksen. Palauttaa vain tunnetut kentät. */
export function tarkistaLahetys(data: unknown): Tulos {
  if (typeof data !== "object" || data === null) return { ok: false, virhe: "pyyntö ei ole objekti" };
  const { viivat, lahde, kieli } = data as Record<string, unknown>;

  if (!Array.isArray(viivat) || viivat.length === 0) return { ok: false, virhe: "piirros on tyhjä" };
  if (viivat.length > RAJAT.viivoja) return { ok: false, virhe: "liikaa viivoja" };
  if (typeof lahde !== "string" || !LAHDE.test(lahde)) return { ok: false, virhe: "tuntematon lähde" };
  if (kieli !== "fi" && kieli !== "en") return { ok: false, virhe: "tuntematon kieli" };

  const puhtaat: Viiva[] = [];
  let yhteensa = 0;
  let nakyvia = 0;
  for (const v of viivat) {
    const tulos = tarkistaViiva(v);
    if (typeof tulos === "string") return { ok: false, virhe: tulos };
    yhteensa += tulos.pisteet.length;
    if (tulos.sivellin !== "kumi") nakyvia += tulos.pisteet.length;
    puhtaat.push(tulos);
  }
  if (yhteensa > RAJAT.pisteitaYhteensa) return { ok: false, virhe: "liikaa pisteitä" };
  if (nakyvia < RAJAT.pisteitaVahintaan) return { ok: false, virhe: "piirros on tyhjä" };

  return { ok: true, lahetys: { viivat: puhtaat, lahde, kieli } };
}
