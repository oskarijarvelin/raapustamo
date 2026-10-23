// Keynote-piirto: esiintyjä piirtää iPadilla koko ruudun kokoiselle alustalle, ja piirros näkyy
// keynote-näytöllä reaaliajassa ilman moderointia. Kanavalle saavat lähettää vain kirjautuneet
// esiintyjät ja moderaattorit (supabase/migrations/0003_keynote.sql).
//
// Viivojen x ja y on normalisoitu alustan leveyteen kuten piirtonäkymässä, joten samat
// renderöintifunktiot (lib/piirto.ts) toimivat. Alustan korkeus on silloin 1 / suhde.
import type { KokoId, Piste, Viiva } from "./tyypit";

export const LAVA = /^[a-z0-9-]{1,30}$/;

/** Realtime-kanavan nimi. Migraation politiikat koskevat vain `keynote:`-alkuisia kanavia. */
export const lavanKanava = (lava: string) => `keynote:${lava}`;

/** Keynote-näytön syke näkyy moderoinnissa ja editorissa tällä tunnuksella. */
export const lavanNaytto = (lava: string) => `keynote-${lava}`;

// Koot suhteessa alustan leveyteen. Alusta on koko screen eikä yksi piirros, joten viivat ovat
// ohuempia kuin piirtonäkymässä: 0.004 × 1920 px ≈ 8 px, × 4032 px ≈ 16 px.
export const LAVAN_KOOT: Record<KokoId, number> = { s: 0.004, m: 0.008, l: 0.018 };

export const OLETUSSUHDE = 16 / 9;

export const sallittuSuhde = (suhde: number) => (Number.isFinite(suhde) ? Math.min(8, Math.max(0.25, suhde)) : OLETUSSUHDE);

/** `?suhde=16:9`, `?suhde=3.5` tai `?suhde=4032x1152` → leveys / korkeus, muuten null. */
export function lueSuhde(arvo: string | undefined): number | null {
  const osat = arvo?.match(/^(\d+(?:\.\d+)?)(?:[:x/](\d+(?:\.\d+)?))?$/);
  if (!osat) return null;
  const suhde = Number(osat[1]) / (osat[2] ? Number(osat[2]) : 1);
  return Number.isFinite(suhde) && suhde >= 0.25 && suhde <= 8 ? suhde : null;
}

export interface LavanViiva extends Viiva {
  id: string;
}

/**
 * Editorin viestit näytölle. Valmiit muutokset kasvattavat versiota yhdellä, jotta näyttö
 * huomaa kadonneet viestit ja hakee silloin tallennetun tilan.
 */
export type KeynoteViesti =
  | { tyyppi: "alku"; viiva: LavanViiva }
  /** `alku` = monesko piste viivassa on `pisteet[0]` */
  | { tyyppi: "jatko"; id: string; alku: number; pisteet: Piste[] }
  | { tyyppi: "valmis"; versio: number; viiva: LavanViiva }
  | { tyyppi: "poista"; versio: number; id: string }
  | { tyyppi: "tyhjenna"; versio: number; suhde: number }
  | { tyyppi: "nakyvyys"; versio: number; nakyvissa: boolean }
  /** Muutos on liian iso viestiksi (esim. tyhjennyksen kumoaminen): hae tallennettu tila. */
  | { tyyppi: "synkkaa"; versio: number };

/** Tietokannan `lavat`-rivi */
export interface TallennettuLava {
  tunnus: string;
  viivat: LavanViiva[];
  suhde: number;
  versio: number;
  nakyvissa: boolean;
}

export interface LavanTila {
  versio: number;
  viivat: LavanViiva[];
  /** Kesken olevat viivat, jotka piirtyvät näytölle sitä mukaa kuin esiintyjä piirtää */
  kesken: Map<string, LavanViiva>;
  nakyvissa: boolean;
  suhde: number;
}

export const tyhjaLava = (suhde = OLETUSSUHDE): LavanTila => ({ versio: 0, viivat: [], kesken: new Map(), nakyvissa: true, suhde });

/**
 * Mitä näytön pitää piirtää uudelleen viestin jälkeen:
 * kesken = vain keskeneräisten kerros, lisatty = viimeinen valmis viiva, kaikki = koko alusta.
 */
export type Piirrettava = "ei" | "kesken" | "lisatty" | "kaikki" | "nakyvyys";

