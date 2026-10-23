// Testeissä käytettävät piirrokset.
import type { Viiva } from "./tyypit";

const viiva = (vari: string, sivellin: Viiva["sivellin"], pisteet: [number, number][]): Viiva => ({
  vari,
  koko: 0.022,
  sivellin,
  paine: false,
  pisteet: pisteet.map(([x, y], i) => [x, y, 0.5, i * 16]),
});

const ympyra = (cx: number, cy: number, r: number) =>
  Array.from({ length: 40 }, (_, i) => [cx + r * Math.cos((i / 39) * 2 * Math.PI), cy + r * Math.sin((i / 39) * 2 * Math.PI)] as [number, number]);

/** Oranssi hymiö: tussi, neonsilmät, sivellinsuu ja kumilla tehty rako reunassa. */
export const HYMIO: Viiva[] = [
  viiva("#F47226", "tussi", ympyra(0.5, 0.5, 0.35)),
  viiva("#3F86D1", "neon", ympyra(0.38, 0.4, 0.03)),
  viiva("#3F86D1", "neon", ympyra(0.62, 0.4, 0.03)),
  viiva("#F54653", "sivellin", Array.from({ length: 20 }, (_, i) => [0.35 + i * 0.016, 0.6 + Math.sin((i / 19) * Math.PI) * 0.1] as [number, number])),
  viiva("#000000", "kumi", [[0.1, 0.5], [0.2, 0.5], [0.3, 0.5]]),
];
