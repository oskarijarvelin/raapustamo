// Generoidut piirrokset näytön demotilaan (`/naytto?demo=40`): kestotesti ja esittely ilman tietokantaa.
// Sama numero tuottaa aina saman piirroksen, joten testiajot ovat vertailukelpoisia.
import { KOOT, KUMIN_VARI, MUSTEET } from "./piirto";
import type { KokoId, NaytettavaPiirros, SivellinId, Viiva } from "./tyypit";

/** Pieni deterministinen satunnaislukugeneraattori (mulberry32) */
function satunnainen(siemen: number) {
  let a = siemen >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const SIVELLINJAKAUMA: SivellinId[] = ["tussi", "tussi", "tussi", "tussi", "sivellin", "sivellin", "neon", "neon", "kumi"];

/** Yksi demopiirros: 3–12 pehmeää viivaa paletin väreillä ja kaikilla siveltimillä. */
export function demopiirros(nro: number): NaytettavaPiirros {
  const r = satunnainen(nro * 7919 + 13);
  const viivat: Viiva[] = [];
  const viivoja = 3 + Math.floor(r() * 10);
  for (let v = 0; v < viivoja; v++) {
    const sivellin = SIVELLINJAKAUMA[Math.floor(r() * SIVELLINJAKAUMA.length)];
    const koko = (["s", "m", "l"] as KokoId[])[Math.floor(r() * 3)];
    const pisteita = 20 + Math.floor(r() * 100);
    let x = 0.2 + r() * 0.6;
    let y = 0.2 + r() * 0.6;
    let suunta = r() * Math.PI * 2;
    const pisteet: Viiva["pisteet"] = [];
    for (let i = 0; i < pisteita; i++) {
      suunta += (r() - 0.5) * 0.6;
      x = Math.min(0.95, Math.max(0.05, x + Math.cos(suunta) * 0.012));
      y = Math.min(0.95, Math.max(0.05, y + Math.sin(suunta) * 0.012));
      pisteet.push([+x.toFixed(4), +y.toFixed(4), 0.5, i * 16]);
    }
    viivat.push({
      vari: sivellin === "kumi" ? KUMIN_VARI : MUSTEET[Math.floor(r() * MUSTEET.length)].hex,
      koko: KOOT[koko],
      sivellin,
      paine: false,
      pisteet,
    });
  }
  return {
    id: `demo-${nro}`,
    nro,
    luotu: new Date(Date.UTC(2026, 10, 13, 12) + nro * 60_000).toISOString(),
    viivat,
    nostettu: nro % 9 === 0,
    nayttokerrat: 0,
    viimeksi_naytetty: null,
  };
}

export const demopiirrokset = (maara: number, alku = 1) => Array.from({ length: maara }, (_, i) => demopiirros(alku + i));