export interface Kasittely {
  piirra: Piirrettava;
  /** Versioista puuttuu välistä: näytön pitää hakea tallennettu tila. */
  synkkaa: boolean;
}

/** Päivittää näytön tilan editorin viestillä (muuttaa `tila`a). */
export function kasitteleViesti(tila: LavanTila, viesti: KeynoteViesti): Kasittely {
  switch (viesti.tyyppi) {
    case "alku": {
      if (tila.viivat.some((v) => v.id === viesti.viiva.id)) return { piirra: "ei", synkkaa: false };
      tila.kesken.set(viesti.viiva.id, { ...viesti.viiva, pisteet: [...viesti.viiva.pisteet] });
      return { piirra: "kesken", synkkaa: false };
    }
    case "jatko": {
      // Jos alku jäi saamatta, viiva piirtyy kokonaan vasta valmis-viestistä.
      const viiva = tila.kesken.get(viesti.id);
      if (!viiva) return { piirra: "ei", synkkaa: false };
      const paallekkain = viiva.pisteet.length - viesti.alku;
      viiva.pisteet.push(...(paallekkain > 0 ? viesti.pisteet.slice(paallekkain) : viesti.pisteet));
      return { piirra: "kesken", synkkaa: false };
    }
    case "synkkaa":
      return { piirra: "ei", synkkaa: viesti.versio > tila.versio };
  }

  // Valmiit muutokset: vanhat ja jo tallennetusta tilasta saadut ohitetaan, jottei esimerkiksi
  // myöhässä tullut poisto poista uudelleen palautettua viivaa.
  if (viesti.versio <= tila.versio) {
    if (viesti.tyyppi === "valmis" && tila.kesken.delete(viesti.viiva.id)) return { piirra: "kesken", synkkaa: false };
    return { piirra: "ei", synkkaa: false };
  }
  const synkkaa = viesti.versio !== tila.versio + 1;
  tila.versio = viesti.versio;

  switch (viesti.tyyppi) {
    case "valmis": {
      tila.kesken.delete(viesti.viiva.id);
      const i = tila.viivat.findIndex((v) => v.id === viesti.viiva.id);
      if (i < 0) {
        tila.viivat.push(viesti.viiva);
        return { piirra: "lisatty", synkkaa };
      }
      tila.viivat[i] = viesti.viiva;
      return { piirra: "kaikki", synkkaa };
    }
    case "poista":
      tila.kesken.delete(viesti.id);
      tila.viivat = tila.viivat.filter((v) => v.id !== viesti.id);
      return { piirra: "kaikki", synkkaa };
    case "tyhjenna":
      tila.viivat = [];
      tila.kesken.clear();
      tila.suhde = sallittuSuhde(viesti.suhde);
      return { piirra: "kaikki", synkkaa };
    case "nakyvyys":
      tila.nakyvissa = viesti.nakyvissa;
      return { piirra: "nakyvyys", synkkaa };
  }
}

/** Ottaa tallennetun tilan käyttöön, jos se on vähintään yhtä tuore. Palauttaa true, jos tila vaihtui. */
export function yhdistaTallennettu(tila: LavanTila, rivi: TallennettuLava): boolean {
  if (rivi.versio < tila.versio) return false;
  tila.versio = rivi.versio;
  tila.viivat = Array.isArray(rivi.viivat) ? rivi.viivat : [];
  tila.nakyvissa = rivi.nakyvissa;
  tila.suhde = sallittuSuhde(rivi.suhde);
  for (const v of tila.viivat) tila.kesken.delete(v.id);
  return true;
}

/** Lyhyt satunnainen tunniste viivalle (ainutlaatuinen lavan sisällä). */
export const viivanId = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);

/** Asettaa canvasin pikselikoon CSS-koon ja näytön tarkkuuden mukaan; palauttaa leveyden pikseleinä. */
export function sovitaAlusta(canvas: HTMLCanvasElement, leveys: number, korkeus: number, dpr = window.devicePixelRatio || 1) {
  const l = Math.round(leveys * dpr);
  const k = Math.round(korkeus * dpr);
  if (canvas.width !== l || canvas.height !== k) {
    canvas.width = l;
    canvas.height = k;
  }
  return l;
}

/** Suurin `suhde`-muotoinen alue, joka mahtuu annettuun tilaan (letterbox). */
export function sovitaSuhteeseen(leveys: number, korkeus: number, suhde: number) {
  const l = Math.min(leveys, korkeus * suhde);
  return { leveys: l, korkeus: l / suhde };
}
