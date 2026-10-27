// Aloitussivun avaruustaustan piirrokset: käsin piirretyn näköisiä avaruusaiheisia raapustuksia
// paletin väreillä. Kiinteät, jottei julkinen sivu näytä kävijöiden piirroksia.
import { KOOT } from "./piirto";
import type { SivellinId, Viiva } from "./tyypit";

type Piste = [number, number];

/** Pieni deterministinen huojunta, jotta muodot näyttävät käsin piirretyiltä. */
function kasin(pisteet: Piste[], siemen: number): Viiva["pisteet"] {
  return pisteet.map(([x, y], i) => [
    +(x + 0.006 * Math.sin(i * 0.7 + siemen)).toFixed(4),
    +(y + 0.006 * Math.cos(i * 0.9 + siemen * 1.3)).toFixed(4),
    0.5,
    i * 16,
  ]);
}

const viiva = (vari: string, sivellin: SivellinId, koko: number, pisteet: Piste[], siemen = 0): Viiva => ({
  vari,
  koko,
  sivellin,
  paine: false,
  pisteet: kasin(pisteet, siemen),
});

/** Ellipsi kaarena kulmasta `a0` kulmaan `a1` (radiaaneina), kallistettuna kulmalla `kallistus`. */
function kaari(cx: number, cy: number, rx: number, ry: number, a0 = 0, a1 = Math.PI * 2, kallistus = 0, n = 48): Piste[] {
  const c = Math.cos(kallistus);
  const s = Math.sin(kallistus);
  return Array.from({ length: n }, (_, i) => {
    const a = a0 + ((a1 - a0) * i) / (n - 1);
    const x = Math.cos(a) * rx;
    const y = Math.sin(a) * ry;
    return [cx + x * c - y * s, cy + x * s + y * c];
  });
}

/** Murtoviiva, jonka jokainen väli jaetaan osiin, jotta siveltimen pehmennys ei pyöristä kulmia pois. */
const murto = (kulmat: Piste[], osia = 6): Piste[] =>
  kulmat.flatMap(([x, y], i) => {
    if (i === kulmat.length - 1) return [[x, y] as Piste];
    const [nx, ny] = kulmat[i + 1];
    return Array.from({ length: osia }, (_, j) => [x + ((nx - x) * j) / osia, y + ((ny - y) * j) / osia] as Piste);
  });

const tahdenKulmat = (cx: number, cy: number, r: number): Piste[] =>
  Array.from({ length: 11 }, (_, i) => {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const sade = i % 2 ? r * 0.42 : r;
    return [cx + Math.cos(a) * sade, cy + Math.sin(a) * sade];
  });

const sydan = (cx: number, cy: number, r: number): Piste[] =>
  Array.from({ length: 56 }, (_, i) => {
    const t = (i / 55) * Math.PI * 2;
    return [cx + r * Math.sin(t) ** 3, cy - (r * (13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t))) / 16];
  });

const { s, m, l } = KOOT;

const PIIRROKSET: Viiva[][] = [
  // Rengasplaneetta
  [
    viiva("#F47226", "tussi", l, kaari(0.5, 0.5, 0.24, 0.24), 1),
    viiva("#D6D4CA", "sivellin", m, kaari(0.5, 0.5, 0.42, 0.11, 0, Math.PI * 2, -0.35, 60), 2),
  ],
  // Tähti
  [viiva("#FFFFFF", "neon", m, murto(tahdenKulmat(0.5, 0.52, 0.4)), 3)],
  // Sydän
  [viiva("#F54653", "tussi", l, sydan(0.5, 0.44, 0.36), 4)],
  // Hymiö
  [
    viiva("#3F86D1", "tussi", m, kaari(0.5, 0.5, 0.36, 0.36), 5),
    viiva("#3F86D1", "tussi", l, kaari(0.38, 0.4, 0.025, 0.025, 0, Math.PI * 2, 0, 12), 6),
    viiva("#3F86D1", "tussi", l, kaari(0.62, 0.4, 0.025, 0.025, 0, Math.PI * 2, 0, 12), 7),
    viiva("#3F86D1", "sivellin", l, kaari(0.5, 0.52, 0.18, 0.14, 0.2, Math.PI - 0.2, 0, 24), 8),
  ],
  // Kuunsirppi
  [
    viiva(
      "#D6D4CA",
      "sivellin",
      l,
      [...kaari(0.5, 0.5, 0.34, 0.34, -Math.PI * 0.62, Math.PI * 0.62, 0, 40).reverse(), ...kaari(0.6, 0.5, 0.26, 0.29, Math.PI * 0.58, -Math.PI * 0.58, 0, 32)],
      9,
    ),
  ],
  // Raketti
  [
    viiva("#FFFFFF", "tussi", m, murto([[0.5, 0.1], [0.64, 0.32], [0.64, 0.64], [0.36, 0.64], [0.36, 0.32], [0.5, 0.1]]), 10),
    viiva("#3F86D1", "neon", m, kaari(0.5, 0.38, 0.06, 0.06, 0, Math.PI * 2, 0, 20), 11),
    viiva("#FFFFFF", "tussi", m, murto([[0.36, 0.5], [0.26, 0.68], [0.36, 0.64]], 4), 12),
    viiva("#FFFFFF", "tussi", m, murto([[0.64, 0.5], [0.74, 0.68], [0.64, 0.64]], 4), 13),
    viiva("#F47226", "neon", m, murto([[0.42, 0.7], [0.46, 0.84], [0.5, 0.74], [0.54, 0.9], [0.58, 0.7]], 4), 14),
  ],
  // Komeetta
  [
    viiva("#CE8DA7", "tussi", l, kaari(0.68, 0.32, 0.08, 0.08, 0, Math.PI * 2, 0, 20), 15),
    viiva("#CE8DA7", "sivellin", m, murto([[0.62, 0.38], [0.2, 0.8]], 10), 16),
    viiva("#CE8DA7", "sivellin", s, murto([[0.6, 0.3], [0.24, 0.62]], 10), 17),
    viiva("#CE8DA7", "sivellin", s, murto([[0.7, 0.4], [0.4, 0.86]], 10), 18),
  ],
  // Spiraaligalaksi
  [
    viiva(
      "#3E9E6A",
      "neon",
      m,
      Array.from({ length: 80 }, (_, i) => {
        const a = (i / 79) * Math.PI * 5;
        const r = 0.02 + (i / 79) * 0.36;
        return [0.5 + Math.cos(a) * r, 0.5 + Math.sin(a) * r * 0.8] as Piste;
      }),
      19,
    ),
  ],
];

export const TAUSTAPIIRROKSET = PIIRROKSET.map((viivat) => ({ viivat }));
